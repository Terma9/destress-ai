import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, GradientCard, ProgressBar, Screen, SectionHeader } from '@/components/ui';
import { metrics as metricsMeta } from '@/data/content';
import { startOfLast7Days } from '@/lib/dates';
import { useAppStore } from '@/store/useAppStore';
import { colors, font, gradients, radii, spacing } from '@/theme';

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `Today, ${new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

/** How positive an entry's mood emoji reads — drives the little bar under each entry. */
const moodPositivity: Record<string, number> = {
  '😊': 0.95,
  '🙂': 0.75,
  '😐': 0.55,
  '😔': 0.35,
  '😰': 0.2,
};

export default function Diary() {
  const router = useRouter();
  const entries = useAppStore((s) => s.entries);
  const stress = useAppStore((s) => s.metrics.stress);

  const thisWeek = entries.filter((e) => e.createdAt >= startOfLast7Days()).length;
  const stressAvg = metricsMeta.find((m) => m.id === 'stress')?.weeklyAvg ?? 5;
  const delta = Math.round(((stress - stressAvg) / stressAvg) * 100);
  const improving = delta <= 0;

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Stress Diary</Text>
          <Text style={styles.sub}>Track what stresses you daily</Text>
        </View>
        <Pressable style={styles.fab} onPress={() => router.push('/diary/new')}>
          <Ionicons name="add" size={26} color={colors.white} />
        </Pressable>
      </View>

      {/* AI Analysis */}
      <GradientCard colors={gradients.aiAnalysis} style={{ marginTop: spacing.md }}>
        <View style={styles.aiHead}>
          <Ionicons name="sparkles" size={15} color={colors.white} />
          <Text style={styles.aiBadge}>AI Analysis</Text>
        </View>
        <Text style={styles.aiTitle}>Early Insights</Text>
        <Text style={styles.aiBody}>
          I'm starting to learn your stress patterns. Work-related stress appears frequently. Keep
          logging to unlock deeper insights and personalized coping strategies.
        </Text>
        <View style={styles.aiBtnRow}>
          <Pressable style={styles.aiBtn} onPress={() => router.push('/(tabs)/tracker')}>
            <Text style={styles.aiBtnText}>View Trends</Text>
          </Pressable>
          <Pressable style={styles.aiBtn} onPress={() => router.push('/deep-dives')}>
            <Text style={styles.aiBtnText}>Get Advice</Text>
          </Pressable>
        </View>
      </GradientCard>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Card style={styles.stat}>
          <View style={styles.statHead}>
            <Ionicons
              name={improving ? 'trending-down' : 'trending-up'}
              size={15}
              color={improving ? colors.green : colors.danger}
            />
            <Text style={styles.statHeadText}>This Week</Text>
          </View>
          <Text style={[styles.statValue, { color: improving ? colors.green : colors.danger }]}>
            {delta > 0 ? '+' : ''}
            {delta}%
          </Text>
          <Text style={styles.statLabel}>Stress vs weekly avg</Text>
        </Card>
        <Card style={styles.stat}>
          <View style={styles.statHead}>
            <Ionicons name="calendar-outline" size={15} color={colors.primary} />
            <Text style={styles.statHeadText}>Entries</Text>
          </View>
          <Text style={styles.statValue}>{thisWeek}</Text>
          <Text style={styles.statLabel}>This week</Text>
        </Card>
      </View>

      <SectionHeader title="Recent Entries" />
      {entries.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="book-outline" size={32} color={colors.textFaint} />}
          title="No entries yet"
          caption="Tap the + button to record your first check-in — a minute is enough."
        />
      ) : (
        entries.map((e) => (
          <Card
            key={e.id}
            style={{ marginBottom: spacing.md }}
            onPress={() => router.push({ pathname: '/entry/[id]', params: { id: e.id } })}>
            <View style={styles.entryRow}>
              <View style={styles.entryEmoji}>
                <Text style={{ fontSize: 22 }}>{e.moodEmoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>{e.title}</Text>
                <Text style={styles.entryTime}>{timeAgo(e.createdAt)}</Text>
                <Text style={styles.entrySummary}>{e.summary}</Text>
                <View style={{ marginTop: spacing.sm }}>
                  <ProgressBar progress={moodPositivity[e.moodEmoji] ?? 0.6} color={colors.green} />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { ...font.h1, color: colors.text },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2 },
  fab: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  aiBadge: { ...font.small, color: colors.white, fontWeight: '600' },
  aiTitle: { ...font.title, color: colors.white, marginBottom: 4 },
  aiBody: { ...font.body, color: 'rgba(255,255,255,0.92)', lineHeight: 20 },
  aiBtnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  aiBtn: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  aiBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  stat: { flex: 1, gap: 4 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statHeadText: { ...font.small, color: colors.textMuted },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { ...font.small, color: colors.textFaint },
  entryRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  entryEmoji: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: { ...font.title, color: colors.text },
  entryTime: { ...font.small, color: colors.textFaint, marginTop: 1 },
  entrySummary: { ...font.body, color: colors.textMuted, marginTop: 4, lineHeight: 19 },
});
