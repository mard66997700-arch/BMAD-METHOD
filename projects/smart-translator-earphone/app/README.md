# Smart Translator Earphone — Mobile + Web App

Real-time speech translation, in your browser and on your phone. Built on
**Expo** (React Native + react-native-web) so the same codebase ships to iOS,
Android, and the desktop browser.

The app is wired across all five epics:

- **Epic 1 — Audio Pipeline Foundation** (capture, frame buffering, VAD,
  high-pass + spectral subtraction, playback queue)
- **Epic 2 — Speech-to-Text Integration** (Whisper, Google STT, mock)
- **Epic 3 — Translation Engine** (DeepL, OpenAI GPT-4, Google Translate, mock)
- **Epic 4 — Text-to-Speech Playback** (Azure Neural TTS, Google Cloud TTS, mock)
- **Epic 5 — Conversation Mode UI** (Home / Conversation / Lecture / Settings /
  History screens, plus shared components)

The orchestrator that chains all of this together lives in
[`src/core/engine-router.ts`](src/core/engine-router.ts).

## Demo mode

The app **runs without any API keys**. If `EXPO_PUBLIC_*` keys are not present,
the engine router falls back to mock providers that emit deterministic
placeholder text and a tone-burst for TTS so the full pipeline is exercisable
end-to-end. This is what the screenshots and Settings → "Mock (demo)" entries
refer to.

## Quick start

```bash
cd projects/smart-translator-earphone/app
npm install                      # one-time
npx expo start --web             # opens http://localhost:8081 in your browser
npx expo start                   # iOS/Android via Expo Go (scan QR)
```

The first time you load the web build, your browser will prompt for microphone
access. Press **Start Translation** on Home and start speaking — transcripts and
translations will appear in real time.

### Native builds

```bash
# Production web bundle (static site under dist/)
npm run export:web

# iOS / Android dev builds (requires Xcode / Android Studio)
npx expo run:ios
npx expo run:android

# Cloud builds (no Xcode/Android Studio required)
npx eas build -p ios
npx eas build -p android
```

For a step-by-step on-device test of the Free preset with native STT
+ TTS (and the stereo dual-ear toggle on real earphones), see
[`docs/TESTING_MOBILE.md`](docs/TESTING_MOBILE.md).

## Configure API keys

Copy `.env.example` to `.env` and fill in the keys you have. Only
`EXPO_PUBLIC_*`-prefixed variables are exposed to the bundle (Expo / Metro
inlines them at build time).

```bash
cp .env.example .env
```

| Variable | Used by | Powers |
|----------|---------|--------|
| `EXPO_PUBLIC_OPENAI_API_KEY` | Whisper STT, GPT-4 translation | English+ STT, nuanced translation, streaming |
| `EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY` | Google STT, Google Translate, Google TTS | 100+ language fallback |
| `EXPO_PUBLIC_DEEPL_API_KEY` | DeepL translation | High-quality EU language pairs |
| `EXPO_PUBLIC_AZURE_TTS_KEY` + `EXPO_PUBLIC_AZURE_TTS_REGION` | Azure Neural TTS | Best-in-class voice synthesis |
| `EXPO_PUBLIC_DEFAULT_STT_ENGINE` | App | Default STT engine (`mock` / `whisper-cloud` / `google`) |
| `EXPO_PUBLIC_DEFAULT_TRANSLATION_ENGINE` | App | Default translation engine (`mock` / `deepl` / `openai` / `google`) |
| `EXPO_PUBLIC_DEFAULT_TTS_ENGINE` | App | Default TTS engine (`mock` / `azure` / `google`) |

After adding keys, restart `expo start` so Metro picks them up. You can verify
which keys are visible to the app under **Settings → API keys**.

## Architecture map

```
src/
├── App.tsx                       Root component (SafeAreaProvider + nav)
├── index.js                      Expo entry point
├── index.ts                      Public surface of the platform-agnostic core
│
├── config/                       Environment + default-engine selection
│   ├── default-config.ts
│   ├── env.ts
│   └── index.ts
│
├── core/
│   ├── audio/                    Epic 1 — capture, VAD, chunker, NR, playback
│   │   ├── expo-audio-capture.ts          mobile (iOS/Android via expo-av)
│   │   ├── web-audio-capture.ts           web (getUserMedia + AudioContext)
│   │   ├── expo-audio-playback.ts         shared playback (web + native)
│   │   └── platform-audio-factory.ts      picks provider by Platform.OS
│   │
│   ├── stt/                      Epic 2 — speech-to-text
│   │   ├── stt-types.ts
│   │   ├── mock-stt-provider.ts           demo mode
│   │   ├── whisper-cloud-provider.ts      OpenAI Whisper
│   │   ├── google-stt-provider.ts         Google Cloud Speech
│   │   ├── language-detector.ts           lang-vote aggregator
│   │   └── stt-engine-router.ts           multi-engine routing + fallback
│   │
│   ├── translation/              Epic 3 — translation
│   │   ├── translation-types.ts
│   │   ├── mock-translation-provider.ts
│   │   ├── deepl-provider.ts
│   │   ├── openai-provider.ts             includes streaming variant
│   │   ├── google-translate-provider.ts
│   │   └── translation-router.ts          LRU cache + multi-engine fallback
│   │
│   ├── tts/                      Epic 4 — text-to-speech
│   │   ├── tts-types.ts
│   │   ├── voice-settings.ts
│   │   ├── mock-tts-provider.ts
│   │   ├── azure-tts-provider.ts
│   │   ├── google-tts-provider.ts
│   │   └── tts-engine-router.ts
│   │
│   ├── engine-router.ts          Orchestrates the full pipeline
│   └── engine-factory.ts         Wires providers from env + selected engines
│
├── components/                   Reusable UI (LanguagePicker, TranscriptBubble,
│                                  WaveformIndicator, ConnectionStatus)
├── screens/                      Home / Conversation / Lecture / Settings /
│                                  History
├── navigation/AppNavigator.tsx   React Navigation stack
├── state/SessionStore.ts         Tiny event-emitter store + useSessionStore hook
└── theme/colors.ts               Shared color palette
```

## Engine pipeline

```
microphone
   │
   ▼
AudioCaptureProvider           ── Story 1.1
   │ AudioFrame (320 int16 @ 16 kHz mono, 20 ms)
   ▼
HighPassFilter + Denoiser      ── Story 1.4
   │
   ▼
VoiceActivityDetector          ── Story 1.3
   │
   ▼
AudioChunker                   ── Story 1.2
   │ AudioChunk (variable-size, VAD-aligned)
   ▼
SttEngineRouter                ── Epic 2
   │ partial + final transcripts
   ▼
TranslationRouter (cached)     ── Epic 3
   │ translated text
   ▼
TtsEngineRouter                ── Epic 4
   │ Int16 PCM @ 24 kHz
   ▼
AudioPlaybackQueue             ── Story 1.5
   │
   ▼
earphones / browser speaker
```

## Development scripts

```bash
npm test            # Jest unit + integration tests
npm run typecheck   # tsc --noEmit (strict mode)
npm run lint        # ESLint over src/
npm run quality     # typecheck + lint + tests (matches CI)
npm run web         # expo start --web
npm run ios         # expo start --ios
npm run android     # expo start --android
```

## What the unit tests prove

The Jest suite covers all five epics:

- **Frame format invariant** (Story 1.1): every emission is exactly 320 int16
  samples (16 kHz mono, 20 ms).
- **Chunker correctness** (Story 1.2): exact chunk sizes; flush-on-utterance-
  boundary; max-chunk-duration safety.
- **VAD hysteresis** (Story 1.3): start/stop thresholds, minimum speech /
  silence duration. Synthetic SNR ≥ 10 dB tests bound FP/FN rates ≤ 5%.
- **High-pass filter response** (Story 1.4): ≥18 dB attenuation at 60 Hz,
  ≤2 dB attenuation at 250 Hz.
- **Spectral subtraction** (Story 1.4): ≥6 dB stationary-noise reduction.
- **Playback queue scheduling** (Story 1.5): ≤50 ms enqueue-to-play latency;
  gapless concatenation; cancellation; idle-event after `idleMs`.
- **STT mock + router** (Epic 2): partial/final emission per chunk, language
  detection vote-locking, recoverable-error fallback to next provider.
- **WAV encoding** (Epic 2): RIFF header layout + PCM round-trip.
- **Translation router** (Epic 3): provider fallback on error, LRU caching,
  streaming partial yield.
- **TTS router + voice settings** (Epic 4): fallback on error, voice helper
  clamping (speed [0.5, 2.0], pitch [-12, 12]).
- **End-to-end engine pipeline** (Epic 1–4): a synthetic speech burst fed
  through capture → chunker → VAD → STT → translation → TTS → playback emits
  the expected events at every stage. `speakOutput=false` is honored.

Run `npm test -- --coverage` for an HTML report.

## Manual smoke test (web)

1. `npm run web` and open the printed URL in Chrome.
2. Allow microphone access when prompted.
3. Click **Start Translation** on the Home screen — you'll be sent to
   Conversation mode.
4. Speak a short sentence. With no API keys configured, the demo providers
   emit a placeholder transcript like "Hello, how are you today?" with a
   translation in the selected target language (default Spanish), plus a
   tone-burst as TTS.
5. Switch to **Lecture** mode to see the same flow without playback.
6. Visit **Settings** to switch engines, adjust voice settings, and verify
   which API keys are visible to the bundle.

## Roadmap from here

1. **Native module compilation:** flesh out `src/native/ios/AudioSession.swift`
   and `src/native/android/AudioSession.kt` and register them as turbo modules
   so iOS/Android use real PCM frames instead of metering-driven synthesized
   frames.
2. **EAS pipelines:** wire `eas.json` for production iOS/Android builds.
3. **Earphone connection (Epic 6):** integrate Bluetooth A2DP / SCO routing
   feedback into `ConnectionStatus.tsx`.
4. **Offline mode:** ship a small on-device Whisper model and a tiny
   translation dictionary for the most common phrases.
