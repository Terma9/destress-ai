import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { generateDeepDives, loadDemoData } from '@/ai/checkinClient';
import { Card, EmptyState, GradientCard, ProgressBar, Screen } from '@/components/ui';
import {
  answeredCount,
  diveStyle,
  MIN_CHECKINS,
  NEW_CHECKINS_FOR_REFRESH,
  useDeepDives,
} from '@/data/deepDives';
import { colors, font, gradients, radii, spacing } from '@/theme';

export default function DeepDives() {
  const router = useRouter();
  const { state, error, reload } = useDeepDives();
  const [busy, setBusy] = useState<'idle' | 'analyzing' | 'demo'>('idle');
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(kind: 'analyzing' | 'demo') {
    setBusy(kind);
    setActionError(null);
    try {
      await (kind === 'analyzing' ? generateDeepDives() : loadDemoData());
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy('idle');
    }
  }

  const analysis = state?.analysis ?? null;

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text style={styles.title}>AI Deep Dives</Text>
      <Text style={styles.sub}>Patterns from your check-ins, with the entries that show them</Text>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {error ? (
          <EmptyState
            icon={<Ionicons name="cloud-offline-outline" size={32} color={colors.textFaint} />}
            title="Couldn't load your Deep Dives"
            caption="Check your connection and come back to this screen."
          />
        ) : !state ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : busy === 'analyzing' ? (
          <GradientCard colors={gradients.aiAnalysis}>
            <ActivityIndicator color={colors.white} />
            <Text style={[styles.heroBody, { textAlign: 'center', marginTop: spacing.md }]}>
              Reading your {state.total} check-ins and looking for patterns. This takes about half a minute.
            </Text>
          </GradientCard>
        ) : state.total < MIN_CHECKINS ? (
          <Card>
            <View style={styles.head}>
              <View style={[styles.icon, { backgroundColor: colors.purple }]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.white} />
              </View>
              <Text style={styles.cardTitle}>Unlocks after {MIN_CHECKINS} check-ins</Text>
            </View>
            <Text style={styles.body}>
              Patterns need a few data points. Keep checking in and your first analysis unlocks here.
            </Text>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Check-ins</Text>
              <Text style={styles.progressVal}>
                {state.total} of {MIN_CHECKINS}
              </Text>
            </View>
            <ProgressBar progress={state.total / MIN_CHECKINS} color={colors.purple} />
            <Pressable style={styles.primaryBtn} onPress={() => router.push('/diary/new')}>
              <Text style={styles.primaryBtnText}>Start a check-in</Text>
            </Pressable>
            {state.total === 0 && (
              <Pressable style={styles.linkBtn} onPress={() => run('demo')} disabled={busy !== 'idle'}>
                {busy === 'demo' ? (
                  <ActivityIndicator color={colors.purple} />
                ) : (
                  <Text style={styles.linkText}>Or try it with 3 weeks of demo data</Text>
                )}
              </Pressable>
            )}
          </Card>
        ) : !analysis ? (
          <GradientCard colors={gradients.aiAnalysis}>
            <View style={styles.heroHead}>
              <Ionicons name="sparkles" size={16} color={colors.white} />
              <Text style={styles.heroTitle}>Ready for your first analysis</Text>
            </View>
            <Text style={styles.heroBody}>
              I'll read your {state.total} check-ins and look for patterns. Every finding comes with the entries
              it's based on.
            </Text>
            <Pressable style={styles.heroBtn} onPress={() => run('analyzing')}>
              <Text style={styles.heroBtnText}>Analyze my entries</Text>
            </Pressable>
          </GradientCard>
        ) : (
          <>
            <Text style={styles.meta}>
              Based on {analysis.checkin_count} check-ins ·{' '}
              {new Date(analysis.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
            </Text>
            {analysis.deepDives.map((d) => {
              const look = diveStyle(d.icon);
              const answered = answeredCount(d);
              return (
                <Card
                  key={d.id}
                  onPress={() => router.push({ pathname: '/deep-dive/[id]', params: { id: d.id } })}>
                  <View style={styles.head}>
                    <View style={[styles.icon, { backgroundColor: look.gradient[0] }]}>
                      <Ionicons name={look.name as any} size={20} color={colors.white} />
                    </View>
                    <Text style={styles.cardTitle}>{d.title}</Text>
                  </View>
                  <Text style={styles.body}>{d.description}</Text>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>Reflections answered</Text>
                    <Text style={styles.progressVal}>
                      {answered} of {d.questions.length}
                    </Text>
                  </View>
                  <ProgressBar progress={d.questions.length ? answered / d.questions.length : 0} color={look.gradient[0]} />
                  <Text style={[styles.explore, { color: look.gradient[0] }]}>Explore Deeper →</Text>
                </Card>
              );
            })}
            <Card>
              {state.newSince >= NEW_CHECKINS_FOR_REFRESH ? (
                <>
                  <Text style={styles.body}>
                    {state.newSince} new check-ins since this analysis. Want me to look again?
                  </Text>
                  <Pressable style={styles.primaryBtn} onPress={() => run('analyzing')}>
                    <Text style={styles.primaryBtnText}>Refresh analysis</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={styles.body}>
                  {NEW_CHECKINS_FOR_REFRESH - state.newSince} more check-in
                  {NEW_CHECKINS_FOR_REFRESH - state.newSince > 1 ? 's' : ''} until I can refresh this analysis.
                </Text>
              )}
            </Card>
          </>
        )}
        {actionError && <Text style={styles.error}>{actionError}</Text>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { marginBottom: spacing.sm },
  back: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...font.h1, color: colors.text },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2 },
  meta: { ...font.small, color: colors.textFaint },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...font.title, color: colors.text, flex: 1 },
  body: { ...font.body, color: colors.textMuted, lineHeight: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: 6 },
  progressLabel: { ...font.small, color: colors.textMuted },
  progressVal: { ...font.small, color: colors.text, fontWeight: '600' },
  explore: { ...font.body, fontWeight: '600', marginTop: spacing.md },
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
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    marginTop: spacing.md,
  },
  primaryBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  linkBtn: { marginTop: spacing.md, alignSelf: 'flex-start' },
  linkText: { color: colors.purple, fontWeight: '600', fontSize: 13 },
  error: { ...font.body, color: colors.danger, textAlign: 'center' },
});
