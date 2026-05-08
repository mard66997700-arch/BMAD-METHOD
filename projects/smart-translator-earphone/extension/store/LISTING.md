# Chrome Web Store listing — Smart Translator Earphone

Copy / paste these fields into <https://chrome.google.com/webstore/devconsole/>.
Keep the version in `manifest.json` in lockstep with the version uploaded
to the dashboard. The free Google Translate endpoint is built in; the
listing must disclose that the user's STT API key is sent to the
provider they pick.

## Required fields

### Extension name (45 char max)

```
Smart Translator Earphone
```

### Short description (132 char max, shows in search)

```
Capture a tab's audio, translate it live, hear the translation in your right ear while the original keeps playing in the left.
```

### Detailed description (16,000 char max)

```
Smart Translator Earphone turns any Chrome tab into a real-time
interpreter. It captures the active tab's audio (no screen-share popup),
batches it into short PCM chunks, transcribes each chunk with the
speech-to-text provider you pick, runs the transcript through the free
Google Translate endpoint, and speaks the translation through Web
Speech TTS. With Stereo dual-ear on, the original audio is panned to
your left ear while the synthesised translation plays in your right
ear, so you can follow a YouTube video, a Netflix episode, or a live
meeting without losing the original voice.

Why you might want it
- Watch foreign-language videos without subtitle delays.
- Sit through a meeting in a language you barely speak.
- Practise a language by hearing the same sentence twice — once in the
  source language, once in your target language.

What's free / what's paid
- Translation is free. The extension uses the same public Google
  Translate endpoint as the open-source companion app; no key needed.
- Speech-to-text needs an API key:
  • Google Cloud Speech-to-Text — free 60 minutes / month, then paid.
  • OpenAI Whisper — ~$0.006 / minute.
  Pick whichever fits your usage. The key is stored only in
  chrome.storage.session, so closing Chrome wipes it.

How it works
1. Open a tab that's playing audio.
2. Click the extension's icon, paste your STT key, pick your source
   and target languages, and hit Start.
3. Chrome shows a one-time prompt asking to share the tab's audio.
4. The extension captures audio in 4-second chunks, transcribes each
   chunk, translates it with the free Google Translate endpoint, and
   speaks the translation. The original audio keeps playing through
   Web Audio so you don't lose context.

Privacy
- Audio chunks are sent only to the STT provider you pick (OpenAI or
  Google Cloud). Nothing is stored on our servers — there are no
  servers; the extension talks to those providers directly from your
  browser.
- The translated text round-trips through translate.googleapis.com,
  which is the same public endpoint used by Google's web translator.
- The full source code is open under the BMAD-METHOD project on
  GitHub: https://github.com/mard66997700-arch/BMAD-METHOD/

Limits
- Browsers only allow capturing one tab at a time.
- Tab audio capture is mute-while-held, so the extension plays the
  original back through Web Audio. Some DRM-protected Netflix titles
  block the capture and you'll hear silence — that's a Netflix
  limitation, not the extension.
- The extension batches every four seconds, so the translation lags
  the speaker by ~chunk length plus your STT round-trip.
```

### Category

```
Productivity
```

### Language

```
English (Vietnamese supported in the UI strings, listing in EN)
```

### Visibility

```
Public
```

## Privacy practices (Chrome Web Store data declaration)

| Field | Answer |
| --- | --- |
| Personally identifiable information | No |
| Health information | No |
| Financial / payment information | No |
| Authentication information | Yes — user's own STT API key (stored in chrome.storage.session, never transmitted to us) |
| Personal communications | Yes — captured tab audio is sent to the user-selected STT provider |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | Yes — the extension reads the active tab's audio when the user clicks Start |

### Privacy policy URL

```
https://github.com/mard66997700-arch/BMAD-METHOD/blob/main/projects/smart-translator-earphone/extension/store/PRIVACY.md
```

### Single purpose

```
Capture the audio of the current Chrome tab, translate it in real time,
and play the translation back so the user can understand foreign-
language audio without losing the original.
```

### Permission justifications

| Permission | Justification |
| --- | --- |
| `tabCapture` | Required to capture the active tab's audio for translation. The capture is started only when the user explicitly clicks Start in the popup. |
| `offscreen` | Manifest V3 service workers cannot hold a `MediaStream`. The extension creates a single offscreen document to own the stream and the AudioContext. |
| `storage` | Persists user preferences (provider choice, language pair, dual-ear toggle) across browser restarts. The API key is stored only in `chrome.storage.session`, which is wiped on browser close. |
| `activeTab` | Lets the popup target the tab currently in focus when the user clicks Start. |
| Host permission `https://api.openai.com/*` | Sends 4-second audio chunks to OpenAI's `/v1/audio/transcriptions` endpoint when the user picks Whisper. |
| Host permission `https://speech.googleapis.com/*` | Sends 4-second audio chunks to Google Cloud's `/v1/speech:recognize` endpoint when the user picks Google Cloud STT. |
| Host permission `https://translate.googleapis.com/*` | Sends transcribed text to the public `translate_a/single` endpoint. |
| Use of remote code | None. The extension ships all its JavaScript in the package; there's no remote `import()` or remote `<script>`. |

## Promotional copy (optional listings)

### Vietnamese tagline

```
Nghe tiếng nước ngoài qua tai trái, nghe bản dịch tiếng Việt qua tai phải — tất cả trong một extension Chrome miễn phí.
```

### Promo tile copy (440 × 280)

Headline: `Listen in two languages at once`
Body: `Original audio in your left ear, live translation in your right.`

### Marquee copy (1400 × 560)

Headline: `Free real-time tab translator`
Body: `YouTube, Netflix, meetings — pick a tab, pick two languages, hear them both.`
