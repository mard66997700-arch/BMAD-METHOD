/**
 * Native STT provider for iOS and Android via the
 * `expo-speech-recognition` package, which wraps Apple's
 * `SFSpeechRecognizer` and Android's `SpeechRecognizer`.
 *
 * The package ships a `ExpoWebSpeechRecognition` class that mirrors the
 * browser's `SpeechRecognition` Web API exactly, so we hand it straight
 * to our existing `WebSpeechSttSession` and only own (a) platform
 * gating via `isAvailable()` and (b) the engine id used by the router.
 *
 * Free / keyless on every device that bundles native speech recognition
 * (iOS 10+, Android with Google or Samsung speech services).
 */

import { Platform } from 'react-native';

import type {
  SttProvider,
  SttSession,
  SttSessionOptions,
} from './stt-types';
import {
  WebSpeechSttSession,
  type SpeechRecognitionCtor,
} from './web-speech-stt-provider';

interface ExpoSpeechRecognitionModuleLike {
  ExpoWebSpeechRecognition: SpeechRecognitionCtor;
}

function loadCtor(): SpeechRecognitionCtor | null {
  try {
    // require() (not import) so jest can swap the module for a noop
    // mock without pulling the native bridge into Node.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod: ExpoSpeechRecognitionModuleLike = require('expo-speech-recognition');
    return mod.ExpoWebSpeechRecognition ?? null;
  } catch {
    return null;
  }
}

export interface ExpoSpeechRecognitionOptions {
  /** Inject a constructor for tests / non-native hosts. */
  ctor?: SpeechRecognitionCtor;
}

export class ExpoSpeechRecognitionProvider implements SttProvider {
  readonly id = 'expo-speech-recognition' as const;

  constructor(private readonly opts: ExpoSpeechRecognitionOptions = {}) {}

  isAvailable(): boolean {
    if (this.opts.ctor) return true;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
    return loadCtor() !== null;
  }

  async createSession(options: SttSessionOptions): Promise<SttSession> {
    if (!this.isAvailable()) {
      throw new Error('expo-speech-recognition is not available on this platform');
    }
    const ctor = this.opts.ctor ?? loadCtor();
    if (!ctor) {
      throw new Error('expo-speech-recognition native module failed to load');
    }
    return new WebSpeechSttSession(ctor, options);
  }
}
