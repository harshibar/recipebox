import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const TOKEN = 'a'.repeat(32);
let root;
let child;
let base;

async function waitForServer(url, attempts = 50) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.status) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'sousserver-'));
  mkdirSync(join(root, 'Recipes'), { recursive: true });
  writeFileSync(join(root, 'Recipes/Pad Thai.md'), '# Pad Thai');

  const port = 8000 + Math.floor(Math.random() * 1000);
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(port), SOUS_VAULT: root, SOUS_TOKEN: TOKEN },
    stdio: 'ignore',
  });
  await waitForServer(`${base}/index.html`);
});

after(() => {
  child?.kill();
  rmSync(root, { recursive: true, force: true });
});

const auth = { 'x-sous-token': TOKEN };

test('api requires the shared token', async () => {
  const res = await fetch(`${base}/api/vault/status`);
  assert.equal(res.status, 401);
  const wrong = await fetch(`${base}/api/vault/status`, { headers: { 'x-sous-token': 'b'.repeat(32) } });
  assert.equal(wrong.status, 401);
  const short = await fetch(`${base}/api/vault/status`, { headers: { 'x-sous-token': 'a' } });
  assert.equal(short.status, 401, 'a length mismatch must not throw or pass');
});

test('vault status and recipe listing work through HTTP', async () => {
  const status = await (await fetch(`${base}/api/vault/status`, { headers: auth })).json();
  assert.equal(status.ok, true);
  assert.equal(status.vaultPath, root);

  const { recipes } = await (await fetch(`${base}/api/vault/recipes?folder=Recipes&q=pad`, { headers: auth })).json();
  assert.equal(recipes.length, 1);
  assert.equal(recipes[0].title, 'Pad Thai');
});

test('writing a bundle lands in the vault', async () => {
  const res = await fetch(`${base}/api/vault/write`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({
      notePath: 'Cook Logs/log.md',
      markdown: '# hello\n',
      files: [{ path: 'attachments/x.jpg', base64: Buffer.from('img').toString('base64') }],
    }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.notePath, 'Cook Logs/log.md');
  assert.equal(readFileSync(join(root, 'Cook Logs/log.md'), 'utf8'), '# hello\n');
  assert.equal(readFileSync(join(root, 'attachments/x.jpg'), 'utf8'), 'img');
});

test('a traversing notePath is rejected over HTTP', async () => {
  const res = await fetch(`${base}/api/vault/write`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ notePath: '../escaped.md', markdown: 'x', files: [] }),
  });
  assert.equal(res.status, 403);
});

test('static files are served and cannot escape the web root', async () => {
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);

  const escape = await fetch(`${base}/%2e%2e/package.json`);
  assert.ok(escape.status === 403 || escape.status === 404, `expected refusal, got ${escape.status}`);
});

test('malformed JSON is a 400, not a crash', async () => {
  const res = await fetch(`${base}/api/vault/write`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: '{not json',
  });
  assert.equal(res.status, 400);
  // The server must still be alive afterwards.
  assert.equal((await fetch(`${base}/api/vault/status`, { headers: auth })).status, 200);
});

test('CORS preflight is answered so a phone on another origin can reach it', async () => {
  const res = await fetch(`${base}/api/vault/status`, {
    method: 'OPTIONS',
    headers: { origin: 'http://192.168.1.50:3000', 'access-control-request-method': 'POST' },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://192.168.1.50:3000');
  assert.match(res.headers.get('access-control-allow-headers'), /x-sous-token/);
});
