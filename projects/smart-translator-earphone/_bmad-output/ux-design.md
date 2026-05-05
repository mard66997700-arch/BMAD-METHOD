---
workflowType: 'ux-design'
project_name: 'Smart Translator Earphone'
phase: '2-planning'
date: '2026-05-05'
inputDocuments:
  - prd.md
  - product-brief.md
---

# UX Design — Smart Translator Earphone

## 1. Design Principles

1. **Voice first, glance second.** The screen is a confidence-builder, not the primary interface. The user should be able to look up from the phone and trust that the translation is happening.
2. **One-tap to value.** A returning user should be able to tap the home-screen widget once and be in their last-used mode and language.
3. **Confidence cues.** Latency, current engine, mic level, and language confidence are surfaced subtly but always visible — translation is an "AI doing magic" task; users will trust it more if they understand what it is doing.
4. **Privacy is visible.** When the app is processing audio, the user can see what is going to the cloud vs. on-device, in plain language.
5. **Mode UIs are different on purpose.** Conversation, Lecture, and Group are distinct social contexts; jamming them into the same screen produces a worse experience than three optimized screens.

## 2. Information Architecture

```
Root tabs (bottom navigation)
  ├── Home
  │     ├── Quick-start card (last mode + language pair) — primary CTA
  │     ├── Mode picker (Conversation / Lecture / Group)
  │     └── Language pair selector
  ├── History
  │     ├── Search bar (FTS over saved sessions)
  │     ├── Session list (grouped by date)
  │     └── Session detail (transcript + translation, copy, delete, export)
  ├── Settings
  │     ├── Languages (downloaded offline packs, default pair)
  │     ├── Voice (TTS gender, speed, output routing per FR-9)
  │     ├── Privacy (cloud-off toggle, history retention, telemetry opt-in)
  │     ├── Audio (mic test, AEC, advanced)
  │     └── Account (sign-in, subscription, sync)
  └── Help (compact, in-app)
```

Modal flows (presented over the tab structure):

- **Onboarding** — first-launch only, 4 screens (Welcome → Mic test → Language pair → Done).
- **Permission requests** — invoked at the moment of first need (mic when first session starts; Bluetooth on first conversation if device is BT).
- **Active session** — full-screen modal that takes over while a session is in progress.

## 3. Screen-by-Screen Specifications

### 3.1 Home

**Goal.** Get the user into a translation session in ≤2 taps.

**Layout.**

```
┌─────────────────────────────────────┐
│   Hi, Anh 👋                         │
│                                      │
│   ┌──────────────────────────────┐  │
│   │  ◉  Continue: EN ↔ ES        │  │   ← primary CTA
│   │     Conversation mode        │  │   (one-tap resume)
│   │     [ Start ]                │  │
│   └──────────────────────────────┘  │
│                                      │
│   Or pick a mode:                   │
│   ┌──────┬───────────┬──────────┐   │
│   │ 🗣️   │ 🎤        │ 👥       │   │
│   │ Conv │ Lecture   │ Group    │   │
│   └──────┴───────────┴──────────┘   │
│                                      │
│   Languages                         │
│   [English  ▾] ↔ [Spanish  ▾]       │
│                                      │
│   ⓘ Earphones connected: AirPods Pro│
└─────────────────────────────────────┘
```

**Notes.**

- The **Continue** card is the first-class CTA. New users see a "Get started" CTA in its place that triggers onboarding.
- The earphone-status footer is a confidence cue (Design Principle 3); it shows the connected device and warns if the connection is HFP (i.e., music quality will downgrade).
- Tapping a language opens a searchable language picker. Recently used pairs surface at the top.

**FRs covered:** FR-1 (entry), FR-2, FR-3, FR-4, FR-9 (output routing visible).

### 3.2 Conversation Mode (active session)

**Goal.** Show the user that translation is happening for both sides; let them course-correct fast.

**Layout (split screen).**

```
┌─────────────────────────────────────┐
│  ⏸ End                  EN ↔ ES  ⓘ │  ← header (end / lang / engine info)
├─────────────────────────────────────┤
│  YOU (English)                      │
│  ─────────────────────              │
│  Hello, can I see the menu          │
│  please?                            │
│  → Hola, ¿puedo ver el menú         │
│     por favor?                      │
│                                      │
├─────────────────────────────────────┤
│  THEM (Spanish)                     │
│  ─────────────────────              │
│  Por supuesto, aquí tiene.          │
│  → Of course, here it is.           │
│                                      │
├─────────────────────────────────────┤
│      [ ────█────────  -38 dB ]      │  ← live mic level (your side)
│                                      │
│                  ●                   │  ← single big mic button
│                                      │
└─────────────────────────────────────┘
```

**Notes.**

- The split is biased: the user's own side is on top because they are the primary actor.
- Each line shows the **source** (gray) and the **translation** (color). Interim text is italicized; final is upright.
- A subtle **pulsing mic ring** around the central mic button indicates active capture; tapping it pauses (does not end) the session.
- The header has a "ⓘ" that opens a transparency sheet showing the active STT engine, MT engine, TTS engine, and round-trip latency.

**FRs covered:** FR-1, FR-5, FR-6 (auto-detect indicator on header), FR-9 (visible voice in transparency sheet).

**Edge cases.**

- If the partner's audio is muted (e.g., Bluetooth couldn't capture from the phone mic), an icon and a one-line tip appear in the partner's panel.
- If the network drops, the app surfaces a banner: "Switched to offline mode" with the engine swap visible.

### 3.3 Lecture Mode (active session)

**Goal.** Continuous, scrollable, transcript-first surface; user listens through earphones.

**Layout.**

```
┌─────────────────────────────────────┐
│  ⏸ End             ES → EN     ⓘ   │
├─────────────────────────────────────┤
│  Spanish                  English   │
│  ────────────             ─────────│
│  Hoy hablaremos        Today we    │
│  sobre las redes       will talk   │
│  neuronales            about       │
│                        neural nets │
│                                     │
│  recurrentes que       recurrent   │
│  manejan ...           which       │
│                        handle ...  │
│                                     │
│              [ Live ▼ ]            │  ← scrubbable; tap to jump back to live
│                                     │
└─────────────────────────────────────┘
```

**Notes.**

- Two columns scroll synchronously. Tapping a line in either column highlights the matching line on the other side.
- A "Live" pill stays pinned to the bottom while user scrolls back; tapping it returns to live.
- Scrubbing back does not interrupt the live audio stream playing through earphones (Design Principle 1; FR-2).

**FRs covered:** FR-2, FR-5, FR-6.

### 3.4 Group Mode (pair via QR)

**Goal.** Turn on a paired session in <30 s.

**Three-screen sub-flow.**

1. **Picker** — "Show QR" or "Scan QR".
2. **Show / Scan** — depending on choice. After scan, a confirmation screen lists both languages.
3. **Active session** — same shape as Conversation mode but with both sides showing the partner's translated speech in your earphone (since both are wearing one).

**Notes.**

- Session token expires after 60 seconds if not scanned; QR refreshes automatically.
- A "session-active" badge appears on both phones; either can end.

**FRs covered:** FR-3, FR-5.

### 3.5 Onboarding

Four screens, each with a single goal.

1. **Welcome.** "Turn your earphones into a translator. No new hardware. No subscription required." Two CTAs: "Get started" and "I have an account."
2. **Mic test.** Asks the user to tap, then say "Hello, world." Plays it back through earphones to confirm the loop works. Detects HFP and warns if music quality will downgrade. Detects no-mic and prompts user to connect earphones.
3. **Language pair.** Defaults to device-locale → English (or English → Spanish for English-locale users). Suggests downloading the offline pack for the chosen pair.
4. **Privacy welcome.** "We don't store your audio. Your conversations stay on this device unless you choose to back them up. [Got it]" — single screen, single button.

**FRs covered:** Onboarding flow (V-16 in validation report); FR-4 (language pair); NFR-4 (privacy disclosure).

### 3.6 History

- Search bar (FTS) at the top.
- List of sessions (grouped by date), each row shows date, language pair, duration, first 1–2 lines.
- Tap → session detail with full transcript + translations side by side; copy/share/export/delete actions.
- Bulk delete and "Delete all sessions" in the toolbar.

**FRs covered:** FR-7, NFR-4 (delete-all action).

### 3.7 Settings

Five sections matching IA above. Each is a standard list-of-toggles surface; the highlights:

- **Languages.** Per-language card with download status, size, and on/off toggle for offline use.
- **Voice.** A "preview" button next to each voice; speed slider with 4 stops; output-routing radio (Earphones / Phone speaker / Both).
- **Privacy.** "Cloud off" toggle (forces offline mode regardless of connectivity); "Telemetry" toggle; "Delete all history" action.
- **Audio.** Re-run mic test; toggle AEC; (advanced) frame size, VAD aggressiveness — hidden behind a "Show advanced" expander.
- **Account.** Sign-in / sign-out, subscription status, sync toggle.

**FRs covered:** FR-7, FR-8, FR-9, NFR-4.

## 4. Visual Design Notes

- **Color system.** Single accent color for translations (the "voice" color); monochrome for source text. High contrast (WCAG AA minimum, AAA on critical text).
- **Typography.** System font (SF on iOS, Roboto on Android) for native feel; fluent transcript at 17 pt, copy buttons at 13 pt.
- **Iconography.** Simple line icons; a custom mic-with-soundwave glyph for the central mic button.
- **Motion.** Subtle pulsing for "live" indicators; no heavy animation that competes for cognitive bandwidth during translation.
- **Dark mode.** First-class — translation often happens in low-light contexts (restaurants, planes, hotel rooms).

## 5. Component Inventory (cross-screen)

| Component | Used in |
|-----------|---------|
| `BigMicButton` | Conversation, Lecture, Group |
| `TranscriptPair` (source + translation row) | Conversation, Lecture, Group |
| `EngineTransparencySheet` | All active sessions (header `ⓘ`) |
| `LanguagePicker` | Home, Settings |
| `EarphoneStatusBadge` | Home, Settings → Audio |
| `SessionRow` | History list |
| `LiveScrubber` | Lecture, History detail playback |
| `OfflineBadge` | All active sessions |
| `PrivacyDot` (cloud / on-device indicator) | All active sessions header |

These map directly to a React Native component library; full storybook setup is in scope for Epic 5 / 6.

## 6. Accessibility Specifications

- All controls reachable in ≤4 swipes for VoiceOver / TalkBack users.
- Live transcripts marked as `accessibilityLiveRegion="polite"` so screen readers announce new lines without interrupting current speech.
- Mic level meter has a non-visual equivalent ("Listening…" announcement when mic active).
- Color is never the only carrier of information (final/interim use both italic and color).

## 7. Open Design Questions

- Should the conversation-mode partner-side show in real-time even while the user is speaking (current decision: yes, dimmed)?
- Should auto-detect (FR-6) show the detected language as a confirmable chip ("Detected: Spanish — change?") or silently? Current decision: confirmable chip on first detection per session, silent thereafter.

These are answered in the first design-review session and tracked in the UX changelog (separate document).
