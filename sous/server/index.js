#!/usr/bin/env node
// Sous server: serves the PWA, bridges to an Obsidian vault on this machine,
// and proxies Notion (which sends no CORS headers).
//
//   SOUS_VAULT   absolute path to your Obsidian vault  (optional)
//   NOTION_TOKEN Notion integration token              (optional, safer here)
//   SOUS_TOKEN   shared secret for /api/*              (generated if unset)
//   PORT         default 8787
//
// Everything under /api requires SOUS_TOKEN. The server can write to your
// filesystem and holds your Notion token, so an unauthenticated LAN endpoint
// would let any page you happen to visit reach it.

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import * as notion from './notion.js';
import * as vault from './vault.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..', 'web');
const PORT = Number(process.env.PORT || 8787);
const VAULT = process.env.SOUS_VAULT || '';
const ENV_NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const TOKEN = process.env.SOUS_TOKEN || crypto.randomBytes(16).toString('hex');
const GENERATED_TOKEN = !process.env.SOUS_TOKEN;
const MAX_BODY = 32 * 1024 * 1024; // a cook log with photos, comfortably

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'cache-control': 'no-store', ...headers });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'content-type': 'application/json; charset=utf-8' });
}

function cors(req, res) {
  // The app may be served from somewhere else (GitHub Pages, another port)
  // while this bridge runs on your LAN. Auth is the shared token, not origin.
  res.setHeader('access-control-allow-origin', req.headers.origin || '*');
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-headers', 'content-type, x-notion-token, x-sous-token');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-max-age', '86400');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request body too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('Body was not valid JSON.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function authorized(req, url) {
  const provided = req.headers['x-sous-token'] || url.searchParams.get('token') || '';
  const a = Buffer.from(String(provided));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---- static files ------------------------------------------------------ */

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const target = path.resolve(WEB_ROOT, '.' + rel);
  if (target !== WEB_ROOT && !target.startsWith(WEB_ROOT + path.sep)) {
    return send(res, 403, 'Forbidden');
  }
  try {
    const data = await fs.readFile(target);
    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    return send(res, 200, data, { 'content-type': type });
  } catch {
    // Single-page app: unknown paths fall back to the shell.
    if (!path.extname(target)) {
      try {
        return send(res, 200, await fs.readFile(path.join(WEB_ROOT, 'index.html')), { 'content-type': MIME['.html'] });
      } catch { /* fall through */ }
    }
    return send(res, 404, 'Not found');
  }
}

/* ---- routes ------------------------------------------------------------ */

async function handleVault(req, res, url) {
  const route = url.pathname.replace('/api/vault', '') || '/';

  if (route === '/status') {
    return sendJson(res, 200, await vault.status(VAULT));
  }
  if (route === '/recipes') {
    const recipes = await vault.listRecipes(VAULT, url.searchParams.get('folder') || '', url.searchParams.get('q') || '');
    return sendJson(res, 200, { recipes });
  }
  if (route === '/write' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.notePath || typeof body.markdown !== 'string') {
      return sendJson(res, 400, { message: 'notePath and markdown are required.' });
    }
    return sendJson(res, 200, await vault.writeBundle(VAULT, body));
  }
  return sendJson(res, 404, { message: `Unknown vault route ${route}` });
}

async function handleNotion(req, res, url) {
  const route = url.pathname.replace('/api/notion', '') || '/';
  const body = req.method === 'POST' ? await readBody(req) : {};
  const token = req.headers['x-notion-token'] || ENV_NOTION_TOKEN;

  if (route === '/status') return sendJson(res, 200, await notion.status(token, body.databaseId));
  if (route === '/search-recipes') {
    return sendJson(res, 200, { results: await notion.searchRecipes(token, body.databaseId, body.query) });
  }
  if (route === '/upload') return sendJson(res, 200, await notion.uploadFile(token, body));
  if (route === '/create-log') return sendJson(res, 200, await notion.createLog(token, body));
  return sendJson(res, 404, { message: `Unknown Notion route ${route}` });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  cors(req, res);

  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);

  if (!authorized(req, url)) {
    return sendJson(res, 401, { message: 'Missing or wrong server token. Copy it from the terminal into Settings.' });
  }

  try {
    if (url.pathname.startsWith('/api/vault')) return await handleVault(req, res, url);
    if (url.pathname.startsWith('/api/notion')) return await handleNotion(req, res, url);
    return sendJson(res, 404, { message: 'Unknown endpoint.' });
  } catch (err) {
    return sendJson(res, err.status || 500, { message: err.message || 'Server error.' });
  }
});

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

server.listen(PORT, () => {
  const addresses = ['localhost', ...lanAddresses()];
  console.log('\n  Sous server\n');
  console.log(`  Vault:  ${VAULT || '(none — set SOUS_VAULT to write into Obsidian directly)'}`);
  console.log(`  Notion: ${ENV_NOTION_TOKEN ? 'token loaded from NOTION_TOKEN' : '(no NOTION_TOKEN — you can paste one in Settings)'}`);
  console.log(`  Token:  ${TOKEN}${GENERATED_TOKEN ? '  (new each run — set SOUS_TOKEN to keep it stable)' : ''}\n`);
  for (const address of addresses) {
    console.log(`  Open on your phone:  http://${address}:${PORT}/#setup=${TOKEN}`);
  }
  console.log('');
});

export { server };
