/**
 * Expo / Web playback provider — implements `AudioPlaybackProvider`.
 *
 * On the web we use the Web Audio API directly (the same AudioContext we
 * use for capture). On native (iOS/Android) we encode the int16 PCM into a
 * WAV blob and play it via `expo-av`'s `Audio.Sound`.
 *
 * Both code paths support the AbortSignal contract: when aborted, playback
 * is stopped within `cancelFadeMs` and the promise resolves (the queue
 * interprets a normal resolve plus `signal.aborted` as cancellation).
 *
 * NOTE: This file imports `expo-av` lazily so it remains type-checkable in
 * pure-Node tests (the audio-playback tests use MockAudioPlaybackProvider).
 */

import { Platform } from 'react-native';

import type { AudioPlaybackProvider, PlaybackOptions, PlaybackPan } from './audio-playback';
import { encodeWavInt16 } from '../stt/audio-encoding';

const FADE_MS = 60;

export class ExpoAudioPlaybackProvider implements AudioPlaybackProvider {
  async playSamples(
    samples: Int16Array,
    sampleRateHz: number,
    signal: AbortSignal,
    options?: PlaybackOptions,
  ): Promise<void> {
    if (Platform.OS === 'web') {
      return playViaWebAudio(samples, sampleRateHz, signal, options?.pan ?? 'center');
    }
    return playViaExpoAv(samples, sampleRateHz, signal);
  }
}

function panToValue(pan: PlaybackPan): number {
  if (pan === 'left') return -1;
  if (pan === 'right') return 1;
  return 0;
}

async function playViaWebAudio(
  samples: Int16Array,
  sampleRateHz: number,
  signal: AbortSignal,
  pan: PlaybackPan,
): Promise<void> {
  const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctx = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const buffer = ctx.createBuffer(1, samples.length, sampleRateHz);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    channel[i] = samples[i]! / 32768;
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.connect(gain);
  // StereoPannerNode is not always present (Safari < 14.1); fall back to
  // direct connection when missing.
  const panner =
    typeof ctx.createStereoPanner === 'function' && pan !== 'center'
      ? ctx.createStereoPanner()
      : null;
  if (panner) {
    panner.pan.value = panToValue(pan);
    gain.connect(panner);
    panner.connect(ctx.destination);
  } else {
    gain.connect(ctx.destination);
  }
  gain.gain.value = 1;
  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      try {
        source.stop();
      } catch {
        // ignore
      }
      void ctx.close();
      resolve();
    };
    source.onended = finish;
    signal.addEventListener('abort', () => {
      // Quick fade then stop.
      try {
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_MS / 1000);
      } catch {
        // ignore
      }
      setTimeout(finish, FADE_MS);
    });
    source.start();
  });
}

async function playViaExpoAv(samples: Int16Array, sampleRateHz: number, signal: AbortSignal): Promise<void> {
  // Encode int16 -> WAV -> base64 data URI -> Audio.Sound.
  const wav = encodeWavInt16(samples, sampleRateHz);
  const base64 = bytesToBase64(wav);
  const uri = `data:audio/wav;base64,${base64}`;
  const expoAv = await import('expo-av');
  const { Audio } = expoAv;
  const sound = new Audio.Sound();
  await sound.loadAsync({ uri }, { shouldPlay: false });
  await sound.playAsync();
  return new Promise((resolve) => {
    let resolved = false;
    const finish = async () => {
      if (resolved) return;
      resolved = true;
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        // ignore
      }
      resolve();
    };
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) void finish();
    });
    signal.addEventListener('abort', () => {
      void finish();
    });
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return (globalThis as unknown as { btoa: (s: string) => string }).btoa(binary);
}
