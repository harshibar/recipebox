// Review and publish. The cook is over; now fix the transcripts the kitchen
// mangled, rate it, and push it to wherever the recipe actually lives.

import { el, clear, header, toast, confirmAction, deliverFile } from './dom.js';
import * as session from '../session.js';
import { entryRow } from './cook.js';
import { formatDurationWords, formatDateTime } from '../util/time.js';
import { adapterList, loadConfig } from '../adapters/index.js';
import { deleteSession, put } from '../db.js';

export async function render(root, { id }) {
  const current = await session.loadSession(id);
  if (!current) { location.hash = '#/'; return; }

  const timeline = el('div', { class: 'timeline' });
  const duration = (current.endedAt || Date.now()) - current.startedAt;

  async function refresh() {
    const events = await session.eventsFor(current.id);
    clear(timeline);
    if (!events.length) timeline.append(el('p', { class: 'muted small' }, 'Nothing was captured during this cook.'));
    for (const ev of events) timeline.append(await entryRow(ev, refresh));
  }

  const notesInput = el('textarea', {
    placeholder: 'What would you change next time?',
    value: current.notes || '',
  });
  notesInput.addEventListener('change', async () => {
    current.notes = notesInput.value;
    await session.save(current);
  });

  clear(root).append(
    header(current.recipeTitle || 'Freestyle cook', { back: '#/' }),
    el('main', {},
      el('p', { class: 'muted small' }, `${formatDateTime(current.startedAt)} · ${formatDurationWords(duration)}`),
      el('section', {}, el('h2', {}, 'How did it go?'), ratingRow(current)),
      el('section', {}, el('h2', {}, 'Notes for next time'), notesInput),
      el('section', {}, el('h2', {}, 'Timeline'), timeline),
      el('section', {}, el('h2', {}, 'Save to'), await publishRow(current)),
      el('div', { class: 'btn-row', style: 'margin-top:8px' },
        el('button', {
          class: 'btn-ghost btn-sm btn-danger',
          onClick: async () => {
            if (!(await confirmAction({ title: 'Delete this cook log?', body: 'Photos and audio go too. This cannot be undone.', danger: true, confirmLabel: 'Delete' }))) return;
            await deleteSession(current.id);
            location.hash = '#/';
          },
        }, 'Delete this cook'),
      ),
    ),
  );

  await refresh();
}

function ratingRow(current) {
  const row = el('div', { class: 'rating' });
  const paint = () => {
    [...row.children].forEach((btn, i) => btn.classList.toggle('on', i < (current.rating || 0)));
  };
  for (let i = 1; i <= 5; i++) {
    row.append(el('button', {
      'aria-label': `${i} star${i > 1 ? 's' : ''}`,
      onClick: async () => {
        current.rating = current.rating === i ? null : i;
        await session.save(current);
        paint();
      },
    }, '★'));
  }
  paint();
  return row;
}

async function publishRow(current) {
  const wrap = el('div', { class: 'list' });

  for (const adapter of adapterList) {
    const config = await loadConfig(adapter.id);
    const ready = adapter.isConfigured(config);
    const alreadySynced = (current.synced || []).some((s) => s.adapterId === adapter.id);

    const button = el('button', {
      class: 'row',
      disabled: !ready,
      onClick: () => publish(adapter, current, config, button, wrap),
    },
      el('span', { class: 'grow' },
        el('span', { class: 'title' }, adapter.label),
        el('span', { class: 'sub' }, ready ? describeTarget(adapter, config) : 'Not set up yet — open Settings')),
      alreadySynced ? el('span', { class: 'tag ok' }, 'Saved') : el('span', {}, '›'),
    );
    wrap.append(button);
  }

  wrap.append(el('button', {
    class: 'btn-ghost btn-sm',
    onClick: () => { location.hash = '#/settings'; },
  }, '⚙ Set up Obsidian or Notion'));

  return wrap;
}

function describeTarget(adapter, config) {
  if (adapter.id === 'obsidian') {
    if (config.bridgeUrl) return `Vault bridge → ${config.logsFolder || 'vault root'}`;
    return `Bundle export${config.vaultName ? ` · vault “${config.vaultName}”` : ''}`;
  }
  if (adapter.id === 'notion') return config.logDatabaseId ? 'Cook log database' : 'Child page of the recipe';
  return 'Markdown bundle you can share or download';
}

async function publish(adapter, current, config, button, wrap) {
  const original = button.innerHTML;
  button.disabled = true;
  clear(button).append(el('span', { class: 'spinner' }), el('span', { style: 'margin-left:10px' }, `Saving to ${adapter.label}…`));

  try {
    const events = await session.eventsFor(current.id);
    const result = await adapter.publish(current, events, config);

    if (!result.ok) throw new Error(result.message);

    if (result.zip) {
      const how = await deliverFile(result.zip, result.filename, 'application/zip');
      if (how === 'cancelled') throw new Error('Export cancelled.');
    }

    current.synced = [...(current.synced || []).filter((s) => s.adapterId !== adapter.id), {
      adapterId: adapter.id, at: Date.now(), url: result.url || null, via: result.via || null,
    }];
    await put('sessions', current);

    toast(result.message || `Saved to ${adapter.label}`);
    for (const warning of result.warnings || []) toast(warning, 'bad');

    // Follow-up affordances: open the created page, or hand the note to
    // Obsidian directly when there was no way to write the vault.
    const follow = el('div', { class: 'notice good', style: 'margin-top:10px' },
      el('div', {}, result.message),
      result.url ? el('a', { href: result.url, target: '_blank', rel: 'noopener' }, 'Open in Notion →') : null,
      result.uri ? el('div', { style: 'margin-top:8px' },
        el('a', { class: 'btn btn-sm', href: result.uri }, 'Open in Obsidian →')) : null,
    );
    wrap.prepend(follow);
  } catch (err) {
    toast(err.message, 'bad');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}
