/**
 * Epic 3 — Translation provider interface.
 *
 * Translation is a stateless request/response API: given source text + langs,
 * return translated text. Some providers (OpenAI) support streaming the
 * response so the UI can update word-by-word; we expose that via an
 * AsyncIterable<string> so callers can either await the full result or stream
 * partials.
 */

export type TranslationEngineId = 'mock' | 'deepl' | 'openai' | 'google';

export interface TranslationRequest {
  text: string;
  sourceLang: string | 'auto';
  targetLang: string;
  /** Optional context for nuanced/contextual providers (OpenAI). */
  context?: string;
}

export interface TranslationResult {
  text: string;
  sourceLang: string;
  targetLang: string;
  /** Provider-specific confidence in [0, 1]. Optional. */
  confidence?: number;
  /** Cache hit indicator (true if the result came from the in-memory cache). */
  cached?: boolean;
  /** Engine that produced the result. */
  engine: TranslationEngineId;
}

export interface TranslationProvider {
  readonly id: TranslationEngineId;
  isAvailable(): boolean;
  translate(request: TranslationRequest): Promise<TranslationResult>;
  /**
   * Optional streaming variant. Yields incremental partial translations
   * (each yield is the full translation so far, not a delta). Providers that
   * don't support streaming should leave this undefined; the router will
   * fall back to the regular `translate()` call.
   */
  translateStream?(request: TranslationRequest): AsyncIterable<string>;
}
