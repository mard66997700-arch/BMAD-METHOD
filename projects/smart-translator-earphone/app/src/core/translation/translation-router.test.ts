import { MockTranslationProvider } from './mock-translation-provider';
import { TranslationRouter } from './translation-router';
import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from './translation-types';

class FailingProvider implements TranslationProvider {
  readonly id = 'deepl' as const;
  isAvailable(): boolean {
    return true;
  }
  async translate(_req: TranslationRequest): Promise<TranslationResult> {
    throw new Error('deepl down');
  }
}

class CountingProvider implements TranslationProvider {
  readonly id = 'openai' as const;
  calls = 0;
  isAvailable(): boolean {
    return true;
  }
  async translate(req: TranslationRequest): Promise<TranslationResult> {
    this.calls += 1;
    return {
      text: `[${req.targetLang}] ${req.text}`,
      sourceLang: req.sourceLang === 'auto' ? 'auto' : req.sourceLang,
      targetLang: req.targetLang,
      engine: 'openai',
    };
  }
}

describe('TranslationRouter', () => {
  test('returns translation from the first available provider', async () => {
    const router = new TranslationRouter({ providers: [new MockTranslationProvider()] });
    const result = await router.translate({ text: 'thank you very much.', sourceLang: 'en', targetLang: 'es' });
    expect(result.text).toContain('gracias');
    expect(result.engine).toBe('mock');
  });

  test('falls back to the next provider on error', async () => {
    const counting = new CountingProvider();
    const router = new TranslationRouter({ providers: [new FailingProvider(), counting] });
    const result = await router.translate({ text: 'hello', sourceLang: 'en', targetLang: 'fr' });
    expect(counting.calls).toBe(1);
    expect(result.engine).toBe('openai');
    expect(result.text).toBe('[fr] hello');
  });

  test('caches translations across calls', async () => {
    const counting = new CountingProvider();
    const router = new TranslationRouter({ providers: [counting] });
    const req = { text: 'cached?', sourceLang: 'en', targetLang: 'de' } as const;
    await router.translate(req);
    const second = await router.translate(req);
    expect(counting.calls).toBe(1);
    expect(second.cached).toBe(true);
  });

  test('translateStream yields incremental partials and final', async () => {
    const router = new TranslationRouter({ providers: [new MockTranslationProvider()] });
    const partials: string[] = [];
    for await (const partial of router.translateStream({ text: 'thank you very much.', sourceLang: 'en', targetLang: 'fr' })) {
      partials.push(partial);
    }
    expect(partials.length).toBeGreaterThan(1);
    expect(partials[partials.length - 1]).toContain('Merci');
  });
});
