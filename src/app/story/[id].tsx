/**
 * A community story as a small blog post: the full text, "Helpful", and
 * comments. New comments are checked by the community-comment function
 * (kindness, privacy) before they appear; nobody sees who wrote anything.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { InlineLoader, Logo, SoftDots } from '@/components/brand';
import { CrisisCard } from '@/components/chat';
import { AiMark, PressableScale } from '@/components/motion';
import { Card, Screen } from '@/components/ui';
import {
  deleteComment,
  type FeedStory,
  fetchComments,
  fetchStory,
  postComment,
  readingMinutes,
  type StoryComment,
  THEME_LABELS,
  voteStory,
} from '@/data/community';
import { colors, fields, font, fontFamily, gradients, radii, shadow, spacing } from '@/theme';

type Story = Omit<FeedStory, 'comments' | 'relevance'>;

export default function StoryArticle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [story, setStory] = useState<Story | null | undefined>();
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<{ message: string; crisis?: boolean } | null>(null);

  useEffect(() => {
    Promise.all([fetchStory(id), fetchComments(id)])
      .then(([s, c]) => {
        setStory(s);
        setComments(c);
      })
      .catch(() => setStory(null));
  }, [id]);

  async function toggleHelpful() {
    if (!story || story.is_mine) return;
    const on = story.my_vote !== 1;
    setStory({ ...story, my_vote: on ? 1 : null, helpful: story.helpful + (on ? 1 : -1) });
    await voteStory(story.id, on ? 1 : 0).catch(() => setStory(story));
  }

  async function send() {
    if (!text.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const c = await postComment(id, text.trim());
      setComments((prev) => [...prev, c]);
      setText('');
    } catch (err) {
      setError({ message: (err as Error).message, crisis: (err as { crisis?: boolean }).crisis });
    } finally {
      setPosting(false);
    }
  }

  async function remove(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    await deleteComment(commentId).catch(() => {});
  }

  const back = (
    <Pressable onPress={() => router.back()} hitSlop={10} style={styles.round} accessibilityLabel="Back">
      <Ionicons name="chevron-back" size={18} color={colors.ink} />
    </Pressable>
  );

  if (story === undefined) {
    return (
      <Screen tint="sage">
        {back}
        <InlineLoader />
      </Screen>
    );
  }
  if (story === null) {
    return (
      <Screen tint="sage">
        {back}
        <Card style={styles.center}>
          <Logo size={44} />
          <Text style={styles.muted}>This story is no longer available.</Text>
        </Card>
      </Screen>
    );
  }

  const paragraphs = paragraphsOf(story.body);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen tint="sage">
        {back}

        <Animated.View entering={FadeInDown.duration(420)} style={{ marginTop: spacing.lg }}>
          <View style={styles.badges}>
            <Text style={styles.theme}>{THEME_LABELS[story.theme] ?? story.theme}</Text>
            {story.is_example && <Text style={styles.badge}>Example story</Text>}
            {story.is_mine && <Text style={styles.badge}>Your story</Text>}
          </View>
          <Text style={styles.title}>{story.title}</Text>
          <Text style={styles.meta}>
            Anonymous · {readingMinutes(story.body)} min read
            {story.intensity_before !== null && story.intensity_after !== null
              ? ` · stress ${story.intensity_before} → ${story.intensity_after}`
              : ''}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(100)} style={styles.article}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={[styles.paragraph, i === 0 && styles.lead]}>
              {p}
            </Text>
          ))}
        </Animated.View>

        <View style={styles.helpfulRow}>
          <PressableScale onPress={toggleHelpful} disabled={story.is_mine} style={[styles.helpful, story.my_vote === 1 && styles.helpfulOn]}>
            <Ionicons name={story.my_vote === 1 ? 'heart' : 'heart-outline'} size={16} color={story.my_vote === 1 ? colors.ivory : colors.ink} />
            <Text style={[styles.helpfulText, story.my_vote === 1 && { color: colors.ivory }]}>
              Helpful{story.helpful ? ` · ${story.helpful}` : ''}
            </Text>
          </PressableScale>
        </View>

        <Text style={styles.label}>COMMENTS{comments.length ? ` · ${comments.length}` : ''}</Text>
        <View style={{ gap: spacing.sm }}>
          {comments.length === 0 && <Text style={styles.muted}>No comments yet. A kind word can mean a lot.</Text>}
          {comments.map((c, i) => (
            <Animated.View key={c.id} entering={FadeInDown.duration(320).delay(Math.min(i, 6) * 50)}>
              <View style={styles.comment}>
                <View style={styles.commentHead}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={11} color={fields.mood.deep} />
                  </View>
                  <Text style={styles.commentMeta}>
                    {c.is_mine ? 'You' : 'Anonymous'}
                    {c.is_example ? ' · example comment' : ''} · {new Date(c.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                  </Text>
                  <View style={{ flex: 1 }} />
                  {c.is_mine && (
                    <Pressable onPress={() => remove(c.id)} hitSlop={8} accessibilityLabel="Delete comment">
                      <Ionicons name="trash-outline" size={14} color={colors.textFaint} />
                    </Pressable>
                  )}
                </View>
                <Text style={styles.commentText}>{c.body}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <Card style={{ marginTop: spacing.lg }}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Write something supportive…"
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={1000}
          />
          <View style={styles.sendRow}>
            <View style={{ flex: 1 }}>
              <AiMark label="CHECKED FOR KINDNESS & PRIVACY BEFORE IT APPEARS" size={10} />
            </View>
            <PressableScale onPress={send} disabled={posting || !text.trim()}>
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.send, (!text.trim() || posting) && { opacity: 0.4 }]}>
                {posting ? <SoftDots color={colors.ivory} size={5} /> : <Text style={styles.sendText}>Post</Text>}
              </LinearGradient>
            </PressableScale>
          </View>
          {error?.crisis && (
            <View style={{ marginTop: spacing.md }}>
              <CrisisCard />
            </View>
          )}
          {error && !error.crisis && <Text style={styles.error}>{error.message}</Text>}
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Splits a post into paragraphs; a long single block becomes chunks of ~3 sentences. */
function paragraphsOf(body: string): string[] {
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;
  const sentences = body.match(/[^.!?]+[.!?]+["')\]]*\s*/g) ?? [body];
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) out.push(sentences.slice(i, i + 3).join('').trim());
  return out;
}

const styles = StyleSheet.create({
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl, marginTop: spacing.lg },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  theme: { ...font.label, color: fields.mood.deep },
  badge: { ...font.tiny, color: colors.inkSoft, backgroundColor: colors.sand, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  title: { ...font.h1, color: colors.ink, marginTop: spacing.sm },
  meta: { ...font.small, color: colors.textMuted, marginTop: 4 },
  article: { marginTop: spacing.lg, gap: spacing.md },
  paragraph: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 26, color: colors.ink },
  lead: { fontFamily: fontFamily.medium, fontSize: 17 },
  helpfulRow: { flexDirection: 'row', marginTop: spacing.xl, marginBottom: spacing.xl },
  helpful: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.sand, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 10 },
  helpfulOn: { backgroundColor: fields.mood.deep },
  helpfulText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink },
  label: { ...font.label, color: colors.textMuted, marginBottom: spacing.sm },
  muted: { ...font.body, color: colors.textMuted },
  comment: { backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.md, ...shadow.soft },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: fields.mood.from, alignItems: 'center', justifyContent: 'center' },
  commentMeta: { ...font.tiny, color: colors.textMuted },
  commentText: { ...font.body, color: colors.ink, lineHeight: 21, marginTop: 6 },
  input: { ...font.body, color: colors.ink, minHeight: 70, textAlignVertical: 'top' },
  sendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  send: { borderRadius: radii.pill, paddingHorizontal: 18, height: 38, alignItems: 'center', justifyContent: 'center', minWidth: 70 },
  sendText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ivory },
  error: { ...font.small, color: colors.danger, marginTop: spacing.sm },
});
