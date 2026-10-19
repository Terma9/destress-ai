/**
 * Start screen: the logo sending out soft rings, what the app does in one
 * sentence, and the user's name. Or, for an
 * interviewer: "Explore the demo" loads Jonas's last four weeks (seed-demo)
 * into this fresh account and opens Today.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HaloLogo, SoftDots } from '@/components/brand';
import { AiMark, FadeIn, PressableScale, Sheen } from '@/components/motion';
import { startDemo } from '@/lib/demo';
import { useAppStore } from '@/store/useAppStore';
import { colors, font, fontFamily, gradients, radii, shadow, spacing, tints } from '@/theme';

export default function Start() {
  const router = useRouter();
  const { onboarded, setOnboarded, setName } = useAppStore();
  const insets = useSafeAreaInsets();
  const [nameInput, setNameInput] = useState('');
  const [demo, setDemo] = useState<'idle' | 'loading' | { error: string }>('idle');

  if (onboarded) return <Redirect href="/(tabs)/home" />;

  const start = () => {
    setName(nameInput.trim());
    setOnboarded(true);
    router.replace('/(tabs)/home');
  };

  const exploreDemo = async () => {
    setDemo('loading');
    try {
      await startDemo();
      router.replace('/(tabs)/home');
    } catch (err) {
      setDemo({ error: (err as Error).message });
    }
  };

  return (
    <LinearGradient
      colors={[tints.clay, colors.ivory, tints.sage]}
      locations={[0, 0.55, 1]}
      start={{ x: 0.8, y: 0 }}
      end={{ x: 0.2, y: 1 }}
      style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.center}>
          <FadeIn>
            <HaloLogo size={140} rings />
          </FadeIn>

          <FadeIn delay={150} style={styles.textBlock}>
            <Text style={styles.brand}>
              Destress <Text style={{ color: colors.clay }}>AI</Text>
            </Text>
            <Text style={styles.tagline}>
              A short conversation every evening, patterns from your days, and help when stress hits.
            </Text>
            <View style={{ marginTop: spacing.lg }}>
              <AiMark label="A COMPANION THAT LEARNS WHAT HELPS YOU" />
            </View>
          </FadeIn>

        </View>

        <FadeIn delay={600}>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="What should I call you?"
            placeholderTextColor={colors.textFaint}
            style={styles.nameInput}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={start}
          />
          <PressableScale onPress={start} accessibilityLabel="Get started">
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
              <Sheen />
              <Text style={styles.buttonText}>Get started</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.ivory} />
            </LinearGradient>
          </PressableScale>
          <Pressable onPress={exploreDemo} disabled={demo === 'loading'} style={styles.demo} accessibilityLabel="Explore the demo">
            {demo === 'loading' ? (
              <View style={styles.demoRow}>
                <SoftDots size={5} />
                <Text style={styles.demoText}>Loading Jonas's last 4 weeks…</Text>
              </View>
            ) : (
              <Text style={styles.demoText}>
                Or <Text style={styles.demoLink}>explore the demo</Text> · Jonas, 4 weeks
              </Text>
            )}
          </Pressable>
          {typeof demo === 'object' && <Text style={styles.demoError}>{demo.error}</Text>}
        </FadeIn>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  demo: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  demoText: { ...font.body, color: colors.inkSoft },
  demoLink: { fontFamily: fontFamily.semibold, color: colors.ink, textDecorationLine: 'underline' },
  demoError: { ...font.small, color: colors.danger, textAlign: 'center' },
  container: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: spacing.xl },
  textBlock: { alignItems: 'center', marginTop: -spacing.sm },
  brand: { fontFamily: fontFamily.bold, fontSize: 34, letterSpacing: -1, color: colors.ink },
  tagline: { ...font.body, fontSize: 15, color: colors.inkSoft, textAlign: 'center', lineHeight: 23, marginTop: spacing.md, maxWidth: 290 },
  nameInput: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#F0ECE5',
    ...shadow.soft,
  },
  button: {
    height: 56,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
    ...shadow.lifted,
  },
  buttonText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.ivory },
});
