/**
 * Environment-variable accessor.
 *
 * Expo bundles only EXPO_PUBLIC_* variables into the JS environment at build
 * time. We re-expose them through a typed accessor so the rest of the codebase
 * never reads `process.env.*` directly.
 *
 * The accessor uses `expo-constants` when available (so values flow from
 * app.json `extra` block too) but falls back to `process.env` for plain Node
 * test environments.
 */

let manifestExtra: Record<string, unknown> = {};
try {
  // expo-constants is only present in the Expo runtime; avoid breaking pure
  // Node tests by guarding the require.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Constants = require('expo-constants').default;
  manifestExtra = (Constants?.expoConfig?.extra ?? Constants?.manifest?.extra ?? {}) as Record<string, unknown>;
} catch {
  manifestExtra = {};
}

const NAMES = [
  'EXPO_PUBLIC_OPENAI_API_KEY',
  'EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY',
  'EXPO_PUBLIC_DEEPL_API_KEY',
  'EXPO_PUBLIC_AZURE_TTS_KEY',
  'EXPO_PUBLIC_AZURE_TTS_REGION',
  'EXPO_PUBLIC_DEFAULT_STT_ENGINE',
  'EXPO_PUBLIC_DEFAULT_TRANSLATION_ENGINE',
  'EXPO_PUBLIC_DEFAULT_TTS_ENGINE',
] as const;

export type EnvName = (typeof NAMES)[number];

export function getEnv(name: EnvName): string | undefined {
  const fromManifest = manifestExtra[name];
  if (typeof fromManifest === 'string' && fromManifest.length > 0) return fromManifest;
  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  return fromProcess && fromProcess.length > 0 ? fromProcess : undefined;
}

export function hasEnv(name: EnvName): boolean {
  return getEnv(name) !== undefined;
}
