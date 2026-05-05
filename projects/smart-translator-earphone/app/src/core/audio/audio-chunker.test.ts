import { AudioChunker, FRAME_SAMPLES, type AudioChunk, type AudioFrame } from './index';

function makeFrame(seq: number, fillValue = 1): AudioFrame {
  const samples = new Int16Array(FRAME_SAMPLES);
  samples.fill(fillValue);
  return { samples, seq, timestampMs: seq * 20 };
}

describe('Story 1.2 — AudioChunker', () => {
  test('emits chunks of exactly chunkMs/20 frames worth of samples (300 ms = 4800 samples)', () => {
    const chunker = new AudioChunker({ chunkMs: 300 });
    const chunks: AudioChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    for (let i = 0; i < 30; i++) chunker.push(makeFrame(i));

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.samples.length).toBe(4800);
    expect(chunks[1]!.samples.length).toBe(4800);
    expect(chunks[0]!.durationMs).toBe(300);
    expect(chunks[0]!.startSeq).toBe(0);
    expect(chunks[0]!.endSeq).toBe(14);
    expect(chunks[1]!.startSeq).toBe(15);
    expect(chunks[1]!.endSeq).toBe(29);
    expect(chunks[0]!.final).toBe(false);
    expect(chunks[0]!.utteranceBoundary).toBe(false);
  });

  test('flushFinal emits a partial chunk with final=true', () => {
    const chunker = new AudioChunker({ chunkMs: 300 });
    const chunks: AudioChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    for (let i = 0; i < 5; i++) chunker.push(makeFrame(i));
    expect(chunks).toHaveLength(0);
    chunker.flushFinal();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.final).toBe(true);
    expect(chunks[0]!.samples.length).toBe(5 * FRAME_SAMPLES);
    expect(chunks[0]!.durationMs).toBe(100);
  });

  test('flushFinal on empty buffer is a no-op', () => {
    const chunker = new AudioChunker();
    const chunks: AudioChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));
    chunker.flushFinal();
    expect(chunks).toHaveLength(0);
  });

  test('markUtteranceBoundary flushes early with utteranceBoundary=true', () => {
    const chunker = new AudioChunker({ chunkMs: 300 });
    const chunks: AudioChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    for (let i = 0; i < 4; i++) chunker.push(makeFrame(i));
    chunker.markUtteranceBoundary();

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.utteranceBoundary).toBe(true);
    expect(chunks[0]!.final).toBe(false);
    expect(chunks[0]!.samples.length).toBe(4 * FRAME_SAMPLES);
  });

  test('markUtteranceBoundary on empty buffer does not flush', () => {
    const chunker = new AudioChunker();
    const chunks: AudioChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));
    chunker.markUtteranceBoundary();
    expect(chunks).toHaveLength(0);
  });

  test('rejects invalid chunkMs (not multiple of 20 ms)', () => {
    expect(() => new AudioChunker({ chunkMs: 250 })).toThrow();
  });

  test('rejects maxChunkMs < chunkMs', () => {
    expect(() => new AudioChunker({ chunkMs: 300, maxChunkMs: 200 })).toThrow();
  });

  test('pendingFrameCount reflects buffered frames', () => {
    const chunker = new AudioChunker({ chunkMs: 300 });
    expect(chunker.pendingFrameCount).toBe(0);
    chunker.push(makeFrame(0));
    chunker.push(makeFrame(1));
    expect(chunker.pendingFrameCount).toBe(2);
    chunker.flushFinal();
    expect(chunker.pendingFrameCount).toBe(0);
  });

  test('two consecutive utterance boundaries emit two distinct chunks', () => {
    const chunker = new AudioChunker({ chunkMs: 300 });
    const chunks: AudioChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));
    chunker.push(makeFrame(0));
    chunker.markUtteranceBoundary();
    chunker.push(makeFrame(1));
    chunker.markUtteranceBoundary();
    expect(chunks).toHaveLength(2);
    expect(chunks.every((c) => c.utteranceBoundary)).toBe(true);
  });
});
