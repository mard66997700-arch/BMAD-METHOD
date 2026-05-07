/**
 * Epic 2 — Speech-to-Text (STT) provider interface.
 *
 * Providers consume `AudioChunk`s from the audio pipeline (Epic 1) and emit
 * partial + final transcripts. The interface is event-driven and provider-
 * agnostic; concrete providers (Whisper, Google, mock) implement it without
 * the rest of the pipeline knowing which engine is in use.
 */

import type { AudioChunk } from '../audio/audio-types';

export type SttEngineId =
  | 'mock'
  | 'whisper-cloud'
  | 'google'
  | 'web-speech'
  | 'expo-speech-recognition';

export interface SttSessionOptions {
  /** ISO-639-1 source language, or 'auto' for auto-detection. */
  sourceLang: string | 'auto';
  /** Hint for sample rate. The pipeline always emits 16 kHz mono int16. */
  sampleRateHz?: number;
  /** Identifier for the speaker (Speaker A / B in conversation mode). */
  speakerId?: string;
}

export interface SttPartial {
  type: 'partial';
  /** Stable session id; the consumer can group partials/finals by id. */
  sessionId: string;
  text: string;
  /** Detected language (only set after a few chunks). */
  detectedLang?: string;
  /** When the last chunk feeding this partial started, ms since session start. */
  startTimestampMs: number;
  /** Provider-specific confidence in [0, 1]. Optional. */
  confidence?: number;
}

export interface SttFinal {
  type: 'final';
  sessionId: string;
  text: string;
  detectedLang?: string;
  startTimestampMs: number;
  durationMs: number;
  confidence?: number;
}

export interface SttError {
  type: 'error';
  sessionId: string;
  error: Error;
  /** True if the error is recoverable (provider-specific transient error). */
  recoverable: boolean;
}

export type SttEvent = SttPartial | SttFinal | SttError;

export type SttEventListener = (event: SttEvent) => void;

/**
 * A single STT session. Lifecycle:
 *
 *   const session = await provider.createSession(opts);
 *   session.on(listener);
 *   pipeline.on(({chunk}) => session.pushChunk(chunk));
 *   ...
 *   await session.close();   // emits a final SttFinal for any pending text
 */
export interface SttSession {
  readonly id: string;
  pushChunk(chunk: AudioChunk): void;
  on(listener: SttEventListener): () => void;
  close(): Promise<void>;
}

export interface SttProvider {
  readonly id: SttEngineId;
  /** True if the provider has the credentials it needs to run. */
  isAvailable(): boolean;
  createSession(options: SttSessionOptions): Promise<SttSession>;
}
