// Obsidian adapter.
//
// A vault is just a folder of Markdown, so there are three ways in and the
// adapter picks the best one available, in this order:
//
//   1. Vault bridge  — the bundled Node server running on a machine that can
//                      see the vault folder. Reads recipes, writes logs. Best.
//   2. File System Access — desktop Chrome can hold a directory handle and
//                      write straight into the vault, no server needed.
//   3. Bundle export — a .zip (note + attachments) via download or the Android
//                      share sheet, plus an `obsidian://` link that drops the
//                      note straight into the vault. Always available.

import { buildBundle, zipBundle } from './bundle.js';
import { settings, put, getAll } from '../db.js';
import { apiFetch } from '../util/api.js';

const HANDLE_KEY = 'obsidian.vaultHandle';

export const id = 'obsidian';
export const label = 'Obsidian';

export const configFields = [
  { key: 'vaultName', label: 'Vault name', placeholder: 'Sous Chef', hint: 'Exactly as it appears in Obsidian — used for obsidian:// links.' },
  { key: 'recipesFolder', label: 'Recipes folder', placeholder: 'Recipes', hint: 'Where your recipe notes live, relative to the vault root.' },
  { key: 'logsFolder', label: 'Cook logs folder', placeholder: 'Recipes/Cook Logs', hint: 'Where new cook logs get written.' },
  { key: 'attachmentsFolder', label: 'Attachments folder', placeholder: 'attachments', hint: 'Photos and audio go in a per-session subfolder here.' },
  { key: 'bridgeUrl', label: 'Vault bridge URL', placeholder: 'http://192.168.1.20:8787', optional: true, hint: 'Optional. Run `npm start` on the machine holding your vault and put its address here for direct read/write.' },
];

export function defaults() {
  return { vaultName: '', recipesFolder: 'Recipes', logsFolder: 'Recipes/Cook Logs', attachmentsFolder: 'attachments', bridgeUrl: '' };
}

export function isConfigured() {
  // Export-by-zip works with nothing configured at all; a vault name only makes
  // the obsidian:// hand-off possible.
  return true;
}

/* ---- capability probing ------------------------------------------------ */

export function canUseFsAccess() {
  return typeof globalThis.showDirectoryPicker === 'function';
}

export async function pickVaultFolder() {
  if (!canUseFsAccess()) throw new Error('This browser cannot open a folder directly. Use the vault bridge or zip export instead.');
  const handle = await showDirectoryPicker({ id: 'sous-vault', mode: 'readwrite' });
  await settings.set(HANDLE_KEY, handle);
  return handle;
}

export async function storedVaultHandle() {
  const handle = await settings.get(HANDLE_KEY);
  if (!handle) return null;
  const perm = await handle.queryPermission?.({ mode: 'readwrite' });
  if (perm === 'granted') return handle;
  return { needsPermission: true, handle };
}

async function requestHandle() {
  const stored = await storedVaultHandle();
  if (!stored) return null;
  if (stored.needsPermission) {
    const granted = await stored.handle.requestPermission({ mode: 'readwrite' });
    return granted === 'granted' ? stored.handle : null;
  }
  return stored;
}

function bridgeFetch(config, path, init) {
  if (!config.bridgeUrl) throw new Error('No vault bridge configured.');
  return apiFetch(config.bridgeUrl, `/vault${path}`, init);
}

export async function probe(config) {
  const modes = [];
  if (config.bridgeUrl) {
    try {
      const info = await bridgeFetch(config, '/status');
      if (info.ok) modes.push({ mode: 'bridge', detail: info.vaultPath });
    } catch (err) {
      modes.push({ mode: 'bridge', error: err.message });
    }
  }
  const handle = await storedVaultHandle();
  if (handle) modes.push({ mode: 'fsaccess', detail: (handle.handle || handle).name });
  modes.push({ mode: 'export' });
  return modes;
}

/* ---- recipes ----------------------------------------------------------- */

/**
 * Recipes come from whichever channel is live. The zip-export path has no way
 * to read the vault, so it falls back to the locally cached index — which the
 * user fills by importing .md files once.
 */
export async function searchRecipes(query, config) {
  const q = (query || '').trim().toLowerCase();

  if (config.bridgeUrl) {
    try {
      const { recipes } = await bridgeFetch(config, `/recipes?q=${encodeURIComponent(q)}&folder=${encodeURIComponent(config.recipesFolder || '')}`);
      return recipes.map((r) => ({ ...r, sourceId: id }));
    } catch { /* fall through to other channels */ }
  }

  const handle = await requestHandle();
  if (handle) {
    const found = await scanDirectory(handle, config.recipesFolder || '', q);
    if (found.length || q) return found;
  }

  const cached = await getAll('recipes');
  return cached
    .filter((r) => r.sourceId === id && (!q || r.title.toLowerCase().includes(q)))
    .slice(0, 50);
}

async function resolveFolder(root, path) {
  let dir = root;
  for (const part of String(path || '').split('/').filter(Boolean)) {
    dir = await dir.getDirectoryHandle(part);
  }
  return dir;
}

async function scanDirectory(root, folder, q, depth = 0) {
  const out = [];
  let dir;
  try {
    dir = await resolveFolder(root, folder);
  } catch {
    return out;
  }
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind === 'directory' && depth < 3) {
      out.push(...(await scanDirectory(entry, '', q, depth + 1)));
    } else if (entry.kind === 'file' && name.endsWith('.md')) {
      const title = name.replace(/\.md$/, '');
      if (!q || title.toLowerCase().includes(q)) {
        out.push({ id: `${id}:${folder}/${name}`, sourceId: id, title, path: `${folder ? folder + '/' : ''}${name}` });
      }
    }
    if (out.length >= 50) break;
  }
  return out;
}

/** Cache a recipe the user imported by hand, so it is searchable next time. */
export async function rememberRecipe(title, path = '') {
  const recipe = { id: `${id}:${path || title}`, sourceId: id, title, path, addedAt: Date.now() };
  await put('recipes', recipe);
  return recipe;
}

/* ---- publishing -------------------------------------------------------- */

/**
 * @returns {Promise<{ok: boolean, via: string, message: string, uri?: string, zip?: Uint8Array, filename?: string}>}
 */
export async function publish(session, events, config) {
  const bundle = await buildBundle(session, events, {
    style: 'obsidian',
    attachmentsFolder: config.attachmentsFolder || 'attachments',
  });
  const logsFolder = (config.logsFolder || '').replace(/^\/+|\/+$/g, '');
  const notePath = logsFolder ? `${logsFolder}/${bundle.noteName}` : bundle.noteName;

  if (config.bridgeUrl) {
    try {
      const files = await Promise.all(
        bundle.attachments.map(async (a) => ({
          path: a.path,
          base64: await blobToBase64(a.blob),
        })),
      );
      const res = await bridgeFetch(config, '/write', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notePath, markdown: bundle.markdown, files }),
      });
      return { ok: true, via: 'bridge', message: `Written to ${res.notePath}`, uri: obsidianUri(config, notePath) };
    } catch (err) {
      return { ok: false, via: 'bridge', message: err.message };
    }
  }

  const handle = await requestHandle();
  if (handle) {
    try {
      await writeThroughHandle(handle, notePath, bundle);
      return { ok: true, via: 'fsaccess', message: `Written to ${notePath} in your vault`, uri: obsidianUri(config, notePath) };
    } catch (err) {
      return { ok: false, via: 'fsaccess', message: err.message };
    }
  }

  const zip = await zipBundle(bundle);
  return {
    ok: true,
    via: 'export',
    message: 'Bundle ready — unzip into your vault, or use the Obsidian link to drop in just the note.',
    zip,
    filename: `${bundle.slug}.zip`,
    uri: obsidianUri(config, notePath, bundle.markdown),
  };
}

async function writeThroughHandle(root, notePath, bundle) {
  const parts = notePath.split('/');
  const fileName = parts.pop();
  let dir = root;
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
  await writeFile(dir, fileName, new Blob([bundle.markdown], { type: 'text/markdown' }));

  for (const attachment of bundle.attachments) {
    const segs = attachment.path.split('/');
    const name = segs.pop();
    let adir = root;
    for (const seg of segs) adir = await adir.getDirectoryHandle(seg, { create: true });
    await writeFile(adir, name, attachment.blob);
  }
}

async function writeFile(dir, name, blob) {
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * `obsidian://new` creates the note directly in the app — the one hand-off that
 * works on Android with no server. URIs are length-limited, so the full note is
 * only inlined when it is small enough to survive.
 */
export function obsidianUri(config, notePath, markdown = null) {
  if (!config.vaultName) return null;
  const params = new URLSearchParams({ vault: config.vaultName, file: notePath.replace(/\.md$/, '') });
  if (markdown && markdown.length < 6000) params.set('content', markdown);
  return `obsidian://new?${params.toString()}`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
