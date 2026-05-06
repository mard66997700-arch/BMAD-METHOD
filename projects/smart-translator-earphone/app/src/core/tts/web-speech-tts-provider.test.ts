import { WebSpeechTtsProvider } from './web-speech-tts-provider';
import { DEFAULT_VOICE_SETTINGS } from './voice-settings';

class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  onend: (() => void) | null = null;
  onerror: ((e: { error?: string }) => void) | null = null;
  static lastInstance: FakeUtterance | null = null;

  constructor(text: string) {
    this.text = text;
    FakeUtterance.lastInstance = this;
  }
}

class FakeSynth {
  spoken: FakeUtterance[] = [];
  speak(u: FakeUtterance) {
    this.spoken.push(u);
    // Synchronously fire onend so synthesize() resolves immediately.
    setTimeout(() => u.onend?.(), 0);
  }
  cancel() {
    /* noop */
  }
}

describe('WebSpeechTtsProvider', () => {
  beforeEach(() => {
    FakeUtterance.lastInstance = null;
  });

  it('isAvailable() is false without a synth + ctor', () => {
    const p = new WebSpeechTtsProvider();
    expect(p.isAvailable()).toBe(false);
  });

  it('isAvailable() is true when synth + ctor are injected', () => {
    const p = new WebSpeechTtsProvider({ synth: new FakeSynth(), ctor: FakeUtterance });
    expect(p.isAvailable()).toBe(true);
  });

  it('synthesize() speaks via the injected synth and returns a silent PCM buffer', async () => {
    const synth = new FakeSynth();
    const p = new WebSpeechTtsProvider({ synth, ctor: FakeUtterance });
    const result = await p.synthesize({
      text: 'Hello world',
      targetLang: 'en',
      voice: DEFAULT_VOICE_SETTINGS,
    });
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]!.text).toBe('Hello world');
    expect(synth.spoken[0]!.lang).toBe('en');
    expect(result.engine).toBe('web-speech');
    expect(result.format).toBe('pcm-int16');
    // Tiny silent buffer — every sample is zero.
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.samples.some((s) => s !== 0)).toBe(false);
  });

  it('maps voice.speed to utterance.rate and voice.pitch (semitones) to utterance.pitch', async () => {
    const synth = new FakeSynth();
    const p = new WebSpeechTtsProvider({ synth, ctor: FakeUtterance });
    await p.synthesize({
      text: 'hi',
      targetLang: 'es',
      voice: { ...DEFAULT_VOICE_SETTINGS, speed: 1.5, pitch: 6 },
    });
    const u = FakeUtterance.lastInstance!;
    expect(u.rate).toBeCloseTo(1.5);
    expect(u.pitch).toBeCloseTo(1 + 6 / 12); // 1.5
  });

  it('clamps utterance.pitch to [0, 2] when given extreme semitone values', async () => {
    const synth = new FakeSynth();
    const p = new WebSpeechTtsProvider({ synth, ctor: FakeUtterance });
    await p.synthesize({
      text: 'hi',
      targetLang: 'es',
      voice: { ...DEFAULT_VOICE_SETTINGS, pitch: 100 },
    });
    expect(FakeUtterance.lastInstance!.pitch).toBe(2);
  });

  it('resolves even if speak() throws synchronously', async () => {
    const throwingSynth = {
      speak() {
        throw new Error('synth failed');
      },
      cancel() {
        /* noop */
      },
    };
    const p = new WebSpeechTtsProvider({ synth: throwingSynth, ctor: FakeUtterance });
    const result = await p.synthesize({
      text: 'hi',
      targetLang: 'en',
      voice: DEFAULT_VOICE_SETTINGS,
    });
    expect(result.engine).toBe('web-speech');
  });
});
