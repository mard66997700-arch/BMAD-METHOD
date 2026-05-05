import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../theme/colors';
import type { TranscriptEntry } from '../state/SessionStore';

interface TranscriptBubbleProps {
  entry: TranscriptEntry;
  /** When true, render the bubble aligned right (used for Speaker B). */
  alignRight?: boolean;
  /** When true, hide the speaker label (used in Lecture mode). */
  hideSpeaker?: boolean;
}

export function TranscriptBubble({ entry, alignRight, hideSpeaker }: TranscriptBubbleProps) {
  const speakerColor = entry.speakerId === 'A' ? COLORS.speakerA : COLORS.speakerB;
  return (
    <View style={[styles.row, alignRight && styles.rowRight]}>
      <View style={[styles.bubble, alignRight && styles.bubbleRight]}>
        {!hideSpeaker && (
          <Text style={[styles.speaker, { color: speakerColor }]}>Speaker {entry.speakerId}</Text>
        )}
        <Text style={styles.transcript}>{entry.text || '…'}</Text>
        {entry.translation.length > 0 && (
          <View style={styles.translationContainer}>
            <Text style={styles.translation}>{entry.translation}</Text>
          </View>
        )}
        <View style={styles.footer}>
          {entry.detectedLang && <Text style={styles.meta}>{entry.detectedLang.toUpperCase()}</Text>}
          <Text style={styles.meta}>{entry.status}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 6 },
  rowRight: { alignItems: 'flex-end' },
  bubble: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    maxWidth: '92%',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.speakerA,
  },
  bubbleRight: {
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderRightColor: COLORS.speakerB,
  },
  speaker: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  transcript: { color: COLORS.text, fontSize: 16, lineHeight: 22 },
  translationContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  translation: { color: COLORS.primary, fontSize: 16, lineHeight: 22, fontStyle: 'italic' },
  footer: { flexDirection: 'row', gap: 12, marginTop: 6 },
  meta: { color: COLORS.textMuted, fontSize: 11, letterSpacing: 1 },
});
