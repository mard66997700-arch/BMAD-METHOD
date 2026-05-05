import { FRAME_SAMPLES, MockAudioCaptureProvider, type AudioFrame } from './index';

describe('Story 1.1 — AudioCaptureProvider', () => {
  function buildBuffer(frames: number, fillValue = 100): Int16Array {
    const buf = new Int16Array(frames * FRAME_SAMPLES);
    buf.fill(fillValue);
    return buf;
  }

  test('emits frames of exactly FRAME_SAMPLES (320) int16 samples each', async () => {
    const buf = buildBuffer(5);
    const provider = new MockAudioCaptureProvider(buf);
    const collected: AudioFrame[] = [];
    provider.onFrame((f) => collected.push(f));

    await provider.start();

    expect(collected).toHaveLength(5);
    for (const frame of collected) {
      expect(frame.samples).toBeInstanceOf(Int16Array);
      expect(frame.samples.length).toBe(320);
    }
  });

  test('frames have monotonically increasing seq starting at 0', async () => {
    const provider = new MockAudioCaptureProvider(buildBuffer(3));
    const collected: AudioFrame[] = [];
    provider.onFrame((f) => collected.push(f));
    await provider.start();
    expect(collected.map((f) => f.seq)).toEqual([0, 1, 2]);
  });

  test('drops trailing samples that do not fill a full frame', async () => {
    const buf = new Int16Array(FRAME_SAMPLES * 2 + 5);
    const provider = new MockAudioCaptureProvider(buf);
    const collected: AudioFrame[] = [];
    provider.onFrame((f) => collected.push(f));
    await provider.start();
    expect(collected).toHaveLength(2);
  });

  test('state transitions: idle → starting → capturing → stopping → idle', async () => {
    const provider = new MockAudioCaptureProvider();
    const states: string[] = [];
    provider.onState((s) => states.push(s));
    expect(provider.state).toBe('idle');
    await provider.start();
    expect(provider.state).toBe('capturing');
    await provider.stop();
    expect(provider.state).toBe('idle');
    expect(states).toEqual(['starting', 'capturing', 'stopping', 'idle']);
  });

  test('onFrame returns an unsubscribe function', async () => {
    const provider = new MockAudioCaptureProvider();
    const a: number[] = [];
    const b: number[] = [];
    const unsubA = provider.onFrame((f) => a.push(f.seq));
    provider.onFrame((f) => b.push(f.seq));

    await provider.start();
    provider.pushSamples(buildBuffer(2));
    unsubA();
    provider.pushSamples(buildBuffer(2));

    expect(a).toEqual([0, 1]);
    expect(b).toEqual([0, 1, 2, 3]);
  });

  test('cannot push samples when not capturing', () => {
    const provider = new MockAudioCaptureProvider();
    expect(() => provider.pushSamples(buildBuffer(1))).toThrow();
  });

  test('cannot start twice', async () => {
    const provider = new MockAudioCaptureProvider();
    await provider.start();
    await expect(provider.start()).rejects.toThrow();
  });

  test('emitError transitions to errored state', async () => {
    const provider = new MockAudioCaptureProvider();
    const errors: Error[] = [];
    provider.onError((e) => errors.push(e));
    await provider.start();
    provider.emitError(new Error('boom'));
    expect(provider.state).toBe('errored');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe('boom');
  });
});
