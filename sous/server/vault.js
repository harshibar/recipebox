// Direct Obsidian vault access, for when this server runs on the machine that
// holds the vault. Every path is resolved and re-checked against the vault root
// so a request can never escape it.

import { promises as fs } from 'node:fs';
import path from 'node:path';

export class VaultError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Resolve a vault-relative path, refusing anything that escapes the root. */
export function safeJoin(root, relative) {
  const cleaned = String(relative || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned) throw new VaultError('Empty path.');
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, cleaned);
  const withSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  if (target !== resolvedRoot && !target.startsWith(withSep)) {
    throw new VaultError('Path escapes the vault root.', 403);
  }
  return target;
}

export async function status(root) {
  if (!root) throw new VaultError('No vault configured. Start the server with SOUS_VAULT=/path/to/vault.');
  const stat = await fs.stat(root).catch(() => null);
  if (!stat?.isDirectory()) throw new VaultError(`Not a directory: ${root}`);
  return { ok: true, vaultPath: root };
}

/** List recipe notes under `folder`, matching `q` on the filename. */
export async function listRecipes(root, folder, q, limit = 50) {
  await status(root);
  const base = folder ? safeJoin(root, folder) : path.resolve(root);
  const needle = (q || '').toLowerCase();
  const found = [];

  async function walk(dir, depth) {
    if (found.length >= limit || depth > 3) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (found.length >= limit) return;
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.name.endsWith('.md')) {
        const title = entry.name.replace(/\.md$/, '');
        if (!needle || title.toLowerCase().includes(needle)) {
          found.push({
            id: `obsidian:${path.relative(root, full)}`,
            title,
            path: path.relative(root, full).split(path.sep).join('/'),
          });
        }
      }
    }
  }

  await walk(base, 0);
  found.sort((a, b) => a.title.localeCompare(b.title));
  return found;
}

/**
 * Write the note and its attachments. Never clobbers: an existing note gets a
 * numeric suffix, because a cook log you already edited is not disposable.
 */
export async function writeBundle(root, { notePath, markdown, files = [] }) {
  await status(root);
  let target = safeJoin(root, notePath);

  for (let n = 2; n < 100; n++) {
    if (!(await exists(target))) break;
    const dir = path.dirname(target);
    const ext = path.extname(target);
    const stem = path.basename(target, ext);
    target = path.join(dir, `${stem} ${n}${ext}`);
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, markdown, 'utf8');

  const written = [];
  for (const file of files) {
    const dest = safeJoin(root, file.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, Buffer.from(file.base64, 'base64'));
    written.push(path.relative(root, dest).split(path.sep).join('/'));
  }

  return {
    ok: true,
    notePath: path.relative(root, target).split(path.sep).join('/'),
    attachments: written,
  };
}

async function exists(p) {
  return fs.access(p).then(() => true, () => false);
}
