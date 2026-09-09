// Recipe picker. Searches every configured manager at once — you shouldn't have
// to remember whether a recipe lives in Obsidian or Notion.

import { el, clear, header, toast } from './dom.js';
import { searchAllSources, adapterList, loadConfig } from '../adapters/index.js';
import * as local from '../adapters/local.js';
import * as session from '../session.js';

let searchToken = 0;

export async function render(root) {
  const input = el('input', { type: 'search', placeholder: 'Search your recipes…', autocomplete: 'off', enterkeyhint: 'search' });
  const results = el('div', { class: 'list' });
  const status = el('div', { class: 'small muted' });

  clear(root).append(
    header('What are you making?', { back: '#/' }),
    el('main', {},
      input,
      el('button', {
        class: 'row', onClick: () => begin(null),
      },
        el('span', { class: 'grow' },
          el('span', { class: 'title' }, 'Freestyle — no recipe'),
          el('span', { class: 'sub' }, 'Log it now, attach a recipe later')),
        el('span', {}, '›')),
      status,
      results,
    ),
  );

  async function search(query) {
    const token = ++searchToken;
    status.textContent = 'Searching…';
    const { recipes, errors } = await searchAllSources(query);
    if (token !== searchToken) return; // a newer keystroke already won

    clear(results);
    const configured = [];
    for (const adapter of adapterList) {
      const config = await loadConfig(adapter.id);
      if (adapter.isConfigured(config)) configured.push(adapter.label);
    }

    for (const error of errors) toast(`${error.label}: ${error.message}`, 'bad');

    if (recipes.length === 0) {
      status.textContent = '';
      results.append(el('div', { class: 'empty' },
        el('p', {}, query ? `Nothing matching “${query}”.` : 'No recipes found yet.'),
        el('p', { class: 'small' }, `Connected: ${configured.join(', ') || 'nothing yet'}. Connect Obsidian or Notion in Settings, or add a recipe by name below.`),
        el('button', { class: 'btn-sm', onClick: () => addByName(query) }, `＋ Add “${query || 'a recipe'}” by name`),
      ));
      return;
    }

    status.textContent = `${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`;
    for (const recipe of recipes.slice(0, 60)) {
      results.append(el('button', { class: 'row', onClick: () => begin(recipe) },
        el('span', { class: 'grow' },
          el('span', { class: 'title' }, recipe.title),
          recipe.path || recipe.url ? el('span', { class: 'sub' }, recipe.path || recipe.url) : null),
        el('span', { class: 'tag' }, sourceLabel(recipe.sourceId)),
      ));
    }
    results.append(el('button', { class: 'btn-ghost btn-sm', onClick: () => addByName(input.value) }, '＋ Add one by name'));
  }

  async function addByName(name) {
    const title = (name || '').trim();
    if (!title) return toast('Type a name first.', 'bad');
    const recipe = await local.addRecipe(title);
    await begin(recipe);
  }

  async function begin(recipe) {
    const started = await session.startSession({ recipe });
    location.hash = '#/cook';
    return started;
  }

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => search(input.value), 220);
  });

  await search('');
  setTimeout(() => input.focus(), 60);
}

const LABELS = { obsidian: 'Obsidian', notion: 'Notion', local: 'Local' };
const sourceLabel = (id) => LABELS[id] || id;
