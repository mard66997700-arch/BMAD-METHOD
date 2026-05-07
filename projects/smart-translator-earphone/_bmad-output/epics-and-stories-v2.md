---
workflowType: 'backlog-groom'
project_name: 'Smart Translator Earphone'
phase: 'pre-v1-implementation'
agent: 'Sarah (Product Owner)'
date: '2026-05-07'
predecessor: '_bmad-output/epics-and-stories.md'
inputDocuments:
  - prd-v1-free-only.md
  - handoff-2026-05-07.md
  - reviews/po-review.md
target_sprint: 'v1 (4 weeks)'
---

# 🗂️ Backlog v2 — v1 Free-Only Sprint (Sarah, PO)

> Hi Tuan — Sarah here. I groomed the v2 backlog against John's
> updated PRD. Every story below has been INVEST-checked and meets
> Definition of Ready (actor, business outcome, Given/When/Then,
> S/M/L/XL size, FR/NFR mapping, blocking deps, no open questions).
> The order is the recommended sprint order; you can pull from the
> top.

---

## 1. Sprint goal

By end of sprint:

1. **PR #1 merged** and Phase A live-verified on real Chrome.
2. **Web Speech API** adapter ships in extension.
3. **Default UI** is free-only (paid providers hidden behind
   Advanced disclosure).
4. **Chrome Web Store** has a published listing.
5. **Mobile** carry-over stories MOB-01 / MOB-02 closed.
6. **Mary's research doc** delivered (4 questions answered).

Success metric: a brand-new user (no API keys, no developer mode)
can install the extension from the Web Store and translate a
YouTube video in under 60 seconds.

---

## 2. Definition of Ready (recap)

For every story below:

- [x] User-or-system actor is named.
- [x] Business outcome stated as a sentence.
- [x] Given/When/Then acceptance criteria.
- [x] Size estimate (S = ≤ 1 day · M = 2–4 days · L = 5–10 days · XL = ≥ 10 days).
- [x] Maps to FR or NFR from `prd-v1-free-only.md` or `prd.md`.
- [x] Blocking dependencies identified.
- [x] No unresolved open questions.

---

## 3. Stories — sprint order

### Tier 0 — gating (do first)

#### EXT-01 · Live verification of Phase A on real Chrome + YouTube · S
- **Actor:** End user (Tuan).
- **Outcome:** Phase A pipeline is proven on real hardware before
  any further extension work continues.
- **Given/When/Then:**
  - **Given** PR #1 is merged into `main`,  
    **And** the user runs `npm ci && npm run build` in
    `extension/`,  
    **And** loads unpacked into Chrome,  
    **When** the user opens a foreign-language YouTube watch page
    and clicks Start with `Auto` provider,  
    **Then** the popup shows captions + translations,  
    **And** the engine status badge reads `youtube-captions`,  
    **And** dual-ear audio routes original to L and translation to R.
- **FR/NFR:** FR-2, FR-4, NFR-LATENCY (PC YouTube target).
- **Deps:** PR #1 merged.
- **Definition of Done:** Screenshot or screen recording attached
  to `_bmad-output/test-evidence/ext-01-yt-live-verify.{png,mp4}`.
- **Owner:** Tuan.

#### EXT-02 · Hide paid providers behind "Advanced" disclosure · S
- **Actor:** End user.
- **Outcome:** Default popup is "free-only" per Option A; paid
  Whisper API + Google Cloud STT do not surface for v1 unless the
  user expands an Advanced section.
- **Given/When/Then:**
  - **Given** the user opens the popup for the first time,  
    **When** the dropdown renders,  
    **Then** only free providers (`Auto`, `youtube-captions`,
    `whisper-wasm`, `web-speech`) are visible,  
    **And** an "Advanced (paid options)" toggle is collapsed by
    default,  
    **When** the user clicks the toggle,  
    **Then** Whisper API + Google Cloud STT options + API key field
    appear.
- **FR/NFR:** FR-3 (default = free), NFR-COST.
- **Deps:** none.
- **Definition of Done:** Vitest assertions in
  `__tests__/popup.test.js`; manual screenshot in PR.
- **Size:** S (~2 hr).

### Tier 1 — feature work (parallelizable)

#### EXT-03 · Web Speech API adapter for PC mic conversation · M
- **Actor:** End user using the extension on Chrome / Edge with
  microphone input.
- **Outcome:** Mic conversation on PC works zero-key, zero-download
  (FR-WSP from `prd-v1-free-only.md`).
- **Given/When/Then:**
  - **Given** the user selects `Microphone` input source,  
    **And** is on Chrome or Edge,  
    **When** the user clicks Start,  
    **Then** the extension uses the browser-native Web Speech API,  
    **And** transcripts arrive within 2 s of speech end (per
    NFR-LATENCY).
  - **Given** the user is on Firefox or Safari,  
    **When** the user selects `Microphone` input,  
    **Then** the popup shows: "Web Speech API not supported on this
    browser. Try Tab audio + YouTube, or use whisper-wasm."
  - **Given** Web Speech API is producing partial transcripts,  
    **When** a `final` event fires,  
    **Then** the pipeline emits a `final` SttEvent with shape
    `{ kind: 'final', text, detectedLang }`,  
    **And** `createTranslator` consumes it without modification.
- **FR/NFR:** FR-WSP (new in `prd-v1-free-only.md`).
- **Deps:** EXT-02 (Web Speech option must be in dropdown first).
- **Definition of Done:**
  - `lib/web-speech-stt.js` (~80 LOC).
  - `__tests__/web-speech-stt.test.js` (8+ cases: feature
    detection, partial → final, language switch, abort, error).
  - Hybrid router in `background.js` updated.
  - Manual test on Chrome + Edge + Firefox documented in
    `TESTING.md` §4.
- **Size:** M (~3 days).

#### EXT-04 · Loading-model status badge for Whisper-WASM · S
- **Actor:** End user on first-ever Whisper-WASM session (40 MB
  model download).
- **Outcome:** User knows the extension is downloading, not
  hanging.
- **Given/When/Then:**
  - **Given** the user starts on a non-YouTube tab with
    `whisper-wasm` provider for the first time,  
    **When** the model begins downloading,  
    **Then** the popup shows "Downloading model: NN%" with a
    progress indicator,  
    **And** the engine status badge reads `whisper-wasm (loading)`,  
    **When** the download completes,  
    **Then** the badge switches to `whisper-wasm` and transcription
    starts.
- **FR/NFR:** FR-2, NFR-LATENCY (Whisper-WASM first-load
  exception).
- **Deps:** none (pure popup work).
- **Definition of Done:** Vitest update in `popup.test.js`,
  manual screenshot.
- **Size:** S (~half day).

#### EXT-05 · Resolved-engine status persistence in popup · S
- **Actor:** End user.
- **Outcome:** Re-opening the popup mid-session shows the engine in
  use, not a stale "—".
- **Given/When/Then:**
  - **Given** a session is active and `engine = youtube-captions`,  
    **When** the user closes the popup and re-opens it,  
    **Then** the engine field reads `YouTube captions (zero-key)`,  
    **And** the elapsed time is correct.
- **FR/NFR:** FR-2 (UX polish).
- **Deps:** none.
- **Definition of Done:** `chrome.storage.session.set/get` round-
  trip; one Vitest case.
- **Size:** S (~half day).

#### EXT-06 · Telemetry buffer for extension · M
- **Actor:** Engineering team (post-launch).
- **Outcome:** We learn whether YouTube captions and Whisper-WASM
  actually work in the wild, with what error rates, in what
  languages.
- **Given/When/Then:**
  - **Given** the user has telemetry opted in (default OFF),  
    **When** any session ends,  
    **Then** the extension POSTs a buffered batch to the telemetry
    sink with: provider used, language, success/error counts,
    duration, no audio or text content.
  - **Given** the user has not opted in,  
    **When** sessions occur,  
    **Then** no network calls happen.
- **FR/NFR:** NFR-PRIVACY (must not leak content), NFR-COST (must
  not cost money — sink is the user's own).
- **Deps:** Cloudflare Worker for ingest (deferred; for v1, use a
  no-op sink that logs to `chrome.storage.local`).
- **Definition of Done:** Port `app/src/core/telemetry/` to JS;
  Vitest 6+ cases.
- **Size:** M (~3 days).

### Tier 2 — release readiness (parallelizable, end of sprint)

#### EXT-07 · Chrome Web Store packaging script · M
- **Actor:** Engineering / release manager.
- **Outcome:** One command produces a Web Store-ready zip.
- **Given/When/Then:**
  - **Given** the developer runs `npm run build && npm run package`
    in `extension/`,  
    **When** the script completes,  
    **Then** `dist/extension-v{version}.zip` exists,  
    **And** the zip passes a static lint that checks: manifest v3,
    no remote code, declared permissions ≤ 16, no
    `unsafe-inline`,  
    **And** the zip contains exactly the expected files (no
    `node_modules`, no `__tests__`, no `_bmad-output`).
- **FR/NFR:** FR-WS.
- **Deps:** none.
- **Definition of Done:** `scripts/package-extension.js` + 5
  Vitest cases for the lint logic; CI artefact uploaded.
- **Size:** M (~3 days).

#### EXT-08 · Chrome Web Store listing + privacy policy · M
- **Actor:** Release manager.
- **Outcome:** The extension is publicly installable via Web
  Store.
- **Given/When/Then:**
  - **Given** EXT-07 has produced a zip,  
    **When** the release manager uploads it to Chrome Web Store
    Developer Dashboard,  
    **And** writes the listing (description, screenshots, privacy
    policy),  
    **And** submits for review,  
    **Then** the listing passes review,  
    **And** appears at `chrome.google.com/webstore/detail/...`,  
    **And** is installable with one click.
- **FR/NFR:** FR-WS.
- **Deps:** EXT-07. Out-of-band: Tuan needs to register a Chrome
  Web Store developer account (one-time $5 USD fee).
- **Definition of Done:** Public store URL recorded in `README.md`;
  privacy policy committed at `docs/privacy-policy.md`.
- **Size:** M (~3 days, gated by Google review queue 2-7 days).

### Tier 3 — mobile carry-over (independent)

#### MOB-01 · Persist `inputSource` and `micDeviceId` via LocalStore · S
- **Actor:** Mobile / web user.
- **Outcome:** Settings survive a reload.
- (Full ACs in 2026-05-05 handoff §9 Tier 1.)
- **FR/NFR:** carry-over.
- **Deps:** none.
- **Size:** S (~6 hr).

#### MOB-02 · Field-test mobile app outdoors · M
- **Actor:** Field tester (Tuan).
- **Outcome:** Real-world conversation translation validated.
- **Given/When/Then:**
  - **Given** a built TestFlight / Play Internal Testing version,  
    **When** the tester uses the app in a noisy outdoor setting
    (café, train, street) for 10 minutes,  
    **Then** ≥ 80 % of utterances produce a usable translation,  
    **And** dual-ear stereo works on both Bluetooth and wired
    earphones,  
    **And** any errors are logged to `_bmad-output/test-evidence/mob-02-field.md`.
- **FR/NFR:** FR-1 (mobile surface), FR-4.
- **Deps:** TestFlight build + Play Console access (one-time
  setup, gated).
- **Size:** M.

### Tier 4 — research (parallel, no code)

#### BA-01 · YouTube `timedtext` viability research · S
- **Actor:** Mary (BA).
- **Outcome:** Documented stability, rate-limit, and ToS picture.
- (Full scope in `research/zero-key-viability.md` §3.)
- **Size:** S.

#### BA-02 · Whisper-tiny multi-language accuracy benchmark · M
- **Actor:** Mary.
- **Outcome:** Per-language WER table for top-10 languages.
- (Full scope in research doc §4.)
- **Size:** M.

#### BA-03 · Free Google translate ToS / rate-limit research · S
- (Full scope in research doc §5.)
- **Size:** S.

#### BA-04 · Mobile STT comparison · M
- (Full scope in research doc §6.)
- **Size:** M.

---

## 4. Story summary table

| ID | Title | Tier | Size | Deps | Owner |
|---|---|---|---|---|---|
| EXT-01 | Live verify Phase A | 0 | S | PR #1 merged | Tuan |
| EXT-02 | Hide paid providers | 0 | S | — | Dev |
| EXT-03 | Web Speech API adapter | 1 | M | EXT-02 | Dev |
| EXT-04 | Loading-model badge | 1 | S | — | Dev |
| EXT-05 | Engine status persistence | 1 | S | — | Dev |
| EXT-06 | Telemetry buffer | 1 | M | — | Dev |
| EXT-07 | Web Store package script | 2 | M | — | Dev |
| EXT-08 | Web Store listing | 2 | M | EXT-07 + dev account | Tuan |
| MOB-01 | Persist mic / source | 3 | S | — | Dev |
| MOB-02 | Mobile field test | 3 | M | TestFlight build | Tuan |
| BA-01 | YouTube timedtext research | 4 | S | — | Mary |
| BA-02 | Whisper-tiny accuracy | 4 | M | — | Mary |
| BA-03 | Free Google MT ToS | 4 | S | — | Mary |
| BA-04 | Mobile STT comparison | 4 | M | — | Mary |

**Sprint capacity** assuming 1 dev + 1 user (Tuan as field tester
+ release manager): 14 stories, total ≈ 28 dev-days + 5 Tuan-days
+ research in parallel (no contention). Realistic in 4 weeks.

---

## 5. Stories explicitly NOT in this sprint (defer / rejected)

| Story | Why deferred |
|---|---|
| Re-enable paid Whisper / Google STT in default UI | Per PRD update Option A → v1.1. |
| Native iOS / Android route-change bridge | Out of scope; native sprint v1.1. |
| Whisper / NLLB on-device | v1.1 native sprint. |
| Cloudflare Worker for relay | v1.1 group sessions. |
| Edge / Firefox add-on store listings | v1.1 — same code, different review. |
| Real-time speaker diarization | v2 — not yet on roadmap. |

---

## 6. Risks (from PO lens)

| ID | Risk | Mitigation |
|---|---|---|
| P-01 | Chrome Web Store review takes > 7 days, blocking v1 launch | Submit EXT-07 + EXT-08 by week 2 of sprint, not week 4 |
| P-02 | Web Speech API quality on tonal languages (VN, TH) is poor | Mary BA-04 covers; if poor, popup shows "Use whisper-wasm for VN/TH" warning |
| P-03 | Tuan blocked on hardware verification (EXT-01) | Devin can run the extension locally on the user's behalf if user pairs sessions; otherwise EXT-01 sits in "blocked" until hardware available |
| P-04 | Free Google MT endpoint changes shape | Mary BA-03 produces a contract-test fixture; CI runs it daily once Actions enabled |

---

## 7. Open questions

None blocking. The four PRD §8 open questions (mobile store listing,
privacy policy text, brand name) are deferred to a future round and
do not gate this sprint.

---

> **— Sarah 🗂️ PO**
>
> The backlog is ready. Pull EXT-01 first as the gating story; once
> verified, the dev team can fan out across EXT-02 → EXT-08 in
> parallel while Tuan handles MOB-02 + EXT-08 listing in parallel.
> Mary's research is independent and runs end-to-end without
> blocking anyone.
