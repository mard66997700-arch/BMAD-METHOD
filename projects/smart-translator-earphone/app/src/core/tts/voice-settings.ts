/**
 * Voice settings shared by all TTS providers.
 *
 * Providers are free to map these onto their own taxonomy:
 *   - Azure has a fixed catalog of `<voice>` ids (e.g. 'en-US-AriaNeural').
 *   - Google maps voiceId → `name` (e.g. 'en-US-Neural2-F') and gender →
 *     `ssmlGender`.
 *   - The mock provider just records what it received.
 */

export type VoiceGender = 'female' | 'male' | 'neutral';

export interface VoiceSettings {
  gender: VoiceGender;
  /** Speaking rate, 1.0 = normal, [0.5, 2.0]. */
  speed: number;
  /** Pitch in semitones, 0 = normal, [-12, +12]. */
  pitch: number;
  /** Optional explicit provider voice id; overrides gender/speed/pitch heuristics. */
  voiceId?: string;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  gender: 'female',
  speed: 1.0,
  pitch: 0,
};

const SPEED_CLAMP = (v: number) => Math.max(0.5, Math.min(2.0, v));
const PITCH_CLAMP = (v: number) => Math.max(-12, Math.min(12, v));

export function withSpeed(voice: VoiceSettings, speed: number): VoiceSettings {
  return { ...voice, speed: SPEED_CLAMP(speed) };
}

export function withPitch(voice: VoiceSettings, pitch: number): VoiceSettings {
  return { ...voice, pitch: PITCH_CLAMP(pitch) };
}

export function withGender(voice: VoiceSettings, gender: VoiceGender): VoiceSettings {
  return { ...voice, gender };
}
