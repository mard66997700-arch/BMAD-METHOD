import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import { ExpoSpeechTtsProvider } from './expo-speech-tts-provider';
import { DEFAULT_VOICE_SETTINGS } from './voice-settings';

const speakMock = Speech.speak as unknown as jest.Mock;
const platform = Platform as unknown as { OS: string };

describe('ExpoSpeechTtsProvider', () => {
  beforeEach(() => {
    speakMock.mockClear();
    speakMock.mockImplementation((_text: string, options?: { onDone?: () => void }) => {
      if (options?.onDone) setImmediate(options.onDone);
    });
  });

  it('is unavailable on web', () => {
    platform.OS = 'web';
    expect(new ExpoSpeechTtsProvider().isAvailable()).toBe(false);
  });

  it('is available on iOS and Android', () => {
    platform.OS = 'ios';
    expect(new ExpoSpeechTtsProvider().isAvailable()).toBe(true);
    platform.OS = 'android';
    expect(new ExpoSpeechTtsProvider().isAvailable()).toBe(true);
  });

  it('synthesize() forwards text + language + voice settings to expo-speech', async () => {
    platform.OS = 'ios';
    const provider = new ExpoSpeechTtsProvider();
    const result = await provider.synthesize({
      text: 'Xin chào',
      targetLang: 'vi',
      voice: { ...DEFAULT_VOICE_SETTINGS, speed: 1.25, pitch: 6 },
    });
    expect(speakMock).toHaveBeenCalledTimes(1);
    const [text, options] = speakMock.mock.calls[0]!;
    expect(text).toBe('Xin chào');
    expect(options.language).toBe('vi');
    expect(options.rate).toBeCloseTo(1.25);
    expect(options.pitch).toBeCloseTo(1 + 6 / 12);
    expect(result.engine).toBe('expo-speech');
    expect(result.format).toBe('pcm-int16');
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.samples.some((s) => s !== 0)).toBe(false);
  });

  it('clamps rate and pitch into the [0.5, 2] range expected by expo-speech', async () => {
    platform.OS = 'android';
    const provider = new ExpoSpeechTtsProvider();
    await provider.synthesize({
      text: 'hi',
      targetLang: 'en',
      voice: { ...DEFAULT_VOICE_SETTINGS, speed: 5, pitch: -100 },
    });
    const [, options] = speakMock.mock.calls[0]!;
    expect(options.rate).toBe(2);
    expect(options.pitch).toBe(0.5);
  });

  it('throws when the platform is not supported', async () => {
    platform.OS = 'web';
    const provider = new ExpoSpeechTtsProvider();
    await expect(
      provider.synthesize({
        text: 'hi',
        targetLang: 'en',
        voice: DEFAULT_VOICE_SETTINGS,
      }),
    ).rejects.toThrow(/expo-speech/);
  });

  it('resolves even if Speech.speak throws synchronously', async () => {
    platform.OS = 'ios';
    speakMock.mockImplementationOnce(() => {
      throw new Error('native bridge missing');
    });
    const provider = new ExpoSpeechTtsProvider();
    const result = await provider.synthesize({
      text: 'hi',
      targetLang: 'en',
      voice: DEFAULT_VOICE_SETTINGS,
    });
    expect(result.engine).toBe('expo-speech');
  });
});
