import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { hasEnv } from '../config/env';
import { sessionStore, useSessionStore } from '../state/useSessionStore';
import type { SttEngineId } from '../core/stt/stt-types';
import type { TranslationEngineId } from '../core/translation/translation-types';
import type { TtsEngineId } from '../core/tts/tts-types';
import { withGender, withPitch, withSpeed, type VoiceGender } from '../core/tts/voice-settings';
import { COLORS } from '../theme/colors';

const STT_OPTIONS: Array<{ id: SttEngineId; label: string; envVar?: string }> = [
  { id: 'mock', label: 'Mock (demo)' },
  { id: 'whisper-cloud', label: 'OpenAI Whisper', envVar: 'EXPO_PUBLIC_OPENAI_API_KEY' },
  { id: 'google', label: 'Google Cloud STT', envVar: 'EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY' },
];
const TRANSLATION_OPTIONS: Array<{ id: TranslationEngineId; label: string; envVar?: string }> = [
  { id: 'mock', label: 'Mock (demo)' },
  { id: 'deepl', label: 'DeepL', envVar: 'EXPO_PUBLIC_DEEPL_API_KEY' },
  { id: 'openai', label: 'OpenAI GPT-4', envVar: 'EXPO_PUBLIC_OPENAI_API_KEY' },
  { id: 'google', label: 'Google Translate', envVar: 'EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY' },
];
const TTS_OPTIONS: Array<{ id: TtsEngineId; label: string; envVar?: string }> = [
  { id: 'mock', label: 'Mock (demo)' },
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
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      <Section title="Translation Engine">
        {TRANSLATION_OPTIONS.map((opt) => (
          <EngineRow
            key={opt.id}
            label={opt.label}
            envVar={opt.envVar}
            active={state.translationEngine === opt.id}
            onPress={() => sessionStore.setTranslationEngine(opt.id)}
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

      <Section title="API keys">
        <Text style={styles.help}>
          API keys are read at build time from EXPO_PUBLIC_* environment variables. To configure, copy
          .env.example to .env in the app folder and rebuild.
        </Text>
        <KeyStatus name="EXPO_PUBLIC_OPENAI_API_KEY" />
        <KeyStatus name="EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY" />
        <KeyStatus name="EXPO_PUBLIC_DEEPL_API_KEY" />
        <KeyStatus name="EXPO_PUBLIC_AZURE_TTS_KEY" />
      </Section>
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
  engineRowActive: { borderColor: COLORS.primary },
  engineRowDisabled: { opacity: 0.6 },
  engineLabel: { color: COLORS.text, fontSize: 15 },
  engineActive: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  engineMissing: { color: COLORS.warning, fontSize: 11 },
  label: { color: COLORS.textMuted, fontSize: 12, marginTop: 8 },
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
});
