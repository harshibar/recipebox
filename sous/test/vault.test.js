import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeJoin, listRecipes, writeBundle, VaultError } from '../server/vault.js';

function makeVault() {
  const root = mkdtempSync(join(tmpdir(), 'sousvault-'));
  mkdirSync(join(root, 'Recipes/Mains'), { recursive: true });
  writeFileSync(join(root, 'Recipes/Pad Thai.md'), '# Pad Thai');
  writeFileSync(join(root, 'Recipes/Rajma.md'), '# Rajma');
  writeFileSync(join(root, 'Recipes/Mains/Thai Green Curry.md'), '# Curry');
  writeFileSync(join(root, 'Recipes/notes.txt'), 'not a recipe');
  return root;
}

test('safeJoin refuses to escape the vault', () => {
  const root = '/tmp/vault';
  assert.equal(safeJoin(root, 'Recipes/A.md'), '/tmp/vault/Recipes/A.md');
  assert.equal(safeJoin(root, '/Recipes/A.md'), '/tmp/vault/Recipes/A.md', 'leading slash is stripped, not honoured');
  for (const evil of ['../outside.md', 'Recipes/../../etc/passwd', '..', 'a/../../b']) {
    assert.throws(() => safeJoin(root, evil), VaultError, `should reject ${evil}`);
  }
  assert.throws(() => safeJoin(root, ''), VaultError);
});

test('safeJoin is not fooled by a sibling directory with a shared prefix', () => {
  assert.throws(() => safeJoin('/tmp/vault', '../vault-evil/x.md'), VaultError);
});

test('listRecipes finds markdown recursively and filters by query', async () => {
  const root = makeVault();
  try {
    const all = await listRecipes(root, 'Recipes', '');
    assert.deepEqual(all.map((r) => r.title), ['Pad Thai', 'Rajma', 'Thai Green Curry']);
    assert.ok(all.every((r) => r.path.startsWith('Recipes/')), 'paths are vault-relative');
    assert.ok(!all.some((r) => r.title.includes('notes')), 'non-markdown ignored');

    const thai = await listRecipes(root, 'Recipes', 'thai');
    assert.deepEqual(thai.map((r) => r.title), ['Pad Thai', 'Thai Green Curry']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writeBundle writes the note and its attachments', async () => {
  const root = makeVault();
  try {
    const res = await writeBundle(root, {
      notePath: 'Recipes/Cook Logs/2026-09-09 Pad Thai (cook log).md',
      markdown: '# log\n',
      files: [{ path: 'attachments/pad-thai-20260909-1432/00840-photo.jpg', base64: Buffer.from([1, 2, 3]).toString('base64') }],
    });
    assert.equal(res.notePath, 'Recipes/Cook Logs/2026-09-09 Pad Thai (cook log).md');
    assert.equal(readFileSync(join(root, res.notePath), 'utf8'), '# log\n');
    assert.deepEqual([...readFileSync(join(root, res.attachments[0]))], [1, 2, 3]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writeBundle never clobbers an existing log', async () => {
  const root = makeVault();
  try {
    const args = { notePath: 'Logs/entry.md', markdown: 'first', files: [] };
    const a = await writeBundle(root, args);
    const b = await writeBundle(root, { ...args, markdown: 'second' });
    assert.equal(a.notePath, 'Logs/entry.md');
    assert.equal(b.notePath, 'Logs/entry 2.md');
    assert.equal(readFileSync(join(root, 'Logs/entry.md'), 'utf8'), 'first', 'original left untouched');
    assert.equal(readFileSync(join(root, 'Logs/entry 2.md'), 'utf8'), 'second');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writeBundle refuses a traversing attachment path', async () => {
  const root = makeVault();
  try {
    await assert.rejects(
      writeBundle(root, { notePath: 'Logs/x.md', markdown: 'x', files: [{ path: '../../escaped.jpg', base64: '' }] }),
      VaultError,
    );
    assert.ok(!existsSync(join(root, '../../escaped.jpg')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
