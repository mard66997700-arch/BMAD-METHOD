# Smart Translator Earphone — Chrome companion extension

Manifest-V3 Chrome extension that captures the active tab's audio (no
screen-share popup), transcribes it, runs it through the same free
Google Translate endpoint as the Expo app, and speaks the translation
through Web Speech TTS. Pairs with the Expo app under `../app/` for
mic-driven scenarios.

## What you need

- Chrome / Edge / Brave 116+ (Manifest V3 with `chrome.offscreen`).
- An STT API key. Either:
  - **Google Cloud Speech-to-Text** — free tier 60 min/month
    ([console](https://console.cloud.google.com/apis/credentials)).
    Recommended for the keyless-by-default vibe.
  - **OpenAI Whisper** — `$0.006/minute`
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
  `AudioContext`, batches PCM into 4-second chunks, runs the chunks
  through the chosen STT provider, then `translateFree()`, then Web
  Speech TTS.
- `popup.html` / `popup.js` — the configuration UI and a live
  transcript view. Settings persist in `chrome.storage.local`; the API
  key is stored only in `chrome.storage.session` so closing Chrome
  wipes it.
- `lib/audio-capture.js` — Web Audio plumbing: stereo-pan playback +
  16 kHz mono PCM tap.
- `lib/translate.js` — same `google-free` endpoint as the Expo app.
- `lib/stt.js` — Whisper and Google Cloud Speech REST adapters.

## Limits

- **Browsers can only stream one tab at a time.** Switching tabs while
  capturing keeps capturing the original tab.
- **STT is required for tab audio.** The browser's `Web Speech API`
  only accepts microphone input; there's no free, in-browser STT
  capable of transcribing arbitrary audio. The extension makes that
  caveat explicit by requiring a key on the popup.
- **No streaming STT.** We post 4-second WAV chunks, so latency is
  ~chunk length plus the round-trip. For YouTube / Netflix watching
  that's acceptable; for live conversations the Expo app's Web Speech
  / native paths are lower-latency.
- **Web Speech TTS plays from both ears.** If you wear earphones, the
  panning still helps because the original is attenuated to your left
  ear, leaving the right ear dominated by the synthesised voice.

## Publishing to the Chrome Web Store

`store/` contains everything you need to push the extension to the
Chrome Web Store:

- `store/LISTING.md` — copy / paste fields for the dev console.
- `store/PRIVACY.md` — privacy policy required by the dashboard.
- `store/PUBLISH_CHECKLIST.md` — step-by-step submission checklist.
- `store/build-zip.sh` — packages the extension into
  `store/dist/smart-translator-earphone-v<version>.zip`.
- `store/generate-placeholders.sh` — regenerates the placeholder
  screenshots in `store/assets/` (replace before public release).
