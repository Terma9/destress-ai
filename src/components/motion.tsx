/**
 * Small motion building blocks. Calm and short on purpose: entrances that
 * fade up, a soft spring when pressing, numbers that count up, gradients
 * that slowly drift. Reanimated's entering animations follow the system's
 * "reduce motion" setting by default.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polyline } from 'react-native-svg';
import { colors, fontFamily } from '@/theme';

/** Fades and slides its children in. Use increasing `delay`s for a staggered entrance. */
export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(520).delay(delay)} style={style}>
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that sinks in slightly while pressed and springs back. */
export function PressableScale({
  children,
  onPress,
  style,
  disabled,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 18, stiffness: 320 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 14, stiffness: 240 }))}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}

/** Counts from 0 up to `value` when it appears (or jumps straight there with reduced motion). */
export function CountUp({ value, style, duration = 800 }: { value: number; style?: StyleProp<TextStyle>; duration?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);
  return <Text style={style}>{shown}</Text>;
}

/**
 * A gradient that drifts very slowly, so color fields feel alive.
 * The gradient is larger than its box and moves back and forth inside it.
 */
export function LivingGradient({
  colors: stops,
  style,
  children,
  speed = 9000,
}: {
  colors: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  speed?: number;
}) {
  const reduced = useReducedMotion();
  const shift = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    shift.value = withRepeat(withTiming(1, { duration: speed, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, speed]);
  const moving = useAnimatedStyle(() => ({
    transform: [{ translateX: -40 * shift.value }, { translateY: -24 * shift.value }],
  }));
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <Animated.View style={[styles.drift, moving]}>
        <LinearGradient colors={stops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {children}
    </View>
  );
}

/**
 * Marks content the AI made. Deliberately small and used sparingly:
 * visible, but the content stays the hero. Twinkles gently now and then.
 */
export function AiMark({ size = 13, label, color = colors.clay }: { size?: number; label?: string; color?: string }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 2600 }), withTiming(1.25, { duration: 260 }), withTiming(1, { duration: 360 })),
      -1,
    );
  }, [reduced]);
  const twinkle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <View style={styles.aiRow} accessibilityLabel={label ? `${label}, made with AI` : 'Made with AI'}>
      <Animated.View style={twinkle}>
        <Ionicons name="sparkles" size={size} color={color} />
      </Animated.View>
      {label ? <Text style={[styles.aiLabel, { color }]}>{label}</Text> : null}
    </View>
  );
}

/** A soft band of light that sweeps across its parent every few seconds (place inside an overflow-hidden box). */
export function Sheen({ every = 4800 }: { every?: number }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(-1);
  useEffect(() => {
    if (reduced || !width) return;
    x.value = withRepeat(
      withSequence(withTiming(-1, { duration: every * 0.55 }), withTiming(1, { duration: every * 0.45, easing: Easing.inOut(Easing.quad) })),
      -1,
    );
  }, [reduced, width, every]);
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * width }] }));
  if (reduced) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[StyleSheet.absoluteFill, band]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.13)', 'rgba(255,255,255,0)']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** A small dot with a soft ring that keeps rippling outwards, to say "waiting for you". */
export function PulseDot({ color = '#F0A57E', size = 8 }: { color?: string; size?: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduced) t.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1);
  }, [reduced]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - t.value), transform: [{ scale: 1 + 1.6 * t.value }] }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

/** A tiny line chart, e.g. the last 7 days on a color field. Missing days are skipped. */
export function Sparkline({
  values,
  color,
  width = 48,
  height = 18,
  max = 10,
}: {
  values: (number | null)[];
  color: string;
  width?: number;
  height?: number;
  max?: number;
}) {
  const known = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (known.length < 2) return null;
  const step = width / Math.max(values.length - 1, 1);
  const points = known.map(([i, v]) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`).join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  drift: { position: 'absolute', top: 0, left: 0, width: '140%', height: '140%' },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aiLabel: { fontFamily: fontFamily.semibold, fontSize: 11, letterSpacing: 0.4 },
});
