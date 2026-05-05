/**
 * Story 1.3 — Voice Activity Detection.
 *
 * Energy-based VAD with hysteresis:
 *  - `startThresholdDb` — minimum energy (dBFS) to consider a frame voiced.
 *  - `stopThresholdDb` — energy below which a frame is unvoiced; lower than
 *    `startThresholdDb` so a brief dip in volume does not cut the utterance.
 *  - `minSpeechMs` — frames must be above start threshold for at least this
 *    long before `utterance-start` is emitted (false-trigger suppression).
 *  - `minSilenceMs` — frames must be below stop threshold for at least this
 *    long before `utterance-end` is emitted.
 *
 * Energy in dBFS is computed from the RMS of int16 samples. A full-scale
 * sine wave has dBFS = 0; the noise floor of a real microphone is typically
 * around -55 to -65 dBFS.
 */

import { AudioFrame, FRAME_DURATION_MS, FRAME_SAMPLES, VadEvent } from './audio-types';

export interface VadOptions {
  startThresholdDb: number;
  stopThresholdDb: number;
  minSpeechMs: number;
  minSilenceMs: number;
}

const DEFAULTS: VadOptions = {
  startThresholdDb: -40,
  stopThresholdDb: -50,
  minSpeechMs: 120,
  minSilenceMs: 400,
};

export type VadListener = (event: VadEvent) => void;

type State =
  | { type: 'silent' }
  | { type: 'speech-pending'; voicedStartFrame: AudioFrame; voicedFrames: number }
  | { type: 'speech'; startFrame: AudioFrame; frameCount: number }
  | { type: 'silence-pending'; startFrame: AudioFrame; speechFrames: number; silenceFrames: number };

export class VoiceActivityDetector {
  private readonly opts: VadOptions;
  private readonly minSpeechFrames: number;
  private readonly minSilenceFrames: number;
  private state: State = { type: 'silent' };
  private readonly listeners = new Set<VadListener>();

  constructor(options: Partial<VadOptions> = {}) {
    this.opts = { ...DEFAULTS, ...options };
    if (this.opts.startThresholdDb < this.opts.stopThresholdDb) {
      throw new Error('startThresholdDb must be >= stopThresholdDb');
    }
    this.minSpeechFrames = Math.max(1, Math.ceil(this.opts.minSpeechMs / FRAME_DURATION_MS));
    this.minSilenceFrames = Math.max(1, Math.ceil(this.opts.minSilenceMs / FRAME_DURATION_MS));
  }

  /**
   * Compute frame energy in dBFS. Returns -Infinity for a silent frame; a
   * small floor is applied to keep arithmetic stable.
   */
  static frameEnergyDb(samples: Int16Array): number {
    let sumSq = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]!;
      sumSq += s * s;
    }
    if (sumSq === 0) return -Infinity;
    const rms = Math.sqrt(sumSq / samples.length);
    // Full-scale int16 reference is 32 768. dBFS = 20 * log10(rms / 32768).
    const ratio = rms / 32_768;
    return 20 * Math.log10(Math.max(ratio, 1e-10));
  }

  /** Push a frame; advances the state machine and may emit events. */
  push(frame: AudioFrame): void {
    const db = VoiceActivityDetector.frameEnergyDb(frame.samples);
    const isAboveStart = db >= this.opts.startThresholdDb;
    const isBelowStop = db < this.opts.stopThresholdDb;

    switch (this.state.type) {
      case 'silent': {
        if (isAboveStart) {
          if (this.minSpeechFrames === 1) {
            this.emit({ type: 'utterance-start', frame });
            this.state = { type: 'speech', startFrame: frame, frameCount: 1 };
          } else {
            this.state = {
              type: 'speech-pending',
              voicedStartFrame: frame,
              voicedFrames: 1,
            };
          }
        }
        return;
      }

      case 'speech-pending': {
        if (isAboveStart) {
          this.state.voicedFrames += 1;
          if (this.state.voicedFrames >= this.minSpeechFrames) {
            this.emit({ type: 'utterance-start', frame: this.state.voicedStartFrame });
            this.state = {
              type: 'speech',
              startFrame: this.state.voicedStartFrame,
              frameCount: this.state.voicedFrames,
            };
          }
        } else {
          // Spike that didn't sustain long enough — go back to silent.
          this.state = { type: 'silent' };
        }
        return;
      }

      case 'speech': {
        if (isBelowStop) {
          // Transitioning to silence-pending — the current frame is silent so
          // it does NOT count toward speechFrames; only the prior frames do.
          this.state = {
            type: 'silence-pending',
            startFrame: this.state.startFrame,
            speechFrames: this.state.frameCount,
            silenceFrames: 1,
          };
        } else {
          this.state.frameCount += 1;
        }
        return;
      }

      case 'silence-pending': {
        if (isAboveStart) {
          // Resume speech. The trailing silence-pending frames count as
          // speech (they were below start but above stop, i.e. hysteresis).
          this.state = {
            type: 'speech',
            startFrame: this.state.startFrame,
            frameCount: this.state.speechFrames + this.state.silenceFrames + 1,
          };
        } else if (isBelowStop) {
          this.state.silenceFrames += 1;
          if (this.state.silenceFrames >= this.minSilenceFrames) {
            // The trailing silence does not count toward utterance duration —
            // only the confirmed speech frames before it do.
            const durationMs = this.state.speechFrames * FRAME_DURATION_MS;
            this.emit({ type: 'utterance-end', frame, durationMs });
            this.state = { type: 'silent' };
          }
        } else {
          // Hysteresis zone — neither above start nor below stop. Hold.
        }
        return;
      }
    }
  }

  /**
   * Flush at end-of-stream. If we are mid-utterance, emit `utterance-end`.
   * Resets state to silent.
   */
  flush(lastFrame: AudioFrame | null = null): void {
    let durationMs = 0;
    let shouldEmit = false;
    if (this.state.type === 'speech') {
      durationMs = this.state.frameCount * FRAME_DURATION_MS;
      shouldEmit = true;
    } else if (this.state.type === 'silence-pending') {
      durationMs = this.state.speechFrames * FRAME_DURATION_MS;
      shouldEmit = true;
    }
    if (shouldEmit && lastFrame) {
      this.emit({ type: 'utterance-end', frame: lastFrame, durationMs });
    }
    this.state = { type: 'silent' };
  }

  /** Test helper: introspect current state type. */
  get currentState(): State['type'] {
    return this.state.type;
  }

  onEvent(listener: VadListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Expose for tests. */
  static framesPerSecond(): number {
    return 1000 / FRAME_DURATION_MS;
  }

  /** Expose for tests. */
  static framesForMs(ms: number): number {
    return Math.ceil(ms / FRAME_DURATION_MS);
  }

  /** Expose for tests. */
  static samplesPerFrame(): number {
    return FRAME_SAMPLES;
  }

  private emit(ev: VadEvent): void {
    for (const l of this.listeners) l(ev);
  }
}
