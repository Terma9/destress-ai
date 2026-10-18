import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, GradientCard, Screen, SectionHeader } from '@/components/ui';
import { intensityColor } from '@/components/untangle';
import { useUntangleSessions } from '@/data/untangle';
import { colors, font, gradients, radii, spacing } from '@/theme';

export default function UntangleHome() {
  const router = useRouter();
  const { sessions, error } = useUntangleSessions();

  return (
    <Screen>
      <Text style={styles.title}>Untangle</Text>
      <Text style={styles.sub}>Work through what's stressing you right now</Text>

      <GradientCard colors={gradients.aiAnalysis} style={{ marginTop: spacing.lg }}>
        <View style={styles.heroHead}>
          <Ionicons name="compass-outline" size={18} color={colors.white} />
          <Text style={styles.heroTitle}>Stressed right now?</Text>
        </View>
        <Text style={styles.heroBody}>
          Tell me what's going on. I'll ask a few questions and make a small plan with you, based on what has helped
          you before.
        </Text>
        <Pressable style={styles.heroBtn} onPress={() => router.push('/untangle/new')}>
          <Text style={styles.heroBtnText}>Untangle it</Text>
        </Pressable>
      </GradientCard>

      <SectionHeader title="Your plans" />
      {error ? (
        <EmptyState
          icon={<Ionicons name="cloud-offline-outline" size={32} color={colors.textFaint} />}
          title="Couldn't load your plans"
          caption="Check your connection and come back to this tab."
        />
      ) : sessions === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="compass-outline" size={32} color={colors.textFaint} />}
          title="No plans yet"
          caption="Your plans and how much they helped will show up here."
        />
      ) : (
        sessions.map((s) => (
          <Card
            key={s.id}
            style={{ marginBottom: spacing.md }}
            onPress={() => router.push({ pathname: '/untangle/[id]', params: { id: s.id } })}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{s.title}</Text>
                <Text style={styles.meta}>
                  {new Date(s.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })} ·{' '}
                  {s.plan.steps.filter((st) => st.done).length} of {s.plan.steps.length} steps done
                </Text>
              </View>
              <Text style={styles.scores}>
                <Text style={{ color: intensityColor(s.intensity_before) }}>{s.intensity_before}</Text>
                {s.intensity_after !== null ? (
                  <>
                    {' → '}
                    <Text style={{ color: intensityColor(s.intensity_after) }}>{s.intensity_after}</Text>
                  </>
                ) : null}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </View>
            {s.intensity_after === null && <Text style={styles.open}>How did it go? Tap to rate it.</Text>}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h1, color: colors.text },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  heroTitle: { ...font.title, color: colors.white },
  heroBody: { ...font.body, color: 'rgba(255,255,255,0.92)', lineHeight: 20 },
  heroBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    marginTop: spacing.md,
  },
  heroBtnText: { color: colors.purple, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardTitle: { ...font.title, color: colors.text },
  meta: { ...font.small, color: colors.textFaint, marginTop: 2 },
  scores: { fontSize: 18, fontWeight: '700', color: colors.textFaint },
  open: { ...font.small, color: colors.purple, fontWeight: '600', marginTop: spacing.sm },
});
