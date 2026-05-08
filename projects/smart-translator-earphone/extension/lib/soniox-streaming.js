/**
 * Streaming STT over Soniox WebSocket
 * (https://soniox.com/docs/speech-to-text/api-reference/websocket).
 *
 * Drops latency from the batch endpoint's chunk-length floor (~4 s) to
 * the websocket's natural cadence (~250 ms) by sending raw PCM frames
 * as they arrive and surfacing partial / final tokens incrementally.
 *
 * Translation is left to the existing free Google Translate step in
 * `offscreen.js` so the extension's fallback behaviour stays consistent
 * across STT engines.
 *
 * Soniox is a paid service. The free trial covers ~200 minutes; after
 * that it bills per-minute. Sign up at https://console.soniox.com to
 * get a key.
 */

const WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';
const DEFAULT_MODEL = 'stt-rt-preview';

/**
 * @typedef SonioxOptions
 * @property {string} apiKey
 * @property {string} sourceLang  Either an ISO 639-1 code or `'auto'`.
 * @property {number} sampleRateHz
 * @property {(text: string) => void} onPartial
 * @property {(text: string, detectedLang?: string) => void} onFinal
 * @property {(err: Error) => void} [onError]
 * @property {string} [model]   Override the default Soniox model.
 */

export class SonioxStreaming {
  /** @param {SonioxOptions} opts */
  constructor(opts) {
    this.opts = opts;
    /** @type {WebSocket | null} */
    this.ws = null;
    this.pendingPartial = '';
    this.queuedFrames = [];
    this.opened = false;
    this.stopped = false;
  }

  async start() {
    this.stopped = false;
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      ws.addEventListener('open', () => {
        this.opened = true;
        const { apiKey, sourceLang, sampleRateHz, model } = this.opts;
        const config = {
          api_key: apiKey,
          audio_format: 'pcm_s16le',
          sample_rate: sampleRateHz,
          num_channels: 1,
          model: model ?? DEFAULT_MODEL,
          enable_language_identification: true,
        };
        if (sourceLang && sourceLang !== 'auto') {
          config.language_hints = [sourceLang];
        }
        ws.send(JSON.stringify(config));
        for (const frame of this.queuedFrames) ws.send(frame);
        this.queuedFrames = [];
        if (!settled) {
          settled = true;
          resolve();
        }
      });
      ws.addEventListener('message', (ev) => this.handleMessage(ev));
      ws.addEventListener('error', () => {
        const err = new Error('Soniox websocket error');
        if (!settled) {
          settled = true;
          reject(err);
        } else {
          this.opts.onError?.(err);
        }
      });
      ws.addEventListener('close', (ev) => {
        if (!settled) {
          settled = true;
          reject(new Error(`Soniox websocket closed before open (code ${ev.code})`));
        }
        this.opened = false;
      });
    });
  }

  /** @param {Int16Array} pcm */
  pushPcm(pcm) {
    if (this.stopped) return;
    const frame = pcm.buffer.byteLength === pcm.byteLength ? pcm.buffer : pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength);
    if (this.opened && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    } else {
      this.queuedFrames.push(frame);
    }
  }

  /** @param {MessageEvent} ev */
  handleMessage(ev) {
    let payload;
    try {
      payload = typeof ev.data === 'string' ? JSON.parse(ev.data) : null;
    } catch {
      return;
    }
    if (!payload) return;
    if (payload.error_code || payload.error_message) {
      this.opts.onError?.(new Error(`Soniox error ${payload.error_code ?? ''}: ${payload.error_message ?? ''}`));
      return;
    }
    const tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
    if (tokens.length === 0) return;
    let finalText = '';
    let partialText = '';
    let detectedLang;
    for (const token of tokens) {
      if (typeof token?.text !== 'string') continue;
      if (token.language && !detectedLang) detectedLang = token.language;
      if (token.is_final) finalText += token.text;
      else partialText += token.text;
    }
    finalText = finalText.trim();
    partialText = partialText.trim();
    if (finalText.length > 0) {
      this.pendingPartial = '';
      this.opts.onFinal(finalText, detectedLang);
    }
    if (partialText.length > 0) {
      const merged = (this.pendingPartial + ' ' + partialText).trim();
      this.pendingPartial = merged;
      this.opts.onPartial(merged);
    }
  }

  async stop() {
    this.stopped = true;
    this.queuedFrames = [];
    if (!this.ws) return;
    try {
      // Empty binary frame signals end-of-stream to Soniox.
      if (this.ws.readyState === WebSocket.OPEN) this.ws.send(new ArrayBuffer(0));
    } catch {
      /* ignore */
    }
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.opened = false;
  }
}
