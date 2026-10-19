/**
 * Today: the evening check-in is the hero. Below it, the latest values as
 * color fields with a 7-day line, the AI's note from the week, and a way
 * into Untangle for acute stress.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Logo, SoftDots } from '@/components/brand';
import { FieldTile } from '@/components/fields';
import { AiMark, FadeIn, LivingGradient, PressableScale, PulseDot, Sheen } from '@/components/motion';
import { Card, Screen } from '@/components/ui';
import { type Checkin, useCheckins } from '@/data/checkins';
import { MIN_CHECKINS, useWeeklyInsights } from '@/data/deepDives';
import { lastSevenDays, useDailyMetrics } from '@/data/metrics';
import { computeStreak, dateKey, getGreeting, todayKey } from '@/lib/dates';
import { disableDailyReminder, enableDailyReminder, remindersSupported } from '@/lib/reminders';
import { useAppStore } from '@/store/useAppStore';
import { colors, fields, font, fontFamily, gradients, radii, shadow, spacing } from '@/theme';

/** "Yesterday", or a short date like "Fri, 16 Oct". */
function dayLabel(day: string): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === dateKey(yesterday)) return 'Yesterday';
  return new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

/** The entry's three values as small color-field chips. */
function ValueChips({ entry }: { entry: Checkin }) {
  const items = [
    { kind: 'stress' as const, label: 'Stress', value: entry.stress },
    { kind: 'sleep' as const, label: 'Sleep', value: entry.sleep },
    { kind: 'mood' as const, label: 'Mood', value: entry.emotion },
  ];
  return (
    <View style={styles.chips}>
      {items.map((i) => (
        <View key={i.kind} style={[styles.chip, { backgroundColor: fields[i.kind].from }]}>
          <Text style={[styles.chipText, { color: fields[i.kind].ink }]}>
            {i.label} {i.value ?? '–'}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function Today() {
  const router = useRouter();
  const { name, activityDates, reminderEnabled, setReminderEnabled } = useAppStore();
  const { checkins } = useCheckins();
  const { rows } = useDailyMetrics();
  const weekly = useWeeklyInsights();
  const streak = computeStreak(activityDates);
  const greeting = getGreeting();

  const today = todayKey();
  const entryDay = (c: Checkin) => c.day ?? dateKey(new Date(c.created_at));
  const todaysEntry = checkins?.find((c) => entryDay(c) === today) ?? null;
  const recent = (checkins ?? []).filter((c) => entryDay(c) !== today).slice(0, 5);

  // Show today's values once there are any, otherwise yesterday's.
  const days = lastSevenDays();
  const byDay = new Map((rows ?? []).map((r) => [r.day, r]));
  const todayRow = byDay.get(today);
  const showDay = todayRow && (todayRow.stress ?? todayRow.sleep ?? todayRow.emotion) !== null ? today : days[5];
  const shown = byDay.get(showDay);
  const history = (key: 'stress' | 'sleep' | 'emotion') => days.map((d) => byDay.get(d)?.[key] ?? null);

  const toggleReminder = async () => {
    if (reminderEnabled) {
      await disableDailyReminder();
      setReminderEnabled(false);
    } else {
      setReminderEnabled(await enableDailyReminder());
    }
  };

  return (
    <Screen>
      <FadeIn>
        <View style={styles.headRow}>
          <View style={styles.brandRow}>
            <Logo size={26} />
            <Text style={styles.date}>
              {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          {remindersSupported && (
            <Pressable onPress={toggleReminder} hitSlop={8} style={styles.bell} accessibilityLabel="Evening reminder">
              <Ionicons
                name={reminderEnabled ? 'notifications' : 'notifications-outline'}
                size={18}
                color={reminderEnabled ? fields.stress.ink : colors.textMuted}
              />
            </Pressable>
          )}
        </View>
        <Text style={styles.greeting}>
          {greeting.charAt(0) + greeting.slice(1).toLowerCase()}
          {name ? `,\n${name}` : ''}
        </Text>
        {streak >= 2 && (
          <View style={styles.streak}>
            <Ionicons name="flame" size={13} color={fields.stress.ink} />
            <Text style={styles.streakText}>{streak} days in a row</Text>
          </View>
        )}
      </FadeIn>

      <FadeIn delay={90} style={{ marginTop: spacing.lg }}>
        {todaysEntry ? (
          <Card onPress={() => router.push({ pathname: '/entry/[id]', params: { id: todaysEntry.id } })}>
            <View style={styles.doneRow}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark" size={16} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.doneLabel}>Today's entry is written</Text>
                <Text style={styles.doneTitle}>{todaysEntry.title ?? 'Check-in'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </View>
            <View style={styles.entryValues}>
              <ValueChips entry={todaysEntry} />
            </View>
            <PressableScale onPress={() => router.push('/diary/new')} style={styles.continueBtn}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.ink} />
              <Text style={styles.continueText}>Add to today's check-in</Text>
            </PressableScale>
          </Card>
        ) : (
          <PressableScale onPress={() => router.push('/diary/new')} accessibilityLabel="Start tonight's check-in">
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
              <Sheen />
              <View>
                <View style={styles.ctaRow}>
                  <PulseDot />
                  <Text style={styles.ctaTitle}>Tonight's check-in</Text>
                </View>
                <Text style={styles.ctaSub}>2 minutes · write or speak</Text>
              </View>
              <View style={styles.ctaArrow}>
                <Ionicons name="arrow-forward" size={20} color={colors.ink} />
              </View>
            </LinearGradient>
          </PressableScale>
        )}
      </FadeIn>

      <FadeIn delay={170} style={{ marginTop: spacing.xl }}>
        <Text style={styles.label}>{showDay === today ? 'TODAY' : 'YESTERDAY'}</Text>
        <View style={styles.tiles}>
          <FieldTile kind="stress" value={shown?.stress ?? null} history={history('stress')} />
          <FieldTile kind="sleep" value={shown?.sleep ?? null} history={history('sleep')} delay={300} />
          <FieldTile kind="mood" value={shown?.emotion ?? null} history={history('emotion')} delay={600} />
        </View>
      </FadeIn>

      <FadeIn delay={250} style={{ marginTop: spacing.lg }}>
        <Card onPress={() => router.push('/deep-dives')} style={styles.insight}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', fields.sleep.from]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radii.lg }]}
          />
          <AiMark
            label={weekly.status === 'ready' && weekly.fresh ? 'YOUR WEEKLY INSIGHTS ARE READY' : 'WEEKLY INSIGHTS'}
            color={fields.sleep.deep}
          />
          {weekly.status === 'preparing' ? (
            <View style={styles.preparing}>
              <SoftDots color={fields.sleep.deep} />
              <Text style={styles.insightText}>Looking back at your week…</Text>
            </View>
          ) : (
            <Text style={styles.insightText}>
              {weekly.status === 'ready'
                ? weekly.analysis.insight
                : weekly.status === 'locked'
                  ? `After ${MIN_CHECKINS} check-ins I'll look back at your week: patterns, what worked, and a question for the next one (${weekly.total}/${MIN_CHECKINS}).`
                  : ' '}
            </Text>
          )}
          <Text style={styles.insightLink}>{weekly.status === 'ready' ? 'Open your week →' : 'See how it works →'}</Text>
        </Card>
      </FadeIn>

      <FadeIn delay={330} style={{ marginTop: spacing.lg }}>
        <PressableScale onPress={() => router.push('/untangle/calm')} accessibilityLabel="Calm now">
          <LivingGradient colors={['#F3D5C4', '#E8B39A', '#F0C7B1']} style={styles.untangle} speed={7000}>
            <View style={{ flex: 1 }}>
              <Text style={styles.untangleTitle}>Stressed right now?</Text>
              <Text style={styles.untangleSub}>Calm now: slow down together in a few minutes</Text>
            </View>
            <View style={styles.untangleIcon}>
              <Ionicons name="compass" size={22} color={fields.stress.ink} />
            </View>
          </LivingGradient>
        </PressableScale>
      </FadeIn>

      {recent.length > 0 && (
        <FadeIn delay={400} style={{ marginTop: spacing.xl }}>
          <View style={styles.recentHead}>
            <Text style={styles.label}>YOUR LAST DAYS</Text>
            <Pressable onPress={() => router.push('/(tabs)/calendar')} hitSlop={8}>
              <Text style={styles.recentAll}>Calendar →</Text>
            </Pressable>
          </View>
          <View style={{ gap: spacing.sm }}>
            {recent.map((entry) => (
              <Card
                key={entry.id}
                style={styles.recentCard}
                onPress={() => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}>
                <Text style={styles.recentDay}>{dayLabel(entry.day ?? dateKey(new Date(entry.created_at)))}</Text>
                <Text style={styles.recentTitle} numberOfLines={1}>
                  {entry.title ?? 'Check-in'}
                </Text>
                <ValueChips entry={entry} />
              </Card>
            ))}
          </View>
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { ...font.small, color: colors.textMuted },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  greeting: { ...font.display, color: colors.ink, marginTop: 6 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: fields.stress.from,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  streakText: { fontFamily: fontFamily.semibold, fontSize: 12, color: fields.stress.ink },
  cta: {
    borderRadius: radii.lg,
    padding: spacing.lg + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...shadow.lifted,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  ctaTitle: { fontFamily: fontFamily.semibold, fontSize: 17, color: colors.ivory },
  ctaSub: { ...font.small, color: 'rgba(251,250,247,0.65)', marginTop: 4, marginLeft: 17 },
  ctaArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  doneIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: fields.mood.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: { ...font.small, color: colors.textMuted },
  doneTitle: { ...font.title, color: colors.ink },
  label: { ...font.label, color: colors.textMuted, marginBottom: spacing.sm },
  entryValues: { marginTop: spacing.md },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  continueText: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.ink },
  recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  recentAll: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.inkSoft },
  recentCard: { paddingVertical: 14, gap: 6 },
  recentDay: { ...font.small, color: colors.textMuted },
  recentTitle: { ...font.title, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontFamily: fontFamily.semibold, fontSize: 11 },
  tiles: { flexDirection: 'row', gap: 9 },
  insight: { overflow: 'hidden' },
  insightText: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: spacing.sm },
  insightLink: { fontFamily: fontFamily.semibold, fontSize: 13, color: fields.sleep.ink, marginTop: spacing.md },
  preparing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  untangle: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  untangleTitle: { fontFamily: fontFamily.bold, fontSize: 16, color: '#5E2C17' },
  untangleSub: { ...font.small, color: '#7A4A33', marginTop: 2 },
  untangleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
