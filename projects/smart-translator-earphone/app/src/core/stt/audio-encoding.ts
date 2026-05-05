/**
 * Minimal int16-PCM → WAV (RIFF) encoder used by STT providers that expect
 * a file upload (Whisper, Google batch). Outputs a single-channel,
 * 16-bit signed-int PCM WAV at the given sample rate.
 *
 * The function is pure and synchronous; it does not allocate beyond the
 * output buffer.
 */

const HEADER_BYTES = 44;

export function encodeWavInt16(samples: Int16Array, sampleRateHz: number): Uint8Array {
  const byteLength = HEADER_BYTES + samples.length * 2;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, byteLength - 8, true);
  writeAscii(view, 8, 'WAVE');

  // fmt subchunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk size for PCM
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // numChannels = 1
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, sampleRateHz * 2, true); // byteRate = sampleRate * blockAlign
  view.setUint16(32, 2, true); // blockAlign = numChannels * bytesPerSample
  view.setUint16(34, 16, true); // bitsPerSample

  // data subchunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // PCM samples
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(HEADER_BYTES + i * 2, samples[i]!, true);
  }

  return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, ascii: string): void {
  for (let i = 0; i < ascii.length; i++) {
    view.setUint8(offset + i, ascii.charCodeAt(i));
  }
}
