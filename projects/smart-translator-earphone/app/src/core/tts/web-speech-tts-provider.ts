/**
 * Web Speech API TTS provider — wraps the browser's `speechSynthesis`. The
 * actual audio plays through the browser's own output (bypassing the
 * router's `AudioPlaybackQueue`); the provider returns a tiny silent PCM
 * buffer so the queue's chunk-start/chunk-end events still flow normally
 * and consecutive translations stay serialized.
 *
 * `synthesize()` resolves only after `utterance.onend` fires, so the
 * playback queue won't kick off the next utterance until the browser has
 * finished speaking the current one.
 */

import type { TtsProvider, TtsRequest, TtsResult } from './tts-types';

interface SpeechSynthesisLike {
  speak(utterance: SpeechSynthesisUtteranceLike): void;
  cancel(): void;
}

interface SpeechSynthesisUtteranceLike {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

export type UtteranceCtor = new (text: string) => SpeechSynthesisUtteranceLike;

const SAMPLE_RATE = 24_000;
// Tiny sentinel of silence so the AudioPlaybackQueue can track this TTS
// chunk without producing audible interference.
const SILENCE_DURATION_SEC = 0.05;

let counter = 0;

function getSynthesis(): { synth: SpeechSynthesisLike; ctor: UtteranceCtor } | null {
  const g = globalThis as unknown as {
    speechSynthesis?: SpeechSynthesisLike;
    SpeechSynthesisUtterance?: UtteranceCtor;
  };
  if (!g.speechSynthesis || !g.SpeechSynthesisUtterance) return null;
  return { synth: g.speechSynthesis, ctor: g.SpeechSynthesisUtterance };
}

export interface WebSpeechTtsOptions {
  /** Inject for tests / non-browser hosts. */
  synth?: SpeechSynthesisLike;
  ctor?: UtteranceCtor;
}

export class WebSpeechTtsProvider implements TtsProvider {
  readonly id = 'web-speech' as const;

  constructor(private readonly opts: WebSpeechTtsOptions = {}) {}

  isAvailable(): boolean {
    if (this.opts.synth && this.opts.ctor) return true;
    return getSynthesis() !== null;
  }

  async synthesize(request: TtsRequest): Promise<TtsResult> {
    counter += 1;
    const synth = this.opts.synth ?? getSynthesis()?.synth;
    const Ctor = this.opts.ctor ?? getSynthesis()?.ctor;
    if (!synth || !Ctor) {
      throw new Error('Web Speech speechSynthesis is not available in this environment');
    }
    const utterance = new Ctor(request.text);
    utterance.lang = request.targetLang;
    utterance.rate = Math.max(0.1, Math.min(10, request.voice.speed));
    // Map our [-12, +12] semitone scale onto the browser's [0, 2] pitch range.
    utterance.pitch = Math.max(0, Math.min(2, 1 + request.voice.pitch / 12));
    utterance.volume = 1;
    await new Promise<void>((resolve) => {
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      try {
        synth.speak(utterance);
      } catch {
        resolve();
      }
    });
    const totalSamples = Math.floor(SILENCE_DURATION_SEC * SAMPLE_RATE);
    return {
      samples: new Int16Array(totalSamples),
      sampleRateHz: SAMPLE_RATE,
      format: 'pcm-int16',
      engine: 'web-speech',
      id: `web-speech-tts-${counter}`,
    };
  }
}
