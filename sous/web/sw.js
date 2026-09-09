// Cache the shell so the app opens instantly and keeps working if the kitchen
// Wi-Fi drops. Captures never depend on the network — they live in IndexedDB.

const CACHE = 'sous-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/session.js',
  './js/util/time.js',
  './js/util/zip.js',
  './js/util/api.js',
  './js/capture/audio.js',
  './js/capture/photo.js',
  './js/render/cooklog.js',
  './js/adapters/index.js',
  './js/adapters/bundle.js',
  './js/adapters/local.js',
  './js/adapters/obsidian.js',
  './js/adapters/notion.js',
  './js/ui/dom.js',
  './js/ui/home.js',
  './js/ui/picker.js',
  './js/ui/cook.js',
  './js/ui/review.js',
  './js/ui/settings.js',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache the bridge: vault and Notion calls must always hit the network.
  if (url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  // Network-first, so a redeploy is picked up, with the cache as the fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
  );
});
