/**
 * The Destress AI logo, and the calm loading states built from it.
 *
 * Loading never spins here: a spinner signals "hurry", which is the
 * opposite of what this app is for. Instead the logo breathes slowly
 * (about one breath every 8 seconds) and three soft dots fade in turn.
 */
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, fields, fontFamily } from '@/theme';

const LOGO = require('../../assets/images/logo.png');

export function Logo({ size = 32 }: { size?: number }) {
  return <Image source={LOGO} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="Destress AI" />;
}

/** Soft round glow behind the logo: concentric circles fading outwards. */
function Glow({ size, opacity }: { size: number; opacity: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      {[1, 0.86, 0.72, 0.6].map((f, i) => (
        <View
          key={f}
          style={{
            position: 'absolute',
            width: size * f,
            height: size * f,
            borderRadius: (size * f) / 2,
            backgroundColor: `rgba(232, 170, 140, ${(0.07 + i * 0.05) * opacity})`,
          }}
        />
      ))}
    </View>
  );
}

const RING_MS = 7000;
const RINGS = 3;

/**
 * The logo in its soft clay glow. With `rings`, it sends out soft rings that
 * slowly widen and fade, like ripples on still water, and breathes gently.
 */
export function HaloLogo({ size = 148, rings = false }: { size?: number; rings?: boolean }) {
  const reduced = useReducedMotion();
  const breath = useSharedValue(0);
  const animate = rings && !reduced;
  useEffect(() => {
    if (animate) {
      breath.value = withRepeat(withTiming(1, { duration: 4500, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
  }, [animate]);
  const logo = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath.value * 0.03 }] }));
  const halo = size * 1.75;
  return (
    <View style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }}>
      <Glow size={halo} opacity={1} />
      {animate && Array.from({ length: RINGS }, (_, i) => <Ring key={i} index={i} size={size} max={halo * 1.15} />)}
      <Animated.View style={logo}>
        <Logo size={size} />
      </Animated.View>
    </View>
  );
}

function Ring({ index, size, max }: { index: number; size: number; max: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      (index * RING_MS) / RINGS,
      withRepeat(withTiming(1, { duration: RING_MS, easing: Easing.out(Easing.quad) }), -1, false),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.8 + t.value * (max / size - 0.8) }],
    opacity: t.value < 0.1 ? t.value * 3.5 : 0.35 * (1 - t.value),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1.2, borderColor: fields.stress.strong }, style]}
    />
  );
}

const BREATH_MS = 4000;

/** The logo breathing in and out slowly: in for 4 s, out for 4 s. */
export function BreathingLogo({ size }: { size: number }) {
  const reduced = useReducedMotion();
  const breath = useSharedValue(0);
  useEffect(() => {
    if (!reduced) {
      breath.value = withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
  }, [reduced]);
  const logo = useAnimatedStyle(() => ({ transform: [{ scale: 0.92 + breath.value * 0.1 }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.35 + breath.value * 0.65, transform: [{ scale: 0.9 + breath.value * 0.15 }] }));
  const halo = size * 1.9;
  return (
    <View style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, glow]}>
        <Glow size={halo} opacity={1} />
      </Animated.View>
      <Animated.View style={logo}>
        <Logo size={size} />
      </Animated.View>
    </View>
  );
}

/** Three small dots that fade in turn, slowly. For inline "working on it" moments. */
export function SoftDots({ color = fields.stress.strong, size = 7 }: { color?: string; size?: number }) {
  return (
    <View style={styles.dots} accessibilityLabel="Loading">
      {[0, 1, 2].map((i) => (
        <SoftDot key={i} index={i} color={color} size={size} />
      ))}
    </View>
  );
}

function SoftDot({ index, color, size }: { index: number; color: string; size: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0.3);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(
      index * 260,
      withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.3, { duration: 900 })), -1),
    );
  }, [reduced]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.8 + t.value * 0.25 }] }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/**
 * Full-screen calm loading state: the breathing logo, soft dots and an
 * optional quiet line. Appears with a short fade so quick loads don't flash.
 */
export function CalmLoader({ message, size = 84 }: { message?: string; size?: number }) {
  return (
    <Animated.View entering={FadeIn.duration(500).delay(150)} style={styles.full}>
      <BreathingLogo size={size} />
      <SoftDots />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Animated.View>
  );
}

/** A smaller calm loading state for inside a screen (no logo, just the dots). */
export function InlineLoader({ message }: { message?: string }) {
  return (
    <Animated.View entering={FadeIn.duration(400).delay(120)} style={styles.inline}>
      <SoftDots />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: colors.ivory },
  inline: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 36 },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  message: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
