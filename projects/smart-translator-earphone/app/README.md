# Smart Translator Earphone — Mobile App

This folder contains the mobile-app source for **Smart Translator Earphone**.

The current state implements **Epic 1 — Audio Pipeline Foundation** as a self-contained, platform-agnostic TypeScript module that can be dropped into a React Native (Expo Bare) shell. The native iOS/Android modules (Stories 1.6 and 1.7 of the epic) are present as skeleton files with a documented bridge contract; they require Xcode / Android Studio to build and have not been compiled in this snapshot.

## Architecture map

The TypeScript code in `src/core/audio/` is the entirety of Epic 1's platform-agnostic surface. It conforms to the contract documented in:

- `../../_bmad-output/architecture.md` — sections 3.3 (Audio pipeline detail) and 3.4 (Engine Router)
- `../../_bmad-output/adrs/ADR-005.md` — Audio routing strategy
- `../../_bmad-output/epics-and-stories.md` — Epic 1 stories 1.1 through 1.5

## Modules implemented (Epic 1)

| Story | Module | File |
|-------|--------|------|
| 1.1 | `AudioCaptureProvider` interface + `MockAudioCaptureProvider` | `src/core/audio/audio-capture.ts` |
| 1.2 | `AudioChunker` (frame buffer + chunker) | `src/core/audio/audio-chunker.ts` |
| 1.3 | `VoiceActivityDetector` | `src/core/audio/vad.ts` |
| 1.4 | `HighPassFilter` and `SpectralSubtractionDenoiser` | `src/core/audio/noise-reduction.ts` |
| 1.5 | `AudioPlaybackQueue` | `src/core/audio/audio-playback.ts` |
| (utility) | `AudioPipeline` orchestrator that composes 1.1–1.5 | `src/core/audio/audio-pipeline.ts` |

### Modules deferred (require device/simulator)

| Story | Module | Status |
|-------|--------|--------|
| 1.6 | iOS `AVAudioSession` / `AVAudioEngine` bridge | Skeleton in `src/native/ios/AudioSession.swift` (not compiled here) |
| 1.7 | Android `AudioRecord` / Oboe / SCO bridge | Skeleton in `src/native/android/AudioSession.kt` (not compiled here) |

The native bridge contract is captured in `src/core/audio/audio-session-types.ts`; the Swift/Kotlin skeletons implement that contract.

## Setup

This app is independent of the parent BMAD-METHOD repo's `package.json`. It manages its own dev dependencies.

```bash
cd projects/smart-translator-earphone/app
npm install
npm test                  # run Jest unit tests
npm run typecheck         # tsc --noEmit
npm run test:coverage     # run with coverage report
```

## What the unit tests prove

Epic 1 has substantive acceptance criteria with quantitative thresholds. The tests verify:

- **Frame format invariant** (Story 1.1): every `MockAudioCaptureProvider` emission is exactly 320 int16 samples (16 kHz mono, 20 ms).
- **Chunker correctness** (Story 1.2): exact chunk sizes; flush-on-utterance-boundary; max-chunk-duration safety.
- **VAD hysteresis** (Story 1.3): start/stop thresholds, minimum speech duration (false-trigger suppression), minimum silence duration. Synthetic SNR ≥ 10 dB tests that bound FP/FN rates ≤ 5%.
- **High-pass filter response** (Story 1.4): ≥18 dB attenuation at 60 Hz, ≤2 dB attenuation at 250 Hz.
- **Spectral subtraction calibration** (Story 1.4): ≥6 dB stationary-noise reduction; calibration-pending event when no leading silence.
- **Playback queue scheduling** (Story 1.5): ≤50 ms enqueue-to-play latency; gapless concatenation; cancellation; idle-event after `idleMs`.
- **End-to-end pipeline** (orchestrator): a synthetic utterance fed through capture → chunker → VAD → playback emits the expected utterance start/end events and chunk boundaries.

## Roadmap from here

1. **Phase 4 next sprints:** Epic 2 (STT integration) and Epic 4 (TTS playback) plug into the same audio pipeline. The interfaces are already defined.
2. **Native module compilation:** flesh out `src/native/ios/AudioSession.swift` and `src/native/android/AudioSession.kt`, register them as turbo modules, and bridge to the TS `AudioCaptureProvider` interface.
3. **Expo Bare shell:** `npx create-expo-app -t expo-template-bare-typescript` and copy `src/` into the resulting `src/` folder. The architecture is designed for this drop-in step to be friction-free.
