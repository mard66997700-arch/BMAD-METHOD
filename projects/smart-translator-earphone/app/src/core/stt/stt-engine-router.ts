/**
 * Routes audio chunks from the AudioPipeline to the active STT provider.
 *
 * The router holds:
 *   - A primary provider (chosen by id) and an ordered list of fallbacks.
 *   - A single active session at a time. The router opens a session lazily
 *     on the first chunk and closes it when `stop()` is called.
 *   - A LanguageDetector that aggregates the per-final detected-language hint
 *     across the session.
 *
 * Provider failures (SttError, recoverable=true) cause the router to mark the
 * provider as failed and re-create the session against the next fallback,
 * forwarding subsequent chunks there.
 */

import type { AudioChunk } from '../audio/audio-types';
import { LanguageDetector, type LanguageDetectorOptions } from './language-detector';
import type {
  SttEngineId,
  SttEvent,
  SttEventListener,
  SttProvider,
  SttSession,
  SttSessionOptions,
} from './stt-types';

export interface SttEngineRouterOptions {
  /** Ordered list of providers; first is primary, rest are fallbacks. */
  providers: SttProvider[];
  /** Optional language-detector configuration. */
  languageDetector?: LanguageDetectorOptions;
  /** Default session options. Source language defaults to 'auto'. */
  sessionDefaults?: Partial<SttSessionOptions>;
}

export class SttEngineRouter {
  private readonly providers: SttProvider[];
  private readonly listeners = new Set<SttEventListener>();
  private readonly languageDetector: LanguageDetector;
  private active: { provider: SttProvider; session: SttSession; unsubscribe: () => void } | null = null;
  private currentSessionOptions: SttSessionOptions;
  private failed: Set<SttEngineId> = new Set();

  constructor(options: SttEngineRouterOptions) {
    if (options.providers.length === 0) throw new Error('At least one STT provider is required');
    this.providers = options.providers.slice();
    this.languageDetector = new LanguageDetector(options.languageDetector);
    this.currentSessionOptions = {
      sourceLang: options.sessionDefaults?.sourceLang ?? 'auto',
      sampleRateHz: options.sessionDefaults?.sampleRateHz,
      speakerId: options.sessionDefaults?.speakerId,
    };
  }

  /** Set the active engine by id. The next pushed chunk opens a session. */
  selectEngine(id: SttEngineId): void {
    const ix = this.providers.findIndex((p) => p.id === id);
    if (ix < 0) throw new Error(`Unknown STT engine: ${id}`);
    if (ix > 0) {
      // Move selected provider to the front.
      const [picked] = this.providers.splice(ix, 1);
      this.providers.unshift(picked!);
    }
    this.failed.clear();
    if (this.active) void this.closeActive();
  }

  /** Set the source language (or 'auto') for the next session. */
  setSourceLanguage(lang: string | 'auto'): void {
    this.currentSessionOptions = { ...this.currentSessionOptions, sourceLang: lang };
    if (this.active) void this.closeActive();
  }

  /**
   * Push a chunk to the active session, opening one if needed. Returns a
   * promise that resolves once the chunk has been forwarded; failures are
   * surfaced via the SttEvent stream, not by rejecting.
   */
  async pushChunk(chunk: AudioChunk): Promise<void> {
    if (!this.active) {
      const opened = await this.openNext();
      if (!opened) return;
    }
    this.active!.session.pushChunk(chunk);
  }

  on(listener: SttEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Currently active engine id, or null if no session is open. */
  get activeEngineId(): SttEngineId | null {
    return this.active?.provider.id ?? null;
  }

  /** Best-guess detected language so far. */
  detectedLang(): string {
    return this.languageDetector.bestLang();
  }

  async stop(): Promise<void> {
    await this.closeActive();
  }

  private async openNext(): Promise<boolean> {
    for (const provider of this.providers) {
      if (this.failed.has(provider.id)) continue;
      if (!provider.isAvailable()) continue;
      const session = await provider.createSession(this.currentSessionOptions);
      const unsubscribe = session.on((event) => this.handleEvent(provider, event));
      this.active = { provider, session, unsubscribe };
      return true;
    }
    // No providers could open. Surface a synthetic error so the UI can
    // distinguish this from "no speech yet".
    this.emit({
      type: 'error',
      sessionId: 'router',
      error: new Error('No STT provider is available'),
      recoverable: false,
    });
    return false;
  }

  private handleEvent(provider: SttProvider, event: SttEvent): void {
    if (event.type === 'final' || event.type === 'partial') {
      this.languageDetector.observe(event.detectedLang);
    }
    if (event.type === 'error' && event.recoverable) {
      this.failed.add(provider.id);
      this.emit(event);
      void this.closeActive();
      return;
    }
    this.emit(event);
  }

  private async closeActive(): Promise<void> {
    if (!this.active) return;
    const { session, unsubscribe } = this.active;
    this.active = null;
    unsubscribe();
    try {
      await session.close();
    } catch {
      // Closing a session must not throw out of the router.
    }
  }

  private emit(event: SttEvent): void {
    for (const l of this.listeners) l(event);
  }
}
