/**
 * Google Cloud Speech-to-Text provider.
 *
 * We use the REST `speech:recognize` endpoint (batch per utterance) instead
 * of the bidi-streaming gRPC endpoint, because:
 *   - gRPC streaming is awkward in React Native / browsers without auxiliary
 *     servers and proxies.
 *   - Batch-per-utterance is sufficient for our 1–2 s VAD-aligned chunks and
 *     yields production-grade quality.
 *
 * Tradeoff: partials are NOT emitted by Google in this mode. We emit a single
 * final per utterance.
 */

import type { AudioChunk } from '../audio/audio-types';
import type {
  SttEvent,
  SttEventListener,
  SttProvider,
  SttSession,
  SttSessionOptions,
} from './stt-types';

const ENDPOINT = 'https://speech.googleapis.com/v1/speech:recognize';

export interface GoogleSttOptions {
  apiKey: string;
  /** Override fetch (used by tests). */
  fetchFn?: typeof fetch;
}

export class GoogleSttProvider implements SttProvider {
  readonly id = 'google' as const;

  constructor(private readonly opts: GoogleSttOptions) {}

  isAvailable(): boolean {
    return Boolean(this.opts.apiKey);
  }

  async createSession(options: SttSessionOptions): Promise<SttSession> {
    return new GoogleSttSession(options, this.opts);
  }
}

let sessionCounter = 0;

class GoogleSttSession implements SttSession {
  readonly id: string;
  private readonly listeners = new Set<SttEventListener>();
  private utteranceStartMs: number | null = null;
  private utteranceFrames: Int16Array[] = [];
  private utteranceDurationMs = 0;
  private closed = false;
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly sessionOptions: SttSessionOptions,
    private readonly providerOptions: GoogleSttOptions,
  ) {
    sessionCounter += 1;
    this.id = `google-stt-${sessionCounter}`;
  }

  pushChunk(chunk: AudioChunk): void {
    if (this.closed) return;
    if (this.utteranceStartMs === null) this.utteranceStartMs = chunk.startTimestampMs;
    this.utteranceFrames.push(chunk.samples);
    this.utteranceDurationMs += chunk.durationMs;
    if (chunk.utteranceBoundary || chunk.final) {
      void this.flushUtterance();
    }
  }

  on(listener: SttEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.utteranceFrames.length > 0) await this.flushUtterance();
    if (this.inFlight) await this.inFlight;
  }

  private async flushUtterance(): Promise<void> {
    const frames = this.utteranceFrames;
    if (frames.length === 0) return;
    const start = this.utteranceStartMs ?? 0;
    const durationMs = this.utteranceDurationMs;
    this.utteranceFrames = [];
    this.utteranceDurationMs = 0;
    this.utteranceStartMs = null;
    const merged = mergeInt16(frames);
    const base64 = base64FromInt16(merged);
    const fetchFn = this.providerOptions.fetchFn ?? fetch;
    const lang = this.sessionOptions.sourceLang === 'auto' ? 'en-US' : this.sessionOptions.sourceLang;

    const promise = (async () => {
      try {
        const url = `${ENDPOINT}?key=${encodeURIComponent(this.providerOptions.apiKey)}`;
        const res = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              encoding: 'LINEAR16',
              sampleRateHertz: this.sessionOptions.sampleRateHz ?? 16_000,
              languageCode: lang,
              enableAutomaticPunctuation: true,
            },
            audio: { content: base64 },
          }),
        });
        if (!res.ok) throw new Error(`Google STT HTTP ${res.status}`);
        const json = (await res.json()) as {
          results?: Array<{
            alternatives?: Array<{ transcript?: string; confidence?: number }>;
            languageCode?: string;
          }>;
        };
        const top = json.results?.[0]?.alternatives?.[0];
        const text = top?.transcript?.trim() ?? '';
        this.emit({
          type: 'final',
          sessionId: this.id,
          text,
          detectedLang: json.results?.[0]?.languageCode,
          startTimestampMs: start,
          durationMs,
          confidence: top?.confidence,
        });
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

function base64FromInt16(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  // btoa is available in browser/RN. The cast keeps Node typecheck happy.
  return (globalThis as unknown as { btoa: (s: string) => string }).btoa(binary);
}
