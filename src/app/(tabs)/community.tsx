import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { GradientCard, Screen } from '@/components/ui';
import { colors, font, gradients, radii, spacing } from '@/theme';

const bullets = [
  { icon: 'heart-outline', text: 'Support each other through challenges and celebrate wins together' },
  { icon: 'chatbubbles-outline', text: "Share your experiences and learn from others' wellness journeys" },
  { icon: 'share-social-outline', text: 'Exchange tips, techniques, and strategies that work for you' },
] as const;

export default function Community() {
  return (
    <Screen>
      <Text style={styles.title}>Community</Text>
      <Text style={styles.sub}>Connect, share, and support</Text>

      <GradientCard colors={gradients.community} style={{ marginTop: spacing.lg, paddingVertical: spacing.xxl }}>
        <View style={styles.iconWrap}>
          <Ionicons name="people" size={32} color={colors.white} />
        </View>

        <View style={styles.soonRow}>
          <Ionicons name="sparkles" size={14} color={colors.white} />
          <Text style={styles.soon}>Coming Soon</Text>
        </View>
        <Text style={styles.cardTitle}>Community Feature</Text>
        <Text style={styles.cardBody}>
          Soon you'll be able to connect with others on their wellness journey. Share your stories,
          support each other, and find strength in community.
        </Text>

        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          {bullets.map((b) => (
            <View key={b.text} style={styles.bullet}>
              <View style={styles.bulletIcon}>
                <Ionicons name={b.icon as any} size={16} color={colors.white} />
              </View>
              <Text style={styles.bulletText}>{b.text}</Text>
            </View>
          ))}
        </View>
      </GradientCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h1, color: colors.text },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2 },
  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  soonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  soon: { ...font.small, color: colors.white, fontWeight: '600' },
  cardTitle: { ...font.h3, color: colors.white, textAlign: 'center', marginTop: 4 },
  cardBody: {
    ...font.body,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  bulletIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: { ...font.small, color: colors.white, flex: 1, lineHeight: 18 },
});
