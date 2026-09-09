// Adapter registry. The capture UI only ever talks to this shape, which is why
// adding a third recipe manager later is a new file rather than a rewrite.
//
//   id, label, configFields, defaults(), isConfigured(config)
//   searchRecipes(query, config) -> Recipe[]
//   publish(session, events, config) -> {ok, message, url?, zip?, filename?, uri?}

import * as local from './local.js';
import * as obsidian from './obsidian.js';
import * as notion from './notion.js';
import { settings } from '../db.js';

export const adapters = { local, obsidian, notion };
export const adapterList = [obsidian, notion, local];

export function getAdapter(id) {
  return adapters[id] || local;
}

const configKey = (id) => `config.${id}`;

export async function loadConfig(adapterId) {
  const adapter = getAdapter(adapterId);
  const stored = await settings.get(configKey(adapter.id), null);
  return { ...adapter.defaults(), ...(stored || {}) };
}

export async function saveConfig(adapterId, config) {
  await settings.set(configKey(getAdapter(adapterId).id), config);
  return config;
}

/** Which adapter the recipe picker and the publish screen default to. */
export async function primaryAdapterId() {
  return settings.get('primaryAdapter', 'local');
}

export async function setPrimaryAdapter(adapterId) {
  await settings.set('primaryAdapter', getAdapter(adapterId).id);
}

/**
 * Search every configured source at once — you shouldn't have to remember
 * which manager a recipe lives in.
 * @returns {Promise<{recipes: object[], errors: {label: string, message: string}[]}>}
 */
export async function searchAllSources(query) {
  const recipes = [];
  const errors = [];
  for (const adapter of adapterList) {
    const config = await loadConfig(adapter.id);
    if (!adapter.isConfigured(config)) continue;
    try {
      const found = await adapter.searchRecipes(query, config);
      recipes.push(...found);
    } catch (err) {
      errors.push({ label: adapter.label, message: err.message });
    }
  }
  return { recipes, errors };
}
