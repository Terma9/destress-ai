/**
 * The web demo on a laptop: instead of stretching the app across the screen,
 * shows it in a realistic phone (Dynamic Island, status bar, side buttons).
 * Two calm columns: on the left the project in short (each feature as a
 * toggle, the tech stack, a button that loads the demo at any time and a QR
 * code for opening it on a phone), on the right the phone. On phones and in
 * the native app it renders the app unchanged.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Logo, SoftDots } from '@/components/brand';
import { PressableScale } from '@/components/motion';
import { startDemo } from '@/lib/demo';
import { useAppStore } from '@/store/useAppStore';
import { colors, fields, font, fontFamily, gradients, radii, shadow, tints } from '@/theme';

const MIN_DESKTOP_WIDTH = 700;
/** From this width there is room for the project intro next to the phone. */
const WITH_INTRO_WIDTH = 960;
const MAX_HEIGHT = 860;
const RATIO = 0.47; // width / height of a modern phone
const BEZEL = 11;
/** Space the app keeps free for the status bar and the home indicator, like on a real phone. */
const PHONE_INSETS = { top: 50, bottom: 22, left: 0, right: 0 };
const LINKEDIN = 'https://www.linkedin.com/in/simon--kraus/';

type Section = { key: string; icon: string; tint: string; ink: string; title: string; text?: string; chips?: string[] };

const SECTIONS: Section[] = [
  {
    key: 'checkin',
    icon: 'chatbubbles-outline',
    tint: fields.stress.from,
    ink: fields.stress.deep,
    title: 'Evening check-in',
    text: 'Talk about your day for two minutes, by voice or text. The app remembers your past days, asks follow-up questions and fills in stress, sleep and mood with a short reason each.',
  },
  {
    key: 'insights',
    icon: 'analytics-outline',
    tint: fields.sleep.from,
    ink: fields.sleep.deep,
    title: 'Weekly Insights',
    text: 'A weekly look back: how the week compared to the last, which patterns repeat ("Your Sundays are always the hardest") and what helped. Each finding links to the days behind it.',
  },
  {
    key: 'calm',
    icon: 'leaf-outline',
    tint: fields.mood.from,
    ink: fields.mood.deep,
    title: 'Untangle · Calm now',
    text: 'Stressed right now? The app calms you down step by step, with exercises and tips picked from what has helped you before.',
  },
  {
    key: 'solve',
    icon: 'git-branch-outline',
    tint: fields.sleep.from,
    ink: fields.sleep.deep,
    title: 'Untangle · Stress solving',
    text: "Stress that keeps coming back? The app first finds out what's behind it, then makes a plan with you based on your own history. As you go, the plan adapts.",
  },
  {
    key: 'stack',
    icon: 'code-slash-outline',
    tint: colors.sand,
    ink: colors.ink,
    title: 'Tech stack',
    chips: [
      'Expo / React Native',
      'Supabase (Postgres + RLS)',
      'Edge Functions',
      'OpenAI (chat, structured output, speech-to-text, embeddings)',
      'RAG with pgvector',
      'AI moderation',
      'Daily AI quotas',
    ],
  },
];

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
        {width >= WITH_INTRO_WIDTH && <Intro maxHeight={phoneHeight} url={url} />}

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
      </View>
    </LinearGradient>
  );
}

/** The project in short, for an interviewer opening the link on a laptop. */
function Intro({ maxHeight, url }: { maxHeight: number; url: string }) {
  const isDemo = useAppStore((s) => s.demo);
  const [open, setOpen] = useState<string | null>(null);
  const [demo, setDemo] = useState<'idle' | 'loading' | { error: string }>('idle');

  async function loadDemo() {
    setDemo('loading');
    try {
      await startDemo();
      // A full reload, so every screen starts fresh with the new demo account
      // (and this week's Weekly Insights get written live).
      window.location.replace('/home');
    } catch (err) {
      setDemo({ error: (err as Error).message });
    }
  }

  return (
    <ScrollView style={[styles.intro, { maxHeight }]} contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
      <View style={styles.brandRow}>
        <Logo size={40} />
        <Text style={styles.brand}>
          Destress <Text style={{ color: colors.clay }}>AI</Text>
        </Text>
      </View>
      <Text style={styles.pitch}>
        Most stress trackers make you fill in sliders. Destress AI talks with you for two minutes each evening, tracks
        stress, sleep and mood from the conversation, and learns what actually helps you.
      </Text>

      <View style={styles.sections}>
        {SECTIONS.map((s) => {
          const isOpen = open === s.key;
          return (
            <View key={s.key} style={[styles.section, isOpen && styles.sectionOpen]}>
              <Pressable
                onPress={() => setOpen(isOpen ? null : s.key)}
                style={styles.sectionHead}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}>
                <View style={[styles.sectionIcon, { backgroundColor: s.tint }]}>
                  <Ionicons name={s.icon as never} size={16} color={s.ink} />
                </View>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
              </Pressable>
              {isOpen && (
                <Animated.View entering={FadeIn.duration(220)} style={styles.sectionBody}>
                  {s.text ? <Text style={styles.sectionText}>{s.text}</Text> : null}
                  {s.chips ? (
                    <View style={styles.chips}>
                      {s.chips.map((c) => (
                        <Text key={c} style={styles.chip}>
                          {c}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </Animated.View>
              )}
            </View>
          );
        })}
      </View>

      <PressableScale onPress={loadDemo} disabled={demo === 'loading'} style={{ marginTop: 20 }}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.demoButton}>
          {demo === 'loading' ? (
            <>
              <SoftDots color={colors.ivory} size={5} />
              <Text style={styles.demoButtonText}>Loading Jonas's 4 weeks…</Text>
            </>
          ) : (
            <>
              <Ionicons name={isDemo ? 'refresh' : 'play'} size={15} color={colors.ivory} />
              <Text style={styles.demoButtonText}>{isDemo ? 'Restart the demo' : 'Load the demo'}</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>
      <Text style={styles.demoHint}>
        {typeof demo === 'object'
          ? demo.error
          : 'Four weeks of Jonas, a consultant whose Sundays weigh on him. Today is left open for you to try the check-in.'}
      </Text>

      <View style={styles.qrCard}>
        <View style={styles.qrBox}>
          <QRCode value={url} size={76} color="#1C1B19" backgroundColor="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.qrTitle}>Try it on your phone</Text>
          <Text style={styles.qrText}>Scan with your camera. Opens in the browser, no install.</Text>
          <Text style={styles.qrUrl}>{url.replace(/^https?:\/\//, '')}</Text>
        </View>
      </View>

      <Pressable onPress={() => Linking.openURL(LINKEDIN)} style={styles.bylineRow} accessibilityRole="link">
        <Text style={styles.byline}>
          Built by <Text style={styles.bylineName}>Simon Kraus</Text> · 2026
        </Text>
        <Ionicons name="logo-linkedin" size={15} color="#0A66C2" />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 88 },

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
  intro: { width: 380, flexGrow: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { fontFamily: fontFamily.bold, fontSize: 34, letterSpacing: -1, color: colors.ink },
  pitch: { ...font.body, fontSize: 15, lineHeight: 23, color: colors.inkSoft, marginTop: 14 },
  sections: { gap: 8, marginTop: 22 },
  section: { borderRadius: radii.md, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  sectionOpen: { backgroundColor: 'rgba(255,255,255,0.85)', ...shadow.soft },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink },
  sectionBody: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2 },
  sectionText: { ...font.small, color: colors.inkSoft, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    ...font.tiny,
    fontFamily: fontFamily.medium,
    color: colors.inkSoft,
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  demoButton: { height: 48, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadow.lifted },
  demoButtonText: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.ivory },
  demoHint: { ...font.small, color: colors.textMuted, lineHeight: 17, marginTop: 8 },
  bylineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, alignSelf: 'flex-start' },
  byline: { ...font.small, color: colors.textMuted },
  bylineName: { fontFamily: fontFamily.semibold, color: colors.ink, textDecorationLine: 'underline' },

  // QR
  qrCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 },
  qrBox: { padding: 8, backgroundColor: '#FFFFFF', borderRadius: 14, ...shadow.soft },
  qrTitle: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink },
  qrText: { ...font.small, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  qrUrl: { ...font.small, fontFamily: fontFamily.semibold, color: colors.inkSoft, marginTop: 4 },
});
