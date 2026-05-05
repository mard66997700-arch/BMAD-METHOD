/**
 * Routes translated text to the active TTS provider, returning the resulting
 * audio buffer. The result can be enqueued directly into AudioPlaybackQueue
 * (Story 1.5) by the engine router.
 *
 * Falls back to the next available provider if the active one fails.
 */

import type { TtsEngineId, TtsProvider, TtsRequest, TtsResult } from './tts-types';

export interface TtsEngineRouterOptions {
  providers: TtsProvider[];
}

export class TtsEngineRouter {
  private readonly providers: TtsProvider[];

  constructor(options: TtsEngineRouterOptions) {
    if (options.providers.length === 0) throw new Error('At least one TTS provider is required');
    this.providers = options.providers.slice();
  }

  selectEngine(id: TtsEngineId): void {
    const ix = this.providers.findIndex((p) => p.id === id);
    if (ix < 0) throw new Error(`Unknown TTS engine: ${id}`);
    if (ix > 0) {
      const [picked] = this.providers.splice(ix, 1);
      this.providers.unshift(picked!);
    }
  }

  get activeEngineId(): TtsEngineId {
    return this.providers[0]!.id;
  }

  async synthesize(request: TtsRequest): Promise<TtsResult> {
    let lastError: Error | null = null;
    for (const provider of this.providers) {
      if (!provider.isAvailable()) continue;
      try {
        return await provider.synthesize(request);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError ?? new Error('No TTS provider is available');
  }
}
