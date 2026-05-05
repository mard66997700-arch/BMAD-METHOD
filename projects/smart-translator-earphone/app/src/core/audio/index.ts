/**
 * Public surface of the core/audio module (Epic 1).
 *
 * Importers should use the absolute path `@core/audio` (configured in
 * tsconfig paths) and not reach into individual files; this barrel is the
 * stable contract.
 */

export {
  SAMPLE_RATE_HZ,
  FRAME_DURATION_MS,
  FRAME_SAMPLES,
  type AudioFrame,
  type AudioChunk,
  type VadEvent,
} from './audio-types';

export {
  type AudioCaptureProvider,
  type CaptureState,
  type FrameListener,
  type ErrorListener,
  type StateListener,
  MockAudioCaptureProvider,
} from './audio-capture';

export {
  AudioChunker,
  type ChunkerOptions,
  type ChunkListener,
} from './audio-chunker';

export {
  VoiceActivityDetector,
  type VadOptions,
  type VadListener,
} from './vad';

export {
  HighPassFilter,
  type HighPassFilterOptions,
  SpectralSubtractionDenoiser,
  type DenoiserOptions,
} from './noise-reduction';

export {
  AudioPlaybackQueue,
  type AudioPlaybackProvider,
  type PlaybackChunk,
  type PlaybackEvent,
  type PlaybackEventListener,
  type PlaybackQueueOptions,
  MockAudioPlaybackProvider,
} from './audio-playback';

export {
  AudioPipeline,
  type AudioPipelineOptions,
  type PipelineEvent,
  type PipelineListener,
} from './audio-pipeline';

export {
  type AudioSession,
  type AudioSessionMode,
  type AudioSessionEvent,
  type AudioSessionEventListener,
  type OutputRoute,
  type LangCode,
  assertNever,
} from './audio-session-types';

export { createAudioCapture, createAudioPlayback } from './platform-audio-factory';
