// The cook screen. Everything here assumes you are standing over a pan and can
// spare one glance and one tap.

import { el, clear, header, toast, promptText, confirmAction } from './dom.js';
import * as session from '../session.js';
import { formatElapsed } from '../util/time.js';
import { createVoiceRecorder, canTranscribe, canRecordAudio } from '../capture/audio.js';
import { takePhoto, normalizeImage } from '../capture/photo.js';
import { blobs, settings } from '../db.js';

let tickTimer = null;
let recorder = null;
let wakeLock = null;

export async function render(root, { id } = {}) {
  const current = id ? await session.loadSession(id) : await session.activeSession();
  if (!current || current.status === 'finished') {
    location.hash = '#/';
    return;
  }

  const keepAudio = await settings.get('keepAudio', false);

  const timerEl = el('div', { class: 'timer' }, formatElapsed(session.currentElapsed(current)));
  const subEl = el('div', { class: 'timer-sub' });
  const transcriptEl = el('div', { class: 'live-transcript', hidden: true });
  const levelBar = el('i');
  const timelineEl = el('div', { class: 'timeline' });

  const voiceBtn = el('button', {
    class: 'capture-btn', dataset: { kind: 'voice' }, 'aria-label': 'Record a voice note',
  }, el('span', { class: 'glyph' }, '🎙'), el('span', {}, 'Voice note'));

  const photoBtn = el('button', {
    class: 'capture-btn', dataset: { kind: 'photo' }, 'aria-label': 'Take a photo',
  }, el('span', { class: 'glyph' }, '📷'), el('span', {}, 'Photo'));

  const pauseBtn = el('button', { class: 'btn-ghost btn-sm' });

  clear(root).append(
    header(current.recipeTitle || 'Freestyle cook', {
      back: '#/',
      actions: [el('button', {
        class: 'btn-ghost btn-icon', 'aria-label': 'Finish cook',
        onClick: () => finishCook(current),
      }, '✓')],
    }),
    el('main', {},
      el('div', { class: 'card' }, timerEl, subEl,
        el('div', { style: 'display:flex;justify-content:center;margin-top:10px' }, pauseBtn)),
      transcriptEl,
      el('div', { class: 'capture-grid' }, voiceBtn, photoBtn),
      el('button', {
        class: 'btn-block', onClick: () => addTypedNote(current),
      }, '📝 Type a note instead'),
      el('section', {},
        el('h2', {}, 'So far'),
        timelineEl),
      el('div', { class: 'sticky-actions' },
        el('button', { class: 'btn-primary btn-block', onClick: () => finishCook(current) }, 'Finish cook')),
    ),
  );

  /* ---- clock --------------------------------------------------------- */

  const tick = () => {
    const running = session.isRunning(current);
    timerEl.textContent = formatElapsed(session.currentElapsed(current));
    timerEl.classList.toggle('paused', !running);
    subEl.textContent = running ? 'Cooking' : 'Paused';
    pauseBtn.textContent = running ? '⏸ Pause' : '▶ Resume';
  };
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, 500);
  tick();

  pauseBtn.onclick = async () => {
    if (session.isRunning(current)) await session.pause(current);
    else await session.resume(current);
    tick();
  };

  // Without this the screen sleeps while the onions caramelise.
  requestWakeLock();

  /* ---- timeline ------------------------------------------------------ */

  async function refreshTimeline() {
    // The "Started cooking" marker matters in the exported log but is noise
    // in the running list, so the live view shows captures only.
    const events = (await session.eventsFor(current.id)).filter((ev) => ev.type !== 'marker');
    clear(timelineEl);
    if (!events.length) {
      timelineEl.append(el('p', { class: 'muted small' }, 'Captures show up here as you go.'));
    }
    for (const ev of [...events].reverse()) {
      timelineEl.append(await entryRow(ev, refreshTimeline));
    }
  }

  /* ---- voice --------------------------------------------------------- */

  let recording = false;

  voiceBtn.onclick = async () => {
    if (recording) return stopVoice();

    if (!canTranscribe() && !canRecordAudio()) {
      toast('This browser has no microphone access. Use "Type a note" instead.', 'bad');
      return;
    }

    recorder = createVoiceRecorder({
      keepAudio: keepAudio || !canTranscribe(),
      onPartial: (text) => { transcriptEl.textContent = text; },
      onLevel: (level) => { levelBar.style.width = `${Math.round(level * 100)}%`; },
      onError: (message) => toast(message, 'bad'),
    });

    try {
      const { transcribing } = await recorder.start();
      recording = true;
      transcriptEl.hidden = false;
      transcriptEl.textContent = '';
      clear(voiceBtn).append(
        el('span', { class: 'glyph' }, '⏹'),
        el('span', {}, 'Tap to stop'),
        el('span', { class: 'level' }, levelBar),
      );
      voiceBtn.classList.add('recording');
      if (!transcribing) toast('Recording audio — no live transcription on this browser.');
    } catch (err) {
      toast(err.message, 'bad');
      recorder = null;
    }
  };

  async function stopVoice() {
    if (!recorder) return;
    const active = recorder;
    recorder = null;
    recording = false;
    voiceBtn.classList.remove('recording');
    clear(voiceBtn).append(el('span', { class: 'glyph' }, '⏳'), el('span', {}, 'Saving…'));

    const { transcript, blob, mime, durationMs } = await active.stop();
    transcriptEl.hidden = true;

    if (!transcript && !blob) {
      toast('Nothing was captured — try again, or type a note.', 'bad');
    } else {
      await session.addEvent(current, {
        type: 'voice', text: transcript, blob, mime, durationMs, keepAudio: Boolean(blob),
      });
      await refreshTimeline();
      toast(transcript ? 'Voice note saved' : 'Audio saved (no transcript)');
    }

    clear(voiceBtn).append(el('span', { class: 'glyph' }, '🎙'), el('span', {}, 'Voice note'));
  }

  /* ---- photo --------------------------------------------------------- */

  photoBtn.onclick = async () => {
    const file = await takePhoto();
    if (!file) return;
    // Stamp the time the shutter fired, not the time processing finished.
    const at = Date.now();
    clear(photoBtn).append(el('span', { class: 'glyph' }, '⏳'), el('span', {}, 'Saving…'));
    try {
      const { blob } = await normalizeImage(file);
      await session.addEvent(current, { type: 'photo', blob, mime: 'image/jpeg', at });
      await refreshTimeline();
      toast('Photo saved');
    } catch (err) {
      toast(err.message, 'bad');
    }
    clear(photoBtn).append(el('span', { class: 'glyph' }, '📷'), el('span', {}, 'Photo'));
  };

  async function addTypedNote(activeSession) {
    const at = Date.now();
    const text = await promptText({ title: 'Note', placeholder: 'What just happened?', multiline: true });
    if (!text) return;
    await session.addEvent(activeSession, { type: 'text', text, at });
    await refreshTimeline();
  }

  async function finishCook(activeSession) {
    if (recording) await stopVoice();
    const ok = await confirmAction({
      title: 'Finish this cook?',
      body: 'The timer stops and you can review, rate, and save it to your recipe manager.',
      confirmLabel: 'Finish',
    });
    if (!ok) return;
    await session.finish(activeSession);
    cleanup();
    location.hash = `#/session/${activeSession.id}`;
  }

  await refreshTimeline();
}

/* ---- shared bits ------------------------------------------------------ */

const KIND_LABEL = { voice: 'Voice note', photo: 'Photo', text: 'Note', marker: '' };

/** One timeline entry, with its media loaded lazily from IndexedDB. */
export async function entryRow(ev, onChange, { editable = true } = {}) {
  const body = el('div', { class: 'body' });
  if (KIND_LABEL[ev.type]) body.append(el('span', { class: 'kind' }, KIND_LABEL[ev.type]));
  body.append(el('div', { class: 'text' }, ev.text || (ev.type === 'photo' ? '' : '(empty)')));

  if (ev.blobId) {
    const blob = await blobs.get(ev.blobId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      if (ev.type === 'photo') {
        body.append(el('img', { src: url, alt: ev.text || 'Cook photo', loading: 'lazy' }));
      } else if (ev.type === 'voice') {
        body.append(el('audio', { src: url, controls: true, preload: 'none' }));
      }
    }
  }

  if (editable && ev.type !== 'marker' && onChange) {
    body.append(el('div', { class: 'entry-actions' },
      el('button', {
        class: 'btn-ghost btn-sm',
        onClick: async () => {
          const text = await promptText({
            title: ev.type === 'photo' ? 'Caption' : 'Edit note',
            value: ev.text || '',
            multiline: ev.type !== 'photo',
          });
          if (text == null) return;
          await session.updateEvent(ev, { text });
          onChange();
        },
      }, ev.type === 'photo' ? 'Caption' : 'Edit'),
      el('button', {
        class: 'btn-ghost btn-sm btn-danger',
        onClick: async () => {
          if (!(await confirmAction({ title: 'Delete this capture?', danger: true, confirmLabel: 'Delete' }))) return;
          await session.removeEvent(ev);
          onChange();
        },
      }, 'Delete'),
    ));
  }

  return el('div', { class: 'entry' }, el('div', { class: 'at' }, formatElapsed(ev.elapsedMs)), body);
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { /* not fatal — the screen just sleeps */ }
}

// Android drops the wake lock when the tab is backgrounded; take it back.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && location.hash.startsWith('#/cook')) requestWakeLock();
});

export function cleanup() {
  clearInterval(tickTimer);
  tickTimer = null;
  recorder?.cancel();
  recorder = null;
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
