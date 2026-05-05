import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../theme/colors';
import type { SessionStatus } from '../core/engine-router';

interface ConnectionStatusProps {
  status: SessionStatus;
  /** Engine display name (e.g. "Whisper + DeepL + Azure"). */
  engineSummary: string;
  /** Optional error message to surface beneath the status pill. */
  errorMessage: string | null;
}

const LABELS: Record<SessionStatus, string> = {
  idle: 'Idle',
  starting: 'Starting…',
  active: 'Listening',
  paused: 'Paused',
  stopping: 'Stopping…',
};

const COLOR_FOR_STATUS: Record<SessionStatus, string> = {
  idle: COLORS.textMuted,
  starting: COLORS.warning,
  active: COLORS.success,
  paused: COLORS.warning,
  stopping: COLORS.textMuted,
};

export function ConnectionStatus({ status, engineSummary, errorMessage }: ConnectionStatusProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: COLOR_FOR_STATUS[status] }]} />
        <Text style={styles.label}>{LABELS[status]}</Text>
        <Text style={styles.engine}>{engineSummary}</Text>
      </View>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  engine: { color: COLORS.textMuted, fontSize: 12, marginLeft: 8 },
  error: { color: COLORS.danger, fontSize: 12, marginTop: 4 },
});
