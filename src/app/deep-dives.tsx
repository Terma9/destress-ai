/**
 * Weekly Insights: a look back at the week, written automatically once it's
 * due (7 days after the last, with new check-ins). Four parts:
 * the week in numbers vs last week (computed by code), patterns with the
 * entries behind them (AI, citations checked by code), what worked, and one
 * question for the week ahead.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { generateDeepDives, loadDemoData } from '@/ai/checkinClient';
import { InlineLoader, Logo, SoftDots } from '@/components/brand';
import { FIELD_LABELS } from '@/components/fields';
import { AiMark, PressableScale } from '@/components/motion';
import { Card, Screen } from '@/components/ui';
import { type Analysis, diveStyle, insightsDue, MIN_CHECKINS, useDeepDives } from '@/data/deepDives';
import { colors, type FieldKey, fields, font, fontFamily, gradients, radii, shadow, spacing } from '@/theme';
import { LinearGradient } from 'expo-linear-gradient';

const KINDS: FieldKey[] = ['stress', 'sleep', 'mood'];

export default function WeeklyInsights() {
  const router = useRouter();
  const { state, error, reload } = useDeepDives();
  const [busy, setBusy] = useState<'idle' | 'writing' | 'demo'>('idle');
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(kind: 'writing' | 'demo') {
    setBusy(kind);
    setActionError(null);
    try {
      await (kind === 'writing' ? generateDeepDives() : loadDemoData());
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy('idle');
    }
  }

  const analysis = state?.analysis ?? null;

  return (
    <Screen tint="indigo">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.round} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
        <Logo size={30} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Weekly Insights</Text>
          {analysis && <Text style={styles.sub}>{weekRange(analysis.created_at)}</Text>}
        </View>
      </View>

      {error ? (
        <Text style={styles.note}>Couldn't load your Weekly Insights. Check your connection and come back.</Text>
      ) : !state ? (
        <InlineLoader />
      ) : busy !== 'idle' ? (
        <Card style={styles.center}>
          <SoftDots color={fields.sleep.deep} size={6} />
          <Text style={styles.note}>{busy === 'demo' ? 'Loading two weeks of demo days…' : 'Looking back at your week…'}</Text>
        </Card>
      ) : !analysis ? (
        <Card style={styles.center}>
          <Logo size={56} />
          <Text style={styles.emptyTitle}>Your first look back is coming</Text>
          <Text style={styles.note}>
            After {MIN_CHECKINS} check-ins I'll show you your week in numbers, patterns with the entries behind them,
            what worked, and a question for the next week. ({state.total}/{MIN_CHECKINS})
          </Text>
          {insightsDue(state) && <SmallButton label="Write them now" onPress={() => run('writing')} />}
          {state.total === 0 && <SmallButton label="Load demo data" onPress={() => run('demo')} />}
        </Card>
      ) : (
        <Insights analysis={analysis} onOpen={(id) => router.push({ pathname: '/deep-dive/[id]', params: { id } })} />
      )}

      {analysis && insightsDue(state!) && busy === 'idle' && (
        <SmallButton label="Write this week's insights" onPress={() => run('writing')} />
      )}
      {actionError && <Text style={styles.note}>{actionError}</Text>}
    </Screen>
  );
}

function Insights({ analysis, onOpen }: { analysis: Analysis; onOpen: (id: string) => void }) {
  const { week } = analysis;
  return (
    <View style={{ gap: spacing.lg }}>
      <Animated.View entering={FadeInDown.duration(420)}>
        <LinearGradient colors={[fields.sleep.from, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <AiMark label="YOUR WEEK IN ONE SENTENCE" color={fields.sleep.deep} size={11} />
          <Text style={styles.heroText}>{analysis.insight}</Text>
        </LinearGradient>
      </Animated.View>

      {week.thisWeek && (
        <Animated.View entering={FadeInDown.duration(420).delay(90)}>
          <Text style={styles.label}>THIS WEEK VS LAST WEEK · {week.checkins} CHECK-INS</Text>
          <View style={styles.tiles}>
            {KINDS.map((k) => {
              const now = week.thisWeek?.[k] ?? null;
              const before = week.lastWeek?.[k] ?? null;
              const diff = now !== null && before !== null ? Math.round((now - before) * 10) / 10 : null;
              return (
                <View key={k} style={[styles.tile, { backgroundColor: fields[k].from }]}>
                  <Text style={[styles.tileLabel, { color: fields[k].ink }]}>{FIELD_LABELS[k]}</Text>
                  <Text style={[styles.tileValue, { color: fields[k].ink }]}>{now ?? '–'}</Text>
                  <Text style={styles.tileDiff}>
                    {diff === null ? 'no week before' : diff === 0 ? 'same' : `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)}`}
                  </Text>
                </View>
              );
            })}
          </View>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.duration(420).delay(180)}>
        <Text style={styles.label}>PATTERNS</Text>
        <View style={{ gap: spacing.sm }}>
          {analysis.deepDives.map((d) => {
            const style = diveStyle(d.icon);
            return (
              <Card key={d.id} onPress={() => onOpen(d.id)}>
                <View style={styles.patternRow}>
                  <View style={[styles.icon, { backgroundColor: fields.sleep.from }]}>
                    <Ionicons name={style.name as never} size={18} color={fields.sleep.deep} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patternTitle}>{d.title}</Text>
                    <Text style={styles.patternText} numberOfLines={3}>
                      {d.description}
                    </Text>
                    <Text style={styles.evidence}>
                      Based on {new Set(d.findings.flatMap((f) => f.evidence)).size} of your entries →
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      </Animated.View>

      {analysis.worked.length > 0 && (
        <Animated.View entering={FadeInDown.duration(420).delay(270)}>
          <Text style={styles.label}>WHAT WORKED</Text>
          <Card style={{ gap: spacing.sm }}>
            {analysis.worked.map((w, i) => (
              <View key={i} style={styles.workedRow}>
                <Ionicons name={w.source === 'untangle' ? 'git-branch-outline' : 'checkmark-circle'} size={16} color={fields.mood.deep} />
                <Text style={styles.workedText}>{w.text}</Text>
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {analysis.question && (
        <Animated.View entering={FadeInDown.duration(420).delay(360)}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.question}>
            <Text style={styles.questionLabel}>FOR THE WEEK AHEAD</Text>
            <Text style={styles.questionText}>{analysis.question}</Text>
            <Text style={styles.questionHint}>Your next check-ins can pick this up.</Text>
          </LinearGradient>
        </Animated.View>
      )}
    </View>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </PressableScale>
  );
}

/** "12 – 19 Oct" for the 7 days ending on the analysis day. */
function weekRange(createdAt: string): string {
  const end = new Date(createdAt);
  const start = new Date(end.getTime() - 6 * 86_400_000);
  const f = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${f(start)} – ${f(end)}`;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  title: { ...font.h2, color: colors.ink },
  sub: { ...font.small, color: colors.textMuted },
  label: { ...font.label, color: colors.textMuted, marginBottom: spacing.sm },
  note: { ...font.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md, lineHeight: 20 },
  center: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { ...font.h3, color: colors.ink, marginTop: spacing.md },
  hero: { borderRadius: radii.lg, padding: spacing.lg, ...shadow.soft },
  heroText: { fontFamily: fontFamily.medium, fontSize: 17, lineHeight: 24, color: colors.ink, marginTop: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, borderRadius: radii.md, padding: 12 },
  tileLabel: { fontFamily: fontFamily.semibold, fontSize: 12 },
  tileValue: { fontFamily: fontFamily.bold, fontSize: 26, letterSpacing: -0.5, marginTop: 2 },
  tileDiff: { ...font.tiny, color: colors.inkSoft },
  patternRow: { flexDirection: 'row', gap: spacing.md },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  patternTitle: { ...font.title, color: colors.ink },
  patternText: { ...font.body, color: colors.inkSoft, marginTop: 2, lineHeight: 20 },
  evidence: { fontFamily: fontFamily.semibold, fontSize: 12, color: fields.sleep.ink, marginTop: spacing.sm },
  workedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  workedText: { ...font.body, color: colors.ink, flex: 1 },
  question: { borderRadius: radii.lg, padding: spacing.lg },
  questionLabel: { ...font.label, color: 'rgba(255,255,255,0.7)' },
  questionText: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 24, color: colors.ivory, marginTop: spacing.sm },
  questionHint: { ...font.small, color: 'rgba(255,255,255,0.65)', marginTop: spacing.sm },
  button: {
    alignSelf: 'center',
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: spacing.lg,
  },
  buttonText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink },
});
