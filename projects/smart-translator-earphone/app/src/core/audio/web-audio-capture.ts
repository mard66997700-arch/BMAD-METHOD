/**
 * Web Audio capture provider — implements `AudioCaptureProvider` for the
 * browser using `navigator.mediaDevices.getUserMedia` + an `AudioContext`
 * with an `AudioWorkletNode` (or fallback `ScriptProcessorNode`).
 *
 * The provider:
 *   1. Opens the mic at whatever sample rate the browser provides (typically
 *      44.1 kHz or 48 kHz).
 *   2. Down-samples to 16 kHz mono int16 (the project's pipeline-wide format).
 *   3. Slices the down-sampled stream into FRAME_SAMPLES (320) frames and
 *      emits them.
 *
 * No external libraries are used — only Web Audio APIs available in every
 * evergreen browser.
 */

import type {
  AudioCaptureProvider,
  CaptureState,
  ErrorListener,
  FrameListener,
  StateListener,
} from './audio-capture';
import { FRAME_SAMPLES, SAMPLE_RATE_HZ, type AudioFrame } from './audio-types';

interface WebAudioGlobals {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
  navigator?: { mediaDevices?: MediaDevices };
}

const RESAMPLE_SAMPLE_RATE = SAMPLE_RATE_HZ; // 16000

export class WebAudioCaptureProvider implements AudioCaptureProvider {
  private _state: CaptureState = 'idle';
  private readonly frameListeners = new Set<FrameListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private readonly stateListeners = new Set<StateListener>();
  private mediaStream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private leftover = new Float32Array(0);
  private seq = 0;
  private startMs = 0;

  get state(): CaptureState {
    return this._state;
  }

  async start(): Promise<void> {
    if (this._state === 'capturing' || this._state === 'starting') return;
    this.transition('starting');
    try {
      const g = globalThis as unknown as WebAudioGlobals;
      const Ctx = g.AudioContext ?? g.webkitAudioContext;
      if (!Ctx) throw new Error('AudioContext is not available in this environment');
      if (!g.navigator?.mediaDevices?.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is not available');
      }
      this.context = new Ctx();
      this.mediaStream = await g.navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.context.createMediaStreamSource(this.mediaStream);
      // ScriptProcessorNode is deprecated but universally supported. AudioWorklet
      // would be preferable but requires a separate worklet file which complicates
      // bundling for our purposes.
      const bufferSize = 4096;
      this.node = this.context.createScriptProcessor(bufferSize, 1, 1);
      this.node.onaudioprocess = (event: AudioProcessingEvent) => this.handleBuffer(event);
      this.source.connect(this.node);
      this.node.connect(this.context.destination);
      this.seq = 0;
      this.startMs = Date.now();
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
    try {
      this.node?.disconnect();
      this.source?.disconnect();
      await this.context?.close();
    } catch {
      // ignore tear-down errors
    }
    if (this.mediaStream) {
      for (const t of this.mediaStream.getTracks()) t.stop();
    }
    this.node = null;
    this.source = null;
    this.context = null;
    this.mediaStream = null;
    this.leftover = new Float32Array(0);
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

  private handleBuffer(event: AudioProcessingEvent): void {
    if (this._state !== 'capturing' || !this.context) return;
    const inputBuffer = event.inputBuffer.getChannelData(0);
    const inputRate = this.context.sampleRate;
    const downSampled = downsampleFloat32(inputBuffer, inputRate, RESAMPLE_SAMPLE_RATE);
    // Concatenate with leftover then slice into FRAME_SAMPLES frames.
    const merged = concatFloat32(this.leftover, downSampled);
    const fullFrames = Math.floor(merged.length / FRAME_SAMPLES);
    for (let i = 0; i < fullFrames; i++) {
      const start = i * FRAME_SAMPLES;
      const slice = merged.subarray(start, start + FRAME_SAMPLES);
      const samples = floatToInt16(slice);
      const frame: AudioFrame = {
        samples,
        seq: this.seq++,
        timestampMs: this.startMs + Math.round((this.seq * 1000 * FRAME_SAMPLES) / RESAMPLE_SAMPLE_RATE),
      };
      for (const l of this.frameListeners) l(frame);
    }
    this.leftover = merged.subarray(fullFrames * FRAME_SAMPLES);
  }

  private transition(next: CaptureState): void {
    this._state = next;
    for (const l of this.stateListeners) l(next);
  }
}

function concatFloat32(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function downsampleFloat32(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  if (toRate > fromRate) {
    throw new Error(`Cannot upsample from ${fromRate} to ${toRate}`);
  }
  const ratio = fromRate / toRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    // Average the input samples that fall into this output sample. This is
    // a low-pass / box filter; good enough for VAD-quality speech and
    // dramatically simpler than a polyphase resampler.
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j]!;
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]!));
    out[i] = Math.round(clamped * 32767);
  }
  return out;
}
