// Local adapter — always present, never fails, needs no configuration.
// Recipes are ones you typed in here; publishing hands you the same Markdown
// bundle every other adapter builds, as a download or via the share sheet.

import { buildBundle, zipBundle } from './bundle.js';
import { put, getAll, del } from '../db.js';

export const id = 'local';
export const label = 'On this device';
export const configFields = [];
export const defaults = () => ({});
export const isConfigured = () => true;

export async function searchRecipes(query) {
  const q = (query || '').trim().toLowerCase();
  const all = await getAll('recipes');
  return all
    .filter((r) => r.sourceId === id && (!q || r.title.toLowerCase().includes(q)))
    .sort((a, b) => (b.lastCookedAt || b.addedAt || 0) - (a.lastCookedAt || a.addedAt || 0))
    .slice(0, 50);
}

export async function addRecipe(title, url = '') {
  const recipe = { id: `${id}:${title.toLowerCase()}`, sourceId: id, title: title.trim(), url, addedAt: Date.now() };
  await put('recipes', recipe);
  return recipe;
}

export async function removeRecipe(recipeId) {
  await del('recipes', recipeId);
}

export async function publish(session, events) {
  const bundle = await buildBundle(session, events, { style: 'plain' });
  const zip = await zipBundle(bundle);
  return {
    ok: true,
    via: 'export',
    message: 'Bundle ready to download or share.',
    zip,
    filename: `${bundle.slug}.zip`,
    markdown: bundle.markdown,
  };
}
