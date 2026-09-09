// Turns a finished session into the artifacts a recipe manager wants:
// a Markdown cook log plus named attachments. Pure — no DOM, no storage —
// so it is unit-testable and shared by every adapter.

import { formatElapsed, formatDurationWords, localDateStamp, fileStamp, formatDateTime } from '../util/time.js';

const ICON = { voice: '🎙', photo: '📷', text: '📝', marker: '🔖' };

/** Filesystem/URL-safe slug. Keeps it readable rather than hashing. */
export function slugify(title, fallback = 'cook') {
  const s = String(title || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || fallback;
}

/** Stable folder name for one session's attachments, e.g. "pad-thai-20260909-1432". */
export function sessionSlug(session) {
  return `${slugify(session.recipeTitle, 'freestyle')}-${fileStamp(session.startedAt)}`;
}

/** Attachment filename for an event: "0840-photo.jpg", ordered by elapsed time. */
export function attachmentName(event, ext) {
  const total = Math.floor(event.elapsedMs / 1000);
  const mm = String(Math.floor(total / 60)).padStart(3, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}${ss}-${event.type}.${ext}`;
}

function yamlString(v) {
  return `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Render a cook log.
 *
 * opts:
 *   style            'obsidian' (wikilinks + ![[embeds]]) or 'plain' (CommonMark)
 *   attachmentDir    path prefix the attachments will live at, relative to the note
 *   recipeLink       {title, url?} — how to point back at the source of truth
 *   includeFrontmatter
 */
export function renderMarkdown(session, events, opts = {}) {
  const {
    style = 'obsidian',
    attachmentDir = '',
    recipeLink = null,
    includeFrontmatter = true,
  } = opts;

  const title = session.recipeTitle || 'Freestyle cook';
  const duration = (session.endedAt || Date.now()) - session.startedAt;
  const ordered = [...events].sort((a, b) => a.elapsedMs - b.elapsedMs);
  const dir = attachmentDir ? attachmentDir.replace(/\/+$/, '') + '/' : '';

  const link = () => {
    if (!recipeLink) return null;
    if (style === 'obsidian') return `[[${recipeLink.title}]]`;
    return recipeLink.url ? `[${recipeLink.title}](${recipeLink.url})` : recipeLink.title;
  };

  const out = [];

  if (includeFrontmatter) {
    const fm = [
      '---',
      'type: cook-log',
      `recipe: ${yamlString(recipeLink ? (style === 'obsidian' ? `[[${recipeLink.title}]]` : recipeLink.url || title) : title)}`,
      `date: ${localDateStamp(session.startedAt)}`,
      `started: ${new Date(session.startedAt).toISOString()}`,
      `duration: ${yamlString(formatDurationWords(duration))}`,
      `duration_minutes: ${Math.round(duration / 60000)}`,
    ];
    if (session.rating) fm.push(`rating: ${session.rating}`);
    fm.push('tags: [cook-log, sous]', '---', '');
    out.push(fm.join('\n'));
  }

  out.push(`# ${title} — cook log`);
  out.push('');
  const meta = [formatDateTime(session.startedAt), `${formatDurationWords(duration)} total`];
  if (session.rating) meta.push('★'.repeat(session.rating) + '☆'.repeat(5 - session.rating));
  out.push(`*${meta.join(' · ')}*`);
  const l = link();
  if (l) out.push('', `Recipe: ${l}`);

  if (session.notes && session.notes.trim()) {
    out.push('', '## Notes for next time', '', session.notes.trim());
  }

  out.push('', '## Timeline', '');

  if (ordered.length === 0) {
    out.push('*No captures logged.*');
  }

  for (const ev of ordered) {
    const stamp = `**${formatElapsed(ev.elapsedMs)}**`;
    const icon = ICON[ev.type] || '•';
    const body = (ev.text || '').trim();

    if (ev.type === 'photo') {
      const caption = body ? ` ${body}` : '';
      out.push(`${stamp} ${icon}${caption}`);
      if (ev.attachment) {
        out.push(style === 'obsidian'
          ? `![[${dir}${ev.attachment}]]`
          : `![${body || 'photo'}](${encodeURI(dir + ev.attachment)})`);
      }
    } else if (ev.type === 'voice') {
      out.push(`${stamp} ${icon} ${body || '*(no transcript)*'}`);
      if (ev.attachment && ev.keepAudio) {
        out.push(style === 'obsidian'
          ? `![[${dir}${ev.attachment}]]`
          : `[audio](${encodeURI(dir + ev.attachment)})`);
      }
    } else {
      out.push(`${stamp} ${icon} ${body}`);
    }
    out.push('');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Default note filename, e.g. "2026-09-09 Pad Thai (cook log).md". */
export function noteFilename(session) {
  const title = session.recipeTitle || 'Freestyle cook';
  return `${localDateStamp(session.startedAt)} ${title.replace(/[\\/:*?"<>|]/g, '-')} (cook log).md`;
}
