/**
 * Pure pipeline used by the offscreen document. Buffers incoming PCM
 * samples, batches them into fixed-length segments, and runs each
 * segment through STT → translation → (optional) TTS.
 *
 * Extracted from `offscreen.js` so it can be unit-tested without the
 * `chrome.*` / `speechSynthesis` APIs that the offscreen document owns.
 *
 * Dependency injection makes this trivial to drive from tests: callers
 * supply `transcribe`, `translate`, `speak`, and `report` callbacks.
 */

export const SAMPLE_RATE_HZ = 16_000;
export const CHUNK_SECONDS = 4;
export const CHUNK_SAMPLES = SAMPLE_RATE_HZ * CHUNK_SECONDS;

/**
 * @typedef {object} TranslatorConfig
 * @property {string} sourceLang  ISO code or `'auto'`.
 * @property {string} targetLang  Target ISO code.
 * @property {boolean} [tts]      Whether to invoke `speak` (default true).
 *
 * @typedef {object} SttResult
 * @property {string} text
 * @property {string} [detectedLang]
 *
 * @typedef {object} TranslateResult
 * @property {string} text
 * @property {string} [detectedLang]
 *
 * @typedef {object} TranslatorDeps
 * @property {(pcm: Int16Array, signal?: AbortSignal) => Promise<SttResult>} transcribe
 * @property {(args: { text: string; sourceLang: string; targetLang: string; signal?: AbortSignal }) => Promise<TranslateResult>} translate
 * @property {(text: string, lang: string) => void} speak
 * @property {(payload: Record<string, unknown>) => void} report
 * @property {AbortSignal} [signal]
 * @property {number} [chunkSamples] Override `CHUNK_SAMPLES` (tests use a small value).
 */

/**
 * Build a translator instance.
 *
 * @param {TranslatorConfig} config
 * @param {TranslatorDeps} deps
 * @returns {{ onPcm: (chunk: Int16Array) => void; flush: () => Promise<void>; isBusy: () => boolean }}
 */
export function createTranslator(config, deps) {
  const { transcribe, translate, speak, report, signal } = deps;
  const chunkSamples = deps.chunkSamples ?? CHUNK_SAMPLES;
  let buffer = new Int16Array(0);
  let busy = false;
  /** @type {Promise<void> | null} */
  let inflight = null;

  function onPcm(chunk) {
    const merged = new Int16Array(buffer.length + chunk.length);
    merged.set(buffer);
    merged.set(chunk, buffer.length);
    buffer = merged;
    pumpIfReady();
  }

  function pumpIfReady() {
    if (busy) return;
    if (buffer.length < chunkSamples) return;
    const segment = buffer.subarray(0, chunkSamples);
    buffer = buffer.subarray(chunkSamples);
    inflight = translateSegment(new Int16Array(segment));
  }

  async function translateSegment(pcm) {
    busy = true;
    try {
      const stt = await transcribe(pcm, signal);
      if (!stt.text) return;
      report({
        kind: 'partial',
        text: stt.text,
        detectedLang: stt.detectedLang,
      });
      const tr = await translate({
        text: stt.text,
        sourceLang: stt.detectedLang ?? config.sourceLang,
        targetLang: config.targetLang,
        signal,
      });
      report({
        kind: 'translation',
        original: stt.text,
        translated: tr.text,
        detectedLang: tr.detectedLang ?? stt.detectedLang,
      });
      if (config.tts !== false && tr.text) {
        speak(tr.text, config.targetLang);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      report({ kind: 'error', message: err?.message ?? String(err) });
    } finally {
      busy = false;
      pumpIfReady();
    }
  }

  /** Drain any in-flight work. Mostly useful in tests. */
  async function flush() {
    while (inflight) {
      const current = inflight;
      inflight = null;
      // eslint-disable-next-line no-await-in-loop
      await current;
    }
  }

  return {
    onPcm,
    flush,
    isBusy: () => busy,
  };
}
