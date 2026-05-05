/**
 * Mock STT provider. Emits deterministic placeholder transcripts so the rest
 * of the pipeline (translation, TTS, UI) can be exercised end-to-end without
 * any cloud credentials. This is what powers the app's "demo mode".
 *
 * Behavior:
 *  - On the first chunk of an utterance, emit a partial after `firstPartialDelayChunks`.
 *  - Every chunk thereafter, emit an updated partial with one more word.
 *  - When a chunk arrives with `utteranceBoundary=true` or `final=true`, emit
 *    a final transcript and reset the partial counter.
 */

import type { AudioChunk } from '../audio/audio-types';
import type {
  SttEvent,
  SttEventListener,
  SttProvider,
  SttSession,
  SttSessionOptions,
} from './stt-types';

const DEMO_PHRASES = [
  'Hello, how are you today?',
  'Could you repeat that please?',
  'Where is the nearest train station?',
  'Thank you very much.',
  'I would like a coffee, please.',
  'How much does this cost?',
  'I do not understand, can you explain?',
  'It is nice to meet you.',
  'What time does the meeting start?',
  'The weather is wonderful this morning.',
];

let sessionCounter = 0;

export class MockSttProvider implements SttProvider {
  readonly id = 'mock' as const;

  isAvailable(): boolean {
    return true;
  }

  async createSession(options: SttSessionOptions): Promise<SttSession> {
    return new MockSttSession(options);
  }
}

class MockSttSession implements SttSession {
  readonly id: string;
  private readonly listeners = new Set<SttEventListener>();
  private chunkCount = 0;
  private wordsRevealed = 0;
  private currentPhrase: string;
  private currentPhraseWords: string[];
  private utteranceStartMs: number | null = null;
  private closed = false;
  private readonly detectedLang: string;

  constructor(options: SttSessionOptions) {
    sessionCounter += 1;
    this.id = `mock-stt-${sessionCounter}`;
    this.currentPhrase = pickPhrase(sessionCounter);
    this.currentPhraseWords = this.currentPhrase.split(/\s+/);
    this.detectedLang = options.sourceLang === 'auto' ? 'en' : options.sourceLang;
  }

  pushChunk(chunk: AudioChunk): void {
    if (this.closed) return;
    if (this.utteranceStartMs === null) this.utteranceStartMs = chunk.startTimestampMs;
    this.chunkCount += 1;
    this.wordsRevealed = Math.min(this.currentPhraseWords.length, this.wordsRevealed + 1);

    if (chunk.utteranceBoundary || chunk.final) {
      this.emitFinal(chunk);
      return;
    }

    if (this.chunkCount >= 1) {
      this.emit({
        type: 'partial',
        sessionId: this.id,
        text: this.currentPhraseWords.slice(0, this.wordsRevealed).join(' '),
        detectedLang: this.detectedLang,
        startTimestampMs: this.utteranceStartMs ?? chunk.startTimestampMs,
        confidence: 0.5,
      });
    }
  }

  on(listener: SttEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.wordsRevealed > 0) {
      // Synthesize a final at the end-of-stream point.
      this.emit({
        type: 'final',
        sessionId: this.id,
        text: this.currentPhraseWords.slice(0, this.wordsRevealed).join(' '),
        detectedLang: this.detectedLang,
        startTimestampMs: this.utteranceStartMs ?? 0,
        durationMs: this.chunkCount * 300,
        confidence: 0.95,
      });
    }
  }

  private emitFinal(chunk: AudioChunk): void {
    this.emit({
      type: 'final',
      sessionId: this.id,
      text: this.currentPhrase,
      detectedLang: this.detectedLang,
      startTimestampMs: this.utteranceStartMs ?? chunk.startTimestampMs,
      durationMs: chunk.startTimestampMs - (this.utteranceStartMs ?? chunk.startTimestampMs) + chunk.durationMs,
      confidence: 0.92,
    });
    // Reset for the next utterance.
    this.chunkCount = 0;
    this.wordsRevealed = 0;
    this.utteranceStartMs = null;
    this.currentPhrase = pickPhrase(sessionCounter + this.id.length);
    this.currentPhraseWords = this.currentPhrase.split(/\s+/);
  }

  private emit(event: SttEvent): void {
    for (const l of this.listeners) l(event);
  }
}

function pickPhrase(seed: number): string {
  return DEMO_PHRASES[Math.abs(seed) % DEMO_PHRASES.length]!;
}
