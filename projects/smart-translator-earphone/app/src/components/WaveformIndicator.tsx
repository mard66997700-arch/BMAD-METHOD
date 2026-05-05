import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { COLORS } from '../theme/colors';

interface WaveformIndicatorProps {
  active: boolean;
  /** Number of bars to render. Defaults to 7. */
  bars?: number;
}

/**
 * Cheap animated waveform — renders N vertical bars with random heights that
 * pulse while `active` is true. We deliberately avoid wiring it to real audio
 * levels so the component remains platform-portable; the visual feedback
 * confirms the pipeline is running, not the actual loudness.
 */
export function WaveformIndicator({ active, bars = 7 }: WaveformIndicatorProps) {
  const animations = useRef<Animated.Value[]>(
    Array.from({ length: bars }, () => new Animated.Value(0.3)),
  ).current;
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!active) {
      for (const a of animations) a.setValue(0.3);
      setRunning(false);
      return;
    }
    setRunning(true);
    const loops = animations.map((value, ix) => {
      const animateOnce = () => {
        Animated.sequence([
          Animated.timing(value, {
            toValue: 0.3 + Math.random() * 0.7,
            duration: 250 + ix * 30,
            useNativeDriver: false,
          }),
          Animated.timing(value, {
            toValue: 0.3,
            duration: 250 + ix * 30,
            useNativeDriver: false,
          }),
        ]).start(({ finished }) => {
          if (finished) animateOnce();
        });
      };
      animateOnce();
      return value;
    });
    return () => {
      for (const v of loops) v.stopAnimation();
    };
  }, [active, animations]);

  return (
    <View style={styles.row}>
      {animations.map((value, ix) => (
        <Animated.View
          key={ix}
          style={[
            styles.bar,
            {
              transform: [{ scaleY: value }],
              backgroundColor: running ? COLORS.primary : COLORS.surfaceMuted,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', height: 36 },
  bar: { width: 4, height: 28, borderRadius: 2 },
});
