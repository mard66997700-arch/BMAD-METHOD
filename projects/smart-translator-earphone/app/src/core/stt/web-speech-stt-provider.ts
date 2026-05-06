/**
 * Web Speech API STT provider — wraps the browser's built-in
 * `SpeechRecognition` (Chrome / Edge / WebKit). Works without any API key
 * and runs entirely on-device, but is web-only and quality varies by
 * browser/locale.
 *
 * The browser owns mic capture independently of our `AudioPipeline`, so
 * `pushChunk()` is a no-op — the pipeline still runs (and may double-tap
 * the microphone), but its chunks are ignored. Recognition results are
 * forwarded to subscribers as the standard `SttPartial` / `SttFinal` event
 * stream so the rest of the engine router doesn't need to know whether
 * STT is hosted locally or in the cloud.
 */

import type { AudioChunk } from '../audio/audio-types';
import type {
  SttEvent,
  SttEventListener,
  SttProvider,
  SttSession,
  SttSessionOptions,
} from './stt-types';

/**
 * Minimal structural type for the bits of `SpeechRecognition` we use.
 * Defined locally so this file compiles in non-DOM environments
 * (Node / Jest) without relying on `lib.dom.d.ts`.
 */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionResultEventLike {
  resultIndex?: number;
  results: ArrayLike<{
    isFinal: boolean;
    0?: { transcript: string; confidence?: number };
  }>;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const g = globalThis as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

let sessionCounter = 0;

export interface WebSpeechSttOptions {
  /** Inject a constructor for tests / non-browser hosts. */
  ctor?: SpeechRecognitionCtor;
}

export class WebSpeechSttProvider implements SttProvider {
  readonly id = 'web-speech' as const;

  constructor(private readonly opts: WebSpeechSttOptions = {}) {}

  isAvailable(): boolean {
    return (this.opts.ctor ?? getSpeechRecognitionCtor()) !== null;
  }

  async createSession(options: SttSessionOptions): Promise<SttSession> {
    const ctor = this.opts.ctor ?? getSpeechRecognitionCtor();
    if (!ctor) {
      throw new Error('Web Speech API SpeechRecognition is not available in this environment');
    }
    return new WebSpeechSttSession(ctor, options);
  }
}

export class WebSpeechSttSession implements SttSession {
  readonly id: string;
  private readonly listeners = new Set<SttEventListener>();
  private readonly recognition: SpeechRecognitionLike;
  private readonly detectedLang: string;
  private closed = false;
  private readonly startedAtMs: number;

  constructor(ctor: SpeechRecognitionCtor, options: SttSessionOptions) {
    sessionCounter += 1;
    this.id = `web-speech-stt-${sessionCounter}`;
    this.detectedLang = options.sourceLang === 'auto' ? '' : options.sourceLang;
    this.startedAtMs = Date.now();
    this.recognition = new ctor();
    this.recognition.lang = options.sourceLang === 'auto' ? '' : options.sourceLang;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.onresult = (ev) => this.handleResult(ev);
    this.recognition.onerror = (ev) => {
      const code = ev.error ?? 'unknown';
      this.emit({
        type: 'error',
        sessionId: this.id,
        error: new Error(`Web Speech recognition error: ${code}`),
        recoverable: code !== 'not-allowed' && code !== 'service-not-allowed',
      });
    };
    this.recognition.onend = () => {
      // `continuous = true` still ends after silence on some platforms;
      // restart so the user can keep speaking until they explicitly stop.
      if (!this.closed) {
        try {
          this.recognition.start();
        } catch {
          /* may still be starting — ignore */
        }
      }
    };
    try {
      this.recognition.start();
    } catch {
      /* may already be running */
    }
  }

  pushChunk(_chunk: AudioChunk): void {
    // No-op: the browser captures the microphone directly.
  }

  on(listener: SttEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      this.recognition.stop();
    } catch {
      /* swallow */
    }
  }

  private handleResult(ev: SpeechRecognitionResultEventLike): void {
    if (this.closed) return;
    const results = ev.results;
    const startIdx = ev.resultIndex ?? 0;
    for (let i = startIdx; i < results.length; i++) {
      const res = results[i];
      if (!res) continue;
      const alt = res[0];
      if (!alt) continue;
      const text = alt.transcript ?? '';
      const confidence = typeof alt.confidence === 'number' ? alt.confidence : undefined;
      const elapsedMs = Date.now() - this.startedAtMs;
      if (res.isFinal) {
        this.emit({
          type: 'final',
          sessionId: this.id,
          text,
          detectedLang: this.detectedLang || undefined,
          startTimestampMs: elapsedMs,
          durationMs: 0,
          confidence,
        });
      } else {
        this.emit({
          type: 'partial',
          sessionId: this.id,
          text,
          detectedLang: this.detectedLang || undefined,
          startTimestampMs: elapsedMs,
          confidence,
        });
      }
    }
  }

  private emit(ev: SttEvent): void {
    for (const l of this.listeners) l(ev);
  }
}
