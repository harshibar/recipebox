// The cook session: a start time, a pause ledger, and an ordered list of
// captures. Elapsed times are recomputed from wall-clock stamps rather than a
// running counter, so backgrounding the app (Android will) changes nothing.

import { newId, put, get, del, blobs, eventsFor, deleteSession } from './db.js';
import { elapsedAt } from './util/time.js';

export const ACTIVE_SESSION_KEY = 'activeSessionId';

/** @returns {Promise<object>} the newly started session */
export async function startSession({ recipe = null } = {}) {
  const now = Date.now();
  const session = {
    id: newId('ses'),
    startedAt: now,
    endedAt: null,
    status: 'active',
    pauses: [],
    recipeTitle: recipe?.title || null,
    recipeRef: recipe
      ? { sourceId: recipe.sourceId, id: recipe.id, title: recipe.title, url: recipe.url || null, path: recipe.path || null }
      : null,
    notes: '',
    rating: null,
    synced: [],
  };
  await put('sessions', session);
  await put('settings', session.id, ACTIVE_SESSION_KEY);
  await addEvent(session, { type: 'marker', text: 'Started cooking', at: now });
  return session;
}

export async function loadSession(id) {
  return get('sessions', id);
}

export async function activeSession() {
  const id = await get('settings', ACTIVE_SESSION_KEY);
  if (!id) return null;
  const session = await get('sessions', id);
  if (!session || session.status === 'finished') return null;
  return session;
}

export async function save(session) {
  await put('sessions', session);
  return session;
}

/** True if the clock should currently be running. */
export function isRunning(session) {
  return session.status === 'active';
}

/** Elapsed cook time right now (or at `at`), excluding paused stretches. */
export function currentElapsed(session, at = Date.now()) {
  const ref = session.endedAt != null ? Math.min(at, session.endedAt) : at;
  return elapsedAt(ref, session.startedAt, session.pauses);
}

export async function pause(session) {
  if (session.status !== 'active') return session;
  session.status = 'paused';
  session.pauses.push({ startedAt: Date.now(), endedAt: null });
  return save(session);
}

export async function resume(session) {
  if (session.status !== 'paused') return session;
  const open = session.pauses[session.pauses.length - 1];
  if (open && open.endedAt == null) open.endedAt = Date.now();
  session.status = 'active';
  return save(session);
}

export async function finish(session) {
  if (session.status === 'paused') await resume(session);
  session.status = 'finished';
  session.endedAt = Date.now();
  await save(session);
  await put('settings', null, ACTIVE_SESSION_KEY);
  return session;
}

/**
 * Record a capture.
 * @param {object} session
 * @param {{type:'voice'|'photo'|'text'|'marker', text?:string, blob?:Blob,
 *          mime?:string, durationMs?:number, at?:number, keepAudio?:boolean}} input
 */
export async function addEvent(session, input) {
  const at = input.at ?? Date.now();
  const event = {
    id: newId('evt'),
    sessionId: session.id,
    type: input.type,
    at,
    elapsedMs: elapsedAt(at, session.startedAt, session.pauses),
    text: input.text || '',
    blobId: null,
    mime: input.mime || null,
    durationMs: input.durationMs || null,
    keepAudio: input.keepAudio ?? false,
  };
  if (input.blob) {
    event.blobId = newId('blb');
    event.mime = event.mime || input.blob.type || null;
    event.bytes = input.blob.size;
    await blobs.put(event.blobId, input.blob);
  }
  await put('events', event);
  return event;
}

export async function updateEvent(event, patch) {
  const next = { ...event, ...patch };
  await put('events', next);
  return next;
}

export async function removeEvent(event) {
  if (event.blobId) await blobs.del(event.blobId);
  await del('events', event.id);
}

export { eventsFor, deleteSession };
