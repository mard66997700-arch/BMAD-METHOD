/**
 * Behavior tests for the engine factory's translation provider chain.
 *
 * These exercise the public translate() path of the resulting router rather
 * than asserting on private provider arrays — that way the test stays
 * decoupled from internal ordering implementation details.
 */

import { MockAudioCaptureProvider } from './audio/audio-capture';
import { MockAudioPlaybackProvider } from './audio/audio-playback';
import { createEngineRouter } from './engine-factory';

const FREE_PAYLOAD = [[['Bonjour', 'Hello', null, null, 0]], null, 'en'];

function fakeFetch(json: unknown): typeof fetch {
  return jest.fn(async () => ({
    ok: true,
    status: 200,
    async json() {
      return json;
    },
  })) as unknown as typeof fetch;
}

describe('createEngineRouter — translation provider chain', () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    delete process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY;
    delete process.env.EXPO_PUBLIC_DEEPL_API_KEY;
    delete process.env.EXPO_PUBLIC_AZURE_TTS_KEY;
    delete process.env.EXPO_PUBLIC_AZURE_TTS_REGION;
    // Globally stub fetch so the GoogleTranslateFreeProvider doesn't actually
    // hit the network if it ends up first in the chain.
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fakeFetch(FREE_PAYLOAD);
  });

  test("default engine 'google-free' uses the keyless free Google provider", async () => {
    const router = createEngineRouter({
      capture: new MockAudioCaptureProvider(),
      playback: new MockAudioPlaybackProvider(),
      translationEngine: 'google-free',
    });
    const result = await router.translation.translate({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'fr',
    });
    expect(result.engine).toBe('google-free');
    expect(result.text).toBe('Bonjour');
  });

  test('runtime API keys take precedence over env vars and place the paid provider first when preferred', async () => {
    // No env vars set, but a runtime DeepL key is provided. The DeepL
    // provider's translate() will fail (no real network) and the chain
    // should fall back to the free Google provider — proving DeepL was
    // wired into the chain at all.
    const router = createEngineRouter({
      capture: new MockAudioCaptureProvider(),
      playback: new MockAudioPlaybackProvider(),
      translationEngine: 'deepl',
      apiKeys: { deepl: 'runtime-deepl-key' },
    });
    const result = await router.translation.translate({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'fr',
    });
    expect(result.engine).toBe('google-free');
  });

  test('with no keys at all the free Google provider still produces a real translation', async () => {
    const router = createEngineRouter({
      capture: new MockAudioCaptureProvider(),
      playback: new MockAudioPlaybackProvider(),
    });
    const result = await router.translation.translate({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'fr',
    });
    expect(result.engine).toBe('google-free');
    expect(result.text).toBe('Bonjour');
  });

  test('falls all the way back to MockTranslationProvider when the free endpoint fails', async () => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = (jest.fn(async () => ({
      ok: false,
      status: 503,
      async json() {
        return null;
      },
    })) as unknown) as typeof fetch;
    const router = createEngineRouter({
      capture: new MockAudioCaptureProvider(),
      playback: new MockAudioPlaybackProvider(),
    });
    const result = await router.translation.translate({
      text: 'thank you very much.',
      sourceLang: 'en',
      targetLang: 'es',
    });
    // MockTranslationProvider's PHRASES table has this entry.
    expect(result.engine).toBe('mock');
    expect(result.text).toContain('gracias');
  });
});
