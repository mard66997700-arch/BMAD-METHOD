/**
 * Public surface of the core/stt module (Epic 2).
 */

export * from './stt-types';
export { MockSttProvider } from './mock-stt-provider';
export { WhisperCloudProvider, type WhisperCloudOptions } from './whisper-cloud-provider';
export { GoogleSttProvider, type GoogleSttOptions } from './google-stt-provider';
export {
  WebSpeechSttProvider,
  WebSpeechSttSession,
  type WebSpeechSttOptions,
  type SpeechRecognitionCtor,
} from './web-speech-stt-provider';
export {
  ExpoSpeechRecognitionProvider,
  type ExpoSpeechRecognitionOptions,
} from './expo-speech-recognition-provider';
export { LanguageDetector, type LanguageDetectorOptions } from './language-detector';
export { SttEngineRouter, type SttEngineRouterOptions } from './stt-engine-router';
export { encodeWavInt16 } from './audio-encoding';
