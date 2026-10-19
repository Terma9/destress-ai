/**
 * The Destress AI logo. `Logo` is the plain mark; `LivingLogo` turns very
 * slowly and breathes inside a soft clay glow, for the start screen.
 */
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const LOGO = require('../../assets/images/logo.png');

export function Logo({ size = 32 }: { size?: number }) {
  return <Image source={LOGO} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="Destress AI" />;
}

export function LivingLogo({ size = 148 }: { size?: number }) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    turn.value = withRepeat(withTiming(1, { duration: 90000, easing: Easing.linear }), -1);
    breath.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced]);
  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 360}deg` }, { scale: 1 + breath.value * 0.03 }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.55 + breath.value * 0.35, transform: [{ scale: 1 + breath.value * 0.08 }] }));
  const halo = size * 1.75;
  return (
    <View style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }}>
      {/* Soft round glow: concentric circles fading outwards. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, glow]}>
        {[1, 0.86, 0.72, 0.6].map((f, i) => (
          <View
            key={f}
            style={{
              position: 'absolute',
              width: halo * f,
              height: halo * f,
              borderRadius: (halo * f) / 2,
              backgroundColor: `rgba(232, 170, 140, ${0.07 + i * 0.05})`,
            }}
          />
        ))}
      </Animated.View>
      <Animated.View style={spin}>
        <Logo size={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
