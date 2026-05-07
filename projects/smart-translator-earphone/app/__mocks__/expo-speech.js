// Node-side mock for expo-speech. The real module is a native bridge that
// only resolves inside an iOS/Android runtime; node tests need a no-op
// surface that records calls.
module.exports = {
  speak: jest.fn((_text, options) => {
    if (options && typeof options.onDone === 'function') {
      setImmediate(options.onDone);
    }
  }),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(async () => false),
};
