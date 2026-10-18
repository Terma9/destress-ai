/**
 * Community: anonymous success stories — a situation, what helped, and how
 * much the stress dropped. "For you" ranks them by similarity to the topics
 * of the user's own check-ins (embeddings). Votes: "helpful" is counted and
 * shown; "not for me" only lowers the ranking and is never displayed.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, Screen } from '@/components/ui';
import { intensityColor } from '@/components/untangle';
import { type FeedStory, fetchFeed, reportStory, THEME_LABELS, voteStory } from '@/data/community';
import { colors, font, radii, spacing } from '@/theme';

const THEMES = ['study', 'work', 'sleep', 'family', 'relationships', 'social', 'health', 'money'];

export default function Community() {
  const router = useRouter();
  const [mode, setMode] = useState<'forMe' | 'top'>('forMe');
  const [theme, setTheme] = useState<string | null>(null);
  const [stories, setStories] = useState<FeedStory[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    fetchFeed({ theme, forMe: mode === 'forMe' })
      .then((rows) => {
        setStories(rows);
        setError(false);
      })
      .catch(() => setError(true));
  }, [mode, theme]);
  useFocusEffect(load);

  /** Updates the vote right away and saves it in the background (rolled back on failure). */
  async function vote(story: FeedStory, value: -1 | 1) {
    const next = story.my_vote === value ? 0 : value;
    const helpful = story.helpful - (story.my_vote === 1 ? 1 : 0) + (next === 1 ? 1 : 0);
    const update = (s: Partial<FeedStory>) =>
      setStories((list) => list && list.map((x) => (x.id === story.id ? { ...x, ...s } : x)));
    update({ my_vote: next === 0 ? null : next, helpful });
    try {
      await voteStory(story.id, next);
    } catch {
      update({ my_vote: story.my_vote, helpful: story.helpful });
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Community</Text>
      <Text style={styles.sub}>What helped others in moments like yours</Text>

      <View style={styles.segment}>
        {(['forMe', 'top'] as const).map((m) => (
          <Pressable key={m} style={[styles.segmentBtn, mode === m && styles.segmentActive]} onPress={() => setMode(m)}>
            <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
              {m === 'forMe' ? 'For you' : 'Most helpful'}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode === 'forMe' && <Text style={styles.hint}>Matched to the topics of your check-ins</Text>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[null, ...THEMES].map((t) => (
          <Pressable key={t ?? 'all'} style={[styles.chip, theme === t && styles.chipActive]} onPress={() => setTheme(t)}>
            <Text style={[styles.chipText, theme === t && styles.chipTextActive]}>{t ? THEME_LABELS[t] : 'All'}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {error ? (
        <EmptyState
          icon={<Ionicons name="cloud-offline-outline" size={32} color={colors.textFaint} />}
          title="Couldn't load the community"
          caption="Check your connection and come back to this tab."
        />
      ) : stories === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : stories.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={32} color={colors.textFaint} />}
          title="No stories here yet"
          caption="Try another topic."
        />
      ) : (
        stories.map((s) => <StoryCard key={s.id} story={s} onVote={(v) => vote(s, v)} />)
      )}

      <Card style={{ marginTop: spacing.sm }} onPress={() => router.push('/(tabs)/untangle')}>
        <View style={styles.shareRow}>
          <Text style={{ fontSize: 24 }}>🏆</Text>
          <Text style={[styles.body, { flex: 1 }]}>
            Share your own: when an Untangle plan works, your next check-in turns it into a success story you can share
            anonymously.
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

function StoryCard({ story, onVote }: { story: FeedStory; onVote: (v: -1 | 1) => void }) {
  const [reporting, setReporting] = useState<'closed' | 'asking' | 'done'>('closed');

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={styles.badges}>
        <Text style={styles.theme}>{THEME_LABELS[story.theme] ?? story.theme}</Text>
        {story.is_example && <Text style={styles.badge}>Example</Text>}
        {story.is_mine && <Text style={[styles.badge, styles.mineBadge]}>Your story</Text>}
        <View style={{ flex: 1 }} />
        {story.intensity_before !== null && story.intensity_after !== null && (
          <Text style={styles.scores}>
            <Text style={{ color: intensityColor(story.intensity_before) }}>{story.intensity_before}</Text>
            {' → '}
            <Text style={{ color: intensityColor(story.intensity_after) }}>{story.intensity_after}</Text>
          </Text>
        )}
      </View>
      <Text style={styles.cardTitle}>{story.title}</Text>
      <Text style={styles.situation}>{story.situation}</Text>
      <Text style={styles.helpedLabel}>What helped</Text>
      <Text style={styles.body}>{story.solution}</Text>
      {story.comment ? <Text style={styles.comment}>"{story.comment}"</Text> : null}

      <View style={styles.footer}>
        <Pressable style={[styles.voteBtn, story.my_vote === 1 && styles.voteUp]} onPress={() => onVote(1)} disabled={story.is_mine}>
          <Ionicons name={story.my_vote === 1 ? 'thumbs-up' : 'thumbs-up-outline'} size={16} color={story.my_vote === 1 ? colors.white : colors.textMuted} />
          <Text style={[styles.voteText, story.my_vote === 1 && { color: colors.white }]}>
            Helpful{story.helpful ? ` · ${story.helpful}` : ''}
          </Text>
        </Pressable>
        <Pressable style={[styles.voteBtn, story.my_vote === -1 && styles.voteDown]} onPress={() => onVote(-1)} disabled={story.is_mine}>
          <Ionicons name={story.my_vote === -1 ? 'thumbs-down' : 'thumbs-down-outline'} size={16} color={colors.textMuted} />
          <Text style={styles.voteText}>Not for me</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {!story.is_mine && reporting === 'closed' && (
          <Pressable onPress={() => setReporting('asking')} hitSlop={8} accessibilityLabel="Report">
            <Ionicons name="flag-outline" size={16} color={colors.textFaint} />
          </Pressable>
        )}
      </View>
      {reporting === 'asking' && (
        <View style={styles.reportRow}>
          <Text style={[styles.situation, { flex: 1, marginTop: 0 }]}>Report this story as inappropriate?</Text>
          <Pressable onPress={() => setReporting('closed')}>
            <Text style={styles.reportCancel}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => reportStory(story.id, 'Inappropriate').then(() => setReporting('done')).catch(() => setReporting('closed'))}>
            <Text style={styles.reportConfirm}>Report</Text>
          </Pressable>
        </View>
      )}
      {reporting === 'done' && <Text style={styles.reported}>Thanks. We'll take a look.</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h1, color: colors.text },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    padding: 4,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radii.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.purple },
  segmentText: { ...font.body, color: colors.textMuted, fontWeight: '600' },
  segmentTextActive: { color: colors.white },
  hint: { ...font.small, color: colors.textFaint, marginTop: spacing.sm, textAlign: 'center' },
  chips: { gap: spacing.sm, paddingVertical: spacing.md },
  chip: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { ...font.small, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  theme: { ...font.small, color: colors.purple, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  badge: { ...font.small, color: colors.textMuted, backgroundColor: colors.cardAlt, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
  mineBadge: { color: '#92400E', backgroundColor: '#FEF3C7' },
  scores: { fontSize: 15, fontWeight: '700', color: colors.textFaint },
  cardTitle: { ...font.title, color: colors.text },
  situation: { ...font.body, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  helpedLabel: { ...font.small, color: colors.green, fontWeight: '700', marginTop: spacing.md, marginBottom: 2 },
  body: { ...font.body, color: colors.text, lineHeight: 21 },
  comment: { ...font.body, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  voteUp: { backgroundColor: colors.green, borderColor: colors.green },
  voteDown: { backgroundColor: colors.cardAlt },
  voteText: { ...font.small, color: colors.textMuted, fontWeight: '600' },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  reportCancel: { ...font.small, color: colors.textMuted, fontWeight: '600' },
  reportConfirm: { ...font.small, color: colors.danger, fontWeight: '700' },
  reported: { ...font.small, color: colors.textFaint, marginTop: spacing.sm },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
