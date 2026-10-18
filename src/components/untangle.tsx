import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radii, spacing } from '@/theme';

/** Colour for a 0–10 stress intensity: green → amber → red. */
export function intensityColor(value: number): string {
  if (value <= 3) return '#10B981';
  if (value <= 6) return '#F59E0B';
  return '#EF4444';
}

/** A 0–10 row of buttons for "How intense is it right now?". */
export function IntensityPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <View>
      <View style={styles.row}>
        {Array.from({ length: 11 }, (_, i) => {
          const active = value === i;
          return (
            <Pressable
              key={i}
              onPress={() => onChange(i)}
              accessibilityLabel={`Intensity ${i}`}
              style={[styles.dot, active && { backgroundColor: intensityColor(i), borderColor: intensityColor(i) }]}>
              <Text style={[styles.dotText, active && { color: colors.white }]}>{i}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>calm</Text>
        <Text style={styles.legendText}>overwhelming</Text>
      </View>
    </View>
  );
}

const INHALE_MS = 4000;
const EXHALE_MS = 6000;
const PAUSE_MS = 60_000;

/**
 * One minute of slow breathing before problem-solving: very high stress
 * makes clear thinking hard, so the flow calms the body first.
 */
export function BreathingPause({ onDone }: { onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [left, setLeft] = useState(PAUSE_MS / 1000);
  const native = Platform.OS !== 'web';

  useEffect(() => {
    let stopped = false;
    const cycle = () => {
      if (stopped) return;
      setPhase('in');
      Animated.timing(scale, { toValue: 1, duration: INHALE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: native }).start(() => {
        if (stopped) return;
        setPhase('out');
        Animated.timing(scale, { toValue: 0.6, duration: EXHALE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: native }).start(cycle);
      });
    };
    cycle();
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      stopped = true;
      clearInterval(timer);
      scale.stopAnimation();
    };
  }, []);

  return (
    <View style={styles.pause}>
      <Text style={styles.pauseTitle}>Let's slow down for a minute first</Text>
      <Text style={styles.pauseSub}>Breathe in as the circle grows, out as it shrinks.</Text>
      <View style={styles.circleBox}>
        <Animated.View style={[styles.circle, { transform: [{ scale }] }]}>
          <Text style={styles.circleText}>{phase === 'in' ? 'Breathe in' : 'Breathe out'}</Text>
        </Animated.View>
      </View>
      <Pressable style={styles.pauseBtn} onPress={onDone}>
        <Text style={styles.pauseBtnText}>{left > 0 ? `Continue (${left}s left)` : 'Continue'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 3 },
  dot: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { ...font.small, color: colors.text, fontWeight: '600' },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  legendText: { ...font.small, color: colors.textFaint },
  pause: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  pauseTitle: { ...font.h3, color: colors.text, textAlign: 'center' },
  pauseSub: { ...font.body, color: colors.textMuted, textAlign: 'center' },
  circleBox: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.lg },
  circle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: { ...font.title, color: '#3730A3' },
  pauseBtn: { backgroundColor: colors.purple, borderRadius: radii.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  pauseBtnText: { color: colors.white, fontWeight: '600', fontSize: 15 },
});
