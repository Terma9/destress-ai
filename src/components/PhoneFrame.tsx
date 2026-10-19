/**
 * On a wide browser window (the web demo on a laptop), shows the app centred
 * in a phone-sized frame instead of stretched across the screen, so it looks
 * like the phone app it is, with no developer tools needed. Next to it, a QR
 * code opens the same link on a phone. On phones and in the native app it
 * renders the app unchanged.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Logo } from '@/components/brand';
import { colors, font, fontFamily, shadow, tints } from '@/theme';

const MIN_DESKTOP_WIDTH = 700;
const MAX_HEIGHT = 880;
const RATIO = 0.48; // width / height of a modern phone screen

export function PhoneFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < MIN_DESKTOP_WIDTH) return <>{children}</>;

  const frameHeight = Math.min(MAX_HEIGHT, height - 64);
  const url = typeof window !== 'undefined' ? window.location.origin : '';
  const qr = (
    <View style={styles.qrCard}>
      <View style={styles.qrBox}>
        <QRCode value={url} size={132} color="#1C1B19" backgroundColor="#FFFFFF" />
      </View>
      <View style={{ marginTop: 12 }}>
        <Text style={styles.qrTitle}>Try it on your phone</Text>
        <Text style={styles.qrText}>Scan with your camera. It opens right in the browser, no app to install.</Text>
        <Text style={styles.qrUrl}>{url.replace(/^https?:\/\//, '')}</Text>
      </View>
    </View>
  );
  return (
    <LinearGradient
      colors={[tints.clay, colors.ivory, tints.sage]}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.page}>
      <View style={styles.row}>
        <View style={[styles.frame, { height: frameHeight, width: Math.round(frameHeight * RATIO) }]}>{children}</View>
        {qr}
      </View>
      <View style={styles.caption}>
        <Logo size={18} />
        <Text style={styles.captionText}>
          <Text style={styles.captionBrand}>Destress AI</Text> · an AI companion for everyday stress
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  qrCard: { width: 200, alignItems: 'flex-start' },
  qrBox: { padding: 12, backgroundColor: '#FFFFFF', borderRadius: 18, ...shadow.soft },
  qrTitle: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.ink },
  qrText: { ...font.small, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  qrUrl: { ...font.small, fontFamily: fontFamily.semibold, color: colors.inkSoft, marginTop: 8 },
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
