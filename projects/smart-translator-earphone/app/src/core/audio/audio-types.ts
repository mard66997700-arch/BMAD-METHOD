/**
 * Shared audio types for Epic 1 (Audio Pipeline Foundation).
 *
 * The frame format is FIXED across the entire pipeline:
 *   - 16 kHz mono int16 PCM
 *   - 20 ms per frame (320 samples)
 *
 * See project-context.md "Audio pipeline" rule 1: do not deviate.
 */

export const SAMPLE_RATE_HZ = 16_000;
export const FRAME_DURATION_MS = 20;
export const FRAME_SAMPLES = (SAMPLE_RATE_HZ * FRAME_DURATION_MS) / 1000;

/**
 * A 20 ms frame of int16 PCM at 16 kHz mono.
 *
 * `samples.length` is always `FRAME_SAMPLES` (320). `seq` is a monotonically
 * increasing counter scoped to the current capture session.
 *
 * `timestampMs` is wall-clock-aligned milliseconds since the session started;
 * it is set by the capture provider and is monotonically non-decreasing.
 */
export interface AudioFrame {
  samples: Int16Array;
  seq: number;
  timestampMs: number;
}

/**
 * A chunk produced by the chunker — multiple consecutive frames merged.
 *
 * `final` is true on the final flush at end-of-stream, or when the chunker is
 * configured to flush at utterance boundaries and one was just observed.
 *
 * `utteranceBoundary` is true if this chunk was flushed because the VAD
 * signaled an utterance boundary (independent of `final`, which means
 * end-of-stream).
 */
export interface AudioChunk {
  samples: Int16Array;
  startSeq: number;
  endSeq: number;
  startTimestampMs: number;
  durationMs: number;
  final: boolean;
  utteranceBoundary: boolean;
}

/**
 * VAD events emitted as audio frames are processed.
 *
 * `utterance-start` is emitted exactly once per detected utterance, on the
 * frame where the start condition is first met.
 *
 * `utterance-end` is emitted exactly once per utterance, on the frame where
 * the end condition is first met. `durationMs` is the duration from start to
 * end (inclusive).
 */
export type VadEvent =
  | { type: 'utterance-start'; frame: AudioFrame }
  | { type: 'utterance-end'; frame: AudioFrame; durationMs: number };
