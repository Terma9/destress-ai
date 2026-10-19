/**
 * Community: a small blog of anonymous personal stories about what helped
 * with stress. Cards show a preview; tapping opens the article with
 * comments (story/[id]). "For you" ranks them by similarity to the topics
 * of the user's own check-ins (embeddings). Votes: "helpful" is counted and
 * shown. "Not for me" and "Report" take the story out of this user's feed
 * (the card slides away, with an undo for "not for me"); a downvote also
 * lowers the ranking for everyone but is never displayed.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { InlineLoader } from '@/components/brand';
import { Card, EmptyState, Screen, TAB_BAR_SPACE } from '@/components/ui';
import { type FeedStory, fetchFeed, readingMinutes, reportStory, THEME_LABELS, voteStory } from '@/data/community';
import { colors, font, fontFamily, radii, shadow, spacing } from '@/theme';

const THEMES = ['study', 'work', 'sleep', 'family', 'relationships', 'social', 'health', 'money'];

export default function Community() {
  const router = useRouter();
  const [mode, setMode] = useState<'forMe' | 'top'>('forMe');
  const [theme, setTheme] = useState<string | null>(null);
  const [stories, setStories] = useState<FeedStory[] | null>(null);
  const [error, setError] = useState(false);
  /** The story just taken out of the feed, for the undo bar. */
  const [removed, setRemoved] = useState<{ story: FeedStory; index: number; reason: 'vote' | 'report' } | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    },
    [],
  );

  const load = useCallback(() => {
    fetchFeed({ theme, forMe: mode === 'forMe' })
      .then((rows) => {
        setStories(rows);
        setError(false);
      })
      .catch(() => setError(true));
  }, [mode, theme]);
  useFocusEffect(load);

  /** "Helpful" toggles right away and saves in the background (rolled back on failure). */
  async function markHelpful(story: FeedStory) {
    const next = story.my_vote === 1 ? 0 : 1;
    const update = (patch: Partial<FeedStory>) =>
      setStories((list) => list && list.map((x) => (x.id === story.id ? { ...x, ...patch } : x)));
    update({ my_vote: next === 0 ? null : 1, helpful: story.helpful + (next === 1 ? 1 : -1) });
    try {
      await voteStory(story.id, next);
    } catch {
      update({ my_vote: story.my_vote, helpful: story.helpful });
    }
  }

  /** Takes a story out of the feed (it slides away) and shows the undo bar for a few seconds. */
  async function remove(story: FeedStory, reason: 'vote' | 'report') {
    const index = stories?.findIndex((s) => s.id === story.id) ?? -1;
    setStories((list) => list && list.filter((s) => s.id !== story.id));
    setRemoved({ story, index, reason });
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setRemoved(null), 5000);
    try {
      await (reason === 'vote' ? voteStory(story.id, -1) : reportStory(story.id, 'Inappropriate'));
    } catch {
      restore(story, index);
    }
  }

  function restore(story: FeedStory, index: number) {
    setStories((list) => {
      if (!list || list.some((s) => s.id === story.id)) return list;
      const copy = [...list];
      copy.splice(Math.max(0, Math.min(index, copy.length)), 0, story);
      return copy;
    });
  }

  async function undo() {
    if (!removed) return;
    setRemoved(null);
    restore(removed.story, removed.index);
    await voteStory(removed.story.id, 0).catch(() => {});
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen tint="sage">
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
        <InlineLoader />
      ) : stories.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={32} color={colors.textFaint} />}
          title="No stories here yet"
          caption="Try another topic."
        />
      ) : (
        stories.map((s) => (
          <Animated.View key={s.id} exiting={FadeOutLeft.duration(260)} layout={LinearTransition.springify().damping(18)}>
            <StoryCard story={s} onHelpful={() => markHelpful(s)} onRemove={(reason) => remove(s, reason)} />
          </Animated.View>
        ))
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
      {removed && (
        <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(200)} style={styles.toast}>
          <Ionicons name={removed.reason === 'vote' ? 'eye-off-outline' : 'flag-outline'} size={16} color={colors.ivory} />
          <Text style={styles.toastText}>
            {removed.reason === 'vote' ? 'Hidden from your feed' : "Reported. You won't see it again."}
          </Text>
          {removed.reason === 'vote' && (
            <Pressable onPress={undo} hitSlop={8}>
              <Text style={styles.toastUndo}>Undo</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}

function StoryCard({
  story,
  onHelpful,
  onRemove,
}: {
  story: FeedStory;
  onHelpful: () => void;
  onRemove: (reason: 'vote' | 'report') => void;
}) {
  const [reporting, setReporting] = useState(false);
  const router = useRouter();

  return (
    <Card style={{ marginBottom: spacing.md }} onPress={() => router.push({ pathname: '/story/[id]', params: { id: story.id } })}>
      <View style={styles.badges}>
        <Text style={styles.theme}>{THEME_LABELS[story.theme] ?? story.theme}</Text>
        {story.is_example && <Text style={styles.badge}>Example</Text>}
        {story.is_mine && <Text style={[styles.badge, styles.mineBadge]}>Your story</Text>}
      </View>
      <Text style={styles.cardTitle}>{story.title}</Text>
      <Text style={styles.author}>{story.is_mine ? 'You' : (story.author_name ?? 'Anonymous')}</Text>
      <Text style={styles.excerpt} numberOfLines={4}>
        {story.body}
      </Text>
      <Text style={styles.readMeta}>
        Read story · {readingMinutes(story.body)} min{story.comments ? ` · ${story.comments} comment${story.comments === 1 ? '' : 's'}` : ''} →
      </Text>

      <View style={styles.footer}>
        <Pressable style={[styles.voteBtn, story.my_vote === 1 && styles.voteUp]} onPress={onHelpful} disabled={story.is_mine}>
          <Ionicons name={story.my_vote === 1 ? 'thumbs-up' : 'thumbs-up-outline'} size={16} color={story.my_vote === 1 ? colors.white : colors.textMuted} />
          <Text style={[styles.voteText, story.my_vote === 1 && { color: colors.white }]}>
            Helpful{story.helpful ? ` · ${story.helpful}` : ''}
          </Text>
        </Pressable>
        {!story.is_mine && (
          <Pressable style={styles.voteBtn} onPress={() => onRemove('vote')}>
            <Ionicons name="thumbs-down-outline" size={16} color={colors.textMuted} />
            <Text style={styles.voteText}>Not for me</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {!story.is_mine && !reporting && (
          <Pressable onPress={() => setReporting(true)} hitSlop={8} accessibilityLabel="Report">
            <Ionicons name="flag-outline" size={16} color={colors.textFaint} />
          </Pressable>
        )}
      </View>
      {reporting && (
        <Animated.View entering={FadeInDown.duration(220)} style={styles.reportRow}>
          <Text style={[styles.situation, { flex: 1, marginTop: 0 }]}>Report this story as inappropriate?</Text>
          <Pressable onPress={() => setReporting(false)}>
            <Text style={styles.reportCancel}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => onRemove('report')}>
            <Text style={styles.reportConfirm}>Report</Text>
          </Pressable>
        </Animated.View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: TAB_BAR_SPACE - 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.ink,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    ...shadow.lifted,
  },
  toastText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 14, color: colors.ivory },
  toastUndo: { fontFamily: fontFamily.bold, fontSize: 14, color: '#F0A57E' },
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
  body: { ...font.body, color: colors.text, lineHeight: 21 },
  author: { ...font.small, color: colors.textMuted, marginTop: 2 },
  excerpt: { ...font.body, color: colors.inkSoft, lineHeight: 21, marginTop: 6 },
  readMeta: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.ink, marginTop: spacing.sm },
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
  voteText: { ...font.small, color: colors.textMuted, fontWeight: '600' },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  reportCancel: { ...font.small, color: colors.textMuted, fontWeight: '600' },
  reportConfirm: { ...font.small, color: colors.danger, fontWeight: '700' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
