---
workflowType: 'epics-and-stories'
project_name: 'Smart Translator Earphone'
phase: '3-solutioning'
date: '2026-05-05'
inputDocuments:
  - prd.md
  - ux-design.md
  - architecture.md
  - adrs/ADR-001.md
  - adrs/ADR-002.md
  - adrs/ADR-003.md
  - adrs/ADR-004.md
  - adrs/ADR-005.md
---

# Epic Breakdown — Smart Translator Earphone

## Overview

This document decomposes the v1 capability contract (PRD) into **10 epics** and approximately **45 stories**. Each story has acceptance criteria expressed as Given/When/Then and references the FR/NFR it serves. Story sizes are an order-of-magnitude estimate (S = ≤1 day, M = 2–3 days, L = 4–7 days, XL = >1 week).

## Requirements Inventory (from PRD)

### Functional Requirements

- **FR-1** Conversation Mode (two-way)
- **FR-2** Lecture Mode (one-way listening)
- **FR-3** Group Mode (2-person QR pairing)
- **FR-4** Language Coverage (≥20 cloud, ≥10 offline)
- **FR-5** Live Transcript Display
- **FR-6** Automatic Language Detection
- **FR-7** Searchable Translation History
- **FR-8** Offline Mode
- **FR-9** TTS Voice Customization
- **FR-10** Quick-Launch Shortcut

### Non-Functional Requirements

- **NFR-1** Latency (≤1.5 s P95 cloud, ≤2.5 s offline; first interim ≤500 ms)
- **NFR-2** Device & OS support (iOS 15+, Android 10+)
- **NFR-3** Battery (≤15%/hour active)
- **NFR-4** Privacy (no audio retention; cloud-off mode)
- **NFR-5** Audio quality tolerance (≥85% accuracy at SNR ≥10 dB)
- **NFR-6** Reliability (network blip ≤5 s tolerated; <0.1% crashes)

### FR Coverage Map (epic → FR/NFR)

| Epic | Title | Primary FR/NFR served |
|------|-------|------------------------|
| E1 | Audio Pipeline Foundation | FR-1, FR-2, NFR-1, NFR-3, NFR-5 |
| E2 | Speech-to-Text Integration | FR-1, FR-2, FR-4, FR-6, NFR-1 |
| E3 | Translation Engine | FR-1, FR-2, FR-4, NFR-1 |
| E4 | Text-to-Speech Playback | FR-1, FR-2, FR-9 |
| E5 | Conversation Mode UI | FR-1, FR-5, FR-6 |
| E6 | Lecture Mode UI | FR-2, FR-5 |
| E7 | User Management & Settings | FR-7, FR-9, FR-10, NFR-4 |
| E8 | Offline Mode | FR-4, FR-8, NFR-1 |
| E9 | Session Sharing (Group Mode) | FR-3 |
| E10 | Performance, Privacy, & Polish | NFR-1, NFR-3, NFR-4, NFR-6 |

---

## Epic 1 — Audio Pipeline Foundation

**Goal.** Build the platform-agnostic audio pipeline that captures PCM frames from a connected mic, applies pre-processing (HPF + AGC), runs VAD, chunks frames, and plays back TTS audio. This epic blocks every other engine-integration epic.

**Files / modules.** `app/src/core/audio/*`, `app/src/native/ios/AudioSession.swift`, `app/src/native/android/AudioSession.kt`.

### Story 1.1 — Cross-platform `AudioCaptureProvider` interface (S)

As an architect, I want a TypeScript interface for audio capture that abstracts iOS/Android, so that the rest of the app code is platform-agnostic.

**Acceptance Criteria**

**Given** the interface `AudioCaptureProvider` defined in `app/src/core/audio/AudioCaptureProvider.ts`
**When** an implementation is supplied (mock or real)
**Then** consumers can call `start()`, `stop()`, and subscribe to `onFrame(frame)` and `onError(err)`
**And** frame format is documented: 16 kHz mono int16 PCM, 20 ms (320 samples) per frame.

**Given** the mock implementation `MockAudioCaptureProvider`
**When** consumers `start()` it with a fixture audio file
**Then** frames are emitted at the same rate as a real capture would emit them
**And** unit tests can drive the entire pipeline deterministically without device hardware.

(Implemented in Phase 4 — see `app/src/core/audio/AudioCaptureProvider.ts`.)

**FR/NFR served:** NFR-1, NFR-2.

### Story 1.2 — Audio frame buffer and chunker (M)

As the audio pipeline, I want to aggregate raw 20 ms PCM frames into 200–500 ms chunks suitable for streaming STT, so that downstream stages have sensibly sized inputs.

**Acceptance Criteria**

**Given** a stream of 20 ms PCM frames at 16 kHz
**When** the chunker is configured with `chunkMs=300`
**Then** it emits chunks of exactly 4 800 samples (300 ms) until input ends
**And** at end-of-stream a partial chunk is flushed with a `final=true` flag.

**Given** the chunker is configured for utterance-aligned mode
**When** a VAD-emitted utterance boundary arrives
**Then** the current partial chunk is flushed early with `utteranceBoundary=true` and the next chunk starts cleanly.

**Given** the chunker's max-chunk-duration safety
**When** voice activity exceeds `maxChunkMs=1500`
**Then** the chunker force-flushes a chunk to bound latency.

**FR/NFR served:** NFR-1, FR-1, FR-2.

### Story 1.3 — Voice Activity Detection (M)

As the audio pipeline, I want to detect when a user starts and stops speaking, so that we segment utterances correctly and don't ship silence to STT.

**Acceptance Criteria**

**Given** an energy-based VAD with `startThresholdDb=-40`, `stopThresholdDb=-50`, `minSilenceMs=400`
**When** speech (>start threshold) is sustained for ≥`minSpeechMs=120`
**Then** an `utterance-start` event is emitted with the timestamp of the first voiced frame
**And** subsequent frames are tagged `voiced=true`.

**Given** an in-progress utterance
**When** energy stays below `stopThreshold` for ≥`minSilenceMs`
**Then** an `utterance-end` event is emitted with the duration in ms
**And** subsequent frames are tagged `voiced=false`.

**Given** transient noise spikes (1–2 frames above start threshold)
**When** the spike does not exceed `minSpeechMs`
**Then** no utterance start is emitted (false-trigger suppression).

**Given** SNR ≥ 10 dB (NFR-5)
**When** the VAD is exercised with the synthetic test fixture
**Then** false-positive rate ≤ 5% and false-negative rate ≤ 5%.

**FR/NFR served:** NFR-1, NFR-5, FR-1, FR-2.

### Story 1.4 — Noise reduction primitives (M)

As the audio pipeline, I want a high-pass filter and a basic spectral-subtraction denoiser, so that low-frequency rumble and stationary background noise are reduced before STT.

**Acceptance Criteria**

**Given** the high-pass filter at 80 Hz cutoff (1st-order Butterworth)
**When** an input frame contains both 60 Hz hum and 250 Hz speech
**Then** 60 Hz energy is attenuated by ≥18 dB and 250 Hz speech is attenuated by ≤2 dB.

**Given** the spectral-subtraction denoiser is calibrated on 200 ms of leading silence
**When** a noisy frame is processed
**Then** stationary background noise energy is reduced by ≥6 dB
**And** speech intelligibility (informal A/B listening test) is not degraded.

**Given** the denoiser cannot calibrate (no leading silence detected)
**When** denoising is requested
**Then** the high-pass filter is applied alone and a `calibration-pending` event is emitted.

**FR/NFR served:** NFR-5.

### Story 1.5 — Audio playback queue / scheduler (M)

As the audio pipeline, I want a playback queue that schedules incoming TTS audio chunks back through the connected headset without overlap, so that translated speech sounds continuous.

**Acceptance Criteria**

**Given** an empty playback queue
**When** `enqueue(chunk)` is called with a 24 kHz PCM chunk
**Then** the chunk begins playback within 50 ms
**And** an `onChunkStart` event is emitted with the chunk ID.

**Given** a playback in progress
**When** another chunk is enqueued before the first finishes
**Then** the second chunk is queued and played seamlessly after the first
**And** there is no audible gap or click at the boundary (verified by listening test).

**Given** a playback in progress
**When** `cancel(chunkId)` is called
**Then** that chunk is removed from the queue if not yet started, or fades out within 100 ms if already playing.

**Given** the queue is empty after a chunk completes
**When** no further chunks arrive within `idleMs=2000`
**Then** an `onIdle` event is emitted to allow the audio session to be paused/released.

**FR/NFR served:** NFR-1, FR-1, FR-2.

### Story 1.6 — Native iOS audio session module (L)

As an iOS user, I want the audio session to be configured correctly for each `AudioSessionMode`, so that capture and playback work across HFP, A2DP, wired, and USB-C earphones.

**Acceptance Criteria**

**Given** `start('duplex-bt', ...)` is called on iOS 15+
**When** AirPods Pro are connected
**Then** `AVAudioSession` is set to `.playAndRecord` with `.allowBluetooth` and `.voiceChat` mode
**And** voice processing (AEC) is enabled on `AVAudioEngine.inputNode`
**And** the OS shows the orange mic-active indicator.

**Given** `setOutputRoute('speaker')`
**When** the session is in `capture-earphone-play-speaker` mode
**Then** audio playback is routed to the iPhone's loudspeaker via `overrideOutputAudioPort(.speaker)`
**And** capture remains on the Bluetooth mic.

**Given** the user disconnects the Bluetooth headset mid-session
**When** the route-change event fires
**Then** a `bluetooth-disconnected` event is emitted to the JS bridge
**And** the session pauses gracefully (does not crash).

**FR/NFR served:** NFR-2, FR-1, FR-9.

### Story 1.7 — Native Android audio session module (L)

As an Android user, I want the audio session to be configured correctly for HFP, wired, and USB-C, with foreground-service semantics on Android 14+, so that capture and playback work across the supported device matrix.

**Acceptance Criteria**

**Given** `start('duplex-bt', ...)` is called on Android 10+
**When** Bluetooth earphones are connected
**Then** `AudioManager.startBluetoothSco()` is called
**And** capture begins via `AudioRecord` with `MediaRecorder.AudioSource.VOICE_COMMUNICATION`
**And** `AcousticEchoCanceler` is engaged when supported.

**Given** Android 14 (API 34)
**When** the session is started
**Then** a foreground service of type `microphone` is started before any audio APIs are touched
**And** it is stopped when the session ends.

**Given** the user denies microphone permission
**When** the session attempts to start
**Then** a `mic-blocked` event is emitted to the JS bridge with reason `permission-denied`
**And** no crash occurs.

**FR/NFR served:** NFR-2, FR-1, FR-9.

---

## Epic 2 — Speech-to-Text Integration

**Goal.** Wire the audio pipeline output into both cloud and on-device STT engines via the engine router.

### Story 2.1 — `STTProvider` interface and Deepgram cloud adapter (M)

**As** the engine router, **I want** a uniform `STTProvider` interface, **so that** different vendors can be swapped without changing pipeline code.

**Acceptance Criteria**

**Given** `STTProvider` interface defined with `start(stream, langHint?) -> events { onPartial, onFinal, onError, onClose }`
**When** the Deepgram adapter is started with EN audio
**Then** it streams 20 ms PCM frames over WebSocket to `wss://api.deepgram.com/v1/listen`
**And** emits `onPartial` events as interim transcripts arrive (TTFT < 300 ms in the test fixture).

**FR/NFR served:** FR-1, FR-2, FR-4, NFR-1.

### Story 2.2 — Google Cloud Speech-to-Text adapter (M)

Acceptance: same shape as 2.1, using gRPC streaming. Includes language hint plumbing (Google supports `languageCode` and `alternativeLanguageCodes`).

### Story 2.3 — On-device Whisper adapter (L)

Acceptance: integrates `whisper.cpp` (via `whisper.rn` or a custom turbo module). Supports tiny and base models. Emits partials based on encoder hops (`whisper_full_step`). Stream-aware (does not require full audio before yielding text).

### Story 2.4 — Automatic language detection (M)

As a user (FR-6), **I want** the app to detect which language I'm speaking, **so that** I don't have to explicitly switch.

**Acceptance Criteria**

**Given** auto-detect is enabled and `STTProvider` supports it (Whisper, Google)
**When** the user speaks for ≥ 4 s
**Then** the detected language is emitted via `onLanguageDetected(lang, confidence)`
**And** the UI surfaces a "Detected: <Language>" chip (UX §3.2).

**Given** the detected confidence < 0.7
**When** auto-detect fires
**Then** the chip prompts the user to confirm the language manually.

**FR/NFR served:** FR-6.

### Story 2.5 — Engine router policy & remote config (M)

Acceptance: implements the policy table described in ADR-004 §Default policy. Loads from Cloudflare Workers KV via a signed URL; falls back to embedded JSON if remote fetch fails. A unit test verifies fallback behaviour.

---

## Epic 3 — Translation Engine

### Story 3.1 — `MTProvider` interface and DeepL adapter (M)

Acceptance: `MTProvider.translate(text, source, target) -> Promise<string>` with optional streaming variant. DeepL adapter handles their `/translate` endpoint, formality hint, and proper-noun preservation.

### Story 3.2 — Google Cloud Translation adapter (S)

Acceptance: same shape as 3.1, using `translate.googleapis.com/v3`.

### Story 3.3 — OpenAI GPT-4o-mini adapter with rolling context (M)

Acceptance: Pro-tier feature. Maintains a rolling context window of the last 30 s of conversation; prompts the model to keep proper-noun consistency. Streaming is enabled.

### Story 3.4 — On-device NLLB-200 adapter (L)

Acceptance: integrates the distilled 600M-parameter NLLB-200 via a native module. Loaded lazily; freed after 5 min idle. Same `MTProvider` interface.

### Story 3.5 — Translation pre-emption on partial transcripts (M)

Acceptance: when STT emits an `onPartial`, MT begins translating the partial; on `onFinal`, MT either reuses or revises the translation (revision marks the previous translation chunk as stale).

---

## Epic 4 — Text-to-Speech Playback

### Story 4.1 — `TTSProvider` interface and ElevenLabs streaming adapter (M)

Acceptance: ElevenLabs WebSocket streaming endpoint. Receives MP3 chunks; decodes via native Audio decoder (iOS `AVAudioFile`, Android `MediaCodec`); pushes 24 kHz PCM into the playback queue.

### Story 4.2 — Azure Neural TTS adapter (S)

Acceptance: REST + streaming variant; voice selection via `voiceName`.

### Story 4.3 — Apple `AVSpeechSynthesizer` and Android `TextToSpeech` adapters (S)

Acceptance: free-tier and offline-mode TTS. Maps to the appropriate platform voice for the selected language.

### Story 4.4 — TTS voice selection UI (S)

Acceptance: Settings → Voice (UX §3.7). Per-language voice picker with preview button. Persists selection to local store.

---

## Epic 5 — Conversation Mode UI

### Story 5.1 — Home screen (S)

Acceptance: implements UX §3.1 (Continue card, mode picker, language pair selector, earphone status badge).

### Story 5.2 — Conversation active session screen (M)

Acceptance: implements UX §3.2 (split screen, big mic button, mic-level meter, transparency sheet).

### Story 5.3 — Live transcript component (M)

Acceptance: `<TranscriptPair>` component handling interim vs final styling, language-pair-specific bidirectional layout, copy-on-tap.

### Story 5.4 — Engine transparency sheet (S)

Acceptance: opened via header `ⓘ`; shows active STT/MT/TTS engine names, current latency, and a "Switch to offline" shortcut.

### Story 5.5 — Permission flow (S)

Acceptance: mic permission requested at first session start; Bluetooth permission similarly. Each denial shows a non-modal banner with a deep link to system settings.

---

## Epic 6 — Lecture Mode UI

### Story 6.1 — Lecture active session screen (M)

Acceptance: implements UX §3.3 (two synchronized scrolling columns, Live pill, scrubbable history).

### Story 6.2 — Two-column transcript scroll synchronization (M)

Acceptance: scrolling either column scrolls the other; tapping a line in either column highlights the matching line.

### Story 6.3 — Scrollback with live audio continuing (S)

Acceptance: scrolling back does not pause TTS playback through earphones; "Live" pill returns user to current position.

### Story 6.4 — Lecture session export (S)

Acceptance: from session detail, user can export source + translation transcript as TXT or MD.

---

## Epic 7 — User Management & Settings

### Story 7.1 — Local store (SQLite + FTS5) (M)

Acceptance: tables for `sessions`, `messages`, `language_packs`, `settings`. FTS5 virtual table over `messages.text`. Migrations versioned.

### Story 7.2 — History list and detail screens (M)

Acceptance: implements UX §3.6.

### Story 7.3 — Settings tree implementation (M)

Acceptance: implements UX §3.7 (Languages, Voice, Privacy, Audio, Account sections).

### Story 7.4 — Optional sign-in (Apple, Google, magic-link email) (M)

Acceptance: anonymous device key issued on first launch; sign-in links the device key to an account.

### Story 7.5 — Subscription management (Apple StoreKit + Google Play Billing) (L)

Acceptance: server-side webhook validation; client gates Pro features by subscription claim in JWT; "manage subscription" deeplink to platform settings.

### Story 7.6 — Quick-launch widgets and Siri / Assistant shortcuts (L)

Acceptance: iOS Home/Lock-screen widget that resumes the last session in 1 tap; Android home-screen widget; Siri Shortcut "Start translating to Spanish"; Google Assistant App Action.

---

## Epic 8 — Offline Mode

### Story 8.1 — Language pack downloader (M)

Acceptance: per-language (or per-pair) download with progress, integrity check (sha256), pause/resume, deletion.

### Story 8.2 — Whisper.cpp on-device runtime integration (L)

Acceptance: covered by Story 2.3 + Android/iOS native modules + memory profiling on Pixel 6a (target: tiny < 200 MB peak).

### Story 8.3 — NLLB-200 on-device runtime integration (L)

Acceptance: covered by Story 3.4 + lazy loading + idle freeing.

### Story 8.4 — Offline mode UI affordances (S)

Acceptance: offline badge in active session; cloud-off toggle in Settings → Privacy; clear messaging when a pair is requested but the language pack is missing (with a Download CTA).

---

## Epic 9 — Session Sharing (Group Mode)

### Story 9.1 — Group session token & QR code (S)

Acceptance: server endpoint `POST /sessions/group` returns a JWT; mobile encodes as a QR; expires in 60 s; refreshes auto.

### Story 9.2 — QR scanner integration (S)

Acceptance: `expo-camera` scanner; validates the token; joins the session.

### Story 9.3 — Cloudflare Workers Durable Object relay (M)

Acceptance: relays JSON deltas only (transcripts, metadata); never touches audio; max 30-min session; per-message size cap; auth via JWT.

### Story 9.4 — Group session paired UI (M)

Acceptance: same shape as conversation mode but with both sides showing translated text from the partner; handles disconnect gracefully.

---

## Epic 10 — Performance, Privacy, & Polish

### Story 10.1 — Latency telemetry pipeline (M)

Acceptance: end-of-utterance to first-audio-byte latency measured client-side; emitted (opt-in) to PostHog. P50/P95 dashboards in PostHog.

**Acceptance gate:** P95 ≤ 1.5 s on WiFi, ≤ 1.8 s on 4G.

### Story 10.2 — Battery profiling and optimization (M)

Acceptance: instrumented test that runs a 30-min session on a representative mid-range device (Pixel 7a, iPhone 13) on WiFi; measures battery drain. **Pass: ≤ 7.5% drain on 30 min (≤ 15%/hour).** On 4G the secondary acceptance is ≤ 10% on 30 min (≤ 20%/hour).

### Story 10.3 — Privacy enforcement: no-audio-retention static check (S)

Acceptance: a CI lint rule ensures no server-side code path imports an S3/Postgres write API from any module that touches the audio frame stream. Adds a runtime sampling monitor that aborts on suspicious calls.

### Story 10.4 — Crash reporting and crash-free rate target (S)

Acceptance: Sentry installed in client; crash-free-session rate ≥ 99.9% before launch.

### Story 10.5 — Network blip resilience (M)

Acceptance: a session survives a 5 s network drop; STT buffers locally during the drop and resumes; UI displays a transient "Reconnecting…" indicator.

### Story 10.6 — Onboarding polish (S)

Acceptance: implements UX §3.5 in full, including the mic test that detects HFP and warns about audio-quality downgrade.

### Story 10.7 — App Store / Play Store assets and metadata (S)

Acceptance: screenshots in 5 device sizes; localized listings in EN/ES/FR/DE/VI/TH/JA/ZH-Hans; privacy questionnaire submitted.

### Story 10.8 — Beta release and iteration (L)

Acceptance: TestFlight + Play Internal beta with 200 users for 2 weeks; gather telemetry; fix top-10 bugs; gate launch on crash-free rate ≥ 99.9% and rating ≥ 4.4 / 5 from beta users.

---

## Story Size & Effort Summary

| Epic | Stories | Approx engineer-weeks |
|------|---------|------------------------|
| E1 Audio Pipeline Foundation | 7 | 4–5 |
| E2 STT Integration | 5 | 3 |
| E3 Translation Engine | 5 | 3 |
| E4 TTS Playback | 4 | 2 |
| E5 Conversation UI | 5 | 2 |
| E6 Lecture UI | 4 | 2 |
| E7 User Mgmt & Settings | 6 | 4 |
| E8 Offline Mode | 4 | 4 |
| E9 Session Sharing | 4 | 2 |
| E10 Performance & Polish | 8 | 3 |
| **Total** | **52** | **29–30 weeks** |

With 2 engineers running in parallel and shared epics, the v1 critical path is approximately **14–16 weeks**, in line with the brief's "~3 month MVP" target if Epics 6 and 9 (lecture and group mode) are scope-flexed to the second half of the schedule.

## Dependency Graph (high-level)

```
E1  ──► E2  ──► E5
        E2  ──► E3 ──► E4 ──► E5, E6
                              E5, E6 ──► E7 ──► E10
E1  ──────────► E8 ──► E10
E5  ──────────► E9 ──► E10
```

E1 (Audio Pipeline) gates everything voice-touching. **Hence the user's instruction to begin Phase 4 implementation with Epic 1 — exactly correct.**
