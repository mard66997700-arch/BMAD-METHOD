# Smart Translator Earphone — Chrome companion extension

Manifest-V3 Chrome extension that captures the active tab's audio (no
screen-share popup), transcribes it, runs it through the same free
Google Translate endpoint as the Expo app, and speaks the translation
through Web Speech TTS. Pairs with the Expo app under `../app/` for
mic-driven scenarios.

## What you need

- Chrome / Edge / Brave 116+ (Manifest V3 with `chrome.offscreen`).
- An STT API key. Pick one based on the latency you can tolerate:
  - **Soniox** — streaming WebSocket, ~1 s latency. Free trial
    ~200 minutes; afterwards ~$0.12/h
    ([console](https://console.soniox.com)). Recommended for live
    conversations or watching YouTube without a noticeable lag.
  - **Google Cloud Speech-to-Text** — batch REST, ~5 s latency.
    Free tier 60 min/month
    ([console](https://console.cloud.google.com/apis/credentials)).
  - **OpenAI Whisper** — batch REST, ~5 s latency. `$0.006/minute`
    ([keys](https://platform.openai.com/api-keys)).
- The free Google Translate endpoint
  (`translate.googleapis.com/translate_a/single`) is built in; no
  translation key required.

## Install

1. Open `chrome://extensions` and enable **Developer mode** (top-right).
2. Click **Load unpacked** and select this directory.
3. Pin the extension so the popup is one click away.
4. Open the popup, paste your STT key, pick languages, click **Start**.

The first time you click Start, Chrome asks to capture the tab's audio
— accept. Tab audio is muted while we hold the stream, so the
extension always pipes the original audio back through Web Audio. With
**Stereo dual-ear** on (default), the original plays in your left ear
and the synthesised translation plays in your right.

## How it works

- `background.js` — service worker. Owns the offscreen lifecycle and
  ferries `chrome.tabCapture.getMediaStreamId()` results.
- `offscreen.html` / `offscreen.js` — owns the `MediaStream` /
  `AudioContext`. With a streaming STT (Soniox) it forwards PCM
  frames as they arrive and translates only on finalised tokens.
  With a batch STT (Whisper / Google Cloud REST) it accumulates
  4-second WAV chunks instead. In either case the result flows
  through `translateFree()` and Web Speech TTS.
- `popup.html` / `popup.js` — the configuration UI and a live
  transcript view. Settings persist in `chrome.storage.local`; the API
  key is stored only in `chrome.storage.session` so closing Chrome
  wipes it.
- `lib/audio-capture.js` — Web Audio plumbing: stereo-pan playback +
  16 kHz mono PCM tap.
- `lib/translate.js` — same `google-free` endpoint as the Expo app.
- `lib/stt.js` — Whisper and Google Cloud Speech REST adapters.
- `lib/soniox-streaming.js` — Soniox WebSocket client (push PCM,
  receive partial / final tokens).

## Limits

- **Browsers can only stream one tab at a time.** Switching tabs while
  capturing keeps capturing the original tab.
- **STT is required for tab audio.** The browser's `Web Speech API`
  only accepts microphone input; there's no free, in-browser STT
  capable of transcribing arbitrary audio. The extension makes that
  caveat explicit by requiring a key on the popup.
- **Streaming STT requires Soniox.** The other two providers are HTTP
  REST endpoints with no streaming variant browsers can talk to. If
  ~5 s of latency is fine, Google Cloud's free tier is the cheapest
  option; if you want ≈1 s latency you need a Soniox key.
- **Web Speech TTS plays from both ears.** If you wear earphones, the
  panning still helps because the original is attenuated to your left
  ear, leaving the right ear dominated by the synthesised voice.
