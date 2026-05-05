import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ConnectionStatus } from '../components/ConnectionStatus';
import { WaveformIndicator } from '../components/WaveformIndicator';
import { sessionStore, useSessionStore } from '../state/useSessionStore';
import { COLORS } from '../theme/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Lecture'>;

export function LectureScreen({ navigation: _navigation }: Props) {
  const state = useSessionStore();

  useEffect(() => {
    if (state.mode !== 'lecture') sessionStore.setMode('lecture');
    return () => {
      void sessionStore.stopSession();
    };
  }, [state.mode]);

  const sessionActive = state.status === 'active' || state.status === 'starting';
  const engineSummary = `${state.sttEngine} → ${state.translationEngine} (no playback)`;

  return (
    <View style={styles.container}>
      <ConnectionStatus status={state.status} engineSummary={engineSummary} errorMessage={state.errorMessage} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {state.entries.length === 0 && (
          <Text style={styles.emptyText}>
            Lecture mode: speech is transcribed and translated silently. Start translation to begin.
          </Text>
        )}
        {state.entries.map((entry) => (
          <View key={entry.id} style={styles.row}>
            <Text style={styles.transcript}>{entry.text}</Text>
            {entry.translation.length > 0 && <Text style={styles.translation}>{entry.translation}</Text>}
            <View style={styles.metaRow}>
              {entry.detectedLang && <Text style={styles.meta}>{entry.detectedLang.toUpperCase()}</Text>}
              <Text style={styles.meta}>{entry.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <WaveformIndicator active={sessionActive} />
        <Pressable
          style={[styles.controlButton, sessionActive ? styles.stopButton : styles.startButton]}
          onPress={() => {
            if (sessionActive) void sessionStore.stopSession();
            else void sessionStore.startSession();
          }}
        >
          <Text style={styles.controlButtonText}>{sessionActive ? 'Stop' : 'Start Translation'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  emptyText: { color: COLORS.textMuted, padding: 24, fontSize: 14, textAlign: 'center' },
  row: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  transcript: { color: COLORS.text, fontSize: 16, lineHeight: 22 },
  translation: { color: COLORS.primary, fontSize: 16, lineHeight: 22, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
  meta: { color: COLORS.textMuted, fontSize: 11, letterSpacing: 1 },
  controls: {
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
  },
  controlButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  startButton: { backgroundColor: COLORS.primary },
  stopButton: { backgroundColor: COLORS.danger },
  controlButtonText: { color: '#0c1424', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
});
