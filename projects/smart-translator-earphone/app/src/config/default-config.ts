/**
 * Compile-time defaults for the app. Anything here is what the app falls back
 * to when no environment variable or user setting overrides it.
 */

import { getEnv } from './env';
import type { SttEngineId } from '../core/stt/stt-types';
import type { TranslationEngineId } from '../core/translation/translation-types';
import type { TtsEngineId } from '../core/tts/tts-types';

export interface AppConfig {
  defaultSttEngine: SttEngineId;
  defaultTranslationEngine: TranslationEngineId;
  defaultTtsEngine: TtsEngineId;
  defaultSourceLang: string;
  defaultTargetLang: string;
  /** Available languages in the language picker. ISO-639-1 codes. */
  supportedLanguages: ReadonlyArray<{ code: string; label: string }>;
}

const STT_ENGINES: ReadonlySet<SttEngineId> = new Set([
  'mock',
  'whisper-cloud',
  'google',
  'web-speech',
] as const);
const TRANSLATION_ENGINES: ReadonlySet<TranslationEngineId> = new Set([
  'mock',
  'deepl',
  'openai',
  'google',
  'google-free',
] as const);
const TTS_ENGINES: ReadonlySet<TtsEngineId> = new Set([
  'mock',
  'azure',
  'google',
  'web-speech',
] as const);

function pickStt(raw: string | undefined): SttEngineId {
  return raw && STT_ENGINES.has(raw as SttEngineId) ? (raw as SttEngineId) : 'web-speech';
}
function pickTranslation(raw: string | undefined): TranslationEngineId {
  return raw && TRANSLATION_ENGINES.has(raw as TranslationEngineId)
    ? (raw as TranslationEngineId)
    : 'google-free';
}
function pickTts(raw: string | undefined): TtsEngineId {
  return raw && TTS_ENGINES.has(raw as TtsEngineId) ? (raw as TtsEngineId) : 'web-speech';
}

export const DEFAULT_CONFIG: AppConfig = {
  defaultSttEngine: pickStt(getEnv('EXPO_PUBLIC_DEFAULT_STT_ENGINE')),
  defaultTranslationEngine: pickTranslation(getEnv('EXPO_PUBLIC_DEFAULT_TRANSLATION_ENGINE')),
  defaultTtsEngine: pickTts(getEnv('EXPO_PUBLIC_DEFAULT_TTS_ENGINE')),
  defaultSourceLang: 'en',
  defaultTargetLang: 'es',
  supportedLanguages: [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'it', label: 'Italian' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'nl', label: 'Dutch' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
    { code: 'zh', label: 'Chinese (Mandarin)' },
    { code: 'ar', label: 'Arabic' },
    { code: 'hi', label: 'Hindi' },
    { code: 'ru', label: 'Russian' },
    { code: 'tr', label: 'Turkish' },
    { code: 'pl', label: 'Polish' },
    { code: 'vi', label: 'Vietnamese' },
    { code: 'th', label: 'Thai' },
    { code: 'id', label: 'Indonesian' },
  ],
};
