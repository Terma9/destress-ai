/**
 * Untangle: two ways to deal with stress.
 *   Calm Now       — stressed right now? A few minutes to slow down together.
 *   Stress Solving — something keeps coming back? A plan that fits you.
 * Below: "My plans" (one living plan per stressor) and "Solved": every
 * solved plan is a success story, which can be shared in the community.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { InlineLoader, Logo } from '@/components/brand';
import { FadeIn, LivingGradient, PressableScale } from '@/components/motion';
import { Card, Screen } from '@/components/ui';
import { THEME_LABELS, useMyStories } from '@/data/community';
import { type UntangleSession, useUntangleSessions } from '@/data/untangle';
import { colors, fields, font, fontFamily, radii, shadow, spacing } from '@/theme';

const short = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function UntangleHome() {
  const router = useRouter();
  const { sessions, error } = useUntangleSessions();
  const stories = useMyStories();

  const plans = (sessions ?? []).filter((s) => s.kind === 'plan');
  const active = plans.filter((s) => s.status === 'active');

  return (
    <Screen>
      <Text style={styles.title}>Untangle</Text>
      <Text style={styles.sub}>Calm stress in the moment, or solve what keeps coming back</Text>

      <FadeIn style={styles.tiles}>
        <ModeTile
          title="Calm Now"
          line="Calm down in a few minutes"
          field={fields.stress}
          visual={<BreathingOrb color={fields.stress.deep} />}
          onPress={() => router.push('/untangle/calm')}
        />
        <ModeTile
          title="Stress Solving"
          line="Solve what keeps coming back"
          field={fields.mood}
          visual={<UntangledLine color={fields.mood.deep} />}
          onPress={() => router.push('/untangle/new')}
        />
      </FadeIn>

      <FadeIn delay={150} style={{ marginTop: spacing.xl }}>
        <Text style={styles.heading}>My plans</Text>
        <Text style={styles.sectionHint}>One plan per stressor. Give updates, and the plan grows with you.</Text>
        {error ? (
          <Text style={styles.note}>Couldn't load your plans. Check your connection.</Text>
        ) : sessions === null ? (
          <InlineLoader />
        ) : active.length === 0 ? (
          <Card style={styles.empty}>
            <Logo size={40} />
            <Text style={styles.note}>No plans yet. Start with Stress Solving when something keeps coming back.</Text>
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
          <Text style={styles.heading}>Solved</Text>
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

type Field = { from: string; to: string; ink: string; deep: string };

/** One of the two ways in: a big tile with a small animation that shows what it does. */
function ModeTile({ title, line, field, visual, onPress }: { title: string; line: string; field: Field; visual: ReactNode; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={title} style={{ flex: 1 }}>
      <LivingGradient colors={[field.from, field.to, field.from]} style={styles.tile} speed={10000}>
        <View style={styles.visual}>{visual}</View>
        <View>
          <Text style={[styles.tileTitle, { color: field.ink }]}>{title}</Text>
          <Text style={[styles.tileLine, { color: field.ink }]}>{line}</Text>
        </View>
        <View style={styles.tileArrow}>
          <Ionicons name="arrow-forward" size={16} color={field.deep} />
        </View>
      </LivingGradient>
    </PressableScale>
  );
}

/** Calm Now: an orb that slowly grows and shrinks, like a calm breath. */
function BreathingOrb({ color }: { color: string }) {
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: 0.75 + breath.value * 0.35 }], opacity: 0.35 - breath.value * 0.15 }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: 0.9 + breath.value * 0.12 }] }));
  return (
    <View style={styles.orbBox}>
      <Reanimated.View style={[styles.orbHalo, { backgroundColor: color }, halo]} />
      <Reanimated.View style={[styles.orbCore, { backgroundColor: color }, core]}>
        <Ionicons name="leaf" size={18} color="#FFFFFF" />
      </Reanimated.View>
    </View>
  );
}

/** Stress Solving: one soft loop that becomes a straight line, with a dot at the goal. */
function UntangledLine({ color }: { color: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.35 }], opacity: 0.25 + pulse.value * 0.2 }));
  return (
    <View style={{ width: 96, height: 56 }}>
      <Svg width={96} height={56} viewBox="0 0 96 56">
        <Path
          d="M8 36 C 16 36, 32 32, 32 21 C 32 12, 19 12, 19 21 C 19 31, 34 28, 48 28 L 82 28"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={84} cy={28} r={5} fill={color} />
      </Svg>
      <Reanimated.View style={[styles.goalPulse, { backgroundColor: color }, dot]} />
    </View>
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
  tiles: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  tile: {
    minHeight: 210,
    borderRadius: radii.lg,
    padding: spacing.md,
    paddingTop: spacing.lg,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    ...shadow.card,
  },
  visual: { height: 64, justifyContent: 'center' },
  tileTitle: { fontFamily: fontFamily.bold, fontSize: 19, letterSpacing: -0.3, marginTop: spacing.md },
  tileLine: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 17, marginTop: 4, opacity: 0.8 },
  tileArrow: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  orbBox: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  orbHalo: { position: 'absolute', width: 64, height: 64, borderRadius: 32 },
  orbCore: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  goalPulse: { position: 'absolute', left: 74, top: 18, width: 20, height: 20, borderRadius: 10 },
  heading: { fontFamily: fontFamily.bold, fontSize: 22, letterSpacing: -0.3, color: colors.ink },
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
