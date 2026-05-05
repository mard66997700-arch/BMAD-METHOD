/**
 * Mock TTS provider — synthesizes a tone-burst whose duration scales with the
 * input text length. Used in demo mode so the AudioPlaybackQueue still has
 * something to play and the UI can show "speaking" feedback without spending
 * cloud quota.
 *
 * Pitch is mapped from voice gender + voice.pitch:
 *   female -> 220 Hz
 *   male   -> 110 Hz
 *   neutral-> 165 Hz
 * Each pitch semitone shifts the output by 2^(1/12).
 *
 * Output is always mono int16 PCM at 24 kHz (matches the AudioPlaybackQueue
 * default).
 */

import type { TtsProvider, TtsRequest, TtsResult } from './tts-types';

const SAMPLE_RATE = 24_000;

let counter = 0;

export class MockTtsProvider implements TtsProvider {
  readonly id = 'mock' as const;

  isAvailable(): boolean {
    return true;
  }

  async synthesize(request: TtsRequest): Promise<TtsResult> {
    counter += 1;
    const baseFreq =
      request.voice.gender === 'male' ? 110 : request.voice.gender === 'female' ? 220 : 165;
    const pitchedFreq = baseFreq * Math.pow(2, request.voice.pitch / 12);
    const charsPerSecond = 18 * Math.max(0.5, request.voice.speed);
    const durationSec = Math.max(0.4, request.text.length / charsPerSecond);
    const totalSamples = Math.floor(durationSec * SAMPLE_RATE);
    const samples = new Int16Array(totalSamples);
    // Quiet sine wave with a soft fade in/out so consecutive utterances don't click.
    const fadeSamples = Math.min(SAMPLE_RATE * 0.02, totalSamples / 2);
    const amplitude = 6_000; // ~ -15 dBFS
    for (let i = 0; i < totalSamples; i++) {
      const env =
        i < fadeSamples
          ? i / fadeSamples
          : i > totalSamples - fadeSamples
            ? (totalSamples - i) / fadeSamples
            : 1;
      samples[i] = Math.round(Math.sin((2 * Math.PI * pitchedFreq * i) / SAMPLE_RATE) * amplitude * env);
    }
    return {
      samples,
      sampleRateHz: SAMPLE_RATE,
      format: 'pcm-int16',
      engine: 'mock',
      id: `mock-tts-${counter}`,
    };
  }
}
