/**
 * DeepL translation provider.
 *
 * Uses the DeepL API v2 free/pro endpoint:
 *   POST https://api(-free).deepl.com/v2/translate
 *
 * The provider auto-detects the right host based on whether the supplied API
 * key ends in ":fx" (free tier) — this matches DeepL's documented convention.
 */

import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from './translation-types';

export interface DeeplOptions {
  apiKey: string;
  /** Override fetch (used by tests). */
  fetchFn?: typeof fetch;
}

export class DeeplProvider implements TranslationProvider {
  readonly id = 'deepl' as const;

  constructor(private readonly opts: DeeplOptions) {}

  isAvailable(): boolean {
    return Boolean(this.opts.apiKey);
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const fetchFn = this.opts.fetchFn ?? fetch;
    const host = this.opts.apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const params = new URLSearchParams({
      text: request.text,
      target_lang: request.targetLang.toUpperCase(),
    });
    if (request.sourceLang && request.sourceLang !== 'auto') {
      params.set('source_lang', request.sourceLang.toUpperCase());
    }
    const res = await fetchFn(`${host}/v2/translate`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${this.opts.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) throw new Error(`DeepL HTTP ${res.status}`);
    const json = (await res.json()) as {
      translations?: Array<{ text: string; detected_source_language?: string }>;
    };
    const top = json.translations?.[0];
    if (!top) throw new Error('DeepL returned no translations');
    return {
      text: top.text,
      sourceLang: top.detected_source_language?.toLowerCase() ?? request.sourceLang ?? 'auto',
      targetLang: request.targetLang,
      engine: 'deepl',
    };
  }
}
