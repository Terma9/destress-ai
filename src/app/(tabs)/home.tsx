/**
 * Today: the evening check-in is the hero. Below it, the Weekly Insights
 * (headline and the patterns found) and the last days.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Logo, SoftDots } from '@/components/brand';
import { FadeIn, PressableScale, PulseDot, Sheen } from '@/components/motion';
import { Card, Screen } from '@/components/ui';
import { type Checkin, useCheckins } from '@/data/checkins';
import { diveStyle, MIN_CHECKINS, useWeeklyInsights } from '@/data/deepDives';
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
  const weekly = useWeeklyInsights();
  const streak = computeStreak(activityDates);
  const greeting = getGreeting();

  const today = todayKey();
  const entryDay = (c: Checkin) => c.day ?? dateKey(new Date(c.created_at));
  const todaysEntry = checkins?.find((c) => entryDay(c) === today) ?? null;
  const recent = (checkins ?? []).filter((c) => entryDay(c) !== today).slice(0, 5);

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

      <FadeIn delay={200} style={{ marginTop: spacing.xl }}>
        <Card onPress={() => router.push('/deep-dives')} style={styles.insight}>
          <LinearGradient
            colors={[fields.sleep.from, '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radii.lg }]}
          />
          <View style={styles.insightHead}>
            <View style={styles.insightIcon}>
              <Ionicons name="sparkles" size={18} color={fields.sleep.deep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.insightTitle}>Weekly Insights</Text>
              <Text style={styles.insightSub}>What your check-ins show</Text>
            </View>
            {weekly.status === 'ready' && weekly.fresh && (
              <View style={styles.newPill}>
                <Text style={styles.newPillText}>NEW</Text>
              </View>
            )}
          </View>
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
          {weekly.status === 'ready' && weekly.analysis.deepDives.length > 0 && (
            <View style={styles.insightList}>
              {weekly.analysis.deepDives.map((d) => (
                <View key={d.id} style={styles.insightRow}>
                  <Ionicons name={diveStyle(d.icon).name as keyof typeof Ionicons.glyphMap} size={15} color={fields.sleep.deep} />
                  <Text style={styles.insightRowText}>{d.title}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.insightLink}>{weekly.status === 'ready' ? 'See the evidence →' : 'See how it works →'}</Text>
        </Card>
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
  insight: { overflow: 'hidden', borderWidth: 1, borderColor: fields.sleep.to },
  insightHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  insightIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontFamily: fontFamily.bold, fontSize: 19, color: colors.ink },
  insightSub: { ...font.small, color: colors.textMuted },
  newPill: { backgroundColor: fields.sleep.deep, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 3 },
  newPillText: { fontFamily: fontFamily.bold, fontSize: 10, letterSpacing: 0.6, color: colors.white },
  insightText: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: spacing.md },
  insightList: { marginTop: spacing.md, gap: 8 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 9 },
  insightRowText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink, flex: 1 },
  insightLink: { fontFamily: fontFamily.semibold, fontSize: 13, color: fields.sleep.ink, marginTop: spacing.md },
  preparing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
