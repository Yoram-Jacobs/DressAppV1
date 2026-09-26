/**
 * System-native Speech helpers (Phase M).
 *
 * Wraps the browser Web Speech API:
 *  - Speech-to-Text  ->  window.SpeechRecognition / window.webkitSpeechRecognition
 *  - Text-to-Speech  ->  window.speechSynthesis
 *
 * When unsupported (e.g. Firefox desktop), `isSTTSupported()` / `isTTSSupported()`
 * return `false` and callers should fall back to the existing server-side
 * Groq Whisper / Piper Offline pipeline.
 */

/* ---------- BCP-47 locale mapping ---------- */
// Our app stores short locale codes (`en`, `he`, `zh`, ...); the Web Speech API
// expects BCP-47 tags (`en-US`, `he-IL`, `zh-CN`, ...).
const BCP47 = {
  en: 'en-US',
  he: 'he-IL',
  ar: 'ar-SA',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ja: 'ja-JP',
  hi: 'hi-IN',
};

export function toBcp47(lang) {
  if (!lang) return 'en-US';
  if (lang.includes('-')) return lang; // already BCP-47
  return BCP47[lang.toLowerCase()] || 'en-US';
}

/* ---------- Feature detection ---------- */
export function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSTTSupported() {
  return (
    !!getSpeechRecognitionCtor() ||
    (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia)
  );
}

export function isTTSSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/* ---------- TTS voice loading ---------- */
// Chrome/Safari load voices asynchronously; ensure they're primed before first use.
let _voicesPromise = null;
export function ensureVoicesLoaded() {
  if (!isTTSSupported()) return Promise.resolve([]);
  if (_voicesPromise) return _voicesPromise;
  _voicesPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing && existing.length) return resolve(existing);
    const handler = () => {
      synth.removeEventListener('voiceschanged', handler);
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', handler);
    // Safety timeout — some browsers never fire the event
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', handler);
      resolve(synth.getVoices());
    }, 1500);
  });
  return _voicesPromise;
}

function pickVoice(voices, bcp47) {
  if (!voices || !voices.length) return null;
  const lower = bcp47.toLowerCase();
  const langPrefix = lower.split('-')[0];
  // 1) exact match (e.g. "he-IL")
  let v = voices.find((vv) => vv.lang?.toLowerCase() === lower);
  if (v) return v;
  // 2) same language family (e.g. any "he-*")
  v = voices.find((vv) => vv.lang?.toLowerCase().startsWith(`${langPrefix}-`));
  if (v) return v;
  // 3) bare language match
  v = voices.find((vv) => vv.lang?.toLowerCase() === langPrefix);
  if (v) return v;
  return null;
}

/* ---------- TTS: speak / cancel ---------- */
export async function speak(text, lang = 'en', { onStart, onEnd, onError } = {}) {
  if (!isTTSSupported() || !text) {
    onEnd?.();
    return null;
  }
  const synth = window.speechSynthesis;
  // Cancel anything currently speaking (avoids queued playback surprises).
  try { synth.cancel(); } catch { /* ignore */ }
  const voices = await ensureVoicesLoaded();
  const bcp = toBcp47(lang);
  const voice = pickVoice(voices, bcp);
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = bcp;
  if (voice) utter.voice = voice;
  utter.rate = 1.0;
  utter.pitch = 1.0;
  utter.volume = 1.0;
  if (onStart) utter.onstart = onStart;
  utter.onend = () => { onEnd?.(); };
  utter.onerror = (e) => { onError?.(e); onEnd?.(); };
  try {
    synth.speak(utter);
  } catch (e) {
    onError?.(e);
    onEnd?.();
  }
  return utter;
}

export function cancelSpeak() {
  if (!isTTSSupported()) return;
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
}

/* ---------- STT: create recognition session ----------
 *
 * Returns an object with `start()` and `stop()` methods. The caller supplies
 * callbacks:
 *   onInterim(text)  -> live partial transcript (can be fired many times)
 *   onFinal(text)    -> fires exactly once when recognition ends cleanly
 *   onError(err)     -> fires on recognition errors (permission denied, etc.)
 *   onEnd()          -> always fires when the session stops (after onFinal)
 */
export function createRecognition({
  lang = 'en',
  onInterim,
  onFinal,
  onError,
  onEnd,
} = {}) {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = toBcp47(lang);
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;

  let finalText = '';
  let interimText = '';
  let isStopped = false;

  rec.onresult = (event) => {
    interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const r = event.results[i];
      const chunk = r[0]?.transcript || '';
      if (r.isFinal) {
        finalText += (finalText ? ' ' : '') + chunk.trim();
      } else {
        interimText += chunk;
      }
    }
    const currentCombined = (finalText ? `${finalText} ` : '') + interimText;
    onInterim?.(currentCombined.trim());
  };

  rec.onerror = (event) => {
    // 'no-speech' is non-fatal: user paused or is thinking
    // 'aborted' is non-fatal: stop() or abort() was explicitly invoked
    if (event?.error === 'no-speech' || event?.error === 'aborted') {
      return;
    }
    onError?.(event);
  };

  rec.onend = () => {
    if (!isStopped) {
      const combined = (finalText || interimText || '').trim();
      if (combined) onFinal?.(combined);
      onEnd?.();
    }
  };

  return {
    start: () => {
      finalText = '';
      interimText = '';
      isStopped = false;
      try {
        rec.start();
      } catch (e) {
        onError?.(e);
        onEnd?.();
      }
    },
    stop: () => {
      if (isStopped) return;
      isStopped = true;
      try { rec.stop(); } catch { /* ignore */ }
      const combined = (finalText || interimText || '').trim();
      if (combined) onFinal?.(combined);
      onEnd?.();
    },
    abort: () => {
      isStopped = true;
      try { rec.abort(); } catch { /* ignore */ }
      onEnd?.();
    },
    getTranscript: () => (finalText || interimText || '').trim(),
  };
}

/**
 * Microphone audio recorder using MediaRecorder.
 * Captures clean audio/webm or audio/mp4 blobs for backend multimodal STT.
 */
export function createAudioRecorder({ onError } = {}) {
  let stream = null;
  let mediaRecorder = null;
  let chunks = [];

  return {
    start: async () => {
      chunks = [];
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('Microphone audio capture is not supported in this browser.');
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let mimeType = '';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            mimeType = 'audio/ogg';
          }
        }
        mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        mediaRecorder.start(250);
        return true;
      } catch (err) {
        if (stream) {
          try { stream.getTracks().forEach((t) => t.stop()); } catch {}
          stream = null;
        }
        onError?.(err);
        return false;
      }
    },
    stop: () => {
      return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          if (stream) {
            try { stream.getTracks().forEach((t) => t.stop()); } catch {}
            stream = null;
          }
          resolve(null);
          return;
        }
        mediaRecorder.onstop = () => {
          const type = mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type });
          if (stream) {
            try { stream.getTracks().forEach((t) => t.stop()); } catch {}
            stream = null;
          }
          mediaRecorder = null;
          resolve(blob);
        };
        try {
          mediaRecorder.stop();
        } catch {
          resolve(null);
        }
      });
    },
    abort: () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try { mediaRecorder.stop(); } catch {}
      }
      if (stream) {
        try { stream.getTracks().forEach((t) => t.stop()); } catch {}
        stream = null;
      }
      mediaRecorder = null;
      chunks = [];
    },
  };
}

/**
 * Universal dual-engine Dictation Session:
 * Combines local real-time Web Speech recognition with background MediaRecorder + backend STT fallback.
 */
export async function startDictationSession({
  lang = 'en',
  transcribeFn = null,
  onInterim,
  onFinal,
  onError,
  onStart,
  onEnd,
  onRecordingChange,
} = {}) {
  let finished = false;
  let nativeResult = '';
  const recorder = createAudioRecorder({
    onError: (err) => {
      console.debug('[speech] audio recorder error:', err?.message || err);
    },
  });

  const recorderStarted = await recorder.start();
  if (!recorderStarted && !getSpeechRecognitionCtor()) {
    onError?.(new Error('Microphone access denied or unavailable.'));
    onRecordingChange?.(false);
    return null;
  }

  onRecordingChange?.(true);
  onStart?.();

  let rec = null;
  if (getSpeechRecognitionCtor()) {
    rec = createRecognition({
      lang,
      onInterim: (txt) => {
        if (!finished) onInterim?.(txt);
      },
      onFinal: (txt) => {
        if (txt) nativeResult = txt;
      },
      onError: (err) => {
        console.debug('[speech] native recognition non-fatal error:', err?.error || err);
      },
    });
    try {
      rec.start();
    } catch {
      rec = null;
    }
  }

  const stop = async () => {
    if (finished) return;
    finished = true;
    onRecordingChange?.(false);

    if (rec) {
      try {
        rec.stop();
        const rTxt = rec.getTranscript();
        if (rTxt) nativeResult = rTxt;
      } catch {}
    }

    const audioBlob = await recorder.stop();

    if (nativeResult && nativeResult.trim()) {
      onFinal?.(nativeResult.trim());
      onEnd?.();
      return;
    }

    // If native speech gave no text, fall back to backend transcription
    if (audioBlob && audioBlob.size > 100 && typeof transcribeFn === 'function') {
      try {
        const serverText = await transcribeFn(audioBlob);
        if (serverText && serverText.trim()) {
          onFinal?.(serverText.trim());
          onEnd?.();
          return;
        }
      } catch (err) {
        console.debug('[speech] backend transcribe failed:', err?.message || err);
      }
    }

    onEnd?.();
  };

  return { stop };
}

