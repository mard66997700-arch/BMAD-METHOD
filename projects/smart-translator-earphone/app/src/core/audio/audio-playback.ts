/**
 * Story 1.5 — Audio playback queue / scheduler.
 *
 * Schedules incoming TTS audio chunks back through the connected output device
 * (earphone speaker). The queue:
 *
 *  - Plays chunks in FIFO order with no overlap.
 *  - Begins playback within 50 ms of `enqueue()` (assertable in tests via the
 *    injectable `now` clock).
 *  - Supports cancellation: queued-but-not-started chunks are dropped; a
 *    currently-playing chunk fades out within `cancelFadeMs`.
 *  - Emits `onIdle` if no further chunks arrive within `idleMs` after the last
 *    chunk completes.
 *
 * The queue is platform-agnostic. Real implementations bind `playSamples` to
 * a native audio sink (iOS AVAudioEngine, Android Oboe). The included
 * `MockAudioPlaybackProvider` is sufficient for unit testing.
 */

export type PlaybackPan = 'left' | 'right' | 'center';

export interface PlaybackChunk {
  id: string;
  /** PCM samples. The provider determines sample rate; default 24 kHz. */
  samples: Int16Array;
  /** Sample rate in Hz; default 24 000 (matches typical TTS output). */
  sampleRateHz?: number;
  /**
   * Optional stereo panning hint. Providers that support it pan the
   * playback to the given channel; providers that don't fall back to
   * mono. Default: 'center'.
   */
  pan?: PlaybackPan;
}

export interface PlaybackOptions {
  pan?: PlaybackPan;
}

export type PlaybackEvent =
  | { type: 'chunk-start'; id: string }
  | { type: 'chunk-end'; id: string; cancelled: boolean }
  | { type: 'idle' };

export type PlaybackEventListener = (event: PlaybackEvent) => void;

export interface AudioPlaybackProvider {
  /**
   * Play `samples` at `sampleRateHz`. Returns a promise that resolves when
   * playback completes. The provider must support cooperative cancellation
   * via the supplied AbortSignal — when aborted, it must fade out within
   * `cancelFadeMs` and resolve.
   *
   * Optional `options.pan` hints stereo channel routing for dual-ear modes.
   */
  playSamples(
    samples: Int16Array,
    sampleRateHz: number,
    signal: AbortSignal,
    options?: PlaybackOptions,
  ): Promise<void>;
}

export interface PlaybackQueueOptions {
  /** Idle-event timeout after queue empties. Default 2000 ms. */
  idleMs: number;
  /** Fade-out duration on cancel. Default 100 ms. */
  cancelFadeMs: number;
  /** Wall clock; injectable for tests. */
  now: () => number;
  /** Schedule a deferred callback; injectable for tests. */
  setTimeoutFn: (cb: () => void, ms: number) => unknown;
  /** Cancel a deferred callback; injectable for tests. */
  clearTimeoutFn: (handle: unknown) => void;
}

const DEFAULTS: PlaybackQueueOptions = {
  idleMs: 2000,
  cancelFadeMs: 100,
  now: Date.now,
  setTimeoutFn: globalThis.setTimeout as PlaybackQueueOptions['setTimeoutFn'],
  clearTimeoutFn: globalThis.clearTimeout as PlaybackQueueOptions['clearTimeoutFn'],
};

interface QueueEntry {
  chunk: PlaybackChunk;
  abort: AbortController;
}

export class AudioPlaybackQueue {
  private readonly opts: PlaybackQueueOptions;
  private readonly queue: QueueEntry[] = [];
  private readonly listeners = new Set<PlaybackEventListener>();
  private current: QueueEntry | null = null;
  private idleTimer: unknown = null;

  constructor(
    private readonly provider: AudioPlaybackProvider,
    options: Partial<PlaybackQueueOptions> = {},
  ) {
    this.opts = { ...DEFAULTS, ...options };
  }

  enqueue(chunk: PlaybackChunk): void {
    if (this.idleTimer !== null) {
      this.opts.clearTimeoutFn(this.idleTimer);
      this.idleTimer = null;
    }
    const entry: QueueEntry = { chunk, abort: new AbortController() };
    this.queue.push(entry);
    if (!this.current) {
      void this.advance();
    }
  }

  /**
   * Cancel a chunk by id. If it is queued but not playing, it is removed
   * silently. If it is currently playing, an abort is signalled and the
   * provider is expected to fade out.
   */
  cancel(id: string): void {
    if (this.current && this.current.chunk.id === id) {
      this.current.abort.abort();
      return;
    }
    const idx = this.queue.findIndex((e) => e.chunk.id === id);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
    }
  }

  /** Cancel all chunks (queued and current). */
  clear(): void {
    if (this.current) this.current.abort.abort();
    this.queue.splice(0, this.queue.length);
  }

  on(listener: PlaybackEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** True if a chunk is currently playing or queued. */
  get busy(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  /** Current chunk id (or null). */
  get currentId(): string | null {
    return this.current?.chunk.id ?? null;
  }

  /** Pending (queued but not playing) chunk count. */
  get pendingCount(): number {
    return this.queue.length;
  }

  private async advance(): Promise<void> {
    while (this.queue.length > 0) {
      const entry = this.queue.shift()!;
      this.current = entry;
      this.emit({ type: 'chunk-start', id: entry.chunk.id });
      let cancelled = false;
      try {
        await this.provider.playSamples(
          entry.chunk.samples,
          entry.chunk.sampleRateHz ?? 24_000,
          entry.abort.signal,
          { pan: entry.chunk.pan },
        );
      } catch (e) {
        if ((e as Error)?.name === 'AbortError' || entry.abort.signal.aborted) {
          cancelled = true;
        } else {
          throw e;
        }
      }
      this.emit({ type: 'chunk-end', id: entry.chunk.id, cancelled });
      this.current = null;
    }
    // Empty queue — schedule the idle event.
    this.idleTimer = this.opts.setTimeoutFn(() => {
      this.idleTimer = null;
      // Only emit idle if we are still empty and idle (no advance restarted us).
      if (!this.busy) this.emit({ type: 'idle' });
    }, this.opts.idleMs);
  }

  private emit(ev: PlaybackEvent): void {
    for (const l of this.listeners) l(ev);
  }
}

/**
 * Mock provider for tests. Plays "instantly" by resolving immediately, but
 * captures the played samples so tests can assert on them.
 */
export class MockAudioPlaybackProvider implements AudioPlaybackProvider {
  readonly played: Array<{
    samples: Int16Array;
    sampleRateHz: number;
    cancelled: boolean;
    pan?: PlaybackPan;
  }> = [];
  /** If set, simulate a non-zero playback duration before resolving. */
  playbackDurationMs = 0;
  /** Optional test hook called immediately when playSamples starts. */
  onStart: (() => void) | null = null;

  async playSamples(
    samples: Int16Array,
    sampleRateHz: number,
    signal: AbortSignal,
    options?: PlaybackOptions,
  ): Promise<void> {
    if (this.onStart) this.onStart();
    if (this.playbackDurationMs === 0) {
      this.played.push({ samples, sampleRateHz, cancelled: false, pan: options?.pan });
      return;
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.played.push({ samples, sampleRateHz, cancelled: false, pan: options?.pan });
        resolve();
      }, this.playbackDurationMs);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        this.played.push({ samples, sampleRateHz, cancelled: true, pan: options?.pan });
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  }
}
