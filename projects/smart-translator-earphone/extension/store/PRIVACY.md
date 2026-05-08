# Smart Translator Earphone — Privacy policy

_Last updated: 2026-05-06_

Smart Translator Earphone is an open-source Chrome extension. It runs
entirely in your browser. We do not operate any servers and we do not
collect, store, or transmit any of your data.

## What the extension does with your data

When you click **Start** in the popup, the extension:

1. Calls `chrome.tabCapture.getMediaStreamId()` to capture the audio
   of the tab in focus.
2. Down-samples the captured audio to 16 kHz mono PCM.
3. Splits the PCM into ~4-second WAV chunks.
4. Sends each WAV chunk to the speech-to-text provider you picked in
   the popup, along with the API key you pasted into the popup:
   - **OpenAI Whisper** — `https://api.openai.com/v1/audio/transcriptions`
   - **Google Cloud Speech-to-Text** — `https://speech.googleapis.com/v1/speech:recognize`
5. Sends the resulting transcript to the public Google Translate
   endpoint at `https://translate.googleapis.com/translate_a/single`.
6. Plays the translation back through the browser's Web Speech API,
   while panning the original tab audio to your left ear and the
   synthesised translation to your right ear.

The extension stops sending audio the moment you click **Stop**, close
the popup, or the offscreen document is torn down by Chrome.

## What we store

- **Preferences** (provider choice, language pair, dual-ear toggle) live
  in `chrome.storage.local`. They never leave your browser.
- **Your API key** lives in `chrome.storage.session`, which Chrome wipes
  the moment you close the browser. The key is sent only to the
  provider you picked, in the `Authorization` header (Whisper) or
  `?key=` query parameter (Google Cloud STT).
- **Captured audio** is held in memory for the few seconds it takes to
  build a WAV chunk. We never persist audio to disk.

## What third parties may do with your data

When you choose a paid provider, audio chunks and translation requests
travel across that provider's network and fall under their privacy
policy:

- OpenAI: <https://openai.com/policies/privacy-policy>
- Google Cloud: <https://cloud.google.com/terms/cloud-privacy-notice>
- Google Translate (public endpoint): <https://policies.google.com/privacy>

We are not affiliated with any of these providers. If you're concerned
about a particular language or topic being sent to one of them, don't
use that provider — there's no other path because browsers do not yet
expose a free, in-browser STT capable of transcribing arbitrary audio.

## What we do not do

- We do not run any server-side component.
- We do not embed any analytics, tracking pixels, or advertising SDKs.
- We do not sell your data.
- We do not transmit your API key anywhere except to the provider you
  selected.

## Source code

The full source is open under the MIT license at
<https://github.com/mard66997700-arch/BMAD-METHOD/tree/main/projects/smart-translator-earphone/extension>.
You can audit every byte the extension ships before you load it.

## Contact

Open an issue on the GitHub repository if you spot anything wrong with
this policy or with the extension's data flow.
