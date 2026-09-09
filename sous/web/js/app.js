// Router and bootstrap. Hash routing so the app works from a file:// copy, a
// static host, or the bundled server without any rewrite rules.

import { captureTokenFromUrl } from './util/api.js';
import { toast } from './ui/dom.js';
import * as home from './ui/home.js';
import * as picker from './ui/picker.js';
import * as cook from './ui/cook.js';
import * as review from './ui/review.js';
import * as settingsScreen from './ui/settings.js';

const ROUTES = [
  [/^#\/?$/, home.render],
  [/^#\/pick$/, picker.render],
  [/^#\/cook$/, cook.render],
  [/^#\/session\/(?<id>[^/]+)$/, review.render],
  [/^#\/settings$/, settingsScreen.render],
];

let currentPath = null;

async function route() {
  const hash = location.hash || '#/';
  const root = document.getElementById('app');

  // Leaving the cook screen must release the wake lock and any live recorder.
  if (currentPath?.startsWith('#/cook') && !hash.startsWith('#/cook')) cook.cleanup();
  currentPath = hash;

  for (const [pattern, render] of ROUTES) {
    const match = pattern.exec(hash);
    if (!match) continue;
    try {
      await render(root, match.groups || {});
    } catch (err) {
      console.error(err);
      toast(err.message || 'Something went wrong.', 'bad');
    }
    window.scrollTo(0, 0);
    return;
  }
  location.hash = '#/';
}

window.addEventListener('hashchange', route);

async function boot() {
  await captureTokenFromUrl();
  await route();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline support is a bonus; the app works fine without it.
    });
  }
}

boot();

// An unhandled rejection in a capture path would otherwise vanish silently and
// look like the button simply did nothing.
window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason);
  toast(event.reason?.message || 'Unexpected error', 'bad');
});
