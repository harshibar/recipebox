import { el, clear, header } from './dom.js';
import * as session from '../session.js';
import { listSessions } from '../db.js';
import { formatDurationWords, formatDateTime } from '../util/time.js';

export async function render(root) {
  const active = await session.activeSession();
  const past = (await listSessions()).filter((s) => s.status === 'finished');

  const main = el('main', {});

  if (active) {
    main.append(el('div', { class: 'card' },
      el('div', { class: 'tag accent' }, 'In progress'),
      el('h3', { style: 'margin:10px 0 4px;font-size:21px' }, active.recipeTitle || 'Freestyle cook'),
      el('p', { class: 'muted small' }, `Started ${formatDateTime(active.startedAt)}`),
      el('button', {
        class: 'btn-primary btn-block', style: 'margin-top:14px',
        onClick: () => { location.hash = '#/cook'; },
      }, 'Back to the kitchen'),
    ));
  } else {
    main.append(el('button', {
      class: 'btn-primary btn-block', style: 'min-height:76px;font-size:19px',
      onClick: () => { location.hash = '#/pick'; },
    }, '🍳  Start a cook'));
  }

  main.append(el('section', {},
    el('h2', {}, past.length ? 'Past cooks' : ''),
    past.length
      ? el('div', { class: 'list' }, ...past.map(sessionRow))
      : el('div', { class: 'empty' },
          el('span', { class: 'glyph' }, '🥄'),
          el('p', {}, 'No cooks logged yet.'),
          el('p', { class: 'small' }, 'Start one and tap the mic whenever something is worth remembering.')),
  ));

  clear(root).append(
    header('Sous', {
      actions: [el('button', {
        class: 'btn-ghost btn-icon', 'aria-label': 'Settings',
        onClick: () => { location.hash = '#/settings'; },
      }, '⚙')],
    }),
    main,
  );
}

function sessionRow(s) {
  const duration = s.endedAt ? formatDurationWords(s.endedAt - s.startedAt) : '—';
  const synced = (s.synced || []).length > 0;
  return el('button', {
    class: 'row', onClick: () => { location.hash = `#/session/${s.id}`; },
  },
    el('span', { class: 'grow' },
      el('span', { class: 'title' }, s.recipeTitle || 'Freestyle cook'),
      el('span', { class: 'sub' }, `${formatDateTime(s.startedAt)} · ${duration}${s.rating ? ' · ' + '★'.repeat(s.rating) : ''}`)),
    synced ? el('span', { class: 'tag ok' }, 'Saved') : el('span', { class: 'tag warn' }, 'Draft'),
  );
}
