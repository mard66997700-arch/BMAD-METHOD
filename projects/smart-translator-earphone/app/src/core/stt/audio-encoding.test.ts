import { encodeWavInt16 } from './audio-encoding';

describe('encodeWavInt16', () => {
  test('produces a well-formed 44-byte RIFF header', () => {
    const samples = new Int16Array([0, 1, -1, 32767, -32768]);
    const wav = encodeWavInt16(samples, 16_000);
    expect(wav.length).toBe(44 + samples.length * 2);
    const td = new TextDecoder('ascii');
    expect(td.decode(wav.slice(0, 4))).toBe('RIFF');
    expect(td.decode(wav.slice(8, 12))).toBe('WAVE');
    expect(td.decode(wav.slice(12, 16))).toBe('fmt ');
    expect(td.decode(wav.slice(36, 40))).toBe('data');
    // Sample rate at offset 24 (little-endian)
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
  });

  test('round-trips int16 samples in PCM payload', () => {
    const samples = new Int16Array([100, -200, 300, -400]);
    const wav = encodeWavInt16(samples, 8_000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    for (let i = 0; i < samples.length; i++) {
      expect(view.getInt16(44 + i * 2, true)).toBe(samples[i]);
    }
  });
});
