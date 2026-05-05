/**
 * Cross-platform AudioSession contract (Stories 1.6, 1.7).
 *
 * The eight modes are documented in ADR-005. Both iOS (AVAudioSession +
 * AVAudioEngine) and Android (AudioManager + AudioRecord + Oboe) implement
 * the same contract via the React Native turbo-module bridge.
 *
 * The native implementations live in:
 *   - src/native/ios/AudioSession.swift
 *   - src/native/android/AudioSession.kt
 *
 * These skeletons are not compiled in this repo snapshot; they are present
 * so the contract is reviewable and the migration to Expo Bare is friction
 * free.
 */

export type AudioSessionMode =
  | 'capture-only'
  | 'duplex-bt'
  | 'duplex-wired'
  | 'capture-mic-play-speaker'
  | 'capture-mic-play-earphone'
  | 'capture-earphone-play-speaker'
  | 'capture-earphone-play-both';

export type OutputRoute = 'earphone' | 'speaker' | 'both';

export type LangCode = string;

export type AudioSessionEvent =
  | { type: 'route-changed'; route: OutputRoute }
  | { type: 'bluetooth-disconnected' }
  | { type: 'mic-blocked'; reason: 'permission-denied' | 'already-in-use' | 'unknown' };

export type AudioSessionEventListener = (event: AudioSessionEvent) => void;

export interface AudioSession {
  start(mode: AudioSessionMode, lang: LangCode): Promise<void>;
  stop(): Promise<void>;
  setOutputRoute(route: OutputRoute): Promise<void>;
  on(listener: AudioSessionEventListener): () => void;
}

/**
 * Exhaustiveness helper used by switch statements that branch on
 * AudioSessionMode. See project-context rule 13.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled audio session mode: ${JSON.stringify(x)}`);
}
