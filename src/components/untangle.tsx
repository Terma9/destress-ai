import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, font, fontFamily, radii, spacing } from '@/theme';

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

const STRESS_COLORS = ['#6F9764', '#E8A55B', '#C9663F'];
const STRESS_WORDS = ['Calm', 'Calm', 'Calm', 'A bit tense', 'A bit tense', 'Stressed', 'Stressed', 'Very stressed', 'Very stressed', 'Overwhelmed', 'Overwhelmed'];
const THUMB = 30;

/**
 * A 0–10 slider for "How stressed are you?". Above it an orb that changes
 * colour and pulses faster the higher the stress, like a heartbeat.
 */
export function StressSlider({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const track = useRef<View>(null);
  const box = useRef({ x: 0, width: 1 });
  const width = useSharedValue(1);
  const pos = useSharedValue(value ?? 5);
  const pulse = useSharedValue(1);
  const last = useRef(value);
  const change = useRef(onChange);
  change.current = onChange;

  const measure = () =>
    track.current?.measureInWindow((x, _y, w) => {
      box.current = { x, width: Math.max(1, w) };
    });

  const set = (v: number) => {
    if (v === last.current) return;
    last.current = v;
    change.current(v);
  };

  const responder = useMemo(() => {
    const move = (pageX: number) => {
      const { x, width: w } = box.current;
      const raw = Math.min(10, Math.max(0, ((pageX - x - THUMB / 2) / (w - THUMB)) * 10));
      pos.value = raw;
      set(Math.round(raw));
    };
    const settle = () => {
      pos.value = withSpring(last.current ?? 5, { damping: 18, stiffness: 220 });
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        measure();
        move(e.nativeEvent.pageX);
      },
      onPanResponderMove: (e) => move(e.nativeEvent.pageX),
      onPanResponderRelease: settle,
      onPanResponderTerminate: settle,
    });
  }, []);

  // Calm: a slow, small pulse. Stressed: faster and bigger.
  useEffect(() => {
    if (value === null) return;
    const half = (1700 - value * 110) / 2;
    const grow = 1.05 + value * 0.012;
    pulse.value = withRepeat(withSequence(withTiming(grow, { duration: half }), withTiming(1, { duration: half })), -1);
  }, [value]);

  const tint = () => {
    'worklet';
    return interpolateColor(pos.value, [0, 5, 10], STRESS_COLORS);
  };
  const orbStyle = useAnimatedStyle(() => ({ backgroundColor: tint(), transform: [{ scale: pulse.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ backgroundColor: tint(), transform: [{ scale: pulse.value * 1.25 }] }));
  const fillStyle = useAnimatedStyle(() => ({ backgroundColor: tint(), width: (pos.value / 10) * (width.value - THUMB) + THUMB / 2 }));
  const thumbStyle = useAnimatedStyle(() => ({ borderColor: tint(), left: (pos.value / 10) * (width.value - THUMB) }));

  const step = (d: number) => {
    const v = Math.min(10, Math.max(0, (last.current ?? 5) + d));
    pos.value = withSpring(v, { damping: 18, stiffness: 220 });
    set(v);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={styles.orbBox}>
        <Reanimated.View style={[styles.halo, haloStyle, { opacity: value === null ? 0 : 0.18 }]} />
        <Reanimated.View style={[styles.orb, orbStyle, value === null && { opacity: 0.35 }]}>
          <Text style={styles.orbNumber}>{value ?? '?'}</Text>
        </Reanimated.View>
      </View>
      <Text style={styles.stressWord}>{value === null ? 'Slide to choose' : STRESS_WORDS[value]}</Text>

      <View
        ref={track}
        onLayout={(e) => {
          width.value = e.nativeEvent.layout.width;
          measure();
        }}
        style={styles.slider}
        accessibilityRole="adjustable"
        accessibilityLabel="Stress from 0 to 10"
        accessibilityValue={{ min: 0, max: 10, now: value ?? undefined }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        {...responder.panHandlers}>
        <View style={styles.rail} pointerEvents="none">
          <Reanimated.View style={[styles.fill, fillStyle, value === null && { opacity: 0 }]} />
        </View>
        <Reanimated.View style={[styles.thumb, thumbStyle]} pointerEvents="none" />
      </View>
      <View style={[styles.legend, { alignSelf: 'stretch' }]}>
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
      <Text style={styles.pauseTitle}>Breathe with the circle</Text>
      <Text style={styles.pauseSub}>In as it grows, out as it shrinks. One minute is enough.</Text>
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
  orbBox: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 84, height: 84, borderRadius: 42 },
  orb: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  orbNumber: { fontFamily: fontFamily.bold, fontSize: 32, color: colors.white },
  stressWord: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.inkSoft, marginTop: spacing.xs, marginBottom: spacing.md },
  slider: { alignSelf: 'stretch', height: 44, justifyContent: 'center', cursor: 'pointer' } as object,
  rail: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
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
