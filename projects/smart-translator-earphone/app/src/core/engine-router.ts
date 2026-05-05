/**
 * EngineRouter — orchestrates the full pipeline:
 *
 *     AudioPipeline (Epic 1)
 *           │ chunk
 *           ▼
 *     SttEngineRouter (Epic 2)
 *           │ partial / final transcript
 *           ▼
 *     TranslationRouter (Epic 3)  ← only on `final`s
 *           │ translated text
 *           ▼
 *     TtsEngineRouter (Epic 4)
 *           │ Int16 PCM samples
 *           ▼
 *     AudioPlaybackQueue (Story 1.5)
 *
 * The router exposes a single event stream describing what is happening at
 * each stage so the UI can render transcripts, translations, playback status
 * and errors without having to subscribe to four different routers.
 */

import { AudioPipeline, type PipelineEvent } from './audio/audio-pipeline';
import { AudioPlaybackQueue } from './audio/audio-playback';
import type { AudioCaptureProvider } from './audio/audio-capture';
import type { AudioPlaybackProvider } from './audio/audio-playback';
import type { AudioPipelineOptions } from './audio/audio-pipeline';
import type { SttEvent } from './stt/stt-types';
import { SttEngineRouter, type SttEngineRouterOptions } from './stt/stt-engine-router';
import { TranslationRouter, type TranslationRouterOptions } from './translation/translation-router';
import type { TranslationResult } from './translation/translation-types';
import { TtsEngineRouter, type TtsEngineRouterOptions } from './tts/tts-engine-router';
import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from './tts/voice-settings';

export type SessionStatus = 'idle' | 'starting' | 'active' | 'paused' | 'stopping';

export type EngineEvent =
  | { type: 'status'; status: SessionStatus }
  | { type: 'partial-transcript'; sessionId: string; text: string; detectedLang?: string }
  | { type: 'final-transcript'; sessionId: string; text: string; detectedLang?: string }
  | { type: 'translation-partial'; sessionId: string; text: string }
  | { type: 'translation-final'; sessionId: string; result: TranslationResult }
  | { type: 'playback-start'; id: string }
  | { type: 'playback-end'; id: string; cancelled: boolean }
  | { type: 'playback-idle' }
  | { type: 'error'; stage: 'stt' | 'translation' | 'tts' | 'playback'; error: Error };

export type EngineEventListener = (event: EngineEvent) => void;

export interface EngineRouterOptions {
  capture: AudioCaptureProvider;
  playback: AudioPlaybackProvider;
  pipeline?: AudioPipelineOptions;
  stt: SttEngineRouterOptions;
  translation: TranslationRouterOptions;
  tts: TtsEngineRouterOptions;

  /** Source language (or 'auto'). */
  sourceLang: string | 'auto';
  /** Target language. */
  targetLang: string;
  /** Voice settings for TTS output. */
  voice?: VoiceSettings;

  /**
   * If false, the router emits transcripts and translations but does NOT
   * synthesize speech. Useful for the Lecture / silent-translation modes.
   * Default: true.
   */
  speakOutput?: boolean;
}

export class EngineRouter {
  readonly pipeline: AudioPipeline;
  readonly stt: SttEngineRouter;
  readonly translation: TranslationRouter;
  readonly tts: TtsEngineRouter;
  readonly playback: AudioPlaybackQueue;

  private readonly listeners = new Set<EngineEventListener>();
  private status: SessionStatus = 'idle';
  private targetLang: string;
  private sourceLang: string | 'auto';
  private voice: VoiceSettings;
  private speakOutput: boolean;
  private unsubPipeline: (() => void) | null = null;
  private unsubStt: (() => void) | null = null;
  private unsubPlayback: (() => void) | null = null;

  constructor(options: EngineRouterOptions) {
    this.pipeline = new AudioPipeline(options.capture, options.pipeline ?? {});
    this.stt = new SttEngineRouter(options.stt);
    this.translation = new TranslationRouter(options.translation);
    this.tts = new TtsEngineRouter(options.tts);
    this.playback = new AudioPlaybackQueue(options.playback);
    this.targetLang = options.targetLang;
    this.sourceLang = options.sourceLang;
    this.voice = options.voice ?? DEFAULT_VOICE_SETTINGS;
    this.speakOutput = options.speakOutput ?? true;
    this.stt.setSourceLanguage(this.sourceLang);
  }

  on(listener: EngineEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get currentStatus(): SessionStatus {
    return this.status;
  }

  setSourceLanguage(lang: string | 'auto'): void {
    this.sourceLang = lang;
    this.stt.setSourceLanguage(lang);
  }

  setTargetLanguage(lang: string): void {
    this.targetLang = lang;
  }

  setVoice(voice: VoiceSettings): void {
    this.voice = voice;
  }

  setSpeakOutput(speak: boolean): void {
    this.speakOutput = speak;
    if (!speak) this.playback.clear();
  }

  async start(): Promise<void> {
    if (this.status === 'active' || this.status === 'starting') return;
    this.setStatus('starting');
    this.unsubPipeline = this.pipeline.on((ev) => this.handlePipelineEvent(ev));
    this.unsubStt = this.stt.on((ev) => this.handleSttEvent(ev));
    this.unsubPlayback = this.playback.on((ev) => {
      if (ev.type === 'chunk-start') this.emit({ type: 'playback-start', id: ev.id });
      else if (ev.type === 'chunk-end')
        this.emit({ type: 'playback-end', id: ev.id, cancelled: ev.cancelled });
      else if (ev.type === 'idle') this.emit({ type: 'playback-idle' });
    });
    try {
      await this.pipeline.start();
      this.setStatus('active');
    } catch (err) {
      this.setStatus('idle');
      this.emit({ type: 'error', stage: 'stt', error: err instanceof Error ? err : new Error(String(err)) });
    }
  }

  async stop(): Promise<void> {
    if (this.status === 'idle' || this.status === 'stopping') return;
    this.setStatus('stopping');
    try {
      await this.pipeline.stop();
    } catch {
      // Surface via error stream below if needed.
    }
    await this.stt.stop();
    this.playback.clear();
    if (this.unsubPipeline) this.unsubPipeline();
    if (this.unsubStt) this.unsubStt();
    if (this.unsubPlayback) this.unsubPlayback();
    this.unsubPipeline = null;
    this.unsubStt = null;
    this.unsubPlayback = null;
    this.setStatus('idle');
  }

  async pause(): Promise<void> {
    if (this.status !== 'active') return;
    this.setStatus('paused');
    await this.pipeline.stop();
  }

  async resume(): Promise<void> {
    if (this.status !== 'paused') return;
    this.setStatus('starting');
    await this.pipeline.start();
    this.setStatus('active');
  }

  private handlePipelineEvent(event: PipelineEvent): void {
    if (event.type === 'chunk') {
      void this.stt.pushChunk(event.chunk);
    }
  }

  private handleSttEvent(event: SttEvent): void {
    if (event.type === 'error') {
      this.emit({ type: 'error', stage: 'stt', error: event.error });
      return;
    }
    if (event.type === 'partial') {
      this.emit({
        type: 'partial-transcript',
        sessionId: event.sessionId,
        text: event.text,
        detectedLang: event.detectedLang,
      });
      return;
    }
    // final
    this.emit({
      type: 'final-transcript',
      sessionId: event.sessionId,
      text: event.text,
      detectedLang: event.detectedLang,
    });
    if (event.text.trim().length > 0) {
      void this.translateAndSpeak(event.sessionId, event.text, event.detectedLang);
    }
  }

  private async translateAndSpeak(
    sessionId: string,
    text: string,
    detectedLang: string | undefined,
  ): Promise<void> {
    const sourceLang = detectedLang ?? this.sourceLang;
    let translated: TranslationResult;
    try {
      translated = await this.translation.translate({
        text,
        sourceLang: sourceLang === 'auto' ? 'auto' : sourceLang,
        targetLang: this.targetLang,
      });
    } catch (err) {
      this.emit({ type: 'error', stage: 'translation', error: err instanceof Error ? err : new Error(String(err)) });
      return;
    }
    this.emit({ type: 'translation-final', sessionId, result: translated });

    if (!this.speakOutput) return;
    try {
      const audio = await this.tts.synthesize({
        text: translated.text,
        targetLang: translated.targetLang,
        voice: this.voice,
      });
      this.playback.enqueue({ id: audio.id, samples: audio.samples, sampleRateHz: audio.sampleRateHz });
    } catch (err) {
      this.emit({ type: 'error', stage: 'tts', error: err instanceof Error ? err : new Error(String(err)) });
    }
  }

  private setStatus(next: SessionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.emit({ type: 'status', status: next });
  }

  private emit(event: EngineEvent): void {
    for (const l of this.listeners) l(event);
  }
}
