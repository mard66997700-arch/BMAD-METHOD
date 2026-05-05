/**
 * Story 1.1 — Cross-platform AudioCaptureProvider interface.
 *
 * Real implementations bridge to native iOS/Android audio session APIs
 * (Stories 1.6 and 1.7). The mock implementation drives the pipeline
 * deterministically from a synthetic int16 PCM source so the rest of the
 * pipeline can be unit-tested without device hardware.
 */

import { AudioFrame, FRAME_SAMPLES, SAMPLE_RATE_HZ } from './audio-types';

export type FrameListener = (frame: AudioFrame) => void;
export type ErrorListener = (err: Error) => void;
export type StateListener = (state: CaptureState) => void;

export type CaptureState = 'idle' | 'starting' | 'capturing' | 'stopping' | 'errored';

export interface AudioCaptureProvider {
  /**
   * Start capturing. Resolves once the underlying session is fully active
   * and `onFrame` is being called. Rejects if start fails.
   */
  start(): Promise<void>;

  /** Stop capturing. Resolves when the session is fully torn down. */
  stop(): Promise<void>;

  /** Subscribe to frames. Returns an unsubscribe function. */
  onFrame(listener: FrameListener): () => void;

  /** Subscribe to errors. Returns an unsubscribe function. */
  onError(listener: ErrorListener): () => void;

  /** Subscribe to state transitions. Returns an unsubscribe function. */
  onState(listener: StateListener): () => void;

  /** Current state, useful for assertions in tests. */
  readonly state: CaptureState;
}

/**
 * Mock provider that emits a caller-supplied Int16Array as a stream of frames
 * synchronously.
 *
 * Real-time behaviour is intentionally NOT simulated: tests should be
 * deterministic and finish in milliseconds, not seconds. If a test needs
 * timing behaviour, supply an explicit fake clock and drive frames manually.
 */
export class MockAudioCaptureProvider implements AudioCaptureProvider {
  private _state: CaptureState = 'idle';
  private readonly frameListeners = new Set<FrameListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private readonly stateListeners = new Set<StateListener>();
  private seq = 0;
  private startMs = 0;

  /**
   * Construct with an optional pre-built source. If omitted, the provider can
   * still be `start()`-ed but emits nothing until `pushSamples` is called.
   */
  constructor(private readonly initialSource: Int16Array | null = null) {}

  get state(): CaptureState {
    return this._state;
  }

  async start(): Promise<void> {
    if (this._state !== 'idle' && this._state !== 'errored') {
      throw new Error(`Cannot start in state ${this._state}`);
    }
    this.transition('starting');
    this.seq = 0;
    this.startMs = Date.now();
    this.transition('capturing');
    if (this.initialSource) {
      this.pushSamples(this.initialSource);
    }
  }

  async stop(): Promise<void> {
    if (this._state === 'idle') return;
    this.transition('stopping');
    this.transition('idle');
  }

  onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Push a buffer of int16 samples. The provider slices into FRAME_SAMPLES
   * chunks; any trailing samples shorter than FRAME_SAMPLES are silently
   * discarded (mirrors what real hardware would do at end-of-capture).
   */
  pushSamples(buffer: Int16Array): void {
    if (this._state !== 'capturing') {
      throw new Error(`Cannot push samples in state ${this._state}`);
    }
    const fullFrames = Math.floor(buffer.length / FRAME_SAMPLES);
    for (let i = 0; i < fullFrames; i++) {
      const start = i * FRAME_SAMPLES;
      const samples = buffer.slice(start, start + FRAME_SAMPLES);
      const frame: AudioFrame = {
        samples,
        seq: this.seq++,
        timestampMs: this.startMs + Math.round((this.seq * 1000 * FRAME_SAMPLES) / SAMPLE_RATE_HZ),
      };
      for (const l of this.frameListeners) l(frame);
    }
  }

  /** Test helper: synthesize an error event. */
  emitError(err: Error): void {
    this._state = 'errored';
    for (const l of this.errorListeners) l(err);
    for (const l of this.stateListeners) l(this._state);
  }

  private transition(next: CaptureState): void {
    this._state = next;
    for (const l of this.stateListeners) l(next);
  }
}
