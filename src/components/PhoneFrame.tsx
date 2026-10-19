/**
 * The web demo on a laptop: instead of stretching the app across the screen,
 * shows it in a realistic phone (Dynamic Island, status bar, side buttons),
 * with a short project intro on the left and a QR code on the right that
 * opens the same link on a phone. On phones and in the native app it renders
 * the app unchanged.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Logo } from '@/components/brand';
import { AiMark } from '@/components/motion';
import { colors, fields, font, fontFamily, radii, shadow, tints } from '@/theme';

const MIN_DESKTOP_WIDTH = 700;
/** From this width there is room for the project intro next to the phone. */
const WITH_INTRO_WIDTH = 1180;
const MAX_HEIGHT = 860;
const RATIO = 0.47; // width / height of a modern phone
const BEZEL = 11;
/** Space the app keeps free for the status bar and the home indicator, like on a real phone. */
const PHONE_INSETS = { top: 50, bottom: 22, left: 0, right: 0 };

const FEATURES = [
  {
    icon: 'chatbubbles-outline',
    field: fields.stress,
    title: 'Evening check-in',
    text: 'A short conversation instead of sliders. The AI suggests stress, sleep and mood with reasons; you adjust.',
  },
  {
    icon: 'analytics-outline',
    field: fields.sleep,
    title: 'Weekly Insights',
    text: 'Patterns across your days, each backed by the entries behind it.',
  },
  {
    icon: 'leaf-outline',
    field: fields.mood,
    title: 'Untangle',
    text: 'Calm now for the moment, Stress solving for what keeps coming back.',
  },
] as const;

const LINKEDIN = 'https://www.linkedin.com/in/simon--kraus/';

const STACK = ['Expo · React Native', 'Supabase · Postgres + RLS', 'pgvector RAG', 'OpenAI · structured output', 'Edge Functions'];

export function PhoneFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < MIN_DESKTOP_WIDTH) return <>{children}</>;

  const phoneHeight = Math.min(MAX_HEIGHT, height - 72);
  const phoneWidth = Math.round(phoneHeight * RATIO);
  const url = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <LinearGradient
      colors={[tints.clay, colors.ivory, tints.sage]}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.page}>
      <View style={styles.row}>
        {width >= WITH_INTRO_WIDTH && <Intro />}

        <View style={{ width: phoneWidth, height: phoneHeight }}>
          {/* Side buttons sit outside the screen. */}
          <View style={[styles.button, { left: -3, top: phoneHeight * 0.17, height: 28 }]} />
          <View style={[styles.button, { left: -3, top: phoneHeight * 0.24, height: 52 }]} />
          <View style={[styles.button, { left: -3, top: phoneHeight * 0.32, height: 52 }]} />
          <View style={[styles.button, { right: -3, top: phoneHeight * 0.27, height: 78 }]} />

          <View style={styles.phone}>
            <View style={styles.screen}>
              <SafeAreaInsetsContext.Provider value={PHONE_INSETS}>{children}</SafeAreaInsetsContext.Provider>

              {/* Status bar, Dynamic Island and home indicator, drawn over the app. */}
              <View style={[styles.statusBar, { pointerEvents: 'none' }]}>
                <Text style={styles.time}>9:41</Text>
                <View style={styles.island} />
                <View style={styles.statusIcons}>
                  <Ionicons name="cellular" size={14} color={colors.ink} />
                  <Ionicons name="wifi" size={15} color={colors.ink} />
                  <Ionicons name="battery-full" size={20} color={colors.ink} />
                </View>
              </View>
              <View style={[styles.homeIndicator, { pointerEvents: 'none' }]} />
            </View>
          </View>
        </View>

        <View style={styles.qrCard}>
          <View style={styles.qrBox}>
            <QRCode value={url} size={128} color="#1C1B19" backgroundColor="#FFFFFF" />
          </View>
          <Text style={styles.qrTitle}>Try it on your phone</Text>
          <Text style={styles.qrText}>Scan with your camera. It opens right in the browser, no app to install.</Text>
          <Text style={styles.qrUrl}>{url.replace(/^https?:\/\//, '')}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

/** The project in a few lines, for an interviewer opening the link on a laptop. */
function Intro() {
  return (
    <View style={styles.intro}>
      <Text style={styles.kicker}>PORTFOLIO PROJECT</Text>
      <View style={styles.brandRow}>
        <Logo size={40} />
        <Text style={styles.brand}>
          Destress <Text style={{ color: colors.clay }}>AI</Text>
        </Text>
      </View>
      <Text style={styles.pitch}>
        Stress apps make you fill in sliders. Destress AI talks with you for two minutes each evening, tracks stress, sleep
        and mood from the conversation, and learns what actually helps you.
      </Text>

      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: f.field.from }]}>
              <Ionicons name={f.icon} size={17} color={f.field.deep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.stack}>
        {STACK.map((s) => (
          <Text key={s} style={styles.chip}>
            {s}
          </Text>
        ))}
      </View>

      <View style={styles.demoHint}>
        <AiMark size={12} />
        <Text style={styles.demoHintText}>
          Tap <Text style={styles.bold}>explore the demo</Text> to see four weeks of Jonas, a consultant whose Sundays
          weigh on him.
        </Text>
      </View>
      <Pressable onPress={() => Linking.openURL(LINKEDIN)} style={styles.bylineRow} accessibilityRole="link">
        <Text style={styles.byline}>
          Built by <Text style={styles.bylineName}>Simon Kraus</Text> · 2026
        </Text>
        <Ionicons name="logo-linkedin" size={15} color="#0A66C2" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 56 },

  // Phone
  phone: {
    flex: 1,
    borderRadius: 54,
    padding: BEZEL,
    backgroundColor: '#1C1B19',
    boxShadow: '0px 30px 70px rgba(28,27,25,0.28), 0px 6px 16px rgba(28,27,25,0.14)',
  },
  screen: { flex: 1, borderRadius: 44, overflow: 'hidden', backgroundColor: colors.ivory },
  button: { position: 'absolute', width: 4, borderRadius: 2, backgroundColor: '#2A2926' },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  time: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.ink, width: 60 },
  island: { width: 104, height: 30, borderRadius: 15, backgroundColor: '#000000' },
  statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60, justifyContent: 'flex-end' },
  homeIndicator: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    width: 128,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.ink,
    opacity: 0.85,
  },

  // Intro
  intro: { width: 330 },
  kicker: { ...font.label, color: colors.textMuted },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  brand: { fontFamily: fontFamily.bold, fontSize: 34, letterSpacing: -1, color: colors.ink },
  pitch: { ...font.body, fontSize: 15, lineHeight: 23, color: colors.inkSoft, marginTop: 14 },
  features: { gap: 14, marginTop: 24 },
  feature: { flexDirection: 'row', gap: 12 },
  featureIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink },
  featureText: { ...font.small, color: colors.textMuted, lineHeight: 17, marginTop: 2 },
  stack: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 24 },
  chip: {
    ...font.tiny,
    fontFamily: fontFamily.medium,
    color: colors.inkSoft,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  demoHint: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  demoHintText: { ...font.small, color: colors.inkSoft, flex: 1, lineHeight: 18 },
  bold: { fontFamily: fontFamily.semibold, color: colors.ink },
  bylineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, alignSelf: 'flex-start' },
  byline: { ...font.small, color: colors.textMuted },
  bylineName: { fontFamily: fontFamily.semibold, color: colors.ink, textDecorationLine: 'underline' },

  // QR
  qrCard: { width: 190 },
  qrBox: { alignSelf: 'flex-start', padding: 12, backgroundColor: '#FFFFFF', borderRadius: 18, ...shadow.soft },
  qrTitle: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.ink, marginTop: 14 },
  qrText: { ...font.small, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  qrUrl: { ...font.small, fontFamily: fontFamily.semibold, color: colors.inkSoft, marginTop: 8 },
});
