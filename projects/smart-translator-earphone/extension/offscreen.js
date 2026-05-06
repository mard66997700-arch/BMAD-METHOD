/**
 * Offscreen document — owns the AudioContext, batches tab audio into
 * fixed-length chunks, runs them through STT → free Google translate
 * → Web Speech TTS, and reports transcripts back to the popup.
 *
 * Manifest V3 service workers can't hold a `MediaStream`, hence the
 * offscreen document.
 */

import { TabAudioCapture } from './lib/audio-capture.js';
import { transcribeWithGoogle, transcribeWithWhisper } from './lib/stt.js';
import { translateFree } from './lib/translate.js';

const SAMPLE_RATE = 16_000;
const CHUNK_SECONDS = 4;
const CHUNK_SAMPLES = SAMPLE_RATE * CHUNK_SECONDS;

let capture = null;
let buffer = new Int16Array(0);
let busy = false;
let cancelToken = null;
let activeConfig = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return false;
  if (msg.type === 'start') {
    start(msg.streamId, msg.config)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        report({ kind: 'error', message: err?.message ?? String(err) });
        sendResponse({ ok: false, error: err?.message });
      });
    return true;
  }
  if (msg.type === 'stop') {
    stop()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err?.message }));
    return true;
  }
  return false;
});

async function start(streamId, config) {
  await stop();
  activeConfig = config;
  cancelToken = new AbortController();
  capture = new TabAudioCapture();
  buffer = new Int16Array(0);
  await capture.connect(streamId, {
    pan: config.dualEar ? 'left' : 'center',
    onPcm: (pcm) => onPcm(pcm),
  });
  report({ kind: 'status', state: 'listening' });
}

async function stop() {
  cancelToken?.abort();
  cancelToken = null;
  capture?.stop();
  capture = null;
  buffer = new Int16Array(0);
  busy = false;
  activeConfig = null;
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  report({ kind: 'status', state: 'stopped' });
}

function onPcm(chunk) {
  const merged = new Int16Array(buffer.length + chunk.length);
  merged.set(buffer);
  merged.set(chunk, buffer.length);
  buffer = merged;
  if (buffer.length >= CHUNK_SAMPLES && !busy) {
    const segment = buffer.subarray(0, CHUNK_SAMPLES);
    buffer = buffer.subarray(CHUNK_SAMPLES);
    void translateSegment(new Int16Array(segment));
  }
}

async function translateSegment(pcm) {
  if (!activeConfig) return;
  busy = true;
  try {
    const stt = await runStt(pcm, activeConfig, cancelToken?.signal);
    if (!stt.text) return;
    report({ kind: 'partial', text: stt.text, detectedLang: stt.detectedLang });
    const tr = await translateFree({
      text: stt.text,
      sourceLang: stt.detectedLang ?? activeConfig.sourceLang,
      targetLang: activeConfig.targetLang,
      signal: cancelToken?.signal,
    });
    report({
      kind: 'translation',
      original: stt.text,
      translated: tr.text,
      detectedLang: tr.detectedLang ?? stt.detectedLang,
    });
    if (activeConfig.tts !== false && tr.text) {
      speakRight(tr.text, activeConfig.targetLang);
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
    report({ kind: 'error', message: err?.message ?? String(err) });
  } finally {
    busy = false;
    if (buffer.length >= CHUNK_SAMPLES && activeConfig) {
      const next = buffer.subarray(0, CHUNK_SAMPLES);
      buffer = buffer.subarray(CHUNK_SAMPLES);
      void translateSegment(new Int16Array(next));
    }
  }
}

async function runStt(pcm, config, signal) {
  if (config.sttProvider === 'whisper') {
    return transcribeWithWhisper({
      pcm,
      sampleRateHz: SAMPLE_RATE,
      sourceLang: config.sourceLang,
      apiKey: config.apiKey,
      signal,
    });
  }
  return transcribeWithGoogle({
    pcm,
    sampleRateHz: SAMPLE_RATE,
    sourceLang: config.sourceLang,
    apiKey: config.apiKey,
    signal,
  });
}

function speakRight(text, lang) {
  if (typeof speechSynthesis === 'undefined') return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 1;
  utter.pitch = 1;
  utter.volume = 1;
  // The browser's speechSynthesis pans to both ears. The mic-side
  // panning we do in audio-capture.js sends original audio to the left
  // ear, so the mix still leaves the right ear translation-dominant.
  speechSynthesis.speak(utter);
}

function report(payload) {
  chrome.runtime.sendMessage({ target: 'popup', ...payload }).catch(() => {
    /* popup might be closed — fine */
  });
}
