import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { hasEnv } from '../config/env';
import { sessionStore, useSessionStore } from '../state/useSessionStore';
import type { ApiKeyProvider } from '../state/SessionStore';
import type { SttEngineId } from '../core/stt/stt-types';
import type { TranslationEngineId } from '../core/translation/translation-types';
import type { TtsEngineId } from '../core/tts/tts-types';
import { withGender, withPitch, withSpeed, type VoiceGender } from '../core/tts/voice-settings';
import { COLORS } from '../theme/colors';

/**
 * Friendly Translation Service options surfaced to end-users. Each entry
 * picks the matching STT/TTS engine pair so the user only chooses one
 * thing. `apiKeyProvider` indicates which runtime key, if any, this
 * service requires (the input field is hidden when undefined).
 */
const TRANSLATION_OPTIONS: Array<{
  id: TranslationEngineId;
  label: string;
  description: string;
  apiKeyProvider?: ApiKeyProvider;
  apiKeyHint?: string;
  stt: SttEngineId;
  tts: TtsEngineId;
}> = [
  {
    id: 'google-free',
    label: 'Free (Google Translate)',
    description:
      'No key required. Browser Web Speech for STT + TTS, free Google endpoint for translation. Web only, rate limited.',
    stt: 'web-speech',
    tts: 'web-speech',
  },
  {
    id: 'google',
    label: 'Google Cloud',
    description: 'STT + Translation + TTS via Google Cloud (single key).',
    apiKeyProvider: 'google',
    apiKeyHint: 'Google Cloud API key (Translation, Speech, Text-to-Speech)',
    stt: 'google',
    tts: 'google',
  },
  {
    id: 'deepl',
    label: 'DeepL',
    description: 'High-quality translation. Pairs with browser Web Speech for STT + TTS.',
    apiKeyProvider: 'deepl',
    apiKeyHint: 'DeepL API auth key',
    stt: 'web-speech',
    tts: 'web-speech',
  },
  {
    id: 'openai',
    label: 'OpenAI GPT-4',
    description: 'Context-aware translation + Whisper STT. Browser Web Speech for TTS.',
    apiKeyProvider: 'openai',
    apiKeyHint: 'OpenAI API key (sk-…)',
    stt: 'whisper-cloud',
    tts: 'web-speech',
  },
  {
    id: 'mock',
    label: 'Demo Mode',
    description: 'Deterministic fake translations — no network required.',
    stt: 'mock',
    tts: 'mock',
  },
];

const STT_OPTIONS: Array<{ id: SttEngineId; label: string; envVar?: string }> = [
  { id: 'mock', label: 'Mock (demo)' },
  { id: 'web-speech', label: 'Browser Web Speech (free, web only)' },
  { id: 'whisper-cloud', label: 'OpenAI Whisper', envVar: 'EXPO_PUBLIC_OPENAI_API_KEY' },
  { id: 'google', label: 'Google Cloud STT', envVar: 'EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY' },
];
const TTS_OPTIONS: Array<{ id: TtsEngineId; label: string; envVar?: string }> = [
  { id: 'mock', label: 'Mock (demo)' },
  { id: 'web-speech', label: 'Browser Web Speech (free, web only)' },
  { id: 'azure', label: 'Azure Neural TTS', envVar: 'EXPO_PUBLIC_AZURE_TTS_KEY' },
  { id: 'google', label: 'Google Cloud TTS', envVar: 'EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY' },
];

type EnvKey =
  | 'EXPO_PUBLIC_OPENAI_API_KEY'
  | 'EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY'
  | 'EXPO_PUBLIC_DEEPL_API_KEY'
  | 'EXPO_PUBLIC_AZURE_TTS_KEY';

export function SettingsScreen() {
  const state = useSessionStore();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const currentService = useMemo(
    () =>
      TRANSLATION_OPTIONS.find((opt) => opt.id === state.translationEngine) ??
      TRANSLATION_OPTIONS[0]!,
    [state.translationEngine],
  );
  const apiKeyValue = currentService.apiKeyProvider
    ? state.apiKeys[currentService.apiKeyProvider] ?? ''
    : '';

  const onSelectService = (opt: (typeof TRANSLATION_OPTIONS)[number]) => {
    sessionStore.setTranslationEngine(opt.id);
    // Auto-pair STT/TTS so end-users don't have to think about them.
    sessionStore.setSttEngine(opt.stt);
    sessionStore.setTtsEngine(opt.tts);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Translation Service">
        <Text style={styles.help}>
          Pick how the app translates. The free option works without any setup; paid options need
          an API key.
        </Text>
        {TRANSLATION_OPTIONS.map((opt) => (
          <ServiceRow
            key={opt.id}
            label={opt.label}
            description={opt.description}
            active={state.translationEngine === opt.id}
            onPress={() => onSelectService(opt)}
          />
        ))}

        {currentService.apiKeyProvider && (
          <View style={styles.apiKeyBlock}>
            <Text style={styles.label}>API key for {currentService.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={currentService.apiKeyHint ?? 'Paste API key here'}
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={apiKeyValue}
              onChangeText={(v) =>
                sessionStore.setApiKey(currentService.apiKeyProvider!, v)
              }
            />
            <Text style={styles.helpSmall}>
              Stored in memory only. Cleared when the app reloads.
            </Text>
          </View>
        )}
      </Section>

      <Section title="Voice">
        <Text style={styles.label}>Gender</Text>
        <View style={styles.row}>
          {(['female', 'male', 'neutral'] as VoiceGender[]).map((g) => (
            <Pressable
              key={g}
              style={[styles.pill, state.voice.gender === g && styles.pillActive]}
              onPress={() => sessionStore.setVoice(withGender(state.voice, g))}
            >
              <Text style={styles.pillText}>{g}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Speed: {state.voice.speed.toFixed(2)}x</Text>
        <View style={styles.row}>
          <SmallButton label="−" onPress={() => sessionStore.setVoice(withSpeed(state.voice, state.voice.speed - 0.1))} />
          <SmallButton label="Reset" onPress={() => sessionStore.setVoice(withSpeed(state.voice, 1))} />
          <SmallButton label="+" onPress={() => sessionStore.setVoice(withSpeed(state.voice, state.voice.speed + 0.1))} />
        </View>
        <Text style={styles.label}>Pitch: {state.voice.pitch}st</Text>
        <View style={styles.row}>
          <SmallButton label="−" onPress={() => sessionStore.setVoice(withPitch(state.voice, state.voice.pitch - 1))} />
          <SmallButton label="Reset" onPress={() => sessionStore.setVoice(withPitch(state.voice, 0))} />
          <SmallButton label="+" onPress={() => sessionStore.setVoice(withPitch(state.voice, state.voice.pitch + 1))} />
        </View>
      </Section>

      <Section title="Output">
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Speak translations through earphones</Text>
          <Switch
            value={state.speakOutput}
            onValueChange={(v) => sessionStore.setSpeakOutput(v)}
            trackColor={{ false: COLORS.surfaceMuted, true: COLORS.primaryDark }}
            thumbColor={state.speakOutput ? COLORS.primary : COLORS.surface}
          />
        </View>
      </Section>

      <Pressable
        style={styles.advancedHeader}
        onPress={() => setAdvancedOpen((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.advancedHeaderText}>
          {advancedOpen ? '▾' : '▸'} Advanced
        </Text>
      </Pressable>

      {advancedOpen && (
        <>
          <Section title="Speech-to-Text Engine">
            {STT_OPTIONS.map((opt) => (
              <EngineRow
                key={opt.id}
                label={opt.label}
                envVar={opt.envVar}
                active={state.sttEngine === opt.id}
                onPress={() => sessionStore.setSttEngine(opt.id)}
              />
            ))}
          </Section>
          <Section title="Text-to-Speech Engine">
            {TTS_OPTIONS.map((opt) => (
              <EngineRow
                key={opt.id}
                label={opt.label}
                envVar={opt.envVar}
                active={state.ttsEngine === opt.id}
                onPress={() => sessionStore.setTtsEngine(opt.id)}
              />
            ))}
          </Section>
          <Section title="Build-time API key status">
            <Text style={styles.help}>
              These show which EXPO_PUBLIC_* env vars were baked in at build time. Runtime keys
              entered above always take precedence.
            </Text>
            <KeyStatus name="EXPO_PUBLIC_OPENAI_API_KEY" />
            <KeyStatus name="EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY" />
            <KeyStatus name="EXPO_PUBLIC_DEEPL_API_KEY" />
            <KeyStatus name="EXPO_PUBLIC_AZURE_TTS_KEY" />
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ServiceRow({
  label,
  description,
  active,
  onPress,
}: {
  label: string;
  description: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.serviceRow, active && styles.engineRowActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <View style={styles.serviceRowText}>
        <Text style={styles.engineLabel}>{label}</Text>
        <Text style={styles.serviceDesc}>{description}</Text>
      </View>
      {active && <Text style={styles.engineActive}>Active</Text>}
    </Pressable>
  );
}

function EngineRow({
  label,
  envVar,
  active,
  onPress,
}: {
  label: string;
  envVar?: string;
  active: boolean;
  onPress: () => void;
}) {
  const available = !envVar || hasEnv(envVar as EnvKey);
  return (
    <Pressable
      style={[styles.engineRow, active && styles.engineRowActive, !available && styles.engineRowDisabled]}
      onPress={onPress}
    >
      <Text style={styles.engineLabel}>{label}</Text>
      {!available && <Text style={styles.engineMissing}>API key missing</Text>}
      {active && <Text style={styles.engineActive}>Active</Text>}
    </Pressable>
  );
}

function KeyStatus({ name }: { name: EnvKey }) {
  const present = hasEnv(name);
  return (
    <View style={styles.keyRow}>
      <Text style={styles.keyName}>{name}</Text>
      <Text style={[styles.keyStatus, { color: present ? COLORS.success : COLORS.warning }]}>
        {present ? 'set' : 'missing'}
      </Text>
    </View>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.smallButton} onPress={onPress}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 24 },
  section: { gap: 8 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  engineRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  serviceRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: COLORS.border,
    borderWidth: 1,
    gap: 12,
  },
  serviceRowText: { flex: 1 },
  serviceDesc: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  engineRowActive: { borderColor: COLORS.primary },
  engineRowDisabled: { opacity: 0.6 },
  engineLabel: { color: COLORS.text, fontSize: 15 },
  engineActive: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  engineMissing: { color: COLORS.warning, fontSize: 11 },
  label: { color: COLORS.textMuted, fontSize: 12, marginTop: 8 },
  apiKeyBlock: { gap: 6, marginTop: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  helpSmall: { color: COLORS.textMuted, fontSize: 11 },
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  pillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryDark },
  pillText: { color: COLORS.text, fontSize: 14, textTransform: 'capitalize' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 12,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  toggleLabel: { color: COLORS.text, fontSize: 14, flex: 1, marginRight: 12 },
  help: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  keyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  keyName: { color: COLORS.text, fontSize: 12 },
  keyStatus: { fontSize: 12, fontWeight: '700' },
  smallButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  smallButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  advancedHeader: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  advancedHeaderText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
