/**
 * Untangle: two ways to deal with stress.
 *   Calm now       — stressed right now? A few minutes to slow down together.
 *   Stress solving — something keeps coming back? A plan that fits you.
 * Below: "My plans" (one living plan per stressor) and "Solved": every
 * solved plan is a success story, which can be shared in the community.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { InlineLoader, Logo } from '@/components/brand';
import { FadeIn, LivingGradient, PressableScale } from '@/components/motion';
import { Card, Screen } from '@/components/ui';
import { THEME_LABELS, useMyStories } from '@/data/community';
import { type UntangleSession, useUntangleSessions } from '@/data/untangle';
import { colors, fields, font, fontFamily, radii, shadow, spacing } from '@/theme';

const short = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });

export default function UntangleHome() {
  const router = useRouter();
  const { sessions, error } = useUntangleSessions();
  const stories = useMyStories();

  const plans = (sessions ?? []).filter((s) => s.kind === 'plan');
  const active = plans.filter((s) => s.status === 'active');
  const calm = (sessions ?? []).filter((s) => s.kind === 'calm' && s.intensity_after !== null);
  const avgDrop = calm.length
    ? Math.round((calm.reduce((sum, s) => sum + (s.intensity_before - s.intensity_after!), 0) / calm.length) * 10) / 10
    : null;

  return (
    <Screen>
      <Text style={styles.title}>Untangle</Text>
      <Text style={styles.sub}>Calm stress in the moment, or solve what keeps coming back</Text>

      <FadeIn style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <PressableScale onPress={() => router.push('/untangle/calm')} accessibilityLabel="Calm now">
          <LivingGradient colors={[fields.stress.from, fields.stress.to, fields.stress.from]} style={styles.mode} speed={9000}>
            <View style={styles.modeHead}>
              <View style={[styles.modeIcon, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
                <Ionicons name="leaf-outline" size={18} color={fields.stress.deep} />
              </View>
              <Text style={[styles.modeTitle, { color: fields.stress.ink }]}>Calm now</Text>
              <Ionicons name="arrow-forward" size={18} color={fields.stress.ink} />
            </View>
            <Text style={[styles.modeText, { color: fields.stress.ink }]}>
              Stressed right now? Slow down together in a few minutes, with small exercises and tips.
            </Text>
            {avgDrop !== null && (
              <Text style={[styles.modeStat, { color: fields.stress.deep }]}>
                {calm.length}× used · stress {avgDrop > 0 ? `−${avgDrop}` : avgDrop} on average
              </Text>
            )}
          </LivingGradient>
        </PressableScale>

        <PressableScale onPress={() => router.push('/untangle/new')} accessibilityLabel="Stress solving">
          <LivingGradient colors={[fields.sleep.from, fields.sleep.to, fields.sleep.from]} style={styles.mode} speed={11000}>
            <View style={styles.modeHead}>
              <View style={[styles.modeIcon, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
                <Ionicons name="git-branch-outline" size={18} color={fields.sleep.deep} />
              </View>
              <Text style={[styles.modeTitle, { color: fields.sleep.ink }]}>Stress solving</Text>
              <Ionicons name="arrow-forward" size={18} color={fields.sleep.ink} />
            </View>
            <Text style={[styles.modeText, { color: fields.sleep.ink }]}>
              Something keeps stressing you? Work out a plan that fits you, based on your check-ins and patterns.
            </Text>
          </LivingGradient>
        </PressableScale>
      </FadeIn>

      <FadeIn delay={150} style={{ marginTop: spacing.xl }}>
        <Text style={styles.label}>MY PLANS</Text>
        <Text style={styles.sectionHint}>One plan per stressor. Give updates, and the plan grows with you.</Text>
        {error ? (
          <Text style={styles.note}>Couldn't load your plans. Check your connection.</Text>
        ) : sessions === null ? (
          <InlineLoader />
        ) : active.length === 0 ? (
          <Card style={styles.empty}>
            <Logo size={40} />
            <Text style={styles.note}>No plans yet. Start with Stress solving when something keeps coming back.</Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {active.map((s) => (
              <PlanCard key={s.id} session={s} onPress={() => router.push({ pathname: '/untangle/[id]', params: { id: s.id } })} />
            ))}
          </View>
        )}
      </FadeIn>

      {stories && stories.length > 0 && (
        <FadeIn delay={280} style={{ marginTop: spacing.xl }}>
          <Text style={styles.label}>SOLVED</Text>
          <Text style={styles.sectionHint}>Every solved plan becomes your success story. Share it if you like.</Text>
          <View style={{ gap: spacing.sm }}>
            {stories.map((st) => (
              <Card key={st.id} onPress={() => router.push({ pathname: '/success/[id]', params: { id: st.id } })}>
                <View style={styles.row}>
                  <Ionicons name="checkmark-circle" size={20} color={fields.mood.deep} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{st.title}</Text>
                    <Text style={styles.meta}>
                      {st.intensity_before !== null && st.intensity_after !== null
                        ? `Stress ${st.intensity_before} → ${st.intensity_after} · `
                        : `${THEME_LABELS[st.theme] ?? st.theme} · `}
                      {st.status === 'published' ? 'Shared in the community' : 'Private'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </View>
              </Card>
            ))}
          </View>
        </FadeIn>
      )}
    </Screen>
  );
}

function PlanCard({ session: s, onPress }: { session: UntangleSession; onPress: () => void }) {
  const steps = s.plan?.steps ?? [];
  const done = steps.filter((st) => st.done).length;
  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{s.title}</Text>
          <Text style={styles.cardText} numberOfLines={2}>
            {s.problem}
          </Text>
          <View style={styles.progress}>
            {steps.map((st, i) => (
              <View key={i} style={[styles.bar, st.done && { backgroundColor: fields.mood.strong }]} />
            ))}
          </View>
          <Text style={styles.meta}>
            {s.status === 'solved' ? 'Solved' : `${done} of ${steps.length} steps`} · updated {short(s.updated_at)}
            {s.plan_history.length ? ` · version ${s.plan_history.length + 1}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h1, color: colors.ink },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2 },
  mode: { borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', ...shadow.soft },
  modeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontFamily: fontFamily.bold, fontSize: 18, flex: 1 },
  modeText: { ...font.small, lineHeight: 18, marginTop: spacing.sm, opacity: 0.85 },
  modeStat: { fontFamily: fontFamily.semibold, fontSize: 12, marginTop: spacing.sm },
  label: { ...font.label, color: colors.textMuted },
  sectionHint: { ...font.small, color: colors.textFaint, marginTop: 2, marginBottom: spacing.md },
  note: { ...font.body, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardTitle: { ...font.title, color: colors.ink },
  cardText: { ...font.small, color: colors.inkSoft, marginTop: 2, lineHeight: 18 },
  progress: { flexDirection: 'row', gap: 4, marginTop: spacing.sm },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.sand },
  meta: { ...font.tiny, color: colors.textMuted, marginTop: 6 },
});
