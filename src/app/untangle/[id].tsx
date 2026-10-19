/**
 * One plan from "My plans": the idea behind it (why it fits you), steps to
 * tick off, how you'll notice it works, what your past check-ins show (with
 * the entries behind it), and earlier versions. From here the user keeps
 * talking about it ("Tell me how it's going") or marks it solved, which
 * saves a success story they can share in the community.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { InlineLoader, Logo, SoftDots } from '@/components/brand';
import { CrisisCard } from '@/components/chat';
import { AiMark, PressableScale } from '@/components/motion';
import { Card, Screen } from '@/components/ui';
import { THEME_LABELS } from '@/data/community';
import type { EvidenceEntry } from '@/data/deepDives';
import { fetchSession, markSolved, savePlan, type UntangleSession } from '@/data/untangle';
import { colors, fields, font, fontFamily, gradients, radii, shadow, spacing } from '@/theme';

const short = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<{ session: UntangleSession; evidence: EvidenceEntry[] } | null | undefined>();
  const [loadError, setLoadError] = useState(false);
  const [solving, setSolving] = useState<'closed' | 'pick' | 'saving'>('closed');
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchSession(id)
        .then((d) => {
          setData(d);
          setLoadError(false);
        })
        .catch(() => setLoadError(true));
    }, [id]),
  );

  const header = (
    <View style={styles.topRow}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.round} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={18} color={colors.ink} />
      </Pressable>
    </View>
  );

  if (loadError || data === null || data?.session.plan === null) {
    return (
      <Screen>
        {header}
        <Card style={styles.center}>
          <Logo size={44} />
          <Text style={styles.body}>{loadError ? "Couldn't load this plan." : 'This plan no longer exists.'}</Text>
        </Card>
      </Screen>
    );
  }
  if (data === undefined) {
    return (
      <Screen>
        {header}
        <InlineLoader />
      </Screen>
    );
  }

  const { session, evidence } = data;
  const plan = session.plan!;
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const solved = session.status === 'solved';
  const version = session.plan_history.length + 1;

  /** Ticks a step on or off right away and saves it in the background (rolled back on failure). */
  async function toggleStep(index: number) {
    const next = { ...plan, steps: plan.steps.map((s, i) => (i === index ? { ...s, done: !s.done } : s)) };
    setData((d) => d && { ...d, session: { ...d.session, plan: next } });
    try {
      await savePlan(session.id, next);
    } catch {
      setData((d) => d && { ...d, session: { ...d.session, plan } });
    }
  }

  async function solve(theme: string) {
    setSolving('saving');
    setError(null);
    try {
      const storyId = await markSolved(session, theme);
      router.replace({ pathname: '/success/[id]', params: { id: storyId } });
    } catch (err) {
      setError((err as Error).message);
      setSolving('pick');
    }
  }

  return (
    <Screen tint="sage">
      {header}
      {session.risk_level !== 'none' && (
        <View style={{ marginBottom: spacing.lg }}>
          <CrisisCard />
        </View>
      )}

      <Animated.View entering={FadeInDown.duration(420)}>
        <View style={styles.metaRow}>
          <View style={[styles.status, solved && { backgroundColor: fields.mood.to }]}>
            <Text style={[styles.statusText, solved && { color: fields.mood.deep }]}>{solved ? 'Solved' : 'Active'}</Text>
          </View>
          <Text style={styles.meta}>
            Since {short(session.created_at)}
            {version > 1 ? ` · version ${version}` : ''}
          </Text>
        </View>
        <Text style={styles.title}>{session.title}</Text>
        <Text style={styles.problem}>{session.problem}</Text>
      </Animated.View>

      {plan.approach ? (
        <Animated.View entering={FadeInDown.duration(420).delay(80)} style={{ marginTop: spacing.lg }}>
          <LinearGradient colors={[fields.sleep.from, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.approach}>
            <AiMark label="WHY THIS PLAN FITS YOU" color={fields.sleep.deep} size={11} />
            <Text style={styles.approachText}>{plan.approach}</Text>
          </LinearGradient>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(420).delay(160)} style={{ marginTop: spacing.lg }}>
        <Text style={styles.label}>YOUR STEPS</Text>
        <Card>
          {plan.steps.map((s, i) => (
            <Pressable key={i} style={[styles.stepRow, i > 0 && { marginTop: spacing.md }]} onPress={() => toggleStep(i)}>
              <Ionicons name={s.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={s.done ? fields.mood.deep : colors.textFaint} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepText, s.done && styles.stepDone]}>{s.text}</Text>
                <Text style={styles.stepMeta}>~{s.minutes} min</Text>
              </View>
            </Pressable>
          ))}
          {plan.watch_for ? (
            <View style={styles.watch}>
              <Ionicons name="eye-outline" size={15} color={colors.inkSoft} />
              <Text style={styles.watchText}>{plan.watch_for}</Text>
            </View>
          ) : null}
          {plan.note ? <Text style={styles.note}>{plan.note}</Text> : null}
        </Card>
      </Animated.View>

      {plan.lessons.length > 0 && (
        <Animated.View entering={FadeInDown.duration(420).delay(240)} style={{ marginTop: spacing.lg }}>
          <Text style={styles.label}>WHAT YOUR PAST SHOWS</Text>
          <Card>
            {plan.lessons.map((l, i) => (
              <View key={i} style={i > 0 && { marginTop: spacing.lg }}>
                <View style={styles.stepRow}>
                  <Ionicons
                    name={l.kind === 'helped' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                    size={20}
                    color={l.kind === 'helped' ? fields.mood.deep : fields.stress.deep}
                  />
                  <Text style={[styles.stepText, { flex: 1 }]}>{l.text}</Text>
                </View>
                <View style={styles.chips}>
                  {l.evidence
                    .map((eid) => byId.get(eid))
                    .filter((e): e is EvidenceEntry => !!e)
                    .map((e) => (
                      <Pressable
                        key={e.id}
                        style={styles.chip}
                        onPress={() => router.push({ pathname: '/entry/[id]', params: { id: e.id } })}>
                        <Text style={styles.chipText} numberOfLines={1}>
                          {short(e.created_at)} · {e.title ?? 'Check-in'}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {session.outcome_note ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.label}>FROM YOUR CHECK-INS</Text>
          <Text style={styles.body}>{session.outcome_note}</Text>
        </Card>
      ) : null}

      {session.plan_history.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <Pressable onPress={() => setShowHistory((v) => !v)} style={styles.historyHead}>
            <Text style={styles.label}>EARLIER VERSIONS ({session.plan_history.length})</Text>
            <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
          </Pressable>
          {showHistory &&
            [...session.plan_history].reverse().map((h, i) => (
              <Card key={i} style={styles.history}>
                <Text style={styles.meta}>Until {short(h.replaced_at)}</Text>
                {h.plan.steps.map((s, j) => (
                  <Text key={j} style={styles.historyStep}>
                    {s.done ? '✓' : '·'} {s.text}
                  </Text>
                ))}
              </Card>
            ))}
        </View>
      )}

      {!solved && (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <PressableScale onPress={() => router.push({ pathname: '/untangle/new', params: { sessionId: session.id } })}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.ivory} />
              <Text style={styles.primaryText}>Tell me how it's going</Text>
            </LinearGradient>
          </PressableScale>

          {solving === 'closed' ? (
            <PressableScale onPress={() => setSolving('pick')} style={styles.secondary}>
              <Ionicons name="trophy-outline" size={16} color={colors.ink} />
              <Text style={styles.secondaryText}>Mark as solved</Text>
            </PressableScale>
          ) : (
            <Animated.View entering={FadeInDown.duration(380)}>
              <Card>
                <Text style={styles.solveTitle}>Well done! What was it about?</Text>
                <Text style={styles.body}>Your plan is saved as a success story. You can share it in the community if you like.</Text>
                {solving === 'saving' ? (
                  <View style={{ marginTop: spacing.md }}>
                    <SoftDots />
                  </View>
                ) : (
                  <View style={[styles.chips, { marginLeft: 0, marginTop: spacing.md }]}>
                    {Object.entries(THEME_LABELS).map(([key, label]) => (
                      <PressableScale key={key} style={styles.themeChip} onPress={() => solve(key)}>
                        <Text style={styles.themeChipText}>{label}</Text>
                      </PressableScale>
                    ))}
                  </View>
                )}
              </Card>
            </Animated.View>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}

      <Text style={styles.disclaimer}>AI-generated suggestions. They can be wrong, and they aren't medical advice.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { marginBottom: spacing.md },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  status: { backgroundColor: colors.sand, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontFamily: fontFamily.semibold, fontSize: 11, color: colors.ink },
  meta: { ...font.small, color: colors.textMuted },
  title: { ...font.h1, color: colors.ink, marginTop: spacing.sm },
  problem: { ...font.body, color: colors.inkSoft, lineHeight: 21, marginTop: 4 },
  approach: { borderRadius: radii.lg, padding: spacing.lg, ...shadow.soft },
  approachText: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: colors.ink, marginTop: spacing.sm },
  label: { ...font.label, color: colors.textMuted, marginBottom: spacing.sm },
  stepRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepText: { ...font.body, color: colors.ink, lineHeight: 21 },
  stepDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  stepMeta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  watch: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, backgroundColor: colors.sand, borderRadius: radii.md, padding: spacing.md },
  watchText: { ...font.small, color: colors.inkSoft, flex: 1, lineHeight: 18 },
  note: { ...font.body, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.md, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginLeft: 32 },
  chip: { backgroundColor: colors.sand, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 5, maxWidth: '100%' },
  chipText: { ...font.small, color: colors.ink },
  body: { ...font.body, color: colors.inkSoft, lineHeight: 20 },
  historyHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  history: { marginBottom: spacing.sm, gap: 4, opacity: 0.8 },
  historyStep: { ...font.small, color: colors.inkSoft },
  primary: { height: 54, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadow.lifted },
  primaryText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.ivory },
  secondary: { height: 48, borderRadius: radii.md, backgroundColor: colors.sand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink },
  solveTitle: { ...font.title, color: colors.ink, marginBottom: 4 },
  themeChip: { backgroundColor: fields.mood.from, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8 },
  themeChipText: { fontFamily: fontFamily.semibold, fontSize: 13, color: fields.mood.ink },
  error: { ...font.small, color: colors.danger },
  disclaimer: { ...font.small, color: colors.textFaint, textAlign: 'center', marginTop: spacing.xl },
});
