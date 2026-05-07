/**
 * STT adapters: OpenAI Whisper (HTTP, ~$0.006/min) and Google Cloud
 * Speech-to-Text (HTTP, free tier 60 min/month). Each takes a WAV
 * blob and returns plain text plus an optional detected-language hint.
 *
 * Both are non-streaming on purpose — the extension batches captured
 * tab audio into N-second chunks (default 4 s) so we don't need a
 * websocket. Latency is the chunk length plus the round-trip; for
 * casual YouTube watching that's fine and keeps integration simple.
 */

import { wrapPcmAsWav } from './audio-capture.js';

/**
 * @param {{ pcm: Int16Array; sampleRateHz: number; sourceLang: string; apiKey: string; signal?: AbortSignal }} opts
 */
export async function transcribeWithWhisper({ pcm, sampleRateHz, sourceLang, apiKey, signal }) {
  const wav = wrapPcmAsWav(pcm, sampleRateHz);
  const form = new FormData();
  form.append('file', wav, 'audio.wav');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  if (sourceLang && sourceLang !== 'auto') form.append('language', sourceLang);
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper STT failed: HTTP ${res.status} ${body}`);
  }
  const data = await res.json();
  return {
    text: typeof data?.text === 'string' ? data.text.trim() : '',
    detectedLang: typeof data?.language === 'string' ? data.language : undefined,
  };
}

/**
 * @param {{ pcm: Int16Array; sampleRateHz: number; sourceLang: string; apiKey: string; signal?: AbortSignal }} opts
 */
export async function transcribeWithGoogle({ pcm, sampleRateHz, sourceLang, apiKey, signal }) {
  const audioBytes = pcmToBase64(pcm);
  const url = `https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(apiKey)}`;
  const body = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: sampleRateHz,
      languageCode: sourceLang && sourceLang !== 'auto' ? sourceLang : 'en-US',
      enableAutomaticPunctuation: true,
    },
    audio: { content: audioBytes },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google STT failed: HTTP ${res.status} ${text}`);
  }
  const data = await res.json();
  const transcript = (data?.results ?? [])
    .map((r) => r?.alternatives?.[0]?.transcript ?? '')
    .filter(Boolean)
    .join(' ')
    .trim();
  return { text: transcript };
}

/** @param {Int16Array} pcm */
function pcmToBase64(pcm) {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
