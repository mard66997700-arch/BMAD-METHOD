---
workflowType: 'product-brief'
project_name: 'Smart Translator Earphone'
phase: '1-analysis'
date: '2026-05-05'
inputDocuments:
  - brainstorming-report.md
  - market-research.md
  - technical-research.md
---

# Product Brief — Smart Translator Earphone

## Executive Summary

**Smart Translator Earphone** is a mobile application that turns any pair of ordinary earphones — the Bluetooth earbuds, wired headset, or AirPods the user already owns — into a real-time AI translation device. It offers conversation mode (two-way), lecture mode (one-way listening), and group mode (3+ participants), at a fraction of the cost of dedicated hardware translators like Timekettle WT2 or Pixel Buds Live Translate.

The product attacks a clear market gap: dedicated translation earphones cost USD 200–400 and lock users into proprietary hardware ecosystems, while existing translation apps (Google Translate, iTranslate, SayHi) ignore the earphone as a first-class endpoint. By treating the earphone as the primary input/output device — capture from its microphone, stream the translated voice back to its speaker — the product delivers the hardware translator experience using the user’s own gear.

Why now: streaming STT, MT, and TTS engines have matured enough that end-to-end translation latency under 1.5 seconds is achievable on commodity smartphones; on-device models (Whisper, NLLB-200) make a credible offline mode possible for the first time; and consumer awareness of AI assistants has primed the market for a voice-first translation experience.

## The Problem

People who travel internationally, work with foreign clients, or learn a second language all want the same thing: **to listen and respond in their own language while the other person hears theirs.** The closest commercial answer today is a dedicated translation earphone, but every dedicated device has the same set of problems:

- **Cost.** Timekettle WT2 Edge: USD 299. Vasco Earbuds: USD 389. Most users already own perfectly capable earbuds and can’t justify a second pair.
- **Setup friction.** Pairing, firmware updates, account creation, charging cases.
- **Form-factor lock-in.** A user who paid for high-quality music earbuds doesn’t want to swap to a single-purpose plastic earpiece for translation.
- **Mediocre social UX.** Workflows like “hand one earbud to a stranger” feel awkward in business and travel contexts.

Translation apps (Google Translate, iTranslate, etc.) try to fill this gap but treat the earphone as an accessory. Their conversation modes are push-to-talk with on-screen transcripts; the user’s eyes are stuck on the phone the whole time. Streaming TTS into the user’s earphones — the experience that hardware translators are built around — is simply not there.

The cost of the status quo is concrete: travelers reach for their phone, type into Google Translate, hand the phone across the table, and lose the conversational flow. Business users juggle apps in meetings. Language learners get less interactive practice than a 30-second voice exchange could deliver.

## The Solution

A mobile app that:

- **Treats your earphone as the translator.** Mic capture from the connected headset, streaming TTS back to the same headset, with the same low-latency feel as dedicated hardware.
- **Supports three modes**: conversation (two-way, split-screen transcript), lecture (one-way listening with continuous transcript), and group (3+ participants paired by QR code, each in their own language).
- **Streams.** End-to-end latency target under 1.5 seconds in cloud mode and under 2.5 seconds in offline mode. Users see their words appear and translations begin speaking in their counterpart’s ear before they finish the sentence.
- **Works offline.** A 5–10 language offline pack covers the most common travel corridors (EN, ES, FR, DE, JA, ZH, KO, VI, TH, AR) using Whisper-tiny + NLLB-200 distilled + system TTS.
- **Respects privacy.** No raw audio retention server-side. The streaming session is ephemeral. The user controls what is saved to translation history. Cloud processing can be turned off entirely.

The user experience is voice-first: open the app, tap one big button, the app says “speak now,” the conversation flows, and the screen is glanceable rather than required.

## What Makes This Different

- **No new hardware required.** This is the entire wedge. The user keeps their AirPods, Pixel Buds, JBLs, or their wired in-ears. Acquisition cost in the user’s mental model is zero hardware dollars and one minute of installation.
- **Earphone-first UX in software.** Direct competitors in the software category (Google Translate, iTranslate) have not invested in the audio routing, streaming TTS, and AEC needed to deliver this experience. We will.
- **Privacy as a brand pillar.** No retained audio, configurable cloud-off mode, clear in-session disclosure to the conversation partner. This is rare in the category and visible in onboarding.
- **Mode-aware UI.** Conversation, lecture, and group modes each get a UI optimized for that social context. Hardware translators bake one mode into firmware; software competitors offer all of them as a single push-to-talk surface.
- **Vendor-agnostic engine routing.** STT, MT, and TTS engines are all selectable per language pair, so we can pipe Vietnamese to Google, German to DeepL, and English to GPT-4o-mini — using the best engine for each corridor without vendor lock-in.

The honest version of the moat: **execution speed** and **earphone-first UX**. There is nothing here that Google or Apple could not build. The bet is that they have no incentive to (translation is not a top-3 priority for either) and that we can ship and iterate faster than they can.

## Who This Serves

### Primary

- **International travelers (24–55, urban, dual-income).** Already own quality earbuds. Travel 1–4 weeks/year. Currently use Google Translate awkwardly when stuck. Pay USD 4.99/month for a service that makes a 2-week trip dramatically smoother.
- **Cross-cultural professionals (28–50).** Sales reps, project managers, consultants who attend international meetings. Already pay for productivity tools; willing to expense USD 39.99/year if it materially helps a quarterly meeting.
- **Language learners (16–40).** Use the app for daily immersion practice; high engagement, lower individual ARPU but very sticky retention. Many graduate from free to Pro after 2–4 weeks of regular use.

### Secondary

- **Long-term immigrants.** Daily use case (paperwork, school meetings, healthcare). Highly price-sensitive; free tier with offline mode is the entry point.
- **Tour guides / hospitality workers.** Group mode use case. Lower volume but higher per-user engagement.
- **Accessibility users (hard of hearing).** Live captioning use case (translation engine swapped for transcription). Adjacent but valuable for brand.

Success for a primary user looks like:

- 5+ minutes of conversation translated successfully on day one.
- Returning to the app within 7 days for a second use.
- Converting to the paid tier within 30 days for travelers and professionals.

## Success Criteria

| Category | Metric | Target (12 months post-launch) |
|----------|--------|--------------------------------|
| Adoption | Total installs (iOS + Android) | 1.5M |
| Adoption | Day-7 retention | ≥30% |
| Engagement | Median session length | ≥3 minutes |
| Engagement | Sessions per active user per week | ≥3 |
| Quality | End-to-end latency P95 (cloud) | <1.5 s |
| Quality | Conversation mode user-rated translation quality (1–5 stars) | ≥4.2 |
| Business | Free → Pro conversion at 30 days | ≥4% |
| Business | Pro retention at 90 days | ≥75% |
| Business | Year-1 ARR | USD 5–10M |
| Trust | App-store rating | ≥4.5 / 5 |

## Scope

### In scope for v1 (MVP, ~3 months)

- iOS 15+ and Android 10+
- Conversation mode, lecture mode, and basic group mode (2-person pairing via QR)
- ≥20 cloud-supported languages, 5–10 offline-supported languages
- Translation history (local, searchable)
- Bluetooth and wired earphone support
- Account-free first-use, optional sign-in for sync
- Free tier (with daily caps) + Pro subscription (monthly + annual)

### Explicitly out of scope for v1

- Web/desktop client
- Real-time interpretation in regulated settings (medical, legal) — explicit disclaimer
- Voice cloning of the user’s own voice
- Direct integration with hardware translator devices (we are not building a competitor product)
- Browser extensions
- Wear OS / watchOS apps (would be a fast-follow if engagement justifies)
- 3+ person group mode beyond a 2-person QR pairing (the full group-relay protocol is v2)
- Custom enterprise glossaries / on-prem deployment

## Vision

In 2–3 years:

- The app is the default real-time translation layer for people who own earphones — the same way that Google Translate is the default for typed translation. *“Translation app for AirPods”* is a search query that returns this product first.
- Group mode supports business meeting rooms with 8+ participants and live conference simultaneous interpretation.
- Voice-cloning preserves the speaker’s emotional register across languages (Pro feature).
- Enterprise deployments include verticalized glossaries (legal, medical, technical) and audit trails.
- The app is the first place a user opens when they land in a new country, before maps or translators, because it’s the one that doesn’t make them feel like a tourist.

## Risks

| Risk | Mitigation |
|------|------------|
| **Apple / Google build comparable feature into iOS / Android** | Move fast on the wedge; lock in habits and search keywords before they ship. Differentiate on multi-engine routing and privacy-first stance. |
| **Bluetooth audio quality (HFP profile) is too weak** for satisfying UX on cheap earbuds | Onboard with a mic test; recommend wired earphones; offer the option to use phone mic + Bluetooth speaker as a hybrid. |
| **Cloud translation cost erodes margin** at scale | Aggressive caching of common phrases, on-device fallback, careful per-tier minute caps, multi-vendor pricing competition. |
| **Translation quality complaints in long-tail languages** (Vietnamese, Thai, Tagalog) | Publish per-language quality reports; use NLLB and language-specialist engines (Naver Papago for KO, Yandex for RU/UK) for those corridors. |
| **Privacy regulation tightens** (EU AI Act, US biometric laws) | Privacy-first architecture; no audio retention; legal review before each market launch. |
| **App-store policy** restricts background mic capture | Active mic indicator visible in OS shade; ensure compliance with Apple Mic Privacy Indicator and Android 14 foreground-service rules. |

## Document Lineage

This brief synthesizes:

- [`brainstorming-report.md`](./brainstorming-report.md) — use cases, modes, audio handling, business model.
- [`market-research.md`](./market-research.md) — competitor landscape, market sizing, pain points.
- [`technical-research.md`](./technical-research.md) — STT/MT/TTS engine selection, mobile audio routing constraints, on-device model recommendations.

It is the input to the [`prd.md`](./prd.md) and [`architecture.md`](./architecture.md) documents in subsequent phases.
