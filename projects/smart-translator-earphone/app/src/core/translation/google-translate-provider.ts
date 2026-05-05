/**
 * Google Cloud Translation API provider (v2 — REST, simple key auth).
 *
 * Endpoint: https://translation.googleapis.com/language/translate/v2
 *
 * This is the "fast and cheap" fallback in our router chain; it doesn't do
 * context-aware translation but it returns within a few hundred ms and
 * supports 100+ languages.
 */

import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from './translation-types';

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

export interface GoogleTranslateOptions {
  apiKey: string;
  /** Override fetch (used by tests). */
  fetchFn?: typeof fetch;
}

export class GoogleTranslateProvider implements TranslationProvider {
  readonly id = 'google' as const;

  constructor(private readonly opts: GoogleTranslateOptions) {}

  isAvailable(): boolean {
    return Boolean(this.opts.apiKey);
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const fetchFn = this.opts.fetchFn ?? fetch;
    const url = `${ENDPOINT}?key=${encodeURIComponent(this.opts.apiKey)}`;
    const body: Record<string, string> = {
      q: request.text,
      target: request.targetLang,
      format: 'text',
    };
    if (request.sourceLang && request.sourceLang !== 'auto') body.source = request.sourceLang;
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);
    const json = (await res.json()) as {
      data?: {
        translations?: Array<{ translatedText: string; detectedSourceLanguage?: string }>;
      };
    };
    const top = json.data?.translations?.[0];
    if (!top) throw new Error('Google Translate returned no translations');
    return {
      text: top.translatedText,
      sourceLang: top.detectedSourceLanguage ?? request.sourceLang ?? 'auto',
      targetLang: request.targetLang,
      engine: 'google',
    };
  }
}
