// Lightweight node-side mock for react-native used by core unit tests. The
// real `react-native` package only loads inside the Metro bundler, so any
// core module that imports `Platform` from it would otherwise crash jest.
module.exports = {
  Platform: {
    OS: 'web',
    select: (spec) => (spec && (spec.web ?? spec.default)) ?? undefined,
  },
};
