---
workflowType: 'prd'
project_name: 'Smart Translator Earphone'
phase: '2-planning'
date: '2026-05-05'
inputDocuments:
  - product-brief.md
  - brainstorming-report.md
  - market-research.md
  - technical-research.md
---

# Product Requirements Document — Smart Translator Earphone

## 1. Document Purpose

This PRD is the **capability contract** for v1 (MVP) of Smart Translator Earphone. It defines:

- The product's functional requirements (what capabilities must exist)
- The product's non-functional requirements (how well those capabilities must perform)
- The user journeys those capabilities must support

UX, architecture, and epic breakdown all derive from this document. **A capability that is not listed here will not exist in the v1 release.**

## 2. Background

See [`product-brief.md`](./product-brief.md) for the executive summary. Briefly: a mobile app that turns any user-owned Bluetooth or wired earphone into a real-time AI translation device, supporting conversation, lecture, and group modes, with a privacy-first architecture and an offline language pack for the most common travel corridors.

## 3. Target Users (recap)

- **Primary**: international travelers, cross-cultural professionals, language learners.
- **Secondary**: long-term immigrants, hospitality workers, accessibility users.

See product brief for personas and success criteria.

## 4. User Journeys

### Journey A — First-time tourist before a trip

1. Discovers the app via app-store search ("translation earbuds AirPods").
2. Installs, opens — sees the privacy-first welcome screen.
3. Grants microphone permission and Bluetooth permission (only when user starts the first session).
4. Optional account sign-in (skippable).
5. Selects native language and a target language (Spanish for an upcoming Madrid trip).
6. Runs an in-app mic test that confirms the connected AirPods produce clean audio.
7. Pre-downloads the Spanish offline pack (~250 MB) over WiFi.
8. Closes app; opens it again on the trip — last selected pair is remembered.

### Journey B — Conversation mode at a restaurant

1. User opens app, taps the prominent "Start translating" button.
2. App says "Speak when ready" through the AirPods.
3. User speaks; restaurant staff sees the live transcript (English) and Spanish translation appearing on the user's phone screen, hears the Spanish translation through the phone's speaker.
4. Staff replies in Spanish; the app captures Spanish from the phone mic (since the staff is not wearing earphones), translates to English, plays English back through the user's AirPods.
5. Conversation continues for ~3 minutes, ~12 turns.
6. User taps "End session"; the conversation is saved to history.

### Journey C — Lecture mode at a conference

1. User is at a Spanish-language keynote.
2. User opens app, taps "Lecture mode," confirms English as target.
3. Live transcript scrolls; English translation plays continuously through the user's earphones with ~2 s lag.
4. User scrolls back to re-read a sentence they missed; live audio continues uninterrupted.
5. User can save the full transcript+translation as a note.

### Journey D — Group mode (2-person QR pairing)

1. User and a counterpart each open the app.
2. User taps "Group mode" → "Pair via QR."
3. App displays a QR code with the session token.
4. Counterpart scans; both phones now share a session ID via a thin relay.
5. Each user speaks in their language; transcripts are exchanged; each user hears their own preferred language in their own earphones.
6. Either user can end the session.

### Journey E — Offline mode on a flight / remote area

1. User toggles "Cloud off" in settings or loses connectivity mid-session.
2. App routes STT/MT/TTS through the on-device pipeline if the language pair is downloaded.
3. App displays a clear "Offline" indicator with quality caveat; otherwise UX is identical.

## 5. Functional Requirements

The product **shall** provide the capabilities listed below. Each FR is uniquely identified for traceability into stories.

### FR-1 — Conversation Mode (two-way)

The app shall allow two participants speaking different languages to converse with the user wearing earphones, where:

- The user's earphone microphone captures their speech and the app translates it to the partner's language, played through the phone's external speaker (or partner's earphone if also on the app).
- The partner's speech is captured (via phone mic if not on the app, or via their app) and translated to the user's language, played through the user's earphone.
- Live transcripts of both languages are visible on the user's screen in a split-screen layout.
- The user can start, pause, and end the session at will.

### FR-2 — Lecture Mode (one-way listening)

The app shall provide a mode in which the user listens to a single foreign-language source (live or via the device microphone) and:

- The app continuously transcribes the source language and translates to the user's chosen target language.
- The translated audio plays continuously through the user's earphone with target lag <3 s.
- A scrolling transcript shows source + translation in parallel columns.
- The user may scroll back through past transcript without interrupting the live stream.

### FR-3 — Group Mode (2-person QR pairing in v1)

The app shall allow two users to pair into a shared translation session by:

- One user generating a session QR code; the other scanning to join.
- A backend relay forwarding transcripts (not raw audio) between the paired devices.
- Each device using its preferred input/output language; each user hears the other's speech translated into their own language through their own earphones.

### FR-4 — Language Coverage

The app shall support, in cloud mode, **at least 20 languages** for both speech-to-text and translation, including (at minimum):

EN, ES, FR, DE, IT, PT (BR + EU), NL, PL, RU, JA, KO, ZH (Hans + Hant), AR, HI, BN, TH, VI, ID, TR.

The app shall support, in offline mode, **at least 10 languages** including EN, ES, FR, DE, JA, ZH, KO, VI, TH, AR.

### FR-5 — Live Transcript Display

The app shall display the live transcript of both the source speech and its translation:

- Updated incrementally as partial STT/MT results arrive.
- With a clear visual distinction between final (stable) and interim (revisable) text.
- Allowing the user to copy any past message to clipboard.

### FR-6 — Automatic Language Detection

The app shall detect the spoken language automatically when the user enables auto-detect:

- For conversation mode, after a brief calibration phase, the app distinguishes the user's language from the partner's.
- For lecture mode, the app detects the source language at session start and locks it.
- The user may always override auto-detection manually.

### FR-7 — Searchable Translation History

The app shall save each completed session locally (default) with:

- Date, time, language pair, duration, and full transcript including translations.
- A search interface that searches across all saved sessions.
- The ability to delete individual sessions or all sessions.
- Optional sync to the user's account if signed in (Pro feature).

### FR-8 — Offline Mode

The app shall provide an offline mode that:

- Performs STT, MT, and TTS using on-device models for the supported language subset (FR-4).
- Does not require any network connectivity once the language pack is downloaded.
- Is the **default** when the device has no connectivity, with a visible UI indicator.
- Can be forced on by the user (privacy mode) regardless of connectivity.

### FR-9 — TTS Voice Customization

The app shall allow the user to choose:

- Voice gender (male / female / neutral) per target language, from the available voices for that language.
- Speech speed in 4 increments (0.75×, 1.0× default, 1.25×, 1.5×).
- Whether translation audio plays through earphones, phone speaker, or both.

### FR-10 — Quick-Launch Shortcut

The app shall provide a single-tap entry point to start the most-recently-used mode and language pair:

- An iOS Home Screen widget and an Android home-screen widget.
- A Siri Shortcut / Google Assistant action: "Hey [assistant], start translating to Spanish."
- A Lock Screen widget where supported (iOS 16+, Android 13+).

## 6. Non-Functional Requirements

### NFR-1 — Latency

- **End-to-end conversation-mode latency** (from end-of-utterance to start-of-translated-audio playback) shall be **≤ 1.5 s P95 in cloud mode** and **≤ 2.5 s P95 in offline mode**, on a device with ≥30 ms RTT to the nearest service region and a stable WiFi or 4G+ connection.
- **First interim transcript** shall appear within 500 ms of speech onset.
- **Lecture-mode buffer lag** shall stabilize at ≤ 3 s end-to-end and not drift indefinitely (no buffer accumulation across an hour-long session).

### NFR-2 — Device & OS Support

- iOS 15.0 or later on iPhone 8 (2017) or later.
- Android 10 (API 29) or later, on devices with ARM64 architecture and ≥3 GB RAM.
- Bluetooth audio: Bluetooth 4.0+ headsets supporting HFP profile.
- Wired audio: 3.5 mm and USB-C earphones.
- The app shall work without an active internet connection in offline mode (FR-8).

### NFR-3 — Battery Consumption

- The app shall consume **≤ 15% of battery per hour** of continuous active translation on a representative mid-range device (2024 reference: Pixel 7a or iPhone 13).
- The app shall not consume more than 1% per day in background (when no session is active).

### NFR-4 — Privacy

- The app shall **not retain raw user audio** server-side beyond the duration of an active streaming session.
- The app shall display a visible mic-active indicator whenever a session is in progress.
- Conversation transcripts shall be saved **locally by default**; cloud sync is opt-in.
- The user shall be able to delete all locally saved sessions in a single action.
- The app shall provide a "cloud off" mode that uses only on-device models and does not transmit user audio off-device.
- The app shall display a one-time disclosure to the user about partner consent before the first session in conversation mode.

### NFR-5 — Audio Quality Tolerance

- The app shall maintain ≥85% transcription accuracy on speech with **SNR ≥ 10 dB** (real-world noisy environments).
- The app shall apply automatic gain control and high-pass filtering on the input.
- The app shall apply acoustic echo cancellation when capture and playback share the same device (e.g., user's earphone for both ends).

### NFR-6 — Reliability & Robustness

- A network blip of ≤ 5 s during a session shall not terminate the session; the app shall buffer locally and resume on reconnect.
- Crashes per session shall be <0.1% (1 in 1000 sessions or fewer).
- The app shall maintain its session state across phone-call interruptions and recover gracefully when the call ends.

## 7. Functional / Non-Functional Cross-Cutting Notes

- **Accessibility:** All UI elements shall meet WCAG AA contrast ratios; live transcript shall support VoiceOver / TalkBack reading; system font scaling shall not break layout.
- **Internationalization:** The app's own UI shall be localized into at least 10 languages at launch (matching the offline language set).
- **Error handling:** Network errors, mic permission denials, and offline-pack-missing situations shall surface user-readable, actionable messages — never raw exceptions.
- **Telemetry:** The app shall emit anonymized usage telemetry (session start/end, mode, language pair, latency, errors) only when the user has opted in. No raw transcript or audio is ever telemetry-eligible.

## 8. Out of Scope (v1)

- Voice cloning of the user's own voice
- 3+ person group calls (beyond 2-person QR pair)
- Web/desktop client
- Custom enterprise glossaries
- Wear OS / watchOS apps
- Real-time interpretation in regulated domains (medical, legal) — disclaimer instead

## 9. Open Questions for Architecture

- ADR-001: React Native vs Flutter (tracked in `adrs/`)
- ADR-002: Cloud-first vs on-device-first execution (tracked in `adrs/`)
- ADR-003: Streaming STT vs batch STT for lecture mode (tracked in `adrs/`)
- ADR-004: Translation engine selection per language corridor (tracked in `adrs/`)
- ADR-005: Audio routing strategy on iOS / Android (tracked in `adrs/`)

## 10. Functional-Requirement Coverage Map (forward reference)

| FR | Mapped Epics |
|----|--------------|
| FR-1 Conversation Mode | E1 (Audio Pipeline), E2 (STT), E3 (Translation), E4 (TTS), E5 (Conversation UI) |
| FR-2 Lecture Mode | E1, E2, E3, E4, E6 (Lecture UI) |
| FR-3 Group Mode | E5, E9 (Session Sharing) |
| FR-4 Language Coverage | E2, E3, E8 (Offline Mode) |
| FR-5 Live Transcript | E5, E6 |
| FR-6 Auto Language Detect | E2 |
| FR-7 History | E7 (User Mgmt & Settings) |
| FR-8 Offline Mode | E8 |
| FR-9 TTS Customization | E4, E7 |
| FR-10 Quick Launch | E7 |

The full epic decomposition and per-story FR mapping live in [`epics-and-stories.md`](./epics-and-stories.md).
