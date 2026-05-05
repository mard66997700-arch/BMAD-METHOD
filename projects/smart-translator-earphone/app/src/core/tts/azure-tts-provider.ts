/**
 * Azure Cognitive Services Text-to-Speech provider (REST endpoint).
 *
 * We request `raw-24khz-16bit-mono-pcm` so the response is directly playable
 * via AudioPlaybackQueue without an intermediate MP3/Opus decoder.
 */

import type { TtsProvider, TtsRequest, TtsResult } from './tts-types';
import type { VoiceGender } from './voice-settings';

const SAMPLE_RATE = 24_000;

export interface AzureTtsOptions {
  apiKey: string;
  /** Region (e.g. 'westus'). */
  region: string;
  fetchFn?: typeof fetch;
}

let counter = 0;

export class AzureTtsProvider implements TtsProvider {
  readonly id = 'azure' as const;

  constructor(private readonly opts: AzureTtsOptions) {}

  isAvailable(): boolean {
    return Boolean(this.opts.apiKey && this.opts.region);
  }

  async synthesize(request: TtsRequest): Promise<TtsResult> {
    counter += 1;
    const fetchFn = this.opts.fetchFn ?? fetch;
    const voiceName = request.voice.voiceId ?? defaultAzureVoice(request.targetLang, request.voice.gender);
    const ssml = buildSsml(voiceName, request);
    const url = `https://${this.opts.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.opts.apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'raw-24khz-16bit-mono-pcm',
        'User-Agent': 'smart-translator-earphone',
      },
      body: ssml,
    });
    if (!res.ok) throw new Error(`Azure TTS HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const samples = new Int16Array(arrayBuffer);
    return {
      samples,
      sampleRateHz: SAMPLE_RATE,
      format: 'pcm-int16',
      engine: 'azure',
      id: `azure-tts-${counter}`,
    };
  }
}

function buildSsml(voiceName: string, request: TtsRequest): string {
  const lang = request.targetLang.includes('-')
    ? request.targetLang
    : `${request.targetLang.toLowerCase()}-${request.targetLang.toUpperCase()}`;
  const ratePct = Math.round((request.voice.speed - 1) * 100);
  const rateAttr = `${ratePct >= 0 ? '+' : ''}${ratePct}%`;
  const pitchAttr = `${request.voice.pitch >= 0 ? '+' : ''}${request.voice.pitch}st`;
  const escaped = escapeXml(request.text);
  return (
    `<speak version="1.0" xml:lang="${lang}">` +
    `<voice name="${voiceName}">` +
    `<prosody rate="${rateAttr}" pitch="${pitchAttr}">${escaped}</prosody>` +
    `</voice></speak>`
  );
}

function defaultAzureVoice(lang: string, gender: VoiceGender): string {
  const base = lang.split('-')[0]!.toLowerCase();
  const region = lang.includes('-') ? lang.split('-')[1]!.toUpperCase() : base.toUpperCase();
  const tag = `${base}-${region}`;
  // Reasonable defaults; users can override via voice.voiceId.
  const map: Record<string, { female: string; male: string; neutral: string }> = {
    'en-US': { female: 'en-US-AriaNeural', male: 'en-US-GuyNeural', neutral: 'en-US-AriaNeural' },
    'es-ES': { female: 'es-ES-ElviraNeural', male: 'es-ES-AlvaroNeural', neutral: 'es-ES-ElviraNeural' },
    'fr-FR': { female: 'fr-FR-DeniseNeural', male: 'fr-FR-HenriNeural', neutral: 'fr-FR-DeniseNeural' },
    'de-DE': { female: 'de-DE-KatjaNeural', male: 'de-DE-ConradNeural', neutral: 'de-DE-KatjaNeural' },
    'ja-JP': { female: 'ja-JP-NanamiNeural', male: 'ja-JP-KeitaNeural', neutral: 'ja-JP-NanamiNeural' },
    'zh-CN': { female: 'zh-CN-XiaoxiaoNeural', male: 'zh-CN-YunxiNeural', neutral: 'zh-CN-XiaoxiaoNeural' },
  };
  return map[tag]?.[gender] ?? 'en-US-AriaNeural';
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
