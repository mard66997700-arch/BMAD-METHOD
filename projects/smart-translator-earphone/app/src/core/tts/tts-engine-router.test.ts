import { MockTtsProvider } from './mock-tts-provider';
import { TtsEngineRouter } from './tts-engine-router';
import { DEFAULT_VOICE_SETTINGS, withGender, withPitch, withSpeed } from './voice-settings';
import type { TtsProvider, TtsRequest, TtsResult } from './tts-types';

class FailingTtsProvider implements TtsProvider {
  readonly id = 'azure' as const;
  isAvailable(): boolean {
    return true;
  }
  async synthesize(_req: TtsRequest): Promise<TtsResult> {
    throw new Error('azure down');
  }
}

describe('TtsEngineRouter', () => {
  test('synthesizes via mock provider', async () => {
    const router = new TtsEngineRouter({ providers: [new MockTtsProvider()] });
    const result = await router.synthesize({
      text: 'hello world',
      targetLang: 'en',
      voice: DEFAULT_VOICE_SETTINGS,
    });
    expect(result.engine).toBe('mock');
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.sampleRateHz).toBe(24_000);
  });

  test('falls back to next provider when one fails', async () => {
    const router = new TtsEngineRouter({ providers: [new FailingTtsProvider(), new MockTtsProvider()] });
    const result = await router.synthesize({
      text: 'hello world',
      targetLang: 'en',
      voice: DEFAULT_VOICE_SETTINGS,
    });
    expect(result.engine).toBe('mock');
  });

  test('voice helpers clamp and update fields immutably', () => {
    const v = DEFAULT_VOICE_SETTINGS;
    expect(withSpeed(v, 5).speed).toBe(2);
    expect(withSpeed(v, 0.1).speed).toBe(0.5);
    expect(withPitch(v, 50).pitch).toBe(12);
    expect(withPitch(v, -50).pitch).toBe(-12);
    expect(withGender(v, 'male').gender).toBe('male');
    expect(v.gender).toBe('female'); // original unchanged
  });
});
