---
workflowType: 'research'
research_type: 'technical'
project_name: 'Smart Translator Earphone'
phase: '1-analysis'
date: '2026-05-05'
---

# Technical Research — Smart Translator Earphone

## 1. Research Goals

1. Compare candidate **STT** (speech-to-text) engines on accuracy, latency, language coverage, cost, and ability to stream.
2. Compare candidate **MT** (machine translation) engines along the same axes, with an extra emphasis on context handling for conversational speech.
3. Compare candidate **TTS** (text-to-speech) engines on naturalness, latency, language coverage, and licensing.
4. Document **mobile audio routing** (iOS / Android) constraints when both capture and playback happen on the same Bluetooth headset.
5. Document **on-device** model options for the offline mode.
6. Identify the **latency-optimization techniques** that the architecture must support.

## 2. STT Engines

### 2.1 Comparison

| Engine | Streaming | Languages | Word Error Rate (relative) | Cost (cloud, USD/min indicative) | On-device option |
|--------|-----------|-----------|-----------------------------|-----------------------------------|------------------|
| OpenAI Whisper (cloud `whisper-1`) | No (batch only) | 99 | Strong; multilingual | ~0.006/min | Yes — `whisper.cpp`, `faster-whisper` |
| OpenAI `gpt-4o-transcribe` family | Yes (streaming) | 100+ | Strong | ~0.006/min | No |
| Google Cloud Speech-to-Text v2 | Yes | 125+ | Strong on English; medium-strong on others | ~0.009/min | Yes — limited (Android `SpeechRecognizer`) |
| Azure AI Speech (Speech-to-Text) | Yes | 100+ | Strong; excellent on noisy audio with language ID | ~0.014/min | Yes — Speech SDK Embedded (paid) |
| Deepgram (Nova-3) | Yes (lowest TTFB in class) | 36 | Strong on English; very strong on conversational audio | ~0.0043/min (pre-recorded) / ~0.0058/min (streaming) | No |
| AssemblyAI Streaming | Yes | 99 | Strong | ~0.015/min | No |
| AWS Transcribe Streaming | Yes | 35+ for streaming | Medium-strong | ~0.024/min | No |
| RevAI / Speechmatics | Yes | 50+ | Medium-strong | varies | No |

### 2.2 Latency observations

- For interactive translation, **time-to-first-token (TTFT) matters more than total transcription time.** Deepgram, Google, and Azure consistently deliver first interim partials within 100–250 ms of speech onset. Whisper’s batch-only API can add 800–2000 ms of perceived lag depending on chunk length.
- Most production systems use **partial / interim transcripts** to begin translation pre-emptively, and **revise** when the final stabilizes. This is essential to hit the < 1.5 s end-to-end target.

### 2.3 Recommendation (cloud)

Default to **Deepgram Nova-3 streaming** for English and high-traffic European languages because of its low TTFB and competitive price; fall back to **Google Cloud Speech-to-Text v2 streaming** for languages Deepgram doesn’t cover (notably Vietnamese, Thai, Tagalog, Bengali). Use a feature flag so the architecture isn’t coupled to a single vendor.

### 2.4 Recommendation (on-device)

Default to **`whisper.cpp` with `tiny` (39M params) or `base` (74M params)** quantized to int8/int4. On modern phones (≥A14 / Snapdragon 8 Gen 1), `tiny` runs at ~3× real-time and `base` at near real-time. Memory footprint <200 MB.

Document a **30-day eval** for `Vosk` (Kaldi-based, smaller models) as a candidate fallback for very low-end Android devices.

## 3. Machine Translation Engines

### 3.1 Comparison

| Engine | Streaming | Languages | MT quality (BLEU/COMET ranks on conversational) | Cost (USD/M chars) | On-device option |
|--------|-----------|-----------|---------------------------------------------------|---------------------|------------------|
| DeepL API | Sentence-level (no token-level streaming) | 32 | Best on EU pairs, strong on EN↔ZH, EN↔JA | ~25 | No |
| Google Cloud Translation v3 (NMT) | Sentence-level | 130+ | Strong | ~20 (basic) / ~80 (advanced) | Limited (offline ML Kit, ~50 pairs) |
| OpenAI GPT-4o-mini (translation prompt) | Token streaming | 100+ (but quality varies) | Strong on conversational, excellent at preserving register, requires careful prompting | ~0.15 (input) + 0.6 (output) per M tokens | No |
| Anthropic Claude (translation prompt) | Token streaming | 100+ | Strong; excellent at idioms | varies | No |
| Microsoft Translator | Sentence-level | 130+ | Strong | ~10 | Yes — Translator offline language packs |
| Meta NLLB-200 | Self-hosted | 200 | Good on long-tail; weaker than DeepL/Google on top corridors | self-hosted compute | Yes (1.3B/3.3B distilled) |
| Yandex Translate | Sentence-level | 100+ | Medium-strong | ~15 | No |

### 3.2 Streaming-translation strategy

LLM-based translation (GPT-4o-mini, Claude) supports **token-level streaming**, which fits naturally with a streaming STT pipeline because we can begin TTS synthesis on partial translations and revise as more tokens arrive. The NMT engines (DeepL, Google) translate at sentence granularity; in practice we treat each STT-finalized sentence (or VAD-segmented utterance) as the unit of translation.

### 3.3 Recommendation

- **Primary:** DeepL for the 32 supported languages where it leads quality benchmarks.
- **Fallback:** Google Cloud Translation v3 for languages DeepL doesn’t cover.
- **Premium (Pro tier):** OpenAI GPT-4o-mini for context-aware mode, where we send the rolling 30 s of conversation as context and prompt the model to maintain register/proper-noun consistency. This is gated behind Pro because the per-minute cost is roughly 5× the NMT engines.
- **Offline:** Distilled NLLB-200 (1.3B params, int8) for the supported language subset.

## 4. Text-to-Speech Engines

### 4.1 Comparison

| Engine | Streaming | Voice quality | Languages | Cost (USD/M chars indicative) | On-device option |
|--------|-----------|---------------|-----------|-------------------------------|------------------|
| ElevenLabs | Yes (chunked WebSocket) | State-of-the-art naturalness; multilingual single-voice | 30+ | ~150–300 | No |
| OpenAI TTS (`gpt-4o-mini-tts`) | Yes (streaming MP3) | Very good; multilingual | ~50 | ~15 (mini) / 30 (HD) | No |
| Google Cloud TTS (Neural2 / Studio) | Sentence streaming | Very good | 50+ | ~16 (Neural2) / ~160 (Studio) | Limited (on-device for Pixel, Google ML Kit) |
| Azure Neural TTS | Sentence streaming | Very good; excellent multilingual coverage | 100+ | ~16 | Yes (Speech SDK Embedded, paid) |
| Amazon Polly Neural | Sentence streaming | Good | 30+ | ~16 | No |
| Coqui XTTS / Coqui TTS (open-source) | Yes (with custom inference) | Good | 16 | self-hosted | Yes (mobile inference is heavyweight) |
| Apple `AVSpeechSynthesizer` | Local | Decent (system voices); excellent for system-default | 30+ | Free | Yes (default on iOS) |
| Android `TextToSpeech` | Local | Decent | depends on installed engines | Free | Yes (default on Android) |

### 4.2 Recommendation

- **Primary (Free tier):** Platform default (Apple `AVSpeechSynthesizer` / Android `TextToSpeech`). Zero variable cost; quality acceptable for travel small-talk; works fully offline.
- **Premium (Pro tier):** ElevenLabs streaming for the most natural voices, with Azure Neural TTS as the multilingual coverage backstop and Google Cloud TTS as the secondary fallback.
- **Architecture rule:** TTS must produce audio in a **streaming, chunked** form so we can begin playback before the full translated sentence is synthesized.

## 5. Mobile Audio Routing

This is the section that is most likely to surprise downstream implementers; it is captured in detail.

### 5.1 iOS

- **Capture from a Bluetooth headset’s microphone forces the HFP (Hands-Free Profile)** audio session category, which downgrades both capture and playback to 8 kHz–16 kHz mono. A2DP (high-quality stereo music) is **not** simultaneously available.
- Use `AVAudioSession` with category `.playAndRecord` and the `.allowBluetooth` (HFP) option. Setting `.allowBluetoothA2DP` is NOT compatible with capturing from a Bluetooth mic.
- **AEC (acoustic echo cancellation)** is provided by the OS only when using `AVAudioEngine` with `voiceProcessingEnabled = true` (via `AVAudioEngine.inputNode.isVoiceProcessingEnabled`) — set this whenever the playback path leads back into the same earphone.
- Background audio capture requires the `audio` background mode entitlement and the “Microphone” privacy usage description.

### 5.2 Android

- **Same HFP/A2DP trade-off.** Use `AudioManager.startBluetoothSco()` to force HFP for capture; this disables A2DP music playback on the same device.
- For low-latency capture/playback, prefer `AAudio` (API 26+) or Oboe (the C++ wrapper). The default `MediaRecorder` API is not suitable for streaming.
- Foreground service of type `microphone` is required (Android 14+) for microphone use while the screen is off.

### 5.3 Wired & USB-C earphones

- 3.5 mm jacks expose the mic and speaker as a regular analog input/output; no HFP downgrade. Highest audio quality of all options.
- USB-C earphones use the USB Audio Class profile; quality matches wired in practice. Some Pixel/Samsung models route everything through USB without issue; some Xiaomi devices require explicit user permission to use USB audio for capture.

### 5.4 Implication for product UX

- Onboarding must include a mic test that detects the connection profile and warns if the user is on Bluetooth HFP; suggest wired earphones for best quality.
- The settings screen must let the user opt out of Bluetooth capture entirely (using phone’s built-in mic but routing TTS to the Bluetooth speaker).

## 6. On-Device Models (Offline Mode)

| Layer | Model | Size (int8) | Languages | Real-time on flagship phone | Real-time on mid-range |
|-------|-------|-------------|-----------|------------------------------|-------------------------|
| STT | `whisper.cpp` tiny | ~75 MB | 99 | Yes (~3× RT) | Yes (~1.5× RT) |
| STT | `whisper.cpp` base | ~150 MB | 99 | Yes (~1.5× RT) | Borderline |
| MT | NLLB-200 distilled 1.3B int8 | ~1.4 GB | 200 | Yes (~30 tok/s) | Slow — recommend 600M variant |
| MT | NLLB-200 distilled 600M int8 | ~700 MB | 200 | Yes | Yes |
| TTS | Apple `AVSpeechSynthesizer` | system | 30+ | Yes | Yes |
| TTS | Android `TextToSpeech` | system | 30+ | Yes | Yes |
| TTS | Coqui XTTS-v2 | ~1.8 GB | 16 | Slow (5–10 s per sentence) | Not viable |

**Recommendation for offline mode v1:** Whisper-tiny + NLLB-200 600M distilled + system TTS, supporting EN, ES, FR, DE, JA, ZH, KO, VI, TH, AR. Storage cost ~900 MB total, downloadable on-demand per language pair.

## 7. Latency Optimization Techniques

The end-to-end latency budget for conversation mode is **<1.5 s in cloud mode**. Each stage must contribute fractionally:

| Stage | Budget | Technique |
|-------|--------|-----------|
| Mic → first PCM frame at server | 50 ms | WebSocket (not HTTP polling); 16 kHz mono PCM; 20 ms frames |
| VAD utterance start detection | 100 ms | Voice-activity detection on-device, not server |
| STT TTFT → first interim transcript | 200 ms | Streaming STT with interim results |
| STT → MT pre-emption | 100 ms | Begin MT on interim transcripts; revise on final |
| MT → first TTS chunk | 250 ms | Sentence-level TTS or token-streaming TTS for LLM-based MT |
| TTS → first audio sample | 200 ms | Streaming TTS with chunked transfer |
| Network round-trip overhead | 200 ms | Co-locate STT/MT/TTS in same region; persistent WebSocket |
| Playback buffer | 100 ms | Aggressive jitter-buffer sizing |
| Headroom | 300 ms | Reserved for variance |

Additional design rules:

- **Persistent WebSocket per session.** Reconnecting per utterance adds ~150 ms each.
- **Pre-warm TTS voice cache.** First TTS request to a new voice can incur a cold-start penalty.
- **Use HTTP/2 or HTTP/3 with multiplexing** for the control plane (settings, history) so it does not contend with the audio plane.
- **Echo-cancel on-device** even when STT runs in the cloud, so we don’t send our own playback back to the STT engine.
- **Speculative pre-translation** of partial transcripts can save 200–400 ms when the partial stabilizes; cancel on revision.

## 8. Privacy & Compliance Notes

- Many regions (EU, several US states, parts of Asia) have laws on recording conversations. The product position is **“not retaining audio”** server-side, but we must still:
  - Only process audio when the user is actively in a session and the mic indicator is visible.
  - Provide an in-session message displayed on the partner’s side (or QR-shared session) declaring that translation is in use.
  - Respect user setting to disable cloud processing (forces offline mode regardless of language coverage).
- All cloud vendors used must offer **TLS in transit** (universal) and **data residency configurability** (DeepL, Azure, Google all offer this; Deepgram offers SOC 2; ElevenLabs has a privacy program but residency is less configurable — flag for legal review).

## 9. Summary of Recommendations

| Concern | Recommendation |
|---------|----------------|
| Cloud STT primary | Deepgram Nova-3 streaming |
| Cloud STT fallback | Google Cloud Speech-to-Text v2 streaming |
| On-device STT | whisper.cpp tiny (default) / base (Pro) |
| Cloud MT primary | DeepL |
| Cloud MT fallback | Google Cloud Translation v3 |
| Cloud MT premium | OpenAI GPT-4o-mini with context window |
| On-device MT | NLLB-200 600M distilled int8 |
| Cloud TTS primary (Pro) | ElevenLabs streaming |
| Cloud TTS fallback | Azure Neural TTS |
| On-device TTS | Apple AVSpeechSynthesizer / Android TextToSpeech |
| Mobile framework | Decision deferred to ADR-001 (React Native vs Flutter) |
| Audio routing | OS audio session APIs with HFP for Bluetooth, voice processing enabled |
| Offline-first language set | EN, ES, FR, DE, JA, ZH, KO, VI, TH, AR |
| Network protocol for live audio | Persistent WebSocket, 20 ms PCM frames |

These recommendations are routed into the Architecture document.
