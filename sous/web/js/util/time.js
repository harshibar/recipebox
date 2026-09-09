// Time helpers. Elapsed time is always derived from wall-clock stamps so that a
// session survives the app being killed mid-cook (Android will do this).

/** Format a duration as m:ss, or h:mm:ss once it passes an hour. */
export function formatElapsed(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Human duration for prose and frontmatter: "47m", "1h 12m", "38s". */
export function formatDurationWords(ms) {
  const total = Math.floor(ms / 1000);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Elapsed time into the cook for an event, excluding any time the session was
 * paused before it. `pauses` is a list of {startedAt, endedAt|null} in ms.
 */
export function elapsedAt(at, startedAt, pauses = []) {
  let paused = 0;
  for (const p of pauses) {
    if (p.startedAt >= at) continue;
    const end = p.endedAt == null ? at : Math.min(p.endedAt, at);
    if (end > p.startedAt) paused += end - p.startedAt;
  }
  return Math.max(0, at - startedAt - paused);
}

/** YYYY-MM-DD in the viewer's local timezone (not UTC — a cook belongs to your day). */
export function localDateStamp(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Compact local stamp for filenames: 20260909-1432. */
export function fileStamp(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** "9 Sep 2026, 2:32 pm" */
export function formatDateTime(ms) {
  return new Date(ms).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}
