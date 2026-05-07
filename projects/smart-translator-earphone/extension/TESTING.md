# Manual testing — Smart Translator Earphone (Chrome extension)

End-to-end manual test for the dual-ear stereo translation flow on YouTube.
The automated unit / integration tests live next to the code:

- `__tests__/translate.test.js` — free Google Translate provider (URL,
  query params, response parsing, errors).
- `__tests__/stt.test.js` — Whisper + Google Cloud STT adapters (endpoint,
  headers, request body shape, error handling).
- `__tests__/audio-capture.test.js` — `wrapPcmAsWav` header bytes,
  `downsample`, `floatToPcm16` clamping/scaling.
- `__tests__/offscreen.test.js` — buffer accumulation + STT → translate →
  TTS pipeline in `lib/translator-pipeline.js`.
- `../app/src/core/engine-router.test.ts` — dual-ear stereo, multi-utterance
  panning, and language-switching mid-session for the Expo app pipeline.

Run them with:

```bash
cd projects/smart-translator-earphone/extension && npm install && npm test
cd projects/smart-translator-earphone/app       && npm install && npm test
```

The remainder of this document covers what cannot be automated: real tab
audio capture inside Chrome, Web Speech TTS, and verifying that a real
pair of stereo earphones routes original audio to the left ear and the
translation to the right ear.

## Prerequisites

- Chrome / Edge / Brave **116+** (Manifest V3 + `chrome.offscreen`).
- Stereo earphones — wired is the easiest to verify because some Bluetooth
  stacks downmix to mono.
- One STT API key:
  - **OpenAI Whisper** — `$0.006/min`
    ([keys](https://platform.openai.com/api-keys)).
  - **Google Cloud Speech-to-Text** — free tier ~60 min/month
    ([credentials](https://console.cloud.google.com/apis/credentials)).
- Free Google Translate is built in; no translation key required.

## Load the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select
   `projects/smart-translator-earphone/extension/`.
4. Pin the **Smart Translator Earphone** action so the popup is one click
   away.

## Run the dual-ear translation

1. Open a foreign-language YouTube video — Japanese / Korean / Mandarin /
   Spanish all work well. Pick one with clear single-speaker dialogue (a
   news reader or a tutorial works better than music).
2. Click the extension icon to open the popup.
3. **STT provider** → Whisper or Google Cloud.
4. Paste your STT **API key**.
5. **Source language** → `Auto-detect` (or pin to a specific language).
6. **Target language** → Vietnamese (or anything you like).
7. ✅ **Stereo dual-ear (original L / translation R)**.
8. ✅ **Speak translation through Web Speech TTS**.
9. Click **Start**.
10. Chrome prompts for permission to capture the tab's audio — accept.

## Expected behaviour

| Where to look                             | What you should see / hear                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| Left ear                                  | Original audio from the YouTube video.                                           |
| Right ear                                 | Web Speech TTS reading out the translation (~4–5 s after the matching original). |
| Popup → **Original** field                | Live transcript of the source language as STT returns it.                        |
| Popup → **Translation** field             | Translated text matching the original utterance.                                 |
| Popup → status                            | `Listening to tab…` while running.                                               |
| `chrome://extensions` → service worker    | No errors after `Start`.                                                         |
| Offscreen document DevTools (Inspect)     | `[partial]` and `[translation]` log lines on each chunk.                         |

End-to-end latency is dominated by the 4-second chunk size + STT
round-trip. Anything in the 3–6 s range is normal.

## Regression checks

After making any change to the extension:

1. Click **Stop**, then **Start** again — transcript field clears, capture
   resumes without restarting Chrome.
2. Switch the **target language** mid-session (e.g. `vi → fr`), keep
   running, click **Start** again — new utterances should now arrive in
   the new language. Original audio should still pan left.
3. Open a video in a different language than the one you originally
   chose — with **Source language = Auto-detect**, the popup
   `[detectedLang]` value changes and translation continues.
4. Switch tabs while a capture is running — the original tab keeps
   streaming (Chrome only supports one captured tab at a time; this is
   documented behaviour, not a bug).
5. Click **Stop** — `speechSynthesis.cancel()` is called, queued
   utterances drop within ~1 s.

## Troubleshooting

| Symptom                                    | Likely cause                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Silence in both ears after `Start`         | Tab-capture permission was denied. Click the extension's **site access** toggle in `chrome://extensions` and try again. |
| `Start failed: Could not get media stream` | The tab is muted by Chrome, or another extension already holds the capture. Refresh the tab. |
| `Whisper STT failed: HTTP 401`             | Wrong / expired API key. Re-paste the key (it lives in `chrome.storage.session` only).    |
| `Google STT failed: HTTP 403`              | The Speech-to-Text API isn't enabled on the project the key belongs to.                   |
| Translation lag > 10 s                     | Slow network or rate-limited Google Translate endpoint. Try again in a minute.            |
| Translation plays in **both** ears equally | Web Speech TTS does not honour stereo panning. The original audio still pans left, so the right ear remains translation-dominant — this is expected. |
| Popup shows nothing in transcript          | Open the offscreen document via `chrome://extensions` → **service worker** → **Inspect views: offscreen.html** and check the console for STT errors. |

## Cleanup

`chrome://extensions` → toggle the extension off, or **Remove** to fully
uninstall. The session-scoped API key is wiped automatically when Chrome
closes; settings (provider, languages, dual-ear / TTS toggles) persist in
`chrome.storage.local` until you reset the extension.
