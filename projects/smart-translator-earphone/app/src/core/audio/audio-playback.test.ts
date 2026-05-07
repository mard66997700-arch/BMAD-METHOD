import {
  AudioPlaybackQueue,
  MockAudioPlaybackProvider,
  type PlaybackEvent,
} from './index';

function buildChunk(id: string, samples = 4_800): { id: string; samples: Int16Array } {
  const buf = new Int16Array(samples);
  buf.fill(1_000);
  return { id, samples: buf };
}

/**
 * Minimal fake-clock harness. setTimeoutFn captures pending callbacks so the
 * test can advance time deterministically.
 */
function makeFakeClock() {
  let now = 0;
  const pending: Array<{ id: number; cb: () => void; runAt: number }> = [];
  let next = 1;
  return {
    now: () => now,
    setTimeoutFn: (cb: () => void, ms: number) => {
      const id = next++;
      pending.push({ id, cb, runAt: now + ms });
      return id;
    },
    clearTimeoutFn: (handle: unknown) => {
      const idx = pending.findIndex((p) => p.id === handle);
      if (idx >= 0) pending.splice(idx, 1);
    },
    advance: (ms: number) => {
      now += ms;
      const toFire = pending
        .filter((p) => p.runAt <= now)
        .sort((a, b) => a.runAt - b.runAt);
      for (const p of toFire) {
        const idx = pending.findIndex((q) => q.id === p.id);
        if (idx >= 0) pending.splice(idx, 1);
        p.cb();
      }
    },
    pendingCount: () => pending.length,
  };
}

describe('Story 1.5 — AudioPlaybackQueue', () => {
  test('plays a single chunk and emits chunk-start / chunk-end / idle', async () => {
    const provider = new MockAudioPlaybackProvider();
    const clock = makeFakeClock();
    const queue = new AudioPlaybackQueue(provider, {
      idleMs: 100,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const events: PlaybackEvent[] = [];
    queue.on((e) => events.push(e));

    queue.enqueue(buildChunk('a'));
    // Let the promise microtask fire.
    await Promise.resolve();
    await Promise.resolve();

    clock.advance(100);

    const types = events.map((e) => e.type);
    expect(types).toEqual(['chunk-start', 'chunk-end', 'idle']);
    expect(provider.played).toHaveLength(1);
    expect(provider.played[0]!.cancelled).toBe(false);
  });

  test('plays multiple chunks gaplessly in order', async () => {
    const provider = new MockAudioPlaybackProvider();
    const queue = new AudioPlaybackQueue(provider, { idleMs: 0 });
    const events: PlaybackEvent[] = [];
    queue.on((e) => events.push(e));

    queue.enqueue(buildChunk('a'));
    queue.enqueue(buildChunk('b'));
    queue.enqueue(buildChunk('c'));

    // Allow all microtasks to drain.
    for (let i = 0; i < 10; i++) await Promise.resolve();

    const startIds = events.filter((e) => e.type === 'chunk-start').map((e) => (e as { id: string }).id);
    expect(startIds).toEqual(['a', 'b', 'c']);
  });

  test('cancel() of a queued-not-playing chunk drops it silently', async () => {
    const provider = new MockAudioPlaybackProvider();
    provider.playbackDurationMs = 50;
    const queue = new AudioPlaybackQueue(provider, { idleMs: 0 });
    const events: PlaybackEvent[] = [];
    queue.on((e) => events.push(e));

    queue.enqueue(buildChunk('a'));
    queue.enqueue(buildChunk('b'));
    queue.enqueue(buildChunk('c'));
    // Cancel 'b' and 'c' before they start.
    queue.cancel('b');
    queue.cancel('c');

    // Wait for 'a' to complete.
    await new Promise((r) => setTimeout(r, 100));
    for (let i = 0; i < 10; i++) await Promise.resolve();

    const startIds = events.filter((e) => e.type === 'chunk-start').map((e) => (e as { id: string }).id);
    expect(startIds).toEqual(['a']);
  });

  test('cancel() of currently-playing chunk aborts it', async () => {
    const provider = new MockAudioPlaybackProvider();
    provider.playbackDurationMs = 100;
    const queue = new AudioPlaybackQueue(provider, { idleMs: 0 });
    const events: PlaybackEvent[] = [];
    queue.on((e) => events.push(e));

    queue.enqueue(buildChunk('a'));
    // Wait one microtask to let it start.
    await Promise.resolve();
    await Promise.resolve();
    queue.cancel('a');

    await new Promise((r) => setTimeout(r, 50));

    const ends = events.filter((e) => e.type === 'chunk-end');
    expect(ends).toHaveLength(1);
    expect((ends[0] as { cancelled: boolean }).cancelled).toBe(true);
  });

  test('clear() drops all queued and aborts current', async () => {
    const provider = new MockAudioPlaybackProvider();
    provider.playbackDurationMs = 100;
    const queue = new AudioPlaybackQueue(provider, { idleMs: 0 });

    queue.enqueue(buildChunk('a'));
    queue.enqueue(buildChunk('b'));
    queue.enqueue(buildChunk('c'));

    await Promise.resolve();
    queue.clear();
    expect(queue.pendingCount).toBe(0);

    await new Promise((r) => setTimeout(r, 50));
    // Eventually after current's abort completes, queue is no longer busy.
    expect(queue.busy).toBe(false);
  });

  test('idle event fires after idleMs of no chunks', async () => {
    const provider = new MockAudioPlaybackProvider();
    const clock = makeFakeClock();
    const queue = new AudioPlaybackQueue(provider, {
      idleMs: 2000,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const events: PlaybackEvent[] = [];
    queue.on((e) => events.push(e));

    queue.enqueue(buildChunk('a'));
    for (let i = 0; i < 10; i++) await Promise.resolve();

    expect(events.some((e) => e.type === 'idle')).toBe(false);
    clock.advance(1999);
    expect(events.some((e) => e.type === 'idle')).toBe(false);
    clock.advance(1);
    expect(events.some((e) => e.type === 'idle')).toBe(true);
  });

  test('enqueue while idle-timer pending cancels the idle timer', async () => {
    const provider = new MockAudioPlaybackProvider();
    const clock = makeFakeClock();
    const queue = new AudioPlaybackQueue(provider, {
      idleMs: 2000,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const events: PlaybackEvent[] = [];
    queue.on((e) => events.push(e));

    queue.enqueue(buildChunk('a'));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(clock.pendingCount()).toBe(1);

    queue.enqueue(buildChunk('b'));
    expect(clock.pendingCount()).toBe(0);

    for (let i = 0; i < 10; i++) await Promise.resolve();
    clock.advance(2000);
    expect(events.filter((e) => e.type === 'idle')).toHaveLength(1);
  });

  test('currentId and busy reflect state', async () => {
    const provider = new MockAudioPlaybackProvider();
    provider.playbackDurationMs = 50;
    const queue = new AudioPlaybackQueue(provider, { idleMs: 0 });
    expect(queue.busy).toBe(false);
    expect(queue.currentId).toBe(null);
    queue.enqueue(buildChunk('a'));
    await Promise.resolve();
    await Promise.resolve();
    expect(queue.busy).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(queue.busy).toBe(false);
  });

  test('forwards chunk.pan to the provider via PlaybackOptions', async () => {
    const provider = new MockAudioPlaybackProvider();
    const queue = new AudioPlaybackQueue(provider, { idleMs: 0 });

    queue.enqueue({ ...buildChunk('a'), pan: 'right' });
    queue.enqueue({ ...buildChunk('b'), pan: 'left' });
    queue.enqueue(buildChunk('c'));
    for (let i = 0; i < 10; i++) await Promise.resolve();

    expect(provider.played.map((p) => p.pan)).toEqual(['right', 'left', undefined]);
  });
});
