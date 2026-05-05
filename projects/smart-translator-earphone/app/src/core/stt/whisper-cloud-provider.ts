/**
 * OpenAI Whisper STT provider.
 *
 * Whisper does not (as of writing) expose a browser-friendly streaming
 * WebSocket API; instead we batch each utterance-aligned chunk and POST it to
 * `POST /v1/audio/transcriptions`. Partial transcripts are emitted as soon
 * as a chunk completes; finals are emitted on utterance boundaries.
 *
 * The provider degrades gracefully:
 *  - If `OPENAI_API_KEY` is not set, `isAvailable()` returns false and the
 *    router falls back to the next provider in the chain (mock by default).
 *  - On any transport error, an SttError is emitted (recoverable=true) so the
 *    router can decide whether to retry or fall back.
 */

import type { AudioChunk } from '../audio/audio-types';
import { encodeWavInt16 } from './audio-encoding';
import type {
  SttEvent,
  SttEventListener,
  SttProvider,
  SttSession,
  SttSessionOptions,
} from './stt-types';

const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

export interface WhisperCloudOptions {
  apiKey: string;
  model?: string;
  /** Override fetch (used by tests). */
  fetchFn?: typeof fetch;
}

export class WhisperCloudProvider implements SttProvider {
  readonly id = 'whisper-cloud' as const;

  constructor(private readonly opts: WhisperCloudOptions) {}

  isAvailable(): boolean {
    return Boolean(this.opts.apiKey);
  }

  async createSession(options: SttSessionOptions): Promise<SttSession> {
    return new WhisperCloudSession(options, this.opts);
  }
}

let sessionCounter = 0;

class WhisperCloudSession implements SttSession {
  readonly id: string;
  private readonly listeners = new Set<SttEventListener>();
  private utteranceStartMs: number | null = null;
  private utteranceFrames: Int16Array[] = [];
  private utteranceDurationMs = 0;
  private closed = false;
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly sessionOptions: SttSessionOptions,
    private readonly providerOptions: WhisperCloudOptions,
  ) {
    sessionCounter += 1;
    this.id = `whisper-${sessionCounter}`;
  }

  pushChunk(chunk: AudioChunk): void {
    if (this.closed) return;
    if (this.utteranceStartMs === null) this.utteranceStartMs = chunk.startTimestampMs;
    this.utteranceFrames.push(chunk.samples);
    this.utteranceDurationMs += chunk.durationMs;

    if (chunk.utteranceBoundary || chunk.final) {
      void this.flushUtterance(/* final */ true);
    } else {
      // Optionally emit a partial mid-utterance — we only emit one when the
      // chunk is large enough to be worth a round-trip (>= ~1s of audio).
      if (this.utteranceDurationMs >= 900 && !this.inFlight) {
        void this.flushUtterance(/* final */ false);
      }
    }
  }

  on(listener: SttEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.utteranceFrames.length > 0) {
      await this.flushUtterance(true);
    }
    if (this.inFlight) await this.inFlight;
  }

  private async flushUtterance(final: boolean): Promise<void> {
    const frames = this.utteranceFrames;
    if (frames.length === 0) return;
    const start = this.utteranceStartMs ?? 0;
    const durationMs = this.utteranceDurationMs;
    if (final) {
      this.utteranceFrames = [];
      this.utteranceDurationMs = 0;
      this.utteranceStartMs = null;
    }
    const merged = mergeInt16(frames);
    const wav = encodeWavInt16(merged, this.sessionOptions.sampleRateHz ?? 16_000);
    const fetchFn = this.providerOptions.fetchFn ?? fetch;
    const promise = (async () => {
      try {
        const form = new FormData();
        form.append('file', new Blob([wav], { type: 'audio/wav' }), 'utterance.wav');
        form.append('model', this.providerOptions.model ?? 'whisper-1');
        if (this.sessionOptions.sourceLang && this.sessionOptions.sourceLang !== 'auto') {
          form.append('language', this.sessionOptions.sourceLang);
        }
        const res = await fetchFn(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.providerOptions.apiKey}` },
          body: form,
        });
        if (!res.ok) {
          throw new Error(`Whisper HTTP ${res.status}`);
        }
        const json = (await res.json()) as { text?: string; language?: string };
        const text = json.text?.trim() ?? '';
        if (final) {
          this.emit({
            type: 'final',
            sessionId: this.id,
            text,
            detectedLang: json.language,
            startTimestampMs: start,
            durationMs,
            confidence: 0.9,
          });
        } else {
          this.emit({
            type: 'partial',
            sessionId: this.id,
            text,
            detectedLang: json.language,
            startTimestampMs: start,
            confidence: 0.7,
          });
        }
      } catch (err) {
        this.emit({
          type: 'error',
          sessionId: this.id,
          error: err instanceof Error ? err : new Error(String(err)),
          recoverable: true,
        });
      } finally {
        this.inFlight = null;
      }
    })();
    this.inFlight = promise;
    await promise;
  }

  private emit(event: SttEvent): void {
    for (const l of this.listeners) l(event);
  }
}

function mergeInt16(frames: Int16Array[]): Int16Array {
  const total = frames.reduce((acc, f) => acc + f.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const f of frames) {
    out.set(f, offset);
    offset += f.length;
  }
  return out;
}
