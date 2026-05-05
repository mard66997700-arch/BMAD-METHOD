/**
 * Google Cloud Text-to-Speech provider (REST, simple key auth).
 *
 * Endpoint: https://texttospeech.googleapis.com/v1/text:synthesize
 *
 * We request LINEAR16 audio at 24 kHz so the response is directly playable
 * via AudioPlaybackQueue. The response is base64-encoded, so we decode it
 * and skip the 44-byte WAV header to get raw int16 samples.
 */

import type { TtsProvider, TtsRequest, TtsResult } from './tts-types';
import type { VoiceGender } from './voice-settings';

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const SAMPLE_RATE = 24_000;

export interface GoogleTtsOptions {
  apiKey: string;
  fetchFn?: typeof fetch;
}

let counter = 0;

export class GoogleTtsProvider implements TtsProvider {
  readonly id = 'google' as const;

  constructor(private readonly opts: GoogleTtsOptions) {}

  isAvailable(): boolean {
    return Boolean(this.opts.apiKey);
  }

  async synthesize(request: TtsRequest): Promise<TtsResult> {
    counter += 1;
    const fetchFn = this.opts.fetchFn ?? fetch;
    const url = `${ENDPOINT}?key=${encodeURIComponent(this.opts.apiKey)}`;
    const lang = request.targetLang.includes('-')
      ? request.targetLang
      : defaultLocale(request.targetLang);
    const body = {
      input: { text: request.text },
      voice: {
        languageCode: lang,
        name: request.voice.voiceId,
        ssmlGender: ssmlGenderOf(request.voice.gender),
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        sampleRateHertz: SAMPLE_RATE,
        speakingRate: request.voice.speed,
        pitch: request.voice.pitch,
      },
    };
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
    const json = (await res.json()) as { audioContent?: string };
    if (!json.audioContent) throw new Error('Google TTS returned no audio');
    const samples = decodeLinear16WavBase64(json.audioContent);
    return {
      samples,
      sampleRateHz: SAMPLE_RATE,
      format: 'pcm-int16',
      engine: 'google',
      id: `google-tts-${counter}`,
    };
  }
}

function ssmlGenderOf(gender: VoiceGender): string {
  return gender === 'male' ? 'MALE' : gender === 'female' ? 'FEMALE' : 'NEUTRAL';
}

function defaultLocale(lang: string): string {
  // Map ISO-639-1 → typical BCP-47 locales for Google TTS.
  const map: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-BR',
    ja: 'ja-JP',
    ko: 'ko-KR',
    zh: 'cmn-CN',
    ru: 'ru-RU',
    nl: 'nl-NL',
    pl: 'pl-PL',
    tr: 'tr-TR',
    hi: 'hi-IN',
    ar: 'ar-XA',
  };
  return map[lang] ?? `${lang}-${lang.toUpperCase()}`;
}

function decodeLinear16WavBase64(b64: string): Int16Array {
  const bytes = base64ToBytes(b64);
  // Google returns a WAV-wrapped LINEAR16 payload. Skip the 44-byte header.
  const headerBytes = 44;
  if (bytes.length < headerBytes) return new Int16Array(0);
  const audioBytes = bytes.subarray(headerBytes);
  // Make sure we have an even number of bytes and the buffer is aligned.
  const sampleCount = Math.floor(audioBytes.byteLength / 2);
  const out = new Int16Array(sampleCount);
  const view = new DataView(audioBytes.buffer, audioBytes.byteOffset, audioBytes.byteLength);
  for (let i = 0; i < sampleCount; i++) {
    out[i] = view.getInt16(i * 2, true);
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const binary = (globalThis as unknown as { atob: (s: string) => string }).atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
