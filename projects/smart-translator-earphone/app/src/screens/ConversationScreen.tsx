import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ConnectionStatus } from '../components/ConnectionStatus';
import { TranscriptBubble } from '../components/TranscriptBubble';
import { WaveformIndicator } from '../components/WaveformIndicator';
import { sessionStore, useSessionStore } from '../state/useSessionStore';
import { COLORS } from '../theme/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

export function ConversationScreen({ navigation: _navigation }: Props) {
  const state = useSessionStore();

  useEffect(() => {
    if (state.mode !== 'conversation') sessionStore.setMode('conversation');
    return () => {
      void sessionStore.stopSession();
    };
  }, [state.mode]);

  const speakerAEntries = useMemo(
    () => state.entries.filter((e) => e.speakerId === 'A').slice(-12),
    [state.entries],
  );
  const speakerBEntries = useMemo(
    () => state.entries.filter((e) => e.speakerId === 'B').slice(-12),
    [state.entries],
  );

  const engineSummary = `${state.sttEngine} → ${state.translationEngine} → ${state.ttsEngine}`;
  const sessionActive = state.status === 'active' || state.status === 'starting';

  return (
    <View style={styles.container}>
      <ConnectionStatus status={state.status} engineSummary={engineSummary} errorMessage={state.errorMessage} />

      <View style={[styles.pane, styles.paneA]}>
        <View style={styles.paneHeader}>
          <Text style={[styles.paneTitle, { color: COLORS.speakerA }]}>Speaker A</Text>
          <Text style={styles.paneLang}>
            {state.sourceLang === 'auto' ? 'Auto-detect' : state.sourceLang.toUpperCase()} →{' '}
            {state.targetLang.toUpperCase()}
          </Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {speakerAEntries.length === 0 && <EmptyHint />}
          {speakerAEntries.map((entry) => (
            <TranscriptBubble key={entry.id} entry={entry} />
          ))}
        </ScrollView>
      </View>

      <View style={[styles.pane, styles.paneB]}>
        <View style={styles.paneHeader}>
          <Text style={[styles.paneTitle, { color: COLORS.speakerB }]}>Speaker B</Text>
          <Text style={styles.paneLang}>
            {state.targetLang.toUpperCase()} →{' '}
            {state.sourceLang === 'auto' ? 'Auto-detect' : state.sourceLang.toUpperCase()}
          </Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {speakerBEntries.length === 0 && <EmptyHint />}
          {speakerBEntries.map((entry) => (
            <TranscriptBubble key={entry.id} entry={entry} alignRight />
          ))}
        </ScrollView>
      </View>

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

function EmptyHint() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>
        Tap “Start Translation” and speak to begin. Transcripts and translations will appear here in real time.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  pane: { flex: 1, padding: 8 },
  paneA: { borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  paneB: {},
  paneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 },
  paneTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  paneLang: { color: COLORS.textMuted, fontSize: 12 },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 8, gap: 4 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
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
