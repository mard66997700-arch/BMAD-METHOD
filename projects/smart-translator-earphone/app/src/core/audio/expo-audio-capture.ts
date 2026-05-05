/**
 * Expo / React Native audio capture provider — implements
 * `AudioCaptureProvider` using `expo-av`'s Recording API.
 *
 * NOTE: As of expo-av SDK 52, the Recording API does NOT expose a real-time
 * frame stream — it writes to a file and then `getStatus` reports duration.
 * For a real production build we would integrate a turbo-module that wraps
 * AVAudioEngine (iOS) and AudioRecord (Android) to deliver 20 ms frames; this
 * is the path described in `src/native/{ios,android}/AudioSession.{swift,kt}`.
 *
 * To keep the app runnable today on iOS/Android without writing native code,
 * this provider polls the Recording metering at ~50 Hz and synthesizes
 * frames from the metered amplitude. This is intentionally a simple bridge
 * sufficient to drive the VAD and produce non-zero pipeline output for end-
 * to-end demo scenarios; downstream STT will receive approximate audio.
 *
 * The detailed contract that the future native module must satisfy is in
 * `audio-session-types.ts`.
 */

import type {
  AudioCaptureProvider,
  CaptureState,
  ErrorListener,
  FrameListener,
  StateListener,
} from './audio-capture';
import { FRAME_SAMPLES, SAMPLE_RATE_HZ, type AudioFrame } from './audio-types';

// Lazy-loaded to keep this file importable in pure-Node tests where expo-av
// is not present. The runtime import only happens inside `start()`.
type ExpoAvModule = typeof import('expo-av') | null;

const POLL_INTERVAL_MS = 20;

export class ExpoAudioCaptureProvider implements AudioCaptureProvider {
  private _state: CaptureState = 'idle';
  private readonly frameListeners = new Set<FrameListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private readonly stateListeners = new Set<StateListener>();
  private expoAv: ExpoAvModule = null;
  private recording: import('expo-av').Audio.Recording | null = null;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private seq = 0;
  private startMs = 0;
  private lastDb = -160;

  get state(): CaptureState {
    return this._state;
  }

  async start(): Promise<void> {
    if (this._state === 'capturing' || this._state === 'starting') return;
    this.transition('starting');
    try {
      this.expoAv = await import('expo-av');
      const { Audio } = this.expoAv;
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) throw new Error('Microphone permission denied');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      const options = Audio.RecordingOptionsPresets?.HIGH_QUALITY ?? {
        android: {
          extension: '.m4a',
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.caf',
          audioQuality: 0x60,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
      };
      await recording.prepareToRecordAsync(options as Parameters<typeof recording.prepareToRecordAsync>[0]);
      // Enable progress updates so we can read amplitude metering.
      recording.setProgressUpdateInterval(POLL_INTERVAL_MS);
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && typeof status.metering === 'number') {
          this.lastDb = status.metering;
        }
      });
      await recording.startAsync();
      this.recording = recording;
      this.seq = 0;
      this.startMs = Date.now();
      this.pollHandle = setInterval(() => this.emitFrameFromMetering(), POLL_INTERVAL_MS);
      this.transition('capturing');
    } catch (err) {
      this.transition('errored');
      const error = err instanceof Error ? err : new Error(String(err));
      for (const l of this.errorListeners) l(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this._state === 'idle') return;
    this.transition('stopping');
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    try {
      await this.recording?.stopAndUnloadAsync();
    } catch {
      // Ignore stop errors — tear-down is best-effort.
    }
    this.recording = null;
    this.transition('idle');
  }

  onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private emitFrameFromMetering(): void {
    if (this._state !== 'capturing') return;
    // Convert dB metering ([-160, 0]) to a [0, 1] amplitude. We then emit a
    // 20 ms PCM frame at that amplitude (white-noise modulated). This is NOT
    // real captured audio, but it carries the speaker's loudness envelope so
    // downstream VAD / mock STT can distinguish speech from silence.
    const amplitude = Math.max(0, Math.min(1, (this.lastDb + 60) / 60));
    const peak = Math.round(amplitude * 16_000);
    const samples = new Int16Array(FRAME_SAMPLES);
    for (let i = 0; i < FRAME_SAMPLES; i++) {
      samples[i] = Math.round((Math.random() * 2 - 1) * peak);
    }
    const frame: AudioFrame = {
      samples,
      seq: this.seq++,
      timestampMs: this.startMs + Math.round((this.seq * 1000 * FRAME_SAMPLES) / SAMPLE_RATE_HZ),
    };
    for (const l of this.frameListeners) l(frame);
  }

  private transition(next: CaptureState): void {
    this._state = next;
    for (const l of this.stateListeners) l(next);
  }
}
