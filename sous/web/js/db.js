// IndexedDB wrapper. Everything a cook produces lands here first and is only
// pushed to Obsidian/Notion when you choose to — so the kitchen never depends
// on a network, and a killed tab never loses the session.

const DB_NAME = 'sous';
const DB_VERSION = 1;

/** @type {Promise<IDBDatabase>|null} */
let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('startedAt', 'startedAt');
        s.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains('events')) {
        const e = db.createObjectStore('events', { keyPath: 'id' });
        e.createIndex('sessionId', 'sessionId');
      }
      // Blobs live apart from their events so listing a timeline never pulls
      // megabytes of audio and photos into memory.
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('recipes')) {
        const r = db.createObjectStore('recipes', { keyPath: 'id' });
        r.createIndex('sourceId', 'sourceId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, stores, mode) {
  const t = db.transaction(stores, mode);
  const done = new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('transaction aborted'));
  });
  return { t, done };
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put(store, value, key) {
  const db = await openDb();
  const { t, done } = tx(db, [store], 'readwrite');
  t.objectStore(store).put(value, key);
  await done;
  return value;
}

export async function get(store, key) {
  const db = await openDb();
  const { t } = tx(db, [store], 'readonly');
  return wrap(t.objectStore(store).get(key));
}

export async function del(store, key) {
  const db = await openDb();
  const { t, done } = tx(db, [store], 'readwrite');
  t.objectStore(store).delete(key);
  await done;
}

export async function getAll(store, indexName, query) {
  const db = await openDb();
  const { t } = tx(db, [store], 'readonly');
  const src = indexName ? t.objectStore(store).index(indexName) : t.objectStore(store);
  return wrap(src.getAll(query));
}

export async function clearStore(store) {
  const db = await openDb();
  const { t, done } = tx(db, [store], 'readwrite');
  t.objectStore(store).clear();
  await done;
}

/* ---- typed helpers ---------------------------------------------------- */

export const settings = {
  get: (key, fallback = null) => get('settings', key).then((v) => (v === undefined ? fallback : v)),
  set: (key, value) => put('settings', value, key),
};

export const blobs = {
  get: (id) => get('blobs', id),
  put: (id, blob) => put('blobs', blob, id),
  del: (id) => del('blobs', id),
};

export async function listSessions() {
  const all = await getAll('sessions');
  return all.sort((a, b) => b.startedAt - a.startedAt);
}

export async function eventsFor(sessionId) {
  const all = await getAll('events', 'sessionId', IDBKeyRange.only(sessionId));
  return all.sort((a, b) => a.elapsedMs - b.elapsedMs);
}

/** Remove a session, its events, and every blob they own. */
export async function deleteSession(sessionId) {
  const events = await eventsFor(sessionId);
  for (const ev of events) {
    if (ev.blobId) await blobs.del(ev.blobId);
    await del('events', ev.id);
  }
  await del('sessions', sessionId);
}

/** Rough byte total, so the UI can warn before the origin quota bites. */
export async function estimateUsage() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return { usage, quota };
}

export function newId(prefix = 'id') {
  const rand = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}_${Date.now().toString(36)}_${[...rand].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
