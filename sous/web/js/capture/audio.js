// Voice capture. Two independent halves, either of which may be unavailable:
//
//   1. SpeechRecognition -> live transcript (Chrome on Android: on-device, free)
//   2. MediaRecorder     -> the raw clip, kept only if you asked for it
//
// Running both at once can fight over the mic on some Android builds, so the
// recorder degrades instead of failing: whichever half works, you keep.

const SpeechRecognitionCtor =
  globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;

export const canTranscribe = () => SpeechRecognitionCtor != null;
export const canRecordAudio = () =>
  typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Pick a container the browser will actually produce. */
function pickMime() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
}

export function fileExtFor(mime = '') {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  return 'audio';
}

/**
 * @param {{keepAudio?: boolean, lang?: string,
 *          onPartial?: (text: string) => void,
 *          onLevel?: (level: number) => void,
 *          onError?: (msg: string) => void}} opts
 */
export function createVoiceRecorder(opts = {}) {
  const { keepAudio = false, lang = navigator.language || 'en-US' } = opts;
  const onPartial = opts.onPartial || (() => {});
  const onLevel = opts.onLevel || (() => {});
  const onError = opts.onError || (() => {});

  let recognition = null;
  let recorder = null;
  let stream = null;
  let audioCtx = null;
  let levelTimer = null;
  let chunks = [];
  let finalText = '';
  let startedAt = 0;
  let stopping = false;
  let wantsRecognition = false;

  function startRecognition() {
    if (!SpeechRecognitionCtor) return false;
    try {
      recognition = new SpeechRecognitionCtor();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          if (result.isFinal) finalText += (finalText ? ' ' : '') + text.trim();
          else interim += text;
        }
        onPartial((finalText + ' ' + interim).trim());
      };

      recognition.onerror = (event) => {
        // "no-speech" and "aborted" are ordinary in a noisy kitchen; anything
        // else is worth telling the cook about.
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          onError('Microphone permission denied for speech recognition.');
        } else if (event.error === 'network') {
          onError('Speech recognition needs a network connection on this device.');
        } else {
          onError(`Speech recognition error: ${event.error}`);
        }
      };

      // Chrome ends recognition on its own after a pause. Restart while held.
      recognition.onend = () => {
        if (!stopping && wantsRecognition) {
          try { recognition.start(); } catch { /* already restarting */ }
        }
      };

      wantsRecognition = true;
      recognition.start();
      return true;
    } catch (err) {
      recognition = null;
      wantsRecognition = false;
      onError(`Could not start transcription: ${err.message}`);
      return false;
    }
  }

  async function startRecorder() {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    const mimeType = pickMime();
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks = [];
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    recorder.start(1000);
    meterLevel();
  }

  // Drives the on-screen level meter so you can tell it is listening from
  // across the kitchen.
  function meterLevel() {
    try {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctx || !stream) return;
      audioCtx = new Ctx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      levelTimer = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        onLevel(Math.min(1, peak / 90));
      }, 100);
    } catch { /* the meter is decoration; never let it break capture */ }
  }

  return {
    /** @returns {Promise<{transcribing: boolean, recording: boolean}>} */
    async start() {
      startedAt = Date.now();
      stopping = false;
      finalText = '';

      const transcribing = startRecognition();
      let recording = false;
      if (keepAudio && canRecordAudio()) {
        try {
          await startRecorder();
          recording = true;
        } catch (err) {
          onError(`Could not access the microphone: ${err.message}`);
        }
      }

      if (!transcribing && !recording) {
        throw new Error(
          'No voice capture available on this browser. Use the note button to type instead.',
        );
      }
      return { transcribing, recording };
    },

    /** @returns {Promise<{transcript: string, blob: Blob|null, mime: string|null, durationMs: number}>} */
    async stop() {
      stopping = true;
      wantsRecognition = false;
      const durationMs = Date.now() - startedAt;

      if (recognition) {
        try { recognition.stop(); } catch { /* already stopped */ }
      }

      let blob = null;
      let mime = null;
      if (recorder && recorder.state !== 'inactive') {
        blob = await new Promise((resolve) => {
          recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
          try { recorder.stop(); } catch { resolve(null); }
        });
        mime = blob?.type || null;
      }

      clearInterval(levelTimer);
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close().catch(() => {});
      recognition = null; recorder = null; stream = null; audioCtx = null;

      // Recognition delivers its last final result slightly after stop().
      await new Promise((r) => setTimeout(r, 250));
      return { transcript: finalText.trim(), blob, mime, durationMs };
    },

    cancel() {
      stopping = true;
      wantsRecognition = false;
      try { recognition?.abort(); } catch { /* ignore */ }
      try { if (recorder?.state !== 'inactive') recorder?.stop(); } catch { /* ignore */ }
      clearInterval(levelTimer);
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close().catch(() => {});
    },
  };
}
