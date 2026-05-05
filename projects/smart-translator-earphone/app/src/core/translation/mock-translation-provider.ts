/**
 * Mock translation provider — produces deterministic placeholder translations
 * so the rest of the pipeline (TTS, UI) can be exercised end-to-end without
 * any cloud credentials. Used by demo mode.
 *
 * Strategy: append a `[<targetLang>]` tag and reverse-lookup a small dictionary
 * of common phrases. Anything not in the dictionary is wrapped as
 * `<lang>: <original>`.
 */

import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from './translation-types';

interface PhraseMap {
  [src: string]: { [lang: string]: string };
}

const PHRASES: PhraseMap = {
  'hello, how are you today?': {
    es: 'Hola, ¿cómo estás hoy?',
    fr: 'Bonjour, comment allez-vous aujourd\'hui ?',
    de: 'Hallo, wie geht es dir heute?',
    ja: 'こんにちは、今日はお元気ですか？',
  },
  'thank you very much.': {
    es: 'Muchas gracias.',
    fr: 'Merci beaucoup.',
    de: 'Vielen Dank.',
    ja: 'どうもありがとうございました。',
  },
  'i would like a coffee, please.': {
    es: 'Me gustaría un café, por favor.',
    fr: 'Je voudrais un café, s\'il vous plaît.',
    de: 'Ich hätte gern einen Kaffee, bitte.',
    ja: 'コーヒーをお願いします。',
  },
  'where is the nearest train station?': {
    es: '¿Dónde está la estación de tren más cercana?',
    fr: 'Où est la gare la plus proche ?',
    de: 'Wo ist der nächste Bahnhof?',
    ja: '一番近い駅はどこですか？',
  },
  'how much does this cost?': {
    es: '¿Cuánto cuesta esto?',
    fr: 'Combien ça coûte ?',
    de: 'Wie viel kostet das?',
    ja: 'これはいくらですか？',
  },
};

export class MockTranslationProvider implements TranslationProvider {
  readonly id = 'mock' as const;

  isAvailable(): boolean {
    return true;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const text = lookup(request.text, request.targetLang);
    return {
      text,
      sourceLang: request.sourceLang === 'auto' ? 'en' : request.sourceLang,
      targetLang: request.targetLang,
      confidence: 1,
      engine: 'mock',
    };
  }

  async *translateStream(request: TranslationRequest): AsyncIterable<string> {
    const full = lookup(request.text, request.targetLang);
    const words = full.split(/(\s+)/);
    let acc = '';
    for (const w of words) {
      acc += w;
      yield acc;
    }
  }
}

function lookup(text: string, lang: string): string {
  const key = text.trim().toLowerCase();
  const direct = PHRASES[key]?.[lang];
  if (direct) return direct;
  // Fall back to a clear "translated" tag so the demo UI is obviously demo.
  return `[${lang}] ${text}`;
}
