// Every call to the bundled server carries the shared token it printed at
// startup. The token is captured once from the #setup= fragment in the URL the
// server prints, or pasted into Settings.

import { settings } from '../db.js';

const TOKEN_KEY = 'server.token';

let cached = null;

export async function serverToken() {
  if (cached != null) return cached;
  cached = (await settings.get(TOKEN_KEY, '')) || '';
  return cached;
}

export async function setServerToken(token) {
  cached = token || '';
  await settings.set(TOKEN_KEY, cached);
  return cached;
}

/** Pull a token out of `#setup=...` on first load and clean the URL. */
export async function captureTokenFromUrl() {
  const match = /[#&?]setup=([a-f0-9]{8,})/i.exec(location.hash + location.search);
  if (!match) return null;
  await setServerToken(match[1]);
  history.replaceState(null, '', location.pathname);
  return match[1];
}

/**
 * @param {string} baseUrl origin of the server, e.g. http://192.168.1.20:8787
 * @param {string} path    path under /api
 */
export async function apiFetch(baseUrl, path, init = {}) {
  const base = (baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('No server URL configured.');
  const token = await serverToken();
  const res = await fetch(`${base}/api${path}`, {
    ...init,
    headers: { ...(init.headers || {}), 'x-sous-token': token },
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
  if (!res.ok) {
    if (res.status === 401) throw new Error('Server rejected the token. Re-open the link the server printed, or paste the token in Settings.');
    throw new Error(json.message || `Request failed (${res.status})`);
  }
  return json;
}
