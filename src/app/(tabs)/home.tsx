import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, GradientCard, Screen } from '@/components/ui';
import { useCheckins } from '@/data/checkins';
import { moods } from '@/data/content';
import { useLatestInsight } from '@/data/deepDives';
import { computeStreak, getGreeting } from '@/lib/dates';
import { disableDailyReminder, enableDailyReminder, remindersSupported } from '@/lib/reminders';
import { selectTodayMood, useAppStore } from '@/store/useAppStore';
import { colors, font, gradients, radii, shadow, spacing } from '@/theme';

const tiles = [
  { key: 'deep', title: 'AI Deep Dives', sub: 'Personalized insights', icon: 'analytics-outline', bg: '#EDE9FE', tint: '#7C3AED', href: '/deep-dives' },
  { key: 'prog', title: 'Progress', sub: 'Track wellness', icon: 'trending-up-outline', bg: '#FCE7F3', tint: '#EC4899', href: '/(tabs)/tracker' },
] as const;

export default function Home() {
  const router = useRouter();
  const { setTodayMood, name, activityDates, reminderEnabled, setReminderEnabled } = useAppStore();
  const { checkins } = useCheckins();
  const todayMood = useAppStore(selectTodayMood);
  const insight = useLatestInsight();
  const streak = computeStreak(activityDates);
  const greeting = getGreeting();

  const toggleReminder = async () => {
    if (reminderEnabled) {
      await disableDailyReminder();
      setReminderEnabled(false);
    } else {
      const ok = await enableDailyReminder();
      setReminderEnabled(ok);
    }
  };

  return (
    <Screen>
      <View style={styles.greetRow}>
        <Ionicons name={greeting === 'Good Evening' ? 'moon' : 'sunny'} size={20} color={colors.star} />
        <Text style={[styles.greet, { flex: 1 }]}>
          {greeting}
          {name ? `, ${name}` : ''}
        </Text>
        {remindersSupported && (
          <Pressable onPress={toggleReminder} hitSlop={8} style={styles.bell}>
            <Ionicons
              name={reminderEnabled ? 'notifications' : 'notifications-outline'}
              size={20}
              color={reminderEnabled ? colors.primary : colors.textFaint}
            />
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>How are you feeling today?</Text>

      {/* Daily check-in */}
      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.cardLabel}>Daily Check-In</Text>
        <View style={styles.moodRow}>
          {moods.map((m) => {
            const active = todayMood === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setTodayMood(m.key)}
                style={[styles.mood, active && styles.moodActive]}>
                <Text style={{ fontSize: 26 }}>{m.emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Today's insight */}
      <GradientCard colors={gradients.insight} style={{ marginTop: spacing.lg }}>
        <View style={styles.insightHead}>
          <Ionicons name="sparkles" size={16} color={colors.white} />
          <Text style={styles.insightTitle}>Today's Insight</Text>
        </View>
        <Text style={styles.insightBody}>
          {insight ?? "I'm learning about your stress patterns. Check in regularly to unlock personalized insights!"}
        </Text>
        <Pressable onPress={() => router.push('/deep-dives')} style={styles.insightBtn}>
          <Text style={styles.insightBtnText}>Explore More</Text>
        </Pressable>
      </GradientCard>

      {/* Feature grid */}
      <View style={styles.grid}>
        {tiles.map((t) => (
          <Card key={t.key} style={styles.tile} onPress={() => router.push(t.href as any)}>
            <View style={[styles.tileIcon, { backgroundColor: t.bg }]}>
              <Ionicons name={t.icon as any} size={20} color={t.tint} />
            </View>
            <Text style={styles.tileTitle}>{t.title}</Text>
            <Text style={styles.tileSub}>{t.sub}</Text>
          </Card>
        ))}
      </View>

      {/* Streak strip */}
      <View style={styles.streak}>
        <View>
          <Text style={styles.streakLabel}>Your Streak</Text>
          <Text style={styles.streakValue}>
            {streak} {streak === 1 ? 'Day' : 'Days'} 🔥
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.streakLabel}>Total Entries</Text>
          <Text style={styles.streakValue}>{checkins?.length ?? '–'}</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greet: { ...font.h2, color: colors.text },
  bell: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  sub: { ...font.body, color: colors.textMuted, marginTop: 4 },
  cardLabel: { ...font.title, color: colors.text, marginBottom: spacing.md },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mood: {
    width: 50,
    height: 50,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
  },
  moodActive: { backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: colors.primary },
  insightHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  insightTitle: { ...font.title, color: colors.white },
  insightBody: { ...font.body, color: 'rgba(255,255,255,0.92)', lineHeight: 20 },
  insightBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  insightBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  tile: { width: '47.5%', gap: 6, paddingVertical: spacing.lg },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileTitle: { ...font.title, color: colors.text },
  tileSub: { ...font.small, color: colors.textMuted },
  streak: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.soft,
  },
  streakLabel: { ...font.small, color: '#92400E' },
  streakValue: { ...font.title, color: '#78350F', marginTop: 2 },
});
