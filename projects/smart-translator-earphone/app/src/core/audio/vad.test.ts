import { FRAME_SAMPLES, type AudioFrame, type VadEvent, VoiceActivityDetector } from './index';

/**
 * Build a frame at a target dBFS level. The energy depends on RMS, so we
 * generate a constant-amplitude signal (approximate full-scale at 32767).
 *
 * For dBFS = 20*log10(rms / 32768), an amplitude `a` gives RMS = a (constant
 * signal); so we set a = 32768 * 10^(dB/20).
 */
function buildFrame(seq: number, dbfs: number): AudioFrame {
  const amp = 32_768 * Math.pow(10, dbfs / 20);
  const samples = new Int16Array(FRAME_SAMPLES);
  // Use a square-ish signal alternating +/- amp to keep RMS ≈ amp.
  const a = Math.min(32_767, Math.max(-32_768, Math.round(amp)));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = i % 2 === 0 ? a : -a;
  }
  return { samples, seq, timestampMs: seq * 20 };
}

function silentFrame(seq: number): AudioFrame {
  return { samples: new Int16Array(FRAME_SAMPLES), seq, timestampMs: seq * 20 };
}

describe('Story 1.3 — VoiceActivityDetector', () => {
  test('frameEnergyDb returns -Infinity for silence', () => {
    const f = silentFrame(0);
    expect(VoiceActivityDetector.frameEnergyDb(f.samples)).toBe(-Infinity);
  });

  test('frameEnergyDb returns approximately 0 dBFS for a full-scale signal', () => {
    const samples = new Int16Array(FRAME_SAMPLES);
    samples.fill(32_767);
    expect(VoiceActivityDetector.frameEnergyDb(samples)).toBeCloseTo(0, 1);
  });

  test('emits utterance-start after minSpeechMs of voiced frames', () => {
    const events: VadEvent[] = [];
    const vad = new VoiceActivityDetector({
      startThresholdDb: -40,
      stopThresholdDb: -50,
      minSpeechMs: 120,
      minSilenceMs: 400,
    });
    vad.onEvent((e) => events.push(e));

    // 5 frames of speech-loud (-30 dBFS) plus 1 more — 120 ms threshold means
    // utterance-start emits on the 6th frame (since each frame is 20 ms,
    // 6 * 20 = 120 ms is the first frame at which voicedFrames * 20 >= 120).
    for (let i = 0; i < 6; i++) vad.push(buildFrame(i, -30));
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('utterance-start');
    expect(vad.currentState).toBe('speech');
  });

  test('does not emit utterance-start for spike below minSpeechMs', () => {
    const events: VadEvent[] = [];
    const vad = new VoiceActivityDetector({ minSpeechMs: 120, minSilenceMs: 400 });
    vad.onEvent((e) => events.push(e));

    // 2 frames (40 ms) of loud, then back to silence → no event.
    vad.push(buildFrame(0, -30));
    vad.push(buildFrame(1, -30));
    vad.push(silentFrame(2));
    vad.push(silentFrame(3));
    expect(events).toHaveLength(0);
    expect(vad.currentState).toBe('silent');
  });

  test('emits utterance-end after minSilenceMs of trailing silence', () => {
    const events: VadEvent[] = [];
    const vad = new VoiceActivityDetector({
      startThresholdDb: -40,
      stopThresholdDb: -50,
      minSpeechMs: 60,
      minSilenceMs: 100,
    });
    vad.onEvent((e) => events.push(e));

    // Start utterance.
    for (let i = 0; i < 4; i++) vad.push(buildFrame(i, -30));
    // Trailing silence (≥100 ms = 5 frames).
    for (let i = 4; i < 10; i++) vad.push(silentFrame(i));

    const ends = events.filter((e) => e.type === 'utterance-end');
    expect(events.filter((e) => e.type === 'utterance-start')).toHaveLength(1);
    expect(ends).toHaveLength(1);
    if (ends[0]!.type === 'utterance-end') {
      // 4 frames of speech * 20 ms = 80 ms duration.
      expect(ends[0]!.durationMs).toBe(80);
    }
    expect(vad.currentState).toBe('silent');
  });

  test('hysteresis: brief silence dip in mid-utterance does not end it', () => {
    const events: VadEvent[] = [];
    const vad = new VoiceActivityDetector({
      startThresholdDb: -40,
      stopThresholdDb: -50,
      minSpeechMs: 60,
      minSilenceMs: 200,
    });
    vad.onEvent((e) => events.push(e));

    // Speech, then 2 frames of silence (40 ms < 200 ms), then speech resumes.
    for (let i = 0; i < 4; i++) vad.push(buildFrame(i, -30));
    vad.push(silentFrame(4));
    vad.push(silentFrame(5));
    for (let i = 6; i < 10; i++) vad.push(buildFrame(i, -30));
    // Now sustained silence to end the utterance.
    for (let i = 10; i < 25; i++) vad.push(silentFrame(i));

    const starts = events.filter((e) => e.type === 'utterance-start');
    const ends = events.filter((e) => e.type === 'utterance-end');
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
  });

  test('flush emits utterance-end if mid-utterance', () => {
    const events: VadEvent[] = [];
    const vad = new VoiceActivityDetector({ minSpeechMs: 60, minSilenceMs: 100 });
    vad.onEvent((e) => events.push(e));

    let lastFrame: AudioFrame | null = null;
    for (let i = 0; i < 4; i++) {
      const f = buildFrame(i, -30);
      lastFrame = f;
      vad.push(f);
    }
    vad.flush(lastFrame);
    expect(events.filter((e) => e.type === 'utterance-end')).toHaveLength(1);
  });

  test('rejects invalid threshold ordering', () => {
    expect(
      () => new VoiceActivityDetector({ startThresholdDb: -50, stopThresholdDb: -40 }),
    ).toThrow();
  });

  test('SNR ≥ 10 dB acceptance: false-positive rate ≤ 5% on long silence', () => {
    // Generate noise frames at -55 dBFS (well below stop threshold).
    const events: VadEvent[] = [];
    const vad = new VoiceActivityDetector();
    vad.onEvent((e) => events.push(e));
    for (let i = 0; i < 200; i++) vad.push(buildFrame(i, -55));
    expect(events.filter((e) => e.type === 'utterance-start')).toHaveLength(0);
  });

  test('SNR ≥ 10 dB acceptance: false-negative rate ≤ 5% on sustained speech', () => {
    // 50 utterances, each 200 ms of speech at -30 dBFS surrounded by silence.
    const vad = new VoiceActivityDetector({
      startThresholdDb: -40,
      stopThresholdDb: -50,
      minSpeechMs: 60,
      minSilenceMs: 200,
    });
    let detected = 0;
    vad.onEvent((e) => {
      if (e.type === 'utterance-start') detected += 1;
    });
    let seq = 0;
    for (let u = 0; u < 50; u++) {
      // 200 ms speech (10 frames).
      for (let i = 0; i < 10; i++) vad.push(buildFrame(seq++, -30));
      // 400 ms silence (20 frames).
      for (let i = 0; i < 20; i++) vad.push(silentFrame(seq++));
    }
    // ≥95% detection.
    expect(detected).toBeGreaterThanOrEqual(48);
  });

  test('utility helpers expose frame timing', () => {
    expect(VoiceActivityDetector.framesPerSecond()).toBe(50);
    expect(VoiceActivityDetector.framesForMs(120)).toBe(6);
    expect(VoiceActivityDetector.samplesPerFrame()).toBe(320);
  });
});
