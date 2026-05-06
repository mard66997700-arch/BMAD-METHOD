import { Platform } from 'react-native';

import { ExpoSpeechRecognitionProvider } from './expo-speech-recognition-provider';

const platform = Platform as unknown as { OS: string };

class FakeRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((ev: { results: ArrayLike<unknown>; resultIndex?: number }) => void) | null = null;
  onerror: ((ev: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = 0;
  stopped = 0;
  start() {
    this.started += 1;
  }
  stop() {
    this.stopped += 1;
  }
  abort() {
    /* noop */
  }
}

describe('ExpoSpeechRecognitionProvider', () => {
  it('is unavailable on web by default', () => {
    platform.OS = 'web';
    expect(new ExpoSpeechRecognitionProvider().isAvailable()).toBe(false);
  });

  it('is available on iOS / Android via the bundled native ctor', () => {
    platform.OS = 'ios';
    expect(new ExpoSpeechRecognitionProvider().isAvailable()).toBe(true);
    platform.OS = 'android';
    expect(new ExpoSpeechRecognitionProvider().isAvailable()).toBe(true);
  });

  it('is available on any platform when an explicit ctor is injected', () => {
    platform.OS = 'web';
    const provider = new ExpoSpeechRecognitionProvider({ ctor: FakeRecognition });
    expect(provider.isAvailable()).toBe(true);
  });

  it('createSession() returns a session that wires the injected recognizer', async () => {
    platform.OS = 'ios';
    const provider = new ExpoSpeechRecognitionProvider({ ctor: FakeRecognition });
    const session = await provider.createSession({ sourceLang: 'vi' });
    expect(session.id).toMatch(/^web-speech-stt-/);
    await session.close();
  });

  it('createSession() throws when no native ctor is reachable', async () => {
    platform.OS = 'web';
    const provider = new ExpoSpeechRecognitionProvider();
    await expect(provider.createSession({ sourceLang: 'en' })).rejects.toThrow(
      /expo-speech-recognition/,
    );
  });
});
