// Notion adapter.
//
// Notion's API refuses cross-origin browser calls, so every request goes
// through the bundled server's /api/notion proxy, which adds the token
// server-side. The token therefore never has to live in the phone's storage
// if you keep it in the server's environment instead.

import { buildBundle } from './bundle.js';
import { formatElapsed, formatDurationWords, formatDateTime } from '../util/time.js';
import { apiFetch } from '../util/api.js';

export const id = 'notion';
export const label = 'Notion';

export const configFields = [
  { key: 'proxyUrl', label: 'Server URL', placeholder: 'http://192.168.1.20:8787', hint: 'Where `npm start` is running. Notion blocks direct browser calls, so requests go through it.' },
  { key: 'recipeDatabaseId', label: 'Recipe database ID', placeholder: '1f2e3d4c...', hint: 'The 32-character id in your recipe database URL.' },
  { key: 'logDatabaseId', label: 'Cook log database ID', optional: true, hint: 'Optional. Leave blank to file each log as a child page of the recipe itself.' },
  { key: 'token', label: 'Integration token', type: 'password', optional: true, hint: 'Optional if the server already has NOTION_TOKEN set — which is the safer place for it.' },
];

export function defaults() {
  return { proxyUrl: '', recipeDatabaseId: '', logDatabaseId: '', token: '' };
}

export function isConfigured(config) {
  return Boolean(config?.proxyUrl && config?.recipeDatabaseId);
}

function call(config, path, body) {
  if (!config.proxyUrl) throw new Error('No server URL configured for Notion.');
  return apiFetch(config.proxyUrl, `/notion${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.token ? { 'x-notion-token': config.token } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
}

export async function probe(config) {
  return call(config, '/status', { databaseId: config.recipeDatabaseId });
}

/** Read the title of a page regardless of what the title property is named. */
function pageTitle(page) {
  const props = page.properties || {};
  for (const value of Object.values(props)) {
    if (value?.type === 'title') {
      return value.title.map((t) => t.plain_text).join('').trim() || 'Untitled';
    }
  }
  return 'Untitled';
}

export async function searchRecipes(query, config) {
  const { results = [] } = await call(config, '/search-recipes', {
    databaseId: config.recipeDatabaseId,
    query: (query || '').trim(),
  });
  return results.map((page) => ({
    id: page.id,
    sourceId: id,
    title: pageTitle(page),
    url: page.url,
  }));
}

/* ---- publishing -------------------------------------------------------- */

const ICON = { voice: '🎙', photo: '📷', text: '📝', marker: '🔖' };

function richText(text, annotations) {
  // Notion caps a single rich_text item at 2000 characters.
  const chunks = [];
  let rest = String(text ?? '');
  if (!rest) return [];
  while (rest.length > 0) {
    chunks.push(rest.slice(0, 1900));
    rest = rest.slice(1900);
  }
  return chunks.map((content) => ({ type: 'text', text: { content }, ...(annotations ? { annotations } : {}) }));
}

/** Turn the timeline into Notion blocks. Images are attached separately. */
export function buildBlocks(session, events) {
  const duration = (session.endedAt || Date.now()) - session.startedAt;
  const blocks = [];

  blocks.push({
    object: 'block', type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji: '🍳' },
      rich_text: richText(`${formatDateTime(session.startedAt)} · ${formatDurationWords(duration)}${session.rating ? ' · ' + '★'.repeat(session.rating) : ''}`),
    },
  });

  if (session.notes?.trim()) {
    blocks.push(heading('Notes for next time'));
    blocks.push(paragraph(session.notes.trim()));
  }

  blocks.push(heading('Timeline'));

  for (const ev of [...events].sort((a, b) => a.elapsedMs - b.elapsedMs)) {
    const stamp = formatElapsed(ev.elapsedMs);
    const icon = ICON[ev.type] || '•';
    const body = (ev.text || '').trim();

    if (ev.type === 'photo') {
      blocks.push({
        object: 'block', type: 'paragraph',
        paragraph: {
          rich_text: [
            ...richText(`${stamp}  `, { code: true }),
            ...richText(`${icon} ${body}`.trim()),
          ],
        },
      });
      if (ev.uploadId) {
        blocks.push({
          object: 'block', type: 'image',
          image: { type: 'file_upload', file_upload: { id: ev.uploadId } },
        });
      }
    } else {
      blocks.push({
        object: 'block', type: 'paragraph',
        paragraph: {
          rich_text: [
            ...richText(`${stamp}  `, { code: true }),
            ...richText(`${icon} ${body || '(no transcript)'}`),
          ],
        },
      });
    }
  }
  return blocks;
}

const heading = (text) => ({ object: 'block', type: 'heading_2', heading_2: { rich_text: richText(text) } });
const paragraph = (text) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: richText(text) } });

export async function publish(session, events, config) {
  if (!isConfigured(config)) {
    return { ok: false, message: 'Set the server URL and recipe database ID in Settings first.' };
  }

  const bundle = await buildBundle(session, events, { style: 'plain' });
  const warnings = [];

  // Upload photos first so the blocks can reference them. Notion's file upload
  // is a two-step handshake, both legs handled by the proxy.
  const uploads = new Map();
  for (const attachment of bundle.attachments) {
    if (!attachment.name.endsWith('.jpg')) continue;
    try {
      const { id: uploadId } = await call(config, '/upload', {
        filename: attachment.name,
        contentType: attachment.blob.type || 'image/jpeg',
        base64: await blobToBase64(attachment.blob),
      });
      uploads.set(attachment.name, uploadId);
    } catch (err) {
      warnings.push(`Photo ${attachment.name} could not be uploaded (${err.message}). It is still in the local bundle.`);
    }
  }

  const decorated = bundle.events.map((ev) =>
    ev.attachment && uploads.has(ev.attachment) ? { ...ev, uploadId: uploads.get(ev.attachment) } : ev,
  );

  const title = `${session.recipeTitle || 'Freestyle cook'} — cook log`;
  const parent = config.logDatabaseId
    ? { database_id: config.logDatabaseId }
    : session.recipeRef?.sourceId === id && session.recipeRef.id
      ? { page_id: session.recipeRef.id }
      : { database_id: config.recipeDatabaseId };

  try {
    const page = await call(config, '/create-log', {
      parent,
      title,
      blocks: buildBlocks(session, decorated),
      recipeUrl: session.recipeRef?.url || null,
      startedAt: new Date(session.startedAt).toISOString(),
    });
    return {
      ok: true,
      message: warnings.length ? `Saved to Notion, with ${warnings.length} warning(s).` : 'Saved to Notion.',
      url: page.url,
      warnings,
    };
  } catch (err) {
    return { ok: false, message: err.message, warnings };
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
