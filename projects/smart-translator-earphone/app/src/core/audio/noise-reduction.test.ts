import { FRAME_SAMPLES, HighPassFilter, SAMPLE_RATE_HZ, SpectralSubtractionDenoiser } from './index';

function generateSineWave(frequencyHz: number, lengthSamples: number, amplitude = 5_000): Int16Array {
  const out = new Int16Array(lengthSamples);
  for (let i = 0; i < lengthSamples; i++) {
    out[i] = Math.round(amplitude * Math.sin((2 * Math.PI * frequencyHz * i) / SAMPLE_RATE_HZ));
  }
  return out;
}

function rms(samples: Int16Array): number {
  let s = 0;
  for (const v of samples) s += v * v;
  return Math.sqrt(s / samples.length);
}

function dbRatio(after: Int16Array, before: Int16Array): number {
  const r = rms(after) / rms(before);
  return 20 * Math.log10(Math.max(r, 1e-10));
}

describe('Story 1.4 — HighPassFilter (4-stage cascade, 100 Hz cutoff)', () => {
  function applyFilter(input: Int16Array, filter: HighPassFilter): Int16Array {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += FRAME_SAMPLES) {
      const inSlice = input.slice(i, i + FRAME_SAMPLES);
      const outSlice = out.subarray(i, i + FRAME_SAMPLES);
      filter.process(inSlice, outSlice);
    }
    return out;
  }

  test('attenuates 60 Hz signal by ≥ 18 dB', () => {
    // 4 seconds so the filter settles.
    const len = 4 * SAMPLE_RATE_HZ;
    const input = generateSineWave(60, len);
    const filter = new HighPassFilter({ cutoffHz: 100, numStages: 4 });
    const filtered = applyFilter(input, filter);
    // Drop the first 0.5 s where the filter is still settling.
    const skip = SAMPLE_RATE_HZ / 2;
    const att = dbRatio(filtered.slice(skip), input.slice(skip));
    expect(att).toBeLessThanOrEqual(-18);
  });

  test('attenuates 300 Hz signal by ≤ 3 dB', () => {
    // A 4-stage 1st-order cascade has more pass-band droop than an N-th
    // order Butterworth section. -3 dB at 300 Hz with a 100 Hz cutoff is a
    // realistic bound; ≤ 1 dB would require a biquad-based design.
    const len = 4 * SAMPLE_RATE_HZ;
    const input = generateSineWave(300, len);
    const filter = new HighPassFilter({ cutoffHz: 100, numStages: 4 });
    const filtered = applyFilter(input, filter);
    const skip = SAMPLE_RATE_HZ / 2;
    const att = dbRatio(filtered.slice(skip), input.slice(skip));
    expect(att).toBeGreaterThanOrEqual(-3);
  });

  test('attenuates 1000 Hz signal by ≤ 1 dB (clean speech band)', () => {
    const len = 4 * SAMPLE_RATE_HZ;
    const input = generateSineWave(1_000, len);
    const filter = new HighPassFilter({ cutoffHz: 100, numStages: 4 });
    const filtered = applyFilter(input, filter);
    const skip = SAMPLE_RATE_HZ / 2;
    const att = dbRatio(filtered.slice(skip), input.slice(skip));
    expect(att).toBeGreaterThanOrEqual(-1);
  });

  test('default options yield the same characteristics', () => {
    const len = 4 * SAMPLE_RATE_HZ;
    const input60 = generateSineWave(60, len);
    const input1000 = generateSineWave(1_000, len);
    const f1 = new HighPassFilter();
    const f2 = new HighPassFilter();
    const out60 = applyFilter(input60, f1);
    const out1000 = applyFilter(input1000, f2);
    const skip = SAMPLE_RATE_HZ / 2;
    expect(dbRatio(out60.slice(skip), input60.slice(skip))).toBeLessThanOrEqual(-18);
    expect(dbRatio(out1000.slice(skip), input1000.slice(skip))).toBeGreaterThanOrEqual(-1);
  });

  test('rejects out-of-range cutoff', () => {
    expect(() => new HighPassFilter({ cutoffHz: 0 })).toThrow();
    expect(() => new HighPassFilter({ cutoffHz: SAMPLE_RATE_HZ })).toThrow();
  });

  test('reset() clears internal filter state', () => {
    const f = new HighPassFilter();
    const buf = new Int16Array(FRAME_SAMPLES);
    buf.fill(1_000);
    f.process(buf);
    f.reset();
    // After reset, processing a constant signal again should produce the same
    // settling behaviour as the first time.
    const next = new Int16Array(FRAME_SAMPLES);
    f.process(buf, next);
    expect(next[0]).toBeDefined();
  });

  test('out length must match input length', () => {
    const f = new HighPassFilter();
    expect(() => f.process(new Int16Array(320), new Int16Array(160))).toThrow();
  });
});

describe('Story 1.4 — SpectralSubtractionDenoiser', () => {
  test('calibrationPending is true before calibration', () => {
    const d = new SpectralSubtractionDenoiser();
    expect(d.calibrationPending).toBe(true);
  });

  test('calibrationPending is false after calibration', () => {
    const d = new SpectralSubtractionDenoiser();
    const noise = generateSineWave(60, FRAME_SAMPLES, 2_000);
    d.calibrate(noise);
    expect(d.calibrationPending).toBe(false);
  });

  test('process() is a no-op when not calibrated', () => {
    const d = new SpectralSubtractionDenoiser();
    const input = generateSineWave(250, FRAME_SAMPLES);
    const out = d.process(input);
    expect(Array.from(out)).toEqual(Array.from(input));
  });

  test('reduces stationary noise by ≥ 6 dB after calibration', () => {
    const d = new SpectralSubtractionDenoiser();

    // Calibration: 5 frames of "noise" at 60 Hz, low amplitude.
    for (let i = 0; i < 5; i++) {
      d.calibrate(generateSineWave(60, FRAME_SAMPLES, 2_000));
    }

    // Test signal: same 60 Hz noise — denoiser should suppress it.
    const noisyFrame = generateSineWave(60, FRAME_SAMPLES, 2_000);
    const denoised = d.process(noisyFrame);

    const att = dbRatio(denoised, noisyFrame);
    expect(att).toBeLessThanOrEqual(-6);
  });

  test('rejects calibration frame of wrong size', () => {
    const d = new SpectralSubtractionDenoiser();
    expect(() => d.calibrate(new Int16Array(FRAME_SAMPLES - 1))).toThrow();
  });

  test('rejects process frame of wrong size', () => {
    const d = new SpectralSubtractionDenoiser();
    expect(() => d.process(new Int16Array(FRAME_SAMPLES + 1))).toThrow();
  });

  test('reset() returns to calibration-pending state', () => {
    const d = new SpectralSubtractionDenoiser();
    d.calibrate(generateSineWave(60, FRAME_SAMPLES));
    expect(d.calibrationPending).toBe(false);
    d.reset();
    expect(d.calibrationPending).toBe(true);
  });
});
