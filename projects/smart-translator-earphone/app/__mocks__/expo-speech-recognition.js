// Node-side mock for expo-speech-recognition. The real module is a native
// bridge; tests only need a constructor with the SpeechRecognition shape.
class FakeRecognition {
  constructor() {
    this.lang = '';
    this.continuous = false;
    this.interimResults = false;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
  }
  start() {
    /* noop */
  }
  stop() {
    /* noop */
  }
  abort() {
    /* noop */
  }
}

module.exports = {
  ExpoWebSpeechRecognition: FakeRecognition,
  ExpoSpeechRecognitionModule: {},
  useSpeechRecognitionEvent: () => undefined,
};
