// Metro config for Expo. The default config is sufficient for our use case;
// we re-export it here so future sprints can extend it (e.g. asset extensions,
// resolver aliases).

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
