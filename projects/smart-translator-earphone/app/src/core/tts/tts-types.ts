/**
 * Epic 4 — Text-to-Speech provider interface.
 *
 * Providers accept text + language + voice settings and return PCM (Int16
 * mono) audio at a known sample rate. The router feeds those samples into the
 * existing AudioPlaybackQueue (Story 1.5).
 */

import type { VoiceSettings } from './voice-settings';

export type TtsEngineId = 'mock' | 'azure' | 'google' | 'web-speech';

export type TtsAudioFormat = 'pcm-int16';

export interface TtsRequest {
  text: string;
  /** Target language code (e.g. 'es', 'fr-FR'). */
  targetLang: string;
  /** Voice settings (gender / speed / pitch / explicit voice id). */
  voice: VoiceSettings;
}

export interface TtsResult {
  /** Mono int16 PCM samples. */
  samples: Int16Array;
  sampleRateHz: number;
  format: TtsAudioFormat;
  engine: TtsEngineId;
  /** Identifier for tracing (matches request seq). */
  id: string;
}

export interface TtsProvider {
  readonly id: TtsEngineId;
  isAvailable(): boolean;
  synthesize(request: TtsRequest): Promise<TtsResult>;
}
