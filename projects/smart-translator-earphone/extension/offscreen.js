/**
 * Offscreen document — owns the AudioContext and the chrome-specific
 * messaging. The actual translation pipeline lives in
 * `lib/translator-pipeline.js` so it can be unit-tested without the
 * `chrome.*` / `speechSynthesis` APIs.
 *
 * Manifest V3 service workers can't hold a `MediaStream`, hence the
 * offscreen document.
 */

import { TabAudioCapture } from './lib/audio-capture.js';
import { transcribeWithGoogle, transcribeWithWhisper } from './lib/stt.js';
import { translateFree } from './lib/translate.js';
import { SAMPLE_RATE_HZ, createTranslator } from './lib/translator-pipeline.js';

let capture = null;
let cancelToken = null;
let translator = null;

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
  cancelToken = new AbortController();
  translator = createTranslator(config, {
    signal: cancelToken.signal,
    transcribe: (pcm, signal) => runStt(pcm, config, signal),
    translate: (args) => translateFree(args),
    speak: (text, lang) => speakRight(text, lang),
    report,
  });
  capture = new TabAudioCapture();
  await capture.connect(streamId, {
    pan: config.dualEar ? 'left' : 'center',
    onPcm: (pcm) => translator.onPcm(pcm),
  });
  report({ kind: 'status', state: 'listening' });
}

async function stop() {
  cancelToken?.abort();
  cancelToken = null;
  capture?.stop();
  capture = null;
  translator = null;
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  report({ kind: 'status', state: 'stopped' });
}

async function runStt(pcm, config, signal) {
  if (config.sttProvider === 'whisper') {
    return transcribeWithWhisper({
      pcm,
      sampleRateHz: SAMPLE_RATE_HZ,
      sourceLang: config.sourceLang,
      apiKey: config.apiKey,
      signal,
    });
  }
  return transcribeWithGoogle({
    pcm,
    sampleRateHz: SAMPLE_RATE_HZ,
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
