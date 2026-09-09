// Builds the publishable artifact from a stored session: the Markdown note plus
// its named attachments. Every adapter consumes this same shape, which is what
// keeps Obsidian and Notion from leaking their differences into the capture UI.

import { blobs } from '../db.js';
import { renderMarkdown, noteFilename, sessionSlug, attachmentName } from '../render/cooklog.js';
import { fileExtFor } from '../capture/audio.js';
import { makeZip } from '../util/zip.js';

/**
 * @param {object} session
 * @param {object[]} events
 * @param {{style?: 'obsidian'|'plain', attachmentsFolder?: string}} opts
 * @returns {Promise<{markdown: string, noteName: string, slug: string,
 *                    attachments: {name: string, path: string, blob: Blob}[]}>}
 */
export async function buildBundle(session, events, opts = {}) {
  const { style = 'obsidian', attachmentsFolder = 'attachments' } = opts;
  const slug = sessionSlug(session);
  const dir = `${attachmentsFolder.replace(/^\/+|\/+$/g, '')}/${slug}`;

  const attachments = [];
  const decorated = [];

  for (const ev of events) {
    const copy = { ...ev };
    if (ev.blobId) {
      const blob = await blobs.get(ev.blobId);
      if (blob) {
        const ext = ev.type === 'photo' ? 'jpg' : fileExtFor(ev.mime || '');
        // Keep audio out of the bundle unless the cook chose to keep it —
        // the transcript is the point, the clip is the receipt.
        if (ev.type !== 'voice' || ev.keepAudio) {
          const name = attachmentName(ev, ext);
          copy.attachment = name;
          attachments.push({ name, path: `${dir}/${name}`, blob });
        }
      }
    }
    decorated.push(copy);
  }

  const markdown = renderMarkdown(session, decorated, {
    style,
    attachmentDir: dir,
    recipeLink: session.recipeRef
      ? { title: session.recipeRef.title, url: session.recipeRef.url }
      : null,
  });

  return { markdown, noteName: noteFilename(session), slug, attachments, events: decorated };
}

/** Zip the bundle for download / share-sheet delivery. */
export function zipBundle(bundle, { notePrefix = '' } = {}) {
  const enc = new TextEncoder();
  const entries = [{ name: notePrefix + bundle.noteName, data: enc.encode(bundle.markdown) }];
  return Promise.all(
    bundle.attachments.map(async (a) => ({
      name: a.path,
      data: new Uint8Array(await a.blob.arrayBuffer()),
    })),
  ).then((files) => makeZip([...entries, ...files]));
}
