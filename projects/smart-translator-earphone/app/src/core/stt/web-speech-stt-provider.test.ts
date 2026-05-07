import { WebSpeechSttProvider } from './web-speech-stt-provider';
import type { SttEvent } from './stt-types';

/**
 * Minimal in-memory `SpeechRecognition` stub. Tests drive recognition
 * behavior by calling `emitResult()` directly.
 */
class FakeSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: { resultIndex?: number; results: ArrayLike<unknown> }) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = 0;
  stopped = 0;
  static lastInstance: FakeSpeechRecognition | null = null;

  constructor() {
    FakeSpeechRecognition.lastInstance = this;
  }

  start() {
    this.started++;
  }
  stop() {
    this.stopped++;
  }
  abort() {
    this.stopped++;
  }

  emitResult(transcript: string, isFinal: boolean, confidence = 0.9) {
    this.onresult?.({
      resultIndex: 0,
      results: [
        {
          isFinal,
          0: { transcript, confidence },
        },
      ] as unknown as ArrayLike<unknown>,
    });
  }
}

describe('WebSpeechSttProvider', () => {
  beforeEach(() => {
    FakeSpeechRecognition.lastInstance = null;
  });

  it('isAvailable() is false when no SpeechRecognition is on globalThis and no ctor injected', () => {
    const p = new WebSpeechSttProvider();
    expect(p.isAvailable()).toBe(false);
  });

  it('isAvailable() is true when a constructor is injected', () => {
    const p = new WebSpeechSttProvider({ ctor: FakeSpeechRecognition });
    expect(p.isAvailable()).toBe(true);
  });

  it('forwards interim results as SttPartial events', async () => {
    const p = new WebSpeechSttProvider({ ctor: FakeSpeechRecognition });
    const session = await p.createSession({ sourceLang: 'en' });
    const events: SttEvent[] = [];
    session.on((e) => events.push(e));
    FakeSpeechRecognition.lastInstance!.emitResult('hello wor', false);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('partial');
    if (events[0]!.type === 'partial') {
      expect(events[0]!.text).toBe('hello wor');
      expect(events[0]!.detectedLang).toBe('en');
    }
  });

  it('forwards final results as SttFinal events', async () => {
    const p = new WebSpeechSttProvider({ ctor: FakeSpeechRecognition });
    const session = await p.createSession({ sourceLang: 'fr' });
    const events: SttEvent[] = [];
    session.on((e) => events.push(e));
    FakeSpeechRecognition.lastInstance!.emitResult('Bonjour le monde', true, 0.97);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('final');
    if (events[0]!.type === 'final') {
      expect(events[0]!.text).toBe('Bonjour le monde');
      expect(events[0]!.confidence).toBeCloseTo(0.97);
      expect(events[0]!.detectedLang).toBe('fr');
    }
  });

  it('configures the recognition object with continuous + interimResults + lang', async () => {
    const p = new WebSpeechSttProvider({ ctor: FakeSpeechRecognition });
    await p.createSession({ sourceLang: 'es' });
    const r = FakeSpeechRecognition.lastInstance!;
    expect(r.continuous).toBe(true);
    expect(r.interimResults).toBe(true);
    expect(r.lang).toBe('es');
    expect(r.started).toBe(1);
  });

  it('does not auto-restart once close() has been called', async () => {
    const p = new WebSpeechSttProvider({ ctor: FakeSpeechRecognition });
    const session = await p.createSession({ sourceLang: 'en' });
    const r = FakeSpeechRecognition.lastInstance!;
    expect(r.started).toBe(1);
    await session.close();
    expect(r.stopped).toBe(1);
    r.onend?.();
    expect(r.started).toBe(1); // not restarted
  });

  it('auto-restarts the recognizer when it ends mid-session', async () => {
    const p = new WebSpeechSttProvider({ ctor: FakeSpeechRecognition });
    await p.createSession({ sourceLang: 'en' });
    const r = FakeSpeechRecognition.lastInstance!;
    expect(r.started).toBe(1);
    r.onend?.();
    expect(r.started).toBe(2);
  });

  it('emits a non-recoverable error when permission was denied', async () => {
    const p = new WebSpeechSttProvider({ ctor: FakeSpeechRecognition });
    const session = await p.createSession({ sourceLang: 'en' });
    const events: SttEvent[] = [];
    session.on((e) => events.push(e));
    FakeSpeechRecognition.lastInstance!.onerror?.({ error: 'not-allowed' });
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('error');
    if (events[0]!.type === 'error') {
      expect(events[0]!.recoverable).toBe(false);
    }
  });
});
