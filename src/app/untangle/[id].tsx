/**
 * An Untangle plan: next steps to tick off, lessons from past check-ins
 * (with the entries behind them), and "how intense is it now?" — the
 * before/after rating that lets the app learn what really helps.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CrisisCard } from '@/components/chat';
import { Card, EmptyState, GradientCard, Screen, SectionHeader } from '@/components/ui';
import { IntensityPicker, intensityColor } from '@/components/untangle';
import { moodEmoji } from '@/data/checkins';
import type { EvidenceEntry } from '@/data/deepDives';
import { fetchSession, rateAfter, savePlan, type UntangleSession } from '@/data/untangle';
import { colors, font, gradients, radii, spacing } from '@/theme';

export default function UntanglePlan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<{ session: UntangleSession; evidence: EvidenceEntry[] } | null | undefined>();
  const [loadError, setLoadError] = useState(false);
  const [after, setAfter] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const back = (
    <View style={styles.topRow}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
  );

  if (loadError || data === null) {
    return (
      <Screen>
        {back}
        <EmptyState
          icon={<Ionicons name="alert-circle-outline" size={32} color={colors.textFaint} />}
          title={loadError ? "Couldn't load this plan" : 'This plan no longer exists'}
        />
      </Screen>
    );
  }
  if (data === undefined) {
    return (
      <Screen>
        {back}
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  const { session, evidence } = data;
  const byId = new Map(evidence.map((e) => [e.id, e]));

  /** Ticks a step on or off right away and saves it in the background (rolled back on failure). */
  async function toggleStep(index: number) {
    const previous = session.plan;
    const plan = { ...previous, steps: previous.steps.map((s, i) => (i === index ? { ...s, done: !s.done } : s)) };
    setData((d) => d && { ...d, session: { ...d.session, plan } });
    try {
      await savePlan(session.id, plan);
    } catch {
      setData((d) => d && { ...d, session: { ...d.session, plan: previous } });
    }
  }

  async function saveAfter() {
    if (after === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      await rateAfter(session.id, after);
      setData((d) => d && { ...d, session: { ...d.session, intensity_after: after, completed_at: new Date().toISOString() } });
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const drop = session.intensity_after !== null ? session.intensity_before - session.intensity_after : null;

  return (
    <Screen>
      {back}
      {session.risk_level !== 'none' && (
        <View style={{ marginBottom: spacing.lg }}>
          <CrisisCard />
        </View>
      )}

      <GradientCard colors={gradients.aiAnalysis}>
        <View style={styles.headRow}>
          <Ionicons name="compass-outline" size={20} color={colors.white} />
          <Text style={styles.headTitle}>{session.title}</Text>
        </View>
        <Text style={styles.headBody}>{session.problem}</Text>
        <View style={styles.headChip}>
          <Text style={styles.headChipText}>
            Intensity {session.intensity_before}/10
            {session.intensity_after !== null ? ` → ${session.intensity_after}/10` : ''}
          </Text>
        </View>
      </GradientCard>

      <SectionHeader title="Your next steps" />
      <Card>
        {session.plan.steps.map((s, i) => (
          <Pressable key={i} style={[styles.stepRow, i > 0 && { marginTop: spacing.md }]} onPress={() => toggleStep(i)}>
            <Ionicons
              name={s.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={s.done ? colors.green : colors.textFaint}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepText, s.done && styles.stepDone]}>{s.text}</Text>
              <Text style={styles.stepMeta}>
                {i === 0 ? 'Start here · ' : ''}~{s.minutes} min
              </Text>
            </View>
          </Pressable>
        ))}
        {session.plan.note ? <Text style={styles.note}>{session.plan.note}</Text> : null}
      </Card>

      {session.plan.lessons.length > 0 && (
        <>
          <SectionHeader title="What your past shows" />
          <Card>
            {session.plan.lessons.map((l, i) => (
              <View key={i} style={i > 0 && { marginTop: spacing.lg }}>
                <View style={styles.stepRow}>
                  <Ionicons
                    name={l.kind === 'helped' ? 'checkmark-circle-outline' : 'warning-outline'}
                    size={20}
                    color={l.kind === 'helped' ? colors.green : '#F59E0B'}
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
                          {moodEmoji(e.mood)}{' '}
                          {new Date(e.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })} ·{' '}
                          {e.title ?? 'Check-in'}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionHeader title="How intense is it now?" />
      <Card>
        {session.intensity_after === null ? (
          <>
            <Text style={styles.body}>
              Come back after trying a step or two. Your answer helps me learn what really works for you.
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <IntensityPicker value={after} onChange={setAfter} />
            </View>
            <Pressable
              style={[styles.saveBtn, (after === null || saving) && { opacity: 0.45 }]}
              disabled={after === null || saving}
              onPress={saveAfter}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
            {saveError && <Text style={styles.error}>{saveError}</Text>}
          </>
        ) : (
          <View style={styles.result}>
            <Text style={styles.resultNumbers}>
              <Text style={{ color: intensityColor(session.intensity_before) }}>{session.intensity_before}</Text>
              {'  →  '}
              <Text style={{ color: intensityColor(session.intensity_after) }}>{session.intensity_after}</Text>
            </Text>
            <Text style={styles.body}>
              {drop !== null && drop >= 2
                ? "That's a real drop. I'll remember what helped for next time."
                : "Thanks for checking in. Tough moments don't always shift quickly, and that's okay."}
            </Text>
          </View>
        )}
      </Card>

      <Text style={styles.disclaimer}>AI-generated suggestions. They can be wrong, and they aren't medical advice.</Text>
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
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headTitle: { ...font.h3, color: colors.white, flex: 1 },
  headBody: { ...font.body, color: 'rgba(255,255,255,0.92)', lineHeight: 20, marginTop: spacing.sm },
  headChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.md,
  },
  headChipText: { ...font.small, color: colors.white, fontWeight: '600' },
  stepRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepText: { ...font.body, color: colors.text, lineHeight: 21 },
  stepDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  stepMeta: { ...font.small, color: colors.textFaint, marginTop: 2 },
  note: { ...font.body, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.lg, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginLeft: 32 },
  chip: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  chipText: { ...font.small, color: colors.text },
  body: { ...font.body, color: colors.textMuted, lineHeight: 20 },
  saveBtn: {
    alignSelf: 'flex-end',
    backgroundColor: colors.purple,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    minWidth: 90,
    alignItems: 'center',
  },
  saveText: { color: colors.white, fontWeight: '600' },
  error: { ...font.small, color: colors.danger, marginTop: spacing.sm },
  result: { alignItems: 'center', gap: spacing.sm },
  resultNumbers: { fontSize: 32, fontWeight: '700', color: colors.textFaint },
  disclaimer: { ...font.small, color: colors.textFaint, textAlign: 'center', marginTop: spacing.lg },
});
