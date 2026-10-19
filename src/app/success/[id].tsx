/**
 * A success story: a plan that worked. Private by default; the user can add
 * their own words and share it. Sharing shows an anonymized, rule-checked
 * preview first, which the user can edit before publishing.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { InlineLoader, SoftDots } from '@/components/brand';
import { CrisisCard } from '@/components/chat';
import { Card, EmptyState, GradientCard, Screen, SectionHeader } from '@/components/ui';
import {
  fetchMyStory,
  previewStory,
  publishStory,
  type Review,
  saveComment,
  type StoryText,
  type SuccessStory,
  THEME_LABELS,
  unpublishStory,
} from '@/data/community';
import { colors, fields, font, radii, spacing } from '@/theme';


export default function SuccessStoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [story, setStory] = useState<SuccessStory | null | undefined>();
  const [comment, setComment] = useState('');
  const [draft, setDraft] = useState<{ title: string; body: string; removed: string[] } | null>(null);
  const [blocked, setBlocked] = useState<Review | null>(null);
  const [busy, setBusy] = useState<'idle' | 'saving' | 'preparing' | 'publishing' | 'removing'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyStory(id)
      .then((s) => {
        setStory(s);
        setComment(s?.comment ?? '');
      })
      .catch(() => setStory(null));
  }, [id]);
  useFocusEffect(load);

  const back = (
    <View style={styles.topRow}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
  );

  if (story === undefined) {
    return (
      <Screen>
        {back}
        <InlineLoader />
      </Screen>
    );
  }
  if (story === null) {
    return (
      <Screen>
        {back}
        <EmptyState icon={<Ionicons name="alert-circle-outline" size={32} color={colors.textFaint} />} title="Story not found" />
      </Screen>
    );
  }

  async function run(kind: typeof busy, action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('idle');
    }
  }

  const prepare = () =>
    run('preparing', async () => {
      if (comment.trim() !== (story.comment ?? '')) await saveComment(story.id, comment.trim());
      const review = await previewStory(story.id);
      if (!review.allowed || review.crisis) {
        setBlocked(review);
        return;
      }
      setBlocked(null);
      setDraft({ title: review.title, body: review.body, removed: review.personal_details });
    });

  const publish = () =>
    run('publishing', async () => {
      const { removed: _removed, ...text } = draft!;
      await publishStory(story.id, text);
      setDraft(null);
      load();
    });

  const shared = story.status === 'published';

  return (
    <Screen>
      {back}

      <GradientCard colors={[fields.mood.from, fields.mood.to]}>
        <View style={styles.badgeRow}>
          <View style={styles.badgeIcon}>
            <Ionicons name="ribbon-outline" size={20} color={fields.mood.deep} />
          </View>
          <Text style={styles.badgeLabel}>SOLVED · YOUR STORY</Text>
        </View>
        <Text style={styles.headTitle}>{story.title}</Text>
        <View style={styles.headRow}>
          <View style={styles.headChip}>
            <Text style={styles.headChipText}>{THEME_LABELS[story.theme] ?? story.theme}</Text>
          </View>
          {story.intensity_before !== null && (
            <View style={styles.headChip}>
              <Text style={styles.headChipText}>
                Stress {story.intensity_before}
                {story.intensity_after !== null ? ` → ${story.intensity_after}` : ''}
              </Text>
            </View>
          )}
        </View>
      </GradientCard>

      <SectionHeader title="The situation" />
      <Card>
        <Text style={styles.body}>{story.situation}</Text>
      </Card>

      <SectionHeader title="What made the difference" />
      <Card>
        <Text style={styles.body}>{story.solution}</Text>
      </Card>

      <SectionHeader title="In your own words" />
      <Card>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={setComment}
          placeholder="Anything you'd tell someone in the same situation? (optional)"
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={1000}
        />
        {comment.trim() !== (story.comment ?? '') && (
          <Pressable
            style={styles.smallBtn}
            disabled={busy !== 'idle'}
            onPress={() => run('saving', async () => {
              await saveComment(story.id, comment.trim());
              setStory({ ...story, comment: comment.trim() || null });
            })}>
            <Text style={styles.smallBtnText}>{busy === 'saving' ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        )}
      </Card>

      <SectionHeader title="Share with the community" />
      {shared ? (
        <Card>
          <View style={styles.sharedRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
            <Text style={[styles.body, { flex: 1 }]}>Shared anonymously. This is what others see:</Text>
          </View>
          <Text style={styles.previewTitle}>{story.public_title}</Text>
          <Text style={styles.previewText} numberOfLines={5}>
            {story.public_body ?? `${story.public_situation} ${story.public_solution}`}
          </Text>
          <Pressable style={styles.linkBtn} onPress={() => router.push({ pathname: '/story/[id]', params: { id: story.id } })}>
            <Text style={styles.linkText}>Open it in the community →</Text>
          </Pressable>
          <Pressable
            style={styles.linkBtn}
            disabled={busy !== 'idle'}
            onPress={() => run('removing', async () => {
              await unpublishStory(story.id);
              load();
            })}>
            <Text style={styles.linkText}>{busy === 'removing' ? 'Removing…' : 'Take it down'}</Text>
          </Pressable>
        </Card>
      ) : draft ? (
        <Card>
          <Text style={styles.body}>
            Here's your story as a short post, written from your own words and anonymized. Make it yours: edit anything before publishing.
          </Text>
          {draft.removed.length > 0 && (
            <Text style={styles.removed}>Removed to protect your privacy: {draft.removed.join(', ')}</Text>
          )}
          {(['title', 'body'] as const).map((field) => (
            <View key={field} style={{ marginTop: spacing.md }}>
              <Text style={styles.fieldLabel}>{field === 'title' ? 'Title' : 'Your story'}</Text>
              <TextInput
                style={[styles.input, field === 'body' && { minHeight: 220 }]}
                value={draft[field]}
                onChangeText={(v) => setDraft({ ...draft, [field]: v })}
                multiline={field === 'body'}
                maxLength={field === 'title' ? 120 : 4000}
              />
            </View>
          ))}
          <View style={styles.actions}>
            <Pressable onPress={() => setDraft(null)} disabled={busy !== 'idle'}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={publish} disabled={busy !== 'idle'}>
              {busy === 'publishing' ? (
                <SoftDots color={colors.white} size={6} />
              ) : (
                <Text style={styles.primaryBtnText}>Publish</Text>
              )}
            </Pressable>
          </View>
        </Card>
      ) : (
        <Card>
          {blocked?.crisis && (
            <View style={{ marginBottom: spacing.md }}>
              <CrisisCard />
            </View>
          )}
          {blocked && !blocked.crisis && <Text style={styles.blocked}>{blocked.reason}</Text>}
          <Text style={styles.body}>
            Others in a similar spot could learn from your story. I'll write it as a short personal post from your own
            words; names, places and other personal details are removed, and you can edit everything first. No one will
            see who wrote it.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={prepare} disabled={busy !== 'idle'}>
            {busy === 'preparing' ? (
              <SoftDots color={colors.white} size={6} />
            ) : (
              <Text style={styles.primaryBtnText}>Prepare to share</Text>
            )}
          </Pressable>
        </Card>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { marginBottom: spacing.sm },
  back: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgeIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' },
  badgeLabel: { ...font.label, color: fields.mood.deep },
  headTitle: { ...font.h2, color: colors.ink, marginTop: spacing.md },
  headRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  headChip: { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  headChipText: { ...font.small, color: fields.mood.ink, fontWeight: '600' },
  body: { ...font.body, color: colors.text, lineHeight: 21 },
  input: {
    ...font.body,
    color: colors.text,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  fieldLabel: { ...font.small, color: colors.textMuted, fontWeight: '600', marginBottom: 4 },
  smallBtn: { alignSelf: 'flex-end', marginTop: spacing.sm },
  smallBtnText: { color: colors.purple, fontWeight: '600' },
  sharedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  previewTitle: { ...font.title, color: colors.text },
  previewText: { ...font.body, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  previewComment: { ...font.body, color: colors.text, fontStyle: 'italic', marginTop: spacing.sm },
  removed: { ...font.small, color: colors.green, fontWeight: '600', marginTop: spacing.sm },
  blocked: { ...font.body, color: '#B45309', marginBottom: spacing.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.lg, marginTop: spacing.lg },
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.purple,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.md,
    minWidth: 110,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '600' },
  linkBtn: { marginTop: spacing.md, alignSelf: 'flex-start' },
  linkText: { color: colors.textMuted, fontWeight: '600' },
  error: { ...font.small, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
});
