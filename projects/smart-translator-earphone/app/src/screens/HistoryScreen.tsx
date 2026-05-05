import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { sessionStore, useSessionStore } from '../state/useSessionStore';
import { COLORS } from '../theme/colors';

export function HistoryScreen() {
  const state = useSessionStore();
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {state.history.length === 0 && (
          <Text style={styles.empty}>No past sessions yet. Run a translation to see it appear here.</Text>
        )}
        {state.history.map((session) => (
          <View key={session.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.title}>
                {session.sourceLang.toUpperCase()} → {session.targetLang.toUpperCase()}
              </Text>
              <Text style={styles.tag}>{session.mode}</Text>
            </View>
            <Text style={styles.preview}>{session.preview || '(no transcript)'}</Text>
            <Text style={styles.meta}>
              {new Date(session.startedAt).toLocaleString()} · {session.entryCount} entries ·{' '}
              {Math.round((session.endedAt - session.startedAt) / 1000)}s
            </Text>
          </View>
        ))}
      </ScrollView>
      {state.history.length > 0 && (
        <Pressable style={styles.clearButton} onPress={() => sessionStore.clearHistory()}>
          <Text style={styles.clearButtonText}>Clear history</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  empty: { color: COLORS.textMuted, padding: 24, fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: COLORS.text, fontWeight: '700', fontSize: 16 },
  tag: { color: COLORS.primary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  preview: { color: COLORS.textMuted, fontSize: 14 },
  meta: { color: COLORS.textMuted, fontSize: 11 },
  clearButton: {
    backgroundColor: COLORS.surfaceMuted,
    margin: 16,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearButtonText: { color: COLORS.text, fontSize: 14 },
});
