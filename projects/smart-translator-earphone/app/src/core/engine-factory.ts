/**
 * Convenience factory that wires together default providers based on the
 * available environment variables and the user's selected engine ids.
 *
 * - If the relevant API key is missing, the corresponding cloud provider is
 *   silently dropped and the mock provider takes its place. This is what
 *   makes "demo mode" Just Work when no `.env` is present.
 *
 * - Mock providers always come last in the chain so they act as the final
 *   fallback if a cloud provider transiently fails.
 */

import { hasEnv, getEnv } from '../config/env';
import { DEFAULT_CONFIG } from '../config/default-config';
import type { AudioCaptureProvider } from './audio/audio-capture';
import type { AudioPlaybackProvider } from './audio/audio-playback';
import {
  EngineRouter,
  type EngineRouterOptions,
  type SessionStatus,
} from './engine-router';
import { MockSttProvider } from './stt/mock-stt-provider';
import { GoogleSttProvider } from './stt/google-stt-provider';
import { WhisperCloudProvider } from './stt/whisper-cloud-provider';
import { WebSpeechSttProvider } from './stt/web-speech-stt-provider';
import { ExpoSpeechRecognitionProvider } from './stt/expo-speech-recognition-provider';
import type { SttEngineId, SttProvider } from './stt/stt-types';
import { MockTranslationProvider } from './translation/mock-translation-provider';
import { DeeplProvider } from './translation/deepl-provider';
import { OpenAiTranslationProvider } from './translation/openai-provider';
import { GoogleTranslateProvider } from './translation/google-translate-provider';
import { GoogleTranslateFreeProvider } from './translation/google-translate-free-provider';
import type { GlossaryEntry } from './translation/glossary';
import type { TranslationEngineId, TranslationProvider } from './translation/translation-types';
import { MockTtsProvider } from './tts/mock-tts-provider';
import { AzureTtsProvider } from './tts/azure-tts-provider';
import { GoogleTtsProvider } from './tts/google-tts-provider';
import { WebSpeechTtsProvider } from './tts/web-speech-tts-provider';
import { ExpoSpeechTtsProvider } from './tts/expo-speech-tts-provider';
import type { TtsEngineId, TtsProvider } from './tts/tts-types';
import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from './tts/voice-settings';

/**
 * Runtime API keys collected via the in-app Settings screen. These take
 * precedence over `EXPO_PUBLIC_*` env vars when present, so users can plug in
 * a key without rebuilding the bundle.
 */
export interface RuntimeApiKeys {
  openai?: string;
  google?: string;
  deepl?: string;
  azure?: string;
  azureRegion?: string;
}

export interface EngineFactoryOptions {
  capture: AudioCaptureProvider;
  playback: AudioPlaybackProvider;
  sourceLang?: string | 'auto';
  targetLang?: string;
  voice?: VoiceSettings;
  speakOutput?: boolean;
  sttEngine?: SttEngineId;
  translationEngine?: TranslationEngineId;
  ttsEngine?: TtsEngineId;
  apiKeys?: RuntimeApiKeys;
  /**
   * Stereo dual-ear: route the captured source audio to the left ear and
   * the synthesized translation to the right ear.
   */
  dualEarStereo?: boolean;
  /**
   * User-defined translation glossary applied around every translation
   * call (forwarded to the TranslationRouter).
   */
  glossary?: readonly GlossaryEntry[];
}

export function createEngineRouter(options: EngineFactoryOptions): EngineRouter {
  const apiKeys = options.apiKeys ?? {};
  const sttProviders = buildSttProviders(
    options.sttEngine ?? DEFAULT_CONFIG.defaultSttEngine,
    apiKeys,
  );
  const translationProviders = buildTranslationProviders(
    options.translationEngine ?? DEFAULT_CONFIG.defaultTranslationEngine,
    apiKeys,
  );
  const ttsProviders = buildTtsProviders(
    options.ttsEngine ?? DEFAULT_CONFIG.defaultTtsEngine,
    apiKeys,
  );

  const router = new EngineRouter({
    capture: options.capture,
    playback: options.playback,
    stt: { providers: sttProviders, sessionDefaults: { sourceLang: options.sourceLang ?? 'auto' } },
    translation: { providers: translationProviders, glossary: options.glossary },
    tts: { providers: ttsProviders },
    sourceLang: options.sourceLang ?? 'auto',
    targetLang: options.targetLang ?? DEFAULT_CONFIG.defaultTargetLang,
    voice: options.voice ?? DEFAULT_VOICE_SETTINGS,
    speakOutput: options.speakOutput,
    dualEarStereo: options.dualEarStereo,
  } satisfies EngineRouterOptions);
  return router;
}

function pickKey(runtime: string | undefined, envName: Parameters<typeof hasEnv>[0]): string | undefined {
  if (runtime && runtime.length > 0) return runtime;
  return hasEnv(envName) ? getEnv(envName) : undefined;
}

function buildSttProviders(preferred: SttEngineId, apiKeys: RuntimeApiKeys): SttProvider[] {
  const providers: SttProvider[] = [];
  const cloud: SttProvider[] = [];
  const openaiKey = pickKey(apiKeys.openai, 'EXPO_PUBLIC_OPENAI_API_KEY');
  if (openaiKey) {
    cloud.push(new WhisperCloudProvider({ apiKey: openaiKey }));
  }
  const googleKey = pickKey(apiKeys.google, 'EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY');
  if (googleKey) {
    cloud.push(new GoogleSttProvider({ apiKey: googleKey }));
  }
  // Free, keyless, platform-aware fallbacks. Each self-disables
  // (`isAvailable() === false`) where the platform lacks support, so the
  // SttEngineRouter skips them automatically.
  const webSpeech: SttProvider = new WebSpeechSttProvider();
  const expoSpeech: SttProvider = new ExpoSpeechRecognitionProvider();
  const ordered: SttProvider[] = [...cloud, webSpeech, expoSpeech];
  // Reorder so the user's preferred engine (if available) comes first.
  const preferredIx = ordered.findIndex((p) => p.id === preferred);
  if (preferredIx > 0) {
    const [picked] = ordered.splice(preferredIx, 1);
    ordered.unshift(picked!);
  }
  providers.push(...ordered);
  providers.push(new MockSttProvider());
  return providers;
}

function buildTranslationProviders(
  preferred: TranslationEngineId,
  apiKeys: RuntimeApiKeys,
): TranslationProvider[] {
  const providers: TranslationProvider[] = [];
  const paid: TranslationProvider[] = [];
  const deeplKey = pickKey(apiKeys.deepl, 'EXPO_PUBLIC_DEEPL_API_KEY');
  if (deeplKey) {
    paid.push(new DeeplProvider({ apiKey: deeplKey }));
  }
  const openaiKey = pickKey(apiKeys.openai, 'EXPO_PUBLIC_OPENAI_API_KEY');
  if (openaiKey) {
    paid.push(new OpenAiTranslationProvider({ apiKey: openaiKey }));
  }
  const googleKey = pickKey(apiKeys.google, 'EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY');
  if (googleKey) {
    paid.push(new GoogleTranslateProvider({ apiKey: googleKey }));
  }
  // The free, keyless Google endpoint is always available. Place it after
  // paid providers (so a configured paid provider wins) but before the
  // deterministic Mock so the app produces real translations out of the box.
  const free: TranslationProvider = new GoogleTranslateFreeProvider();
  const ordered: TranslationProvider[] = [...paid, free];
  const preferredIx = ordered.findIndex((p) => p.id === preferred);
  if (preferredIx > 0) {
    const [picked] = ordered.splice(preferredIx, 1);
    ordered.unshift(picked!);
  }
  providers.push(...ordered);
  providers.push(new MockTranslationProvider());
  return providers;
}

function buildTtsProviders(preferred: TtsEngineId, apiKeys: RuntimeApiKeys): TtsProvider[] {
  const providers: TtsProvider[] = [];
  const cloud: TtsProvider[] = [];
  const azureKey = pickKey(apiKeys.azure, 'EXPO_PUBLIC_AZURE_TTS_KEY');
  if (azureKey) {
    cloud.push(
      new AzureTtsProvider({
        apiKey: azureKey,
        region:
          apiKeys.azureRegion ?? getEnv('EXPO_PUBLIC_AZURE_TTS_REGION') ?? 'westus',
      }),
    );
  }
  const googleKey = pickKey(apiKeys.google, 'EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY');
  if (googleKey) {
    cloud.push(new GoogleTtsProvider({ apiKey: googleKey }));
  }
  // Free, keyless, platform-aware fallbacks. Both providers self-disable
  // (`isAvailable() === false`) on platforms they don't support, so it's
  // safe to register them in any order; the TtsEngineRouter skips
  // unavailable providers automatically.
  const webSpeech: TtsProvider = new WebSpeechTtsProvider();
  const expoSpeech: TtsProvider = new ExpoSpeechTtsProvider();
  const ordered: TtsProvider[] = [...cloud, webSpeech, expoSpeech];
  const preferredIx = ordered.findIndex((p) => p.id === preferred);
  if (preferredIx > 0) {
    const [picked] = ordered.splice(preferredIx, 1);
    ordered.unshift(picked!);
  }
  providers.push(...ordered);
  providers.push(new MockTtsProvider());
  return providers;
}

export type { SessionStatus };
