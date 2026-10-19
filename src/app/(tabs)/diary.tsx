import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { InlineLoader, SoftDots } from '@/components/brand';
import { loadDemoData, searchCheckins, type SearchResult } from '@/ai/checkinClient';
import { Card, EmptyState, GradientCard, ProgressBar, Screen, SectionHeader } from '@/components/ui';
import { moodEmoji, useCheckins } from '@/data/checkins';
import type { MoodKey } from '@/data/content';
import { MIN_CHECKINS, useLatestInsight } from '@/data/deepDives';
import { average, useDailyMetrics } from '@/data/metrics';
import { startOfLast7Days } from '@/lib/dates';
import { colors, font, gradients, radii, spacing } from '@/theme';

/** "Today, 18:30", "Yesterday" or "3 days ago", counted in calendar days. */
function timeAgo(ts: number) {
  const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86_400_000);
  if (days <= 0) return `Today, ${new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/** How positive a mood is — drives the little bar under each entry. */
const moodPositivity: Record<MoodKey, number> = {
  great: 0.95,
  good: 0.75,
  ok: 0.55,
  low: 0.35,
  stressed: 0.2,
};

export default function Diary() {
  const router = useRouter();
  const { checkins, error, reload } = useCheckins();
  const { rows: metricRows, reload: reloadMetrics } = useDailyMetrics();
  const insight = useLatestInsight();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<
    { status: 'searching' } | { status: 'done'; results: SearchResult[] } | { status: 'error' } | null
  >(null);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setSearch({ status: 'searching' });
    try {
      setSearch({ status: 'done', results: await searchCheckins(q) });
    } catch {
      setSearch({ status: 'error' });
    }
  }

  function clearSearch() {
    setQuery('');
    setSearch(null);
  }
  const [demo, setDemo] = useState<'idle' | 'loading' | 'error'>('idle');

  async function addDemoData() {
    setDemo('loading');
    try {
      await loadDemoData();
      reload();
      reloadMetrics();
      setDemo('idle');
    } catch {
      setDemo('error');
    }
  }

  const entries = checkins ?? [];
  const thisWeek = entries.filter((e) => Date.parse(e.created_at) >= startOfLast7Days()).length;
  const avgStress = metricRows ? average(metricRows, 'stress') : null;

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
        <Text style={styles.aiTitle}>{insight ? 'Your latest insight' : 'Early Insights'}</Text>
        <Text style={styles.aiBody}>
          {insight ??
            `I'm starting to learn your stress patterns. After ${MIN_CHECKINS} check-ins, Deep Dives show you what keeps coming up, with the entries behind it.`}
        </Text>
        <View style={styles.aiBtnRow}>
          <Pressable style={styles.aiBtn} onPress={() => router.push('/(tabs)/tracker')}>
            <Text style={styles.aiBtnText}>View Trends</Text>
          </Pressable>
          <Pressable style={styles.aiBtn} onPress={() => router.push('/deep-dives')}>
            <Text style={styles.aiBtnText}>Deep Dives</Text>
          </Pressable>
        </View>
      </GradientCard>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Card style={styles.stat}>
          <View style={styles.statHead}>
            <Ionicons name="pulse-outline" size={15} color={colors.danger} />
            <Text style={styles.statHeadText}>Avg stress</Text>
          </View>
          <Text style={styles.statValue}>
            {avgStress ?? '–'}
            {avgStress !== null && <Text style={styles.statLabel}>/10</Text>}
          </Text>
          <Text style={styles.statLabel}>Last 7 days</Text>
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

      <SectionHeader title={search ? 'Search results' : 'Recent Entries'} />
      {entries.length > 0 && (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder="Search by meaning, e.g. “when was I calm?”"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            maxLength={300}
          />
          {(query.length > 0 || search) && (
            <Pressable onPress={clearSearch} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          )}
        </View>
      )}
      {search ? (
        search.status === 'searching' ? (
          <InlineLoader />
        ) : search.status === 'error' ? (
          <Text style={styles.searchNote}>Search didn't work. Check your connection and try again.</Text>
        ) : search.results.length === 0 ? (
          <Text style={styles.searchNote}>No entries are close in meaning to that.</Text>
        ) : (
          search.results.map((r) => (
            <Card
              key={r.id}
              style={{ marginBottom: spacing.md }}
              onPress={() => router.push({ pathname: '/entry/[id]', params: { id: r.id } })}>
              <View style={styles.entryRow}>
                <View style={styles.entryEmoji}>
                  <Text style={{ fontSize: 22 }}>{moodEmoji(r.mood)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryTitle}>{r.title ?? 'Check-in'}</Text>
                  <Text style={styles.entryTime}>
                    {timeAgo(Date.parse(r.created_at))} · {r.similarity >= 0.5 ? 'Strong match' : 'Related'}
                  </Text>
                  {r.topic !== 'all' && r.topic_title && (
                    <Text style={styles.matched}>Matched: {r.topic_title}</Text>
                  )}
                  <Text style={styles.entrySummary} numberOfLines={3}>
                    {r.summary}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </View>
            </Card>
          ))
        )
      ) : error ? (
        <EmptyState
          icon={<Ionicons name="cloud-offline-outline" size={32} color={colors.textFaint} />}
          title="Couldn't load your entries"
          caption="Check your connection — the list reloads when you come back to this tab."
        />
      ) : checkins === null ? (
        <InlineLoader />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="book-outline" size={32} color={colors.textFaint} />}
          title="No entries yet"
          caption="Tap the + button to record your first check-in — a minute is enough."
          action={
            <Pressable style={styles.demoBtn} onPress={addDemoData} disabled={demo === 'loading'}>
              {demo === 'loading' ? (
                <SoftDots size={6} />
              ) : (
                <Text style={styles.demoText}>
                  {demo === 'error' ? "Couldn't load demo data — try again" : 'Or try it with 3 weeks of demo data'}
                </Text>
              )}
            </Pressable>
          }
        />
      ) : (
        entries.map((e) => (
          <Card
            key={e.id}
            style={{ marginBottom: spacing.md }}
            onPress={() => router.push({ pathname: '/entry/[id]', params: { id: e.id } })}>
            <View style={styles.entryRow}>
              <View style={styles.entryEmoji}>
                <Text style={{ fontSize: 22 }}>{moodEmoji(e.mood)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>{e.title ?? 'Check-in'}</Text>
                <Text style={styles.entryTime}>{timeAgo(Date.parse(e.created_at))}</Text>
                <Text style={styles.entrySummary} numberOfLines={3}>
                  {e.summary}
                </Text>
                <View style={{ marginTop: spacing.sm }}>
                  <ProgressBar progress={e.mood ? moodPositivity[e.mood] : 0.6} color={colors.green} />
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: { ...font.body, color: colors.text, flex: 1, paddingVertical: spacing.sm },
  matched: { ...font.small, color: colors.purple, fontWeight: '600', marginTop: 2 },
  searchNote: { ...font.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  demoBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.primary + '1A',
  },
  demoText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
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
