import type { AudioChunk } from '../audio/audio-types';
import { MockSttProvider } from './mock-stt-provider';
import type { SttEvent } from './stt-types';

function chunk(opts: Partial<AudioChunk> & { startTimestampMs: number; durationMs: number }): AudioChunk {
  return {
    samples: new Int16Array(160),
    startSeq: 0,
    endSeq: 1,
    startTimestampMs: opts.startTimestampMs,
    durationMs: opts.durationMs,
    final: opts.final ?? false,
    utteranceBoundary: opts.utteranceBoundary ?? false,
  };
}

describe('MockSttProvider', () => {
  test('emits partials per chunk and a final on utterance boundary', async () => {
    const provider = new MockSttProvider();
    expect(provider.isAvailable()).toBe(true);
    const session = await provider.createSession({ sourceLang: 'auto' });
    const events: SttEvent[] = [];
    session.on((e) => events.push(e));

    session.pushChunk(chunk({ startTimestampMs: 0, durationMs: 300 }));
    session.pushChunk(chunk({ startTimestampMs: 300, durationMs: 300 }));
    session.pushChunk(chunk({ startTimestampMs: 600, durationMs: 300, utteranceBoundary: true }));

    const partials = events.filter((e) => e.type === 'partial');
    const finals = events.filter((e) => e.type === 'final');
    expect(partials.length).toBeGreaterThanOrEqual(2);
    expect(finals.length).toBe(1);
    expect(finals[0]!.text.length).toBeGreaterThan(0);
    expect(finals[0]!.detectedLang).toBe('en');
  });

  test('close emits a final for any in-flight utterance and is idempotent', async () => {
    const provider = new MockSttProvider();
    const session = await provider.createSession({ sourceLang: 'es' });
    const events: SttEvent[] = [];
    session.on((e) => events.push(e));
    session.pushChunk(chunk({ startTimestampMs: 0, durationMs: 300 }));
    await session.close();
    await session.close(); // second close is a no-op
    const finals = events.filter((e) => e.type === 'final');
    expect(finals.length).toBe(1);
    expect(finals[0]!.detectedLang).toBe('es');
  });

  test('listener can unsubscribe', async () => {
    const provider = new MockSttProvider();
    const session = await provider.createSession({ sourceLang: 'auto' });
    let calls = 0;
    const off = session.on(() => {
      calls += 1;
    });
    session.pushChunk(chunk({ startTimestampMs: 0, durationMs: 300 }));
    expect(calls).toBeGreaterThan(0);
    const before = calls;
    off();
    session.pushChunk(chunk({ startTimestampMs: 300, durationMs: 300, utteranceBoundary: true }));
    expect(calls).toBe(before);
  });
});
