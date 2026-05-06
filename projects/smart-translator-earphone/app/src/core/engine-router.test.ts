import { AudioPipeline } from './audio/audio-pipeline';
import { MockAudioCaptureProvider } from './audio/audio-capture';
import { MockAudioPlaybackProvider } from './audio/audio-playback';
import { FRAME_SAMPLES } from './audio/audio-types';
import { EngineRouter, type EngineEvent } from './engine-router';
import { MockSttProvider } from './stt/mock-stt-provider';
import { MockTranslationProvider } from './translation/mock-translation-provider';
import { MockTtsProvider } from './tts/mock-tts-provider';

function buildSpeechSamples(frameCount: number): Int16Array {
  const buf = new Int16Array(frameCount * FRAME_SAMPLES);
  // Loud square wave so VAD definitely classifies as voiced.
  for (let i = 0; i < buf.length; i++) buf[i] = i % 2 === 0 ? 12_000 : -12_000;
  return buf;
}

function buildSilenceSamples(frameCount: number): Int16Array {
  return new Int16Array(frameCount * FRAME_SAMPLES);
}

describe('EngineRouter (E2E across Epics 1-4 with mock providers)', () => {
  test('drives full pipeline: speech -> partial transcript -> final transcript -> translation -> playback', async () => {
    const capture = new MockAudioCaptureProvider();
    const playback = new MockAudioPlaybackProvider();
    const router = new EngineRouter({
      capture,
      playback,
      pipeline: {
        vad: { minSpeechMs: 60, minSilenceMs: 200 },
        chunker: { chunkMs: 300, maxChunkMs: 600 },
        onlyVoicedFramesToChunker: true,
        highPass: false,
      },
      stt: { providers: [new MockSttProvider()] },
      translation: { providers: [new MockTranslationProvider()] },
      tts: { providers: [new MockTtsProvider()] },
      sourceLang: 'en',
      targetLang: 'es',
    });

    const events: EngineEvent[] = [];
    router.on((e) => events.push(e));

    await router.start();
    capture.pushSamples(buildSpeechSamples(10));
    capture.pushSamples(buildSilenceSamples(15));
    capture.pushSamples(buildSpeechSamples(10));
    capture.pushSamples(buildSilenceSamples(15));
    // Give the async translate/tts a tick to resolve.
    await new Promise((r) => setTimeout(r, 50));
    await router.stop();

    expect(events.some((e) => e.type === 'status' && e.status === 'active')).toBe(true);
    expect(events.some((e) => e.type === 'final-transcript')).toBe(true);
    expect(events.some((e) => e.type === 'translation-final')).toBe(true);
    expect(events.some((e) => e.type === 'playback-start')).toBe(true);
  });

  test('respects speakOutput=false: no playback-start emitted', async () => {
    const capture = new MockAudioCaptureProvider();
    const playback = new MockAudioPlaybackProvider();
    const router = new EngineRouter({
      capture,
      playback,
      pipeline: {
        vad: { minSpeechMs: 60, minSilenceMs: 200 },
        chunker: { chunkMs: 300, maxChunkMs: 600 },
        onlyVoicedFramesToChunker: true,
        highPass: false,
      },
      stt: { providers: [new MockSttProvider()] },
      translation: { providers: [new MockTranslationProvider()] },
      tts: { providers: [new MockTtsProvider()] },
      sourceLang: 'en',
      targetLang: 'fr',
      speakOutput: false,
    });
    const events: EngineEvent[] = [];
    router.on((e) => events.push(e));
    await router.start();
    capture.pushSamples(buildSpeechSamples(10));
    capture.pushSamples(buildSilenceSamples(15));
    await new Promise((r) => setTimeout(r, 50));
    await router.stop();
    expect(events.some((e) => e.type === 'translation-final')).toBe(true);
    expect(events.some((e) => e.type === 'playback-start')).toBe(false);
  });

  test('dualEarStereo pans TTS playback to right channel', async () => {
    const capture = new MockAudioCaptureProvider();
    const playback = new MockAudioPlaybackProvider();
    const router = new EngineRouter({
      capture,
      playback,
      pipeline: {
        vad: { minSpeechMs: 60, minSilenceMs: 200 },
        chunker: { chunkMs: 300, maxChunkMs: 600 },
        onlyVoicedFramesToChunker: true,
        highPass: false,
      },
      stt: { providers: [new MockSttProvider()] },
      translation: { providers: [new MockTranslationProvider()] },
      tts: { providers: [new MockTtsProvider()] },
      sourceLang: 'en',
      targetLang: 'es',
      dualEarStereo: true,
    });
    await router.start();
    capture.pushSamples(buildSpeechSamples(10));
    capture.pushSamples(buildSilenceSamples(15));
    await new Promise((r) => setTimeout(r, 50));
    await router.stop();

    // All TTS chunks should be panned right.
    expect(playback.played.length).toBeGreaterThan(0);
    for (const entry of playback.played) {
      expect(entry.pan).toBe('right');
    }
  });

  test('setDualEarStereo calls capture.setMonitor', () => {
    const capture = new MockAudioCaptureProvider();
    const monitorCalls: Array<string | null> = [];
    (capture as unknown as { setMonitor: (p: string | null) => void }).setMonitor = (
      pan: string | null,
    ) => {
      monitorCalls.push(pan);
    };
    const playback = new MockAudioPlaybackProvider();
    const router = new EngineRouter({
      capture,
      playback,
      stt: { providers: [new MockSttProvider()] },
      translation: { providers: [new MockTranslationProvider()] },
      tts: { providers: [new MockTtsProvider()] },
      sourceLang: 'en',
      targetLang: 'es',
    });
    // Initially monitor is disabled (constructor calls applyMonitor once).
    expect(monitorCalls).toContain(null);

    router.setDualEarStereo(true);
    expect(monitorCalls).toContain('left');

    router.setDualEarStereo(false);
    expect(monitorCalls[monitorCalls.length - 1]).toBe(null);
  });

  test('AudioPipeline integration', () => {
    // Sanity check that AudioPipeline is wired to capture without throwing.
    const capture = new MockAudioCaptureProvider();
    const pipeline = new AudioPipeline(capture, {});
    expect(pipeline).toBeDefined();
  });
});
