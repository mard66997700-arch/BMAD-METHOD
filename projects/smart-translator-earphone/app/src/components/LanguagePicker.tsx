import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DEFAULT_CONFIG } from '../config/default-config';
import { COLORS } from '../theme/colors';

interface LanguagePickerProps {
  label: string;
  value: string | 'auto';
  onChange: (lang: string | 'auto') => void;
  /** If true, prepend the special "Auto" entry. Used for source-lang only. */
  includeAuto?: boolean;
}

export function LanguagePicker({ label, value, onChange, includeAuto }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const items: Array<{ code: string; label: string }> = [
    ...(includeAuto ? [{ code: 'auto', label: 'Auto-detect' }] : []),
    ...DEFAULT_CONFIG.supportedLanguages,
  ];
  const current = items.find((i) => i.code === value)?.label ?? value;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.button}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
      >
        <Text style={styles.buttonText}>{current}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView style={styles.list}>
              {items.map((item) => {
                const selected = item.code === value;
                return (
                  <Pressable
                    key={item.code}
                    style={[styles.item, selected && styles.itemSelected]}
                    onPress={() => {
                      onChange(item.code === 'auto' ? 'auto' : item.code);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.itemText, selected && styles.itemTextSelected]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  label: { color: COLORS.textMuted, fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  button: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonText: { color: COLORS.text, fontSize: 16, fontWeight: '500' },
  chevron: { color: COLORS.textMuted, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
  },
  sheetTitle: { color: COLORS.text, fontSize: 18, fontWeight: '600', marginBottom: 12 },
  list: { maxHeight: 320 },
  item: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  itemSelected: { backgroundColor: COLORS.primaryDark },
  itemText: { color: COLORS.text, fontSize: 16 },
  itemTextSelected: { color: '#ffffff', fontWeight: '600' },
});
