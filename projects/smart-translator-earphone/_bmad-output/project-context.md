---
project_name: 'Smart Translator Earphone'
phase: '3-solutioning'
date: '2026-05-05'
sections_completed: ['technology_stack', 'critical_implementation_rules', 'conventions']
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents (Devin, BMad Dev agents, code reviewers) must follow when implementing code in this project. Focus is on **unobvious details** that agents might otherwise miss._

---

## Technology Stack & Versions

### Mobile client

- **React Native** 0.74+ on **Expo SDK 51+** (Bare workflow — we ship custom native modules; managed mode would not allow this)
- **TypeScript** 5.x — strict mode enabled (`"strict": true` in `tsconfig.json`)
- **Node** 20.x for the toolchain
- **Navigation**: `@react-navigation/native` v6
- **State**: `zustand` for in-memory app state; SQLite for durable state. **Do not introduce Redux** — the team explicitly chose against it for the v1 scope; revisit if state-tree complexity justifies it.
- **HTTP**: `ky` (small wrapper over fetch). Do not use `axios` or `superagent`.
- **WebSocket**: native `WebSocket` (RN built-in) for the streaming audio plane; `socket.io` is **not** to be introduced (its protocol overhead is incompatible with our latency budget).

### Native modules

- **iOS**: Swift 5.9+, Xcode 15+, target iOS 15.0
- **Android**: Kotlin 1.9+, Gradle 8.5+, minSdk 29 (Android 10), targetSdk 34
- **whisper.cpp**: pinned to a specific commit hash (recorded in `app/native/whisper-version.txt`); update intentionally, never on a "latest" tag.

### Server

- **Cloudflare Workers** (TypeScript) with Durable Objects for the streaming gateway and group-relay
- **AWS RDS Postgres** 15+
- **AWS ElastiCache** Redis 7+
- **Migrations**: `node-pg-migrate`

### Tooling

- **Lint**: `eslint` (with `@typescript-eslint`) — `npm run lint` must pass with 0 warnings.
- **Format**: `prettier` — `npm run format:check` must pass.
- **Tests**: `jest` for unit/integration, `detox` for device-level E2E (post-MVP).

---

## Critical Implementation Rules

### Audio pipeline (Epic 1)

1. **Frame format is fixed.** All `AudioCaptureProvider` implementations emit 16 kHz mono int16 PCM, **20 ms per frame** (320 samples). Do not introduce a different sampling rate or frame size without an architectural review — downstream stages (VAD, chunker, STT adapters) all assume this contract.
2. **No floating-point arithmetic in the hot path.** VAD, energy computation, and ring-buffer logic all run per frame; use int math (or carefully bounded floats) to keep CPU and battery in budget.
3. **No allocation in the hot path.** Pre-allocate ring buffers at session start; reuse them. Garbage collection pauses on the JS side are tolerable; in native modules they are not.
4. **AEC is mandatory for any duplex mode.** If the audio session mode is `duplex-bt`, `duplex-wired`, or `capture-earphone-play-both`, voice processing / echo cancellation **must** be enabled (iOS: `AVAudioEngine.inputNode.isVoiceProcessingEnabled = true`; Android: `AcousticEchoCanceler` on the input).
5. **Native module errors must propagate to JS as typed events.** Use the `bluetooth-disconnected`, `mic-blocked`, `route-changed` event names. Do not throw raw native errors — JS callers cannot handle them gracefully.

### Privacy (NFR-4)

6. **Server code that touches an audio frame must never call any persistence API** (S3 putObject, Postgres INSERT into anything, KV writes). A CI lint rule enforces this; do not bypass it.
7. **Client telemetry is opt-in and PII-free.** No transcripts, no audio, no precise location, no device identifiers tied to a user. Hash all identifiers before emit.
8. **The "Cloud off" mode is a hard gate.** When `settings.cloudOff === true`, the engine router must never open a WebSocket to the cloud plane. Verify with telemetry that outbound bytes during a "Cloud off" session are zero.

### Performance (NFR-1)

9. **Latency is measured end-of-utterance to first-audio-byte.** A library-private `LatencyTimer` is the only sanctioned measurement; do not invent local timers.
10. **Use streaming everywhere.** STT, MT, TTS — all should be streaming. Batch APIs are only acceptable as fallbacks when streaming fails.
11. **Pre-warm long-lived connections at session start.** WebSocket to the cloud plane and the on-device whisper.cpp context should both be warmed before the user taps the mic button.

### Cross-platform code style

12. **No `Platform.OS === 'ios'` checks in feature code.** All platform branching belongs in `app/src/native/` modules (Stories 1.6, 1.7) or in the `core/audio/` provider implementations. Feature code is platform-agnostic by contract.
13. **Use the `AudioSessionMode` enum exhaustively.** When you write a switch on it, TypeScript's `never` should be reachable in the default branch. Add a lint exhaustiveness check.

### Error handling

14. **Surface errors with user-readable messages.** Never show a raw exception. Every error must map to a translated UI string with an actionable next step.
15. **Network errors are retryable; permission errors are not.** Distinguish them in the error type. Auto-retry network errors up to 3 times with exponential backoff.

### Engine router (Epics 2, 3, 4)

16. **The policy table is the single source of truth.** Do not branch on language inside engine adapter code. The router decides; the adapter implements.
17. **Every adapter must support cancellation.** A user pausing or ending a session must abort all in-flight requests (close the WS, cancel the fetch, free the on-device model handle). Use `AbortController` or its native equivalent.
18. **Adapters report metrics back through a single `EngineEventBus`.** Do not emit metrics from adapters directly — that breaks the router's accounting.

### Data model

19. **SQLite migrations are append-only.** Never edit a previous migration. New migrations only.
20. **FTS5 is required** for history search (Story 7.1). Do not substitute LIKE-based search; performance and ranking would be unacceptable.
21. **Subscription state is server-authoritative.** Client may cache for ≤24 hours. On every Pro feature use, validate the cached JWT's expiry. Do not gate features on a long-lived client flag.

### Build & release

22. **No commits without `npm run quality` passing locally.** This mirrors CI; commits that bypass it create churn.
23. **Conventional Commits.** This rule is inherited from the parent BMAD-METHOD repo (see root `AGENTS.md`).
24. **Releases are versioned semver.** Server and client version independently; the WS protocol must be backward-compatible across at least one minor version.

---

## Conventions

### Directory structure (mobile app)

```
app/
  src/
    app/                  # entry, App.tsx, navigation
    features/             # one folder per feature in UX IA
      conversation/
      lecture/
      group/
      history/
      settings/
      onboarding/
    core/                 # cross-feature primitives
      audio/              # AudioCaptureProvider, VAD, chunker, NR, playback queue
      engine-router/
      cloud-client/
      onboarding-models/
      store/
      telemetry/
    native/
      ios/
      android/
    types/                # shared TypeScript types
    test/
      fixtures/
      utils/
```

### Naming

- **Files**: `kebab-case.ts` for TS modules; `PascalCase.tsx` for React components.
- **Types and interfaces**: `PascalCase`. Interfaces are not prefixed with `I` (we follow modern TS conventions).
- **Constants**: `SCREAMING_SNAKE_CASE`.
- **React Native components**: one component per file unless trivially small; co-locate styles.

### Imports

- **Absolute imports from the `app/src/` root** via `tsconfig.json` `paths` config:
  - `@core/audio/*`
  - `@features/conversation/*`
  - `@native/ios`, `@native/android`
- Relative imports only within the same feature folder.

### Tests

- **Unit tests live next to the file under test**: `vad.ts` ↔ `vad.test.ts`.
- **Test fixtures go in `app/src/test/fixtures/`** (audio fixtures are < 100 KB each — use generated tones/noise rather than real recordings to avoid bloat).
- **Coverage target: 80% on `core/audio/` and `core/engine-router/`.** UI features are not coverage-gated but should have basic smoke tests.

### Comments

- Default is no comment. Names should carry the meaning.
- **Public API of `core/` modules** gets a brief doc comment (param types, return type, error contract).
- Do not write change-history comments — that is what git history is for.

---

## Out-of-Scope Footguns (do not do these)

1. **Do not introduce a real-time framework like Firebase Realtime Database** for the group-mode relay. The architecture explicitly chose Cloudflare Durable Objects (ADR-005); changing this without an ADR update is forbidden.
2. **Do not ship voice cloning.** Vision feature, explicitly out of scope (PRD §8). Adding it would change the privacy posture and the Apple/Google review profile.
3. **Do not log raw transcripts.** Even in debug builds. Use placeholder strings (e.g. `"<utterance, 8 words>"`) so a leaked log file does not leak conversation content.
4. **Do not skip the mic test in onboarding** (UX §3.5 step 2). The HFP detection saves a class of support tickets.

---

## Glossary

- **AEC** — Acoustic Echo Cancellation
- **AGC** — Automatic Gain Control
- **A2DP** — Advanced Audio Distribution Profile (high-quality Bluetooth playback, no mic)
- **HFP** — Hands-Free Profile (lower-quality bidirectional Bluetooth)
- **TTFT** — Time To First Token (or, for STT, time to first interim partial)
- **TTS / STT / MT** — Text-To-Speech / Speech-To-Text / Machine Translation
- **VAD** — Voice Activity Detection
- **PCM** — Pulse Code Modulation (uncompressed audio samples)

---

## When in Doubt

- For **product / requirement** questions, defer to `prd.md`.
- For **architectural** questions, defer to `architecture.md` and the relevant ADR.
- For **UX** questions, defer to `ux-design.md`.
- For **scope** questions, defer to `product-brief.md` (§ "Scope" and "Out of scope").
- If **you find a real conflict between documents**, raise it via PR comment with a proposed resolution; do not silently choose one side.
