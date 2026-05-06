/**
 * expo-speech TTS provider — wraps the OS-native text-to-speech engine on
 * iOS (AVSpeechSynthesizer) and Android (TextToSpeech). Free and
 * keyless on every platform, with builtin voices for many languages
 * (including Vietnamese, Thai, Indonesian) on modern devices.
 *
 * Like {@link WebSpeechTtsProvider}, the audio is played by the OS itself
 * (bypassing the router's `AudioPlaybackQueue`), so this provider returns
 * a tiny silent PCM buffer to keep the queue's chunk-start / chunk-end
 * events flowing for sequencing.
 *
 * `synthesize()` resolves only after `Speech.speak()` finishes (via
 * `onDone` / `onError`), so consecutive translations stay serialized.
 */

import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

import type { TtsProvider, TtsRequest, TtsResult } from './tts-types';

const SAMPLE_RATE = 24_000;
// Sentinel buffer of silence so the AudioPlaybackQueue can track this TTS
// chunk without producing audible interference.
const SILENCE_DURATION_SEC = 0.05;

let counter = 0;

export class ExpoSpeechTtsProvider implements TtsProvider {
  readonly id = 'expo-speech' as const;

  /**
   * Available on iOS and Android. On web, expo-speech can fall through to
   * the browser's speechSynthesis but `WebSpeechTtsProvider` already
   * covers that case more directly, so we hide ourselves there.
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  async synthesize(request: TtsRequest): Promise<TtsResult> {
    counter += 1;
    if (!this.isAvailable()) {
      throw new Error('expo-speech is not available on this platform');
    }
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      try {
        Speech.speak(request.text, {
          language: request.targetLang,
          // expo-speech's pitch + rate map onto a [0.5, 2.0] range; we
          // clamp our voice settings into that.
          pitch: Math.max(0.5, Math.min(2, 1 + request.voice.pitch / 12)),
          rate: Math.max(0.5, Math.min(2, request.voice.speed)),
          onDone: finish,
          onStopped: finish,
          onError: finish,
        });
      } catch {
        resolve();
      }
    });
    const totalSamples = Math.floor(SILENCE_DURATION_SEC * SAMPLE_RATE);
    return {
      samples: new Int16Array(totalSamples),
      sampleRateHz: SAMPLE_RATE,
      format: 'pcm-int16',
      engine: 'expo-speech',
      id: `expo-speech-tts-${counter}`,
    };
  }
}
