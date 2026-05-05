---
workflowType: 'architecture'
project_name: 'Smart Translator Earphone'
phase: '3-solutioning'
date: '2026-05-05'
inputDocuments:
  - prd.md
  - ux-design.md
  - product-brief.md
  - technical-research.md
---

# Architecture — Smart Translator Earphone

## 1. Goals & Constraints

| ID | Statement | Source |
|----|-----------|--------|
| G-1 | End-to-end conversation-mode latency ≤ 1.5 s P95 (cloud) | PRD NFR-1 |
| G-2 | Cross-platform iOS 15+ / Android 10+ from a single codebase | PRD NFR-2 |
| G-3 | No raw audio retention on the server | PRD NFR-4 |
| G-4 | Offline mode for ≥10 languages | PRD FR-8 |
| G-5 | Support 20+ languages cloud-side via vendor-agnostic engine routing | PRD FR-4 |
| G-6 | Pluggable engines per layer (STT, MT, TTS) so we can switch vendors per language pair | Tech Research §9 |
| G-7 | Battery use ≤ 15%/hour on WiFi/5G during active session | PRD NFR-3 |

## 2. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          Mobile Client                              │
│  (React Native + TypeScript; native modules per platform)          │
│                                                                     │
│  ┌────────────────┐   ┌─────────────────┐   ┌──────────────────┐   │
│  │  UI (RN)       │◄─►│  Session Mgr    │◄─►│ Audio Pipeline   │   │
│  │  Conv/Lecture/ │   │ (Mode-specific  │   │ (Native)         │   │
│  │  Group screens │   │  state machine) │   │ ┌────┬────┬────┐ │   │
│  └────────────────┘   └─────┬───────────┘   │ │Cap │VAD │Pla │ │   │
│                             │               │ │tur │+NR │ybk │ │   │
│  ┌────────────────┐         │               │ └─┬──┴──┬─┴──┬─┘ │   │
│  │  Local Store   │◄────────┘               └───┼─────┼────┼───┘   │
│  │ (SQLite + FTS5)│                             ▼     ▼    ▲       │
│  └────────────────┘     ┌──────────────────────────────────┴────┐  │
│                         │  Engine Router                         │  │
│                         │  (route by lang/quality/cost; cloud or │  │
│                         │   on-device)                           │  │
│                         └─────┬──────────┬───────────┬───────────┘  │
└───────────────────────────────┼──────────┼───────────┼──────────────┘
                                │          │           │
       ┌────────────────────────┘          │           └───────────┐
       ▼                                   ▼                       ▼
┌─────────────────┐               ┌─────────────────┐    ┌──────────────────┐
│  Cloud Plane    │               │  On-Device      │    │  Group-Mode      │
│  (Edge: Workers │               │  Models         │    │  Relay (transcr.)│
│   + WebSocket   │               │  (whisper.cpp,  │    │  WebSocket; no   │
│   gateway)      │               │   NLLB-200,     │    │  audio touched   │
│                 │               │   system TTS)   │    │                  │
│  ┌───┐ ┌───┐    │               └─────────────────┘    └──────────────────┘
│  │STT│ │MT │    │
│  └─┬─┘ └─┬─┘    │
│    │     │      │
│  ┌─▼─────▼──┐   │
│  │   TTS    │   │
│  └──────────┘   │
└─────────────────┘
```

### Plane summary

- **Mobile client.** Hosts the entire user experience and the audio pipeline. The native side (iOS/Android) owns capture, VAD, playback, and AEC; the JS side owns UI, session orchestration, and engine routing.
- **Cloud plane.** A thin gateway in front of three vendor-specific upstreams (STT / MT / TTS). The gateway terminates the user's WebSocket and fans out short-lived RPCs to vendors. **It does not persist audio.**
- **On-device plane.** Local model files cached per language. Activated when user is in offline mode or when the cloud plane is unreachable.
- **Group-mode relay.** A separate WebSocket service that forwards transcripts (text) between paired devices. Does not touch audio.

## 3. Mobile Client

### 3.1 Framework

**React Native (TypeScript) on Expo Bare Workflow** — selected over Flutter and Native-per-platform after evaluating ecosystem, audio-native availability, and team skills. See [`adrs/ADR-001.md`](./adrs/ADR-001.md).

### 3.2 Module decomposition

| Module | Owner | Description |
|--------|-------|-------------|
| `app/` | RN | Entry, navigation (React Navigation), tab structure |
| `features/conversation/` | RN | Conversation-mode screens, components |
| `features/lecture/` | RN | Lecture-mode screens, scrubbable transcript |
| `features/group/` | RN | Group-mode QR pairing, paired session UI |
| `features/history/` | RN | History list, detail, FTS search |
| `features/settings/` | RN | Settings tree (languages, voice, privacy, audio, account) |
| `features/onboarding/` | RN | First-launch flow |
| `core/audio/` | RN bridge → native | Capture, VAD, NR, playback. **This is Epic 1's home.** |
| `core/engine-router/` | RN | Decides STT/MT/TTS engine per language pair, given mode (cloud/offline), settings, and cost budget |
| `core/cloud-client/` | RN | WebSocket transport for cloud plane + group-relay |
| `core/onboarding-models/` | RN bridge → native | Downloads, integrity-checks, and loads on-device model files |
| `core/store/` | RN | SQLite + FTS5 (via `expo-sqlite`); session/language/setting persistence |
| `core/telemetry/` | RN | Opt-in telemetry pipeline (PostHog or Sentry; no PII) |
| `native/ios/` | Native (Swift) | `AVAudioSession`, `AVAudioEngine`, `whisper.cpp` bridge |
| `native/android/` | Native (Kotlin) | `AudioManager`, Oboe, `whisper.cpp` JNI bridge |

### 3.3 Audio pipeline detail

```
Mic (HFP/wired) ──► PCM 16 kHz mono frames (20 ms each)
                    │
                    ├─► [Pre-processor]  high-pass @ 80 Hz, AGC
                    │
                    ├─► [VAD]            energy + hysteresis (start_thr, stop_thr, min_silence)
                    │                    emits (frame, voiced, utterance_id)
                    │
                    ├─► [Chunker]        aggregate voiced frames into 200–500 ms chunks
                    │                    flush on utterance boundary or max chunk duration
                    │
                    └─► [Engine router] ─► STT (cloud streaming or on-device)
                                          ─► MT
                                          ─► TTS  ─►  [Playback queue]  ─► Speaker
```

The `core/audio/` modules are designed to be **platform-agnostic** at the TypeScript layer; the native modules implement the `AudioCaptureProvider` / `AudioPlaybackProvider` interfaces. See `app/src/core/audio/` (Phase 4 implementation).

### 3.4 Engine Router

Inputs: language pair, network availability, user mode (privacy / cost / quality), feature flags.

Outputs: 3 engine handles (`stt`, `mt`, `tts`) plus a `lifecycle` token that ties them together.

The router consults a **policy table**:

```
{
  "EN→ES": { "stt": "deepgram", "mt": "deepl", "tts": "azure" },
  "ZH→EN": { "stt": "google",   "mt": "deepl", "tts": "azure" },
  "VI→EN": { "stt": "google",   "mt": "google","tts": "google" },
  "*→*"  : { "stt": "google",   "mt": "google","tts": "google" }   // fallback
}
```

The policy is fetched from a remote config (Firebase Remote Config or equivalent) so we can shift traffic without an app update. If remote config is unavailable, the embedded default table is used.

If `cloud_off === true` or no network, the router returns the on-device pipeline regardless of policy.

## 4. Cloud Plane

### 4.1 Topology

- **API Gateway**: AWS API Gateway (REST/HTTP) for non-realtime endpoints (auth, billing, sync, language-pack signed URLs).
- **WebSocket Gateway**: AWS API Gateway WebSocket OR Cloudflare Workers Durable Object. Clear preference for Cloudflare Workers + Durable Objects for latency reasons (closer to the user globally) and simpler scaling. **Decision: Cloudflare Workers with Durable Objects.** See ADR-002 implication.
- **Audio fan-out**: The Worker reads the user's PCM frames off the WS, routes them to the vendor STT (also via WS), pipes interim transcripts to the MT vendor, pipes translation chunks to the TTS vendor, and streams TTS audio chunks back.
- **No persistent storage** of audio. The Worker holds at most 60 s of in-flight audio in memory; once flushed to the vendor, it is dropped.

### 4.2 Persistence

- **PostgreSQL (RDS)** for users, subscriptions, language packs metadata, remote config history. No transcripts.
- **DynamoDB** for ephemeral session state (mode, language pair, policy snapshot) keyed by session ID. TTL of 24 h.
- **S3** for app artifacts only: signed URLs of language pack downloads, app icons, etc. **No user audio. No transcripts.**
- **Redis (ElastiCache)** for ephemeral session-token blacklist, rate-limit counters.

### 4.3 Auth

- Anonymous-first: app generates an anonymous device key on first launch; all anonymous sessions are authorized via this key.
- Optional account: Sign in with Apple / Google / Email (no password — magic link). Linking ties the anonymous device key to the account.
- Pro subscriptions: validated server-side via Apple StoreKit / Google Play Billing webhooks. The server issues a JWT with subscription claims for every authenticated request.

### 4.4 Group-mode relay

Separate Cloudflare Worker + Durable Object. Pair token format:

```
JWT { sub: <session-id>, peers: 2, exp: now + 60s, region: "<closest>" }
```

When the second peer joins, the Durable Object becomes the message-router for the duration of the session (max 30 minutes). Transcripts are forwarded as JSON deltas; the relay never sees audio.

### 4.5 Cost & rate-limit posture

- Per-user free-tier cap: **30 minutes of cloud-streamed audio per day** enforced server-side via Redis counters.
- Per-IP rate limit: **2 concurrent sessions** to prevent abuse.
- Vendor-cost routing: when a user's policy admits multiple vendors, the router picks the cheapest acceptable vendor first; only escalates on quality complaints (telemetry-driven).

## 5. On-Device Plane

### 5.1 Models

| Layer | Model | Variant | Size (int8) |
|-------|-------|---------|-------------|
| STT | whisper.cpp `tiny.en` / `tiny` (multilingual) | Default | ~75 MB |
| STT | whisper.cpp `base` (multilingual) | Pro | ~150 MB |
| MT | NLLB-200 distilled | 600M params, int8 | ~700 MB |
| TTS | Apple `AVSpeechSynthesizer` | system | 0 (system) |
| TTS | Android `TextToSpeech` | system | 0 (system) |

Total per-language overhead is minimal; the bulk is the multilingual STT and MT. A user can offload offline support entirely to free up ~900 MB.

### 5.2 Loading & threading

- Models are loaded into native (iOS/Android) memory at session start when offline mode is needed; held in memory for 5 minutes after last use, then freed.
- All inference runs on a background thread (iOS GCD `userInitiated`, Android coroutine on Default dispatcher). Frame-by-frame inference (whisper.cpp `whisper_full_with_state`) emits results back to JS via the bridge.
- We do not block the JS thread for any inference call; results are delivered via event emitters.

## 6. Cross-Cutting

### 6.1 Observability

- **Client**: Sentry for crashes; PostHog (opt-in) for events. Latency is measured client-side, end-of-utterance to first-audio-byte.
- **Server**: Cloudflare Workers logs + Logpush to a centralized Datadog account; structured JSON; audio frame counts logged but not contents.

### 6.2 Security

- TLS 1.3 everywhere; certificate pinning in the mobile client for the Cloudflare WS endpoint.
- Per-vendor API keys are held only on the server. The mobile client never sees a vendor key.
- Anonymous device-key rotation every 30 days.

### 6.3 Privacy enforcement

- The server is engineered to never call any persistence API for an audio frame. A code-level lint check + a runtime monitor (sampling) verifies this. Any drift triggers a P0 alert.
- Telemetry events are scrubbed (no transcripts, no language IDs at user level — only at aggregate).
- "Cloud off" mode is enforced at the engine-router layer; if it's on, no WebSocket connection is opened to the cloud plane at all (verifiable by client-side telemetry of zero outbound bytes).

### 6.4 CI / CD

- App: GitHub Actions builds for iOS (TestFlight) and Android (Play Internal). EAS Build (Expo) for streamlined native builds.
- Server: Cloudflare Workers via `wrangler` deploy from CI. PostgreSQL migrations via `node-pg-migrate`.
- Test gates: unit tests (Jest) on every PR; integration tests against vendor sandboxes nightly; smoke tests against production sandboxes per release.

## 7. Architecture Decision Records

The five major decisions are tracked individually:

- [`adrs/ADR-001.md`](./adrs/ADR-001.md) — Mobile framework: React Native vs Flutter
- [`adrs/ADR-002.md`](./adrs/ADR-002.md) — Cloud-first vs on-device-first execution model
- [`adrs/ADR-003.md`](./adrs/ADR-003.md) — Streaming STT vs batch STT for lecture mode
- [`adrs/ADR-004.md`](./adrs/ADR-004.md) — Translation engine selection per language corridor
- [`adrs/ADR-005.md`](./adrs/ADR-005.md) — Audio routing strategy on iOS / Android

## 8. Architecture Risks Forwarded to Implementation

- **Audio capture on Bluetooth HFP profile** sounds worse than music. Onboarding mitigation only — there is no software fix.
- **WebSocket connection persistence on mobile**: iOS aggressively suspends background sockets. We accept that sessions terminate when the app backgrounds for >30 s.
- **whisper.cpp memory pressure** on Android devices with 3 GB RAM: tested on Pixel 6a; tiny works comfortably, base is borderline. Settings UI gates "base" (Pro feature) behind a memory-availability check.
- **Cloud-vendor outages**: the engine router has cascading fallbacks (DeepL → Google → on-device).
