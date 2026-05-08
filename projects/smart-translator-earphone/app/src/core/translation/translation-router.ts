/**
 * Routes translation requests to the active provider with multi-engine
 * fallback and an in-memory LRU cache.
 *
 * The router is event-driven on the provider side (each provider is a simple
 * request/response object), but we add a small async API on top:
 *
 *   const result = await router.translate({ text, sourceLang, targetLang });
 *
 * Cache keys are `${sourceLang}:${targetLang}:${text}` and the cache holds
 * the last `cacheSize` entries (default 200). This is a hot optimization for
 * conversation mode, where short common phrases ("yes", "ok", "thank you")
 * repeat constantly.
 */

import { applyGlossary, restoreGlossary, type GlossaryEntry } from './glossary';
import type {
  TranslationEngineId,
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from './translation-types';

export interface TranslationRouterOptions {
  /** Ordered list of providers; first is primary, rest are fallbacks. */
  providers: TranslationProvider[];
  /** LRU cache size (per direction). Default 200. */
  cacheSize?: number;
  /**
   * Optional glossary applied around every translate() / translateStream()
   * call. Source matches are replaced with opaque tokens before the
   * provider call and the user's chosen target term is restored after.
   */
  glossary?: readonly GlossaryEntry[];
}

export class TranslationRouter {
  private readonly providers: TranslationProvider[];
  private readonly cache = new Map<string, TranslationResult>();
  private readonly cacheSize: number;
  private glossary: readonly GlossaryEntry[];

  constructor(options: TranslationRouterOptions) {
    if (options.providers.length === 0) {
      throw new Error('At least one translation provider is required');
    }
    this.providers = options.providers.slice();
    this.cacheSize = options.cacheSize ?? 200;
    this.glossary = options.glossary ?? [];
  }

  /** Replace the active glossary. Clears the cache so previously cached
   * translations don't leak yesterday's term mappings. */
  setGlossary(entries: readonly GlossaryEntry[]): void {
    this.glossary = entries.slice();
    this.cache.clear();
  }

  /** Inspect the active glossary. Returns a defensive copy. */
  getGlossary(): GlossaryEntry[] {
    return this.glossary.slice();
  }

  /** Set the active engine by id; falls back to the next available engine on failure. */
  selectEngine(id: TranslationEngineId): void {
    const ix = this.providers.findIndex((p) => p.id === id);
    if (ix < 0) throw new Error(`Unknown translation engine: ${id}`);
    if (ix > 0) {
      const [picked] = this.providers.splice(ix, 1);
      this.providers.unshift(picked!);
    }
  }

  get activeEngineId(): TranslationEngineId {
    return this.providers[0]!.id;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (request.text.trim().length === 0) {
      return {
        text: '',
        sourceLang: request.sourceLang === 'auto' ? 'auto' : request.sourceLang,
        targetLang: request.targetLang,
        engine: this.providers[0]!.id,
      };
    }
    const key = cacheKey(request);
    const cached = this.cache.get(key);
    if (cached) {
      // Refresh LRU position.
      this.cache.delete(key);
      this.cache.set(key, cached);
      return { ...cached, cached: true };
    }
    const applied = applyGlossary(
      request.text,
      this.glossary,
      request.sourceLang,
      request.targetLang,
    );
    const providerRequest: TranslationRequest = applied.placeholders.size === 0
      ? request
      : { ...request, text: applied.text };
    let lastError: Error | null = null;
    for (const provider of this.providers) {
      if (!provider.isAvailable()) continue;
      try {
        const raw = await provider.translate(providerRequest);
        const result: TranslationResult = applied.placeholders.size === 0
          ? raw
          : { ...raw, text: restoreGlossary(raw.text, applied.placeholders) };
        this.recordCache(key, result);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError ?? new Error('No translation provider is available');
  }

  /**
   * Streaming variant. If the active provider supports streaming, yields
   * partials. Otherwise yields a single full result.
   */
  async *translateStream(request: TranslationRequest): AsyncIterable<string> {
    if (request.text.trim().length === 0) {
      yield '';
      return;
    }
    const key = cacheKey(request);
    const cached = this.cache.get(key);
    if (cached) {
      yield cached.text;
      return;
    }
    const applied = applyGlossary(
      request.text,
      this.glossary,
      request.sourceLang,
      request.targetLang,
    );
    const providerRequest: TranslationRequest = applied.placeholders.size === 0
      ? request
      : { ...request, text: applied.text };
    for (const provider of this.providers) {
      if (!provider.isAvailable()) continue;
      try {
        if (provider.translateStream) {
          let last = '';
          for await (const partial of provider.translateStream(providerRequest)) {
            last = partial;
            yield restoreGlossary(partial, applied.placeholders);
          }
          this.recordCache(key, {
            text: restoreGlossary(last, applied.placeholders),
            sourceLang: request.sourceLang === 'auto' ? 'auto' : request.sourceLang,
            targetLang: request.targetLang,
            engine: provider.id,
          });
        } else {
          const raw = await provider.translate(providerRequest);
          const result: TranslationResult = applied.placeholders.size === 0
            ? raw
            : { ...raw, text: restoreGlossary(raw.text, applied.placeholders) };
          this.recordCache(key, result);
          yield result.text;
        }
        return;
      } catch {
        // Try the next provider.
      }
    }
    throw new Error('No translation provider is available');
  }

  private recordCache(key: string, result: TranslationResult): void {
    this.cache.set(key, result);
    while (this.cache.size > this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) break;
      this.cache.delete(firstKey);
    }
  }
}

function cacheKey(request: TranslationRequest): string {
  return `${request.sourceLang}:${request.targetLang}:${request.text}`;
}
