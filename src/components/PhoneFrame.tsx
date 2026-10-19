/**
 * On a wide browser window (the web demo on a laptop), shows the app centred
 * in a phone-sized frame instead of stretched across the screen, so it looks
 * like the phone app it is, with no developer tools needed. On phones and in
 * the native app it renders the app unchanged.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Logo } from '@/components/brand';
import { colors, font, fontFamily, shadow, tints } from '@/theme';

const MIN_DESKTOP_WIDTH = 700;
const MAX_HEIGHT = 880;
const RATIO = 0.48; // width / height of a modern phone screen

export function PhoneFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < MIN_DESKTOP_WIDTH) return <>{children}</>;

  const frameHeight = Math.min(MAX_HEIGHT, height - 64);
  return (
    <LinearGradient
      colors={[tints.clay, colors.ivory, tints.sage]}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.page}>
      <View style={[styles.frame, { height: frameHeight, width: Math.round(frameHeight * RATIO) }]}>{children}</View>
      <View style={styles.caption}>
        <Logo size={18} />
        <Text style={styles.captionText}>
          <Text style={styles.captionBrand}>Destress AI</Text> · works best on your phone: open this link there
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: colors.ivory,
    borderWidth: 8,
    borderColor: '#1C1B19',
    ...shadow.lifted,
  },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  captionText: { ...font.small, color: colors.textMuted },
  captionBrand: { fontFamily: fontFamily.semibold, color: colors.ink },
});
