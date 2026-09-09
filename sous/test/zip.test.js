import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, makeZip } from '../web/js/util/zip.js';

test('crc32 matches the known check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('a produced archive is readable by the system unzip', () => {
  const enc = new TextEncoder();
  const md = '# Pad Thai\n\nsome **notes** with unicode: crème brûlée 🍜\n';
  const binary = Uint8Array.from({ length: 5000 }, (_, i) => (i * 31) % 256);

  const zip = makeZip([
    { name: 'cook log.md', data: enc.encode(md) },
    { name: 'attachments/00840-photo.jpg', data: binary },
  ]);

  const dir = mkdtempSync(join(tmpdir(), 'souszip-'));
  try {
    const path = join(dir, 'out.zip');
    writeFileSync(path, zip);
    execFileSync('unzip', ['-qq', '-o', path, '-d', dir]);
    assert.equal(readFileSync(join(dir, 'cook log.md'), 'utf8'), md, 'text survives round trip');
    assert.deepEqual(new Uint8Array(readFileSync(join(dir, 'attachments/00840-photo.jpg'))), binary);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
