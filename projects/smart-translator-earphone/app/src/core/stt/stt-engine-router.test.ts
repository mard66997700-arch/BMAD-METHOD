import type { AudioChunk } from '../audio/audio-types';
import { MockSttProvider } from './mock-stt-provider';
import { SttEngineRouter } from './stt-engine-router';
import type {
  SttEvent,
  SttEventListener,
  SttProvider,
  SttSession,
  SttSessionOptions,
} from './stt-types';

function chunk(durationMs: number, startTimestampMs: number, finalEnd = false): AudioChunk {
  return {
    samples: new Int16Array(160),
    startSeq: 0,
    endSeq: 1,
    startTimestampMs,
    durationMs,
    final: finalEnd,
    utteranceBoundary: finalEnd,
  };
}

class FailingProvider implements SttProvider {
  readonly id = 'whisper-cloud' as const;
  isAvailable(): boolean {
    return true;
  }
  async createSession(_options: SttSessionOptions): Promise<SttSession> {
    return new FailingSession();
  }
}

class FailingSession implements SttSession {
  readonly id = 'failing-1';
  private listeners = new Set<SttEventListener>();
  pushChunk(_chunk: AudioChunk): void {
    for (const l of this.listeners) {
      const event: SttEvent = {
        type: 'error',
        sessionId: this.id,
        error: new Error('boom'),
        recoverable: true,
      };
      l(event);
    }
  }
  on(listener: SttEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  async close(): Promise<void> {
    /* noop */
  }
}

describe('SttEngineRouter', () => {
  test('forwards chunks to the active provider and emits its events', async () => {
    const router = new SttEngineRouter({ providers: [new MockSttProvider()] });
    const events: SttEvent[] = [];
    router.on((e) => events.push(e));
    await router.pushChunk(chunk(300, 0));
    await router.pushChunk(chunk(300, 300, true));
    expect(events.find((e) => e.type === 'final')).toBeDefined();
  });

  test('falls back to next provider when active one emits a recoverable error', async () => {
    const router = new SttEngineRouter({ providers: [new FailingProvider(), new MockSttProvider()] });
    const events: SttEvent[] = [];
    router.on((e) => events.push(e));
    await router.pushChunk(chunk(300, 0));
    await router.pushChunk(chunk(300, 300, true));
    // The first push triggers the failing provider, which emits an error;
    // the second push should reopen on the MockSttProvider and produce a final.
    expect(events.some((e) => e.type === 'error' && e.recoverable)).toBe(true);
    expect(events.some((e) => e.type === 'final')).toBe(true);
  });

  test('selectEngine reorders providers and stop closes any active session', async () => {
    const router = new SttEngineRouter({ providers: [new MockSttProvider()] });
    expect(router.activeEngineId).toBeNull();
    await router.pushChunk(chunk(300, 0));
    expect(router.activeEngineId).toBe('mock');
    router.selectEngine('mock');
    await router.stop();
    expect(router.activeEngineId).toBeNull();
  });
});
