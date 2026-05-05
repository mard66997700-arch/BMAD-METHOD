/**
 * Public surface of the core/tts module (Epic 4).
 */

export * from './tts-types';
export * from './voice-settings';
export { MockTtsProvider } from './mock-tts-provider';
export { AzureTtsProvider, type AzureTtsOptions } from './azure-tts-provider';
export { GoogleTtsProvider, type GoogleTtsOptions } from './google-tts-provider';
export { TtsEngineRouter, type TtsEngineRouterOptions } from './tts-engine-router';
