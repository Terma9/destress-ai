import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';
import { colors, font, gradients, radii, spacing } from '@/theme';

const features = [
  { icon: 'sparkles', label: 'AI Insights', tint: colors.primary, bg: '#DBEAFE' },
  { icon: 'heart', label: 'Mindfulness', tint: colors.green, bg: '#DCFCE7' },
  { icon: 'pulse', label: 'Wellbeing', tint: colors.purple, bg: '#EDE9FE' },
] as const;

export default function Onboarding() {
  const router = useRouter();
  const { onboarded, setOnboarded, setName } = useAppStore();
  const insets = useSafeAreaInsets();
  const [nameInput, setNameInput] = useState('');

  if (onboarded) return <Redirect href="/(tabs)/home" />;

  const start = () => {
    setName(nameInput);
    setOnboarded(true);
    router.replace('/(tabs)/home');
  };

  return (
    <LinearGradient colors={gradients.appBackground} style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.center}>
          <LinearGradient colors={['#60A5FA', '#2563EB']} style={styles.logo}>
            <Ionicons name="leaf" size={54} color={colors.white} />
          </LinearGradient>

          <Text style={styles.brand}>
            Destress <Text style={{ color: colors.purple }}>AI</Text>
          </Text>
          <Text style={styles.tagline}>Your AI-Powered Companion for Stress Relief and Wellbeing</Text>

          <View style={styles.featureRow}>
            {features.map((f) => (
              <View key={f.label} style={styles.feature}>
                <View style={[styles.featureIcon, { backgroundColor: f.bg }]}>
                  <Ionicons name={f.icon as any} size={22} color={f.tint} />
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="What should we call you?"
            placeholderTextColor={colors.textFaint}
            style={styles.nameInput}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={start}
          />
        </View>

        <PrimaryButton label="Get Started" onPress={start} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  logo: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    marginBottom: spacing.sm,
  },
  brand: { fontSize: 30, fontWeight: '800', color: colors.primary },
  tagline: {
    ...font.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 21,
  },
  featureRow: { flexDirection: 'row', gap: spacing.xxl, marginTop: spacing.xl },
  nameInput: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 48,
    paddingHorizontal: spacing.lg,
    ...font.body,
    color: colors.text,
    textAlign: 'center',
  },
  feature: { alignItems: 'center', gap: 6 },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: { ...font.small, color: colors.textMuted, fontWeight: '500' },
});
