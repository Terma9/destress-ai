import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Screen } from '@/components/ui';
import { type CheckinWithMessages, deleteCheckin, fetchCheckin, moodEmoji } from '@/data/checkins';
import { colors, font, radii, spacing } from '@/theme';

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<CheckinWithMessages | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCheckin(id)
      .then(setEntry)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  const back = (
    <View style={styles.topRow}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
  );

  if (error || entry === null) {
    return (
      <Screen>
        {back}
        <Text style={styles.missing}>{error ? "Couldn't load this entry." : 'This entry no longer exists.'}</Text>
      </Screen>
    );
  }

  if (entry === undefined) {
    return (
      <Screen>
        {back}
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      </Screen>
    );
  }

  const created = new Date(entry.created_at);
  const when = created.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const time = created.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const scores = [
    { label: 'Stress', value: entry.stress },
    { label: 'Emotion', value: entry.emotion },
    { label: 'Sleep', value: entry.sleep },
  ].filter((s) => s.value !== null);

  const onDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteCheckin(entry.id);
      router.back();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <Screen>
      {back}

      <View style={styles.emojiWrap}>
        <Text style={{ fontSize: 40 }}>{moodEmoji(entry.mood)}</Text>
      </View>
      <Text style={styles.title}>{entry.title ?? 'Check-in'}</Text>
      <Text style={styles.when}>
        {when} · {time}
      </Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.label}>Summary</Text>
        <Text style={styles.summary}>{entry.summary}</Text>

        {scores.length > 0 && (
          <View style={styles.scoreRow}>
            {scores.map((s) => (
              <View key={s.label} style={styles.scoreChip}>
                <Text style={styles.scoreValue}>{s.value}/10</Text>
                <Text style={styles.scoreLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {entry.themes.length > 0 && (
          <View style={styles.tagRow}>
            {entry.themes.map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {entry.helped.length > 0 && (
          <Text style={styles.detail}>
            <Text style={styles.detailLabel}>What helped: </Text>
            {entry.helped.join(', ')}
          </Text>
        )}
      </Card>

      <Pressable style={styles.convToggle} onPress={() => setShowConversation((v) => !v)}>
        <Ionicons name={showConversation ? 'chevron-up' : 'chatbubbles-outline'} size={16} color={colors.primary} />
        <Text style={styles.convToggleText}>
          {showConversation ? 'Hide conversation' : `Show conversation (${entry.messages.length} messages)`}
        </Text>
      </Pressable>

      {showConversation && (
        <View style={styles.conversation}>
          {entry.messages.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={m.role === 'user' ? styles.userText : styles.aiText}>{m.content}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        style={[styles.deleteBtn, confirming && styles.deleteBtnConfirm]}
        onPress={onDelete}
        disabled={deleting}>
        {deleting ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Ionicons name="trash-outline" size={16} color={confirming ? colors.white : colors.danger} />
        )}
        <Text style={[styles.deleteText, confirming && { color: colors.white }]}>
          {confirming ? 'Tap again to delete' : 'Delete entry'}
        </Text>
      </Pressable>
      {confirming && !deleting && (
        <Pressable onPress={() => setConfirming(false)} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { marginBottom: spacing.md },
  back: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missing: { ...font.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
  emojiWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...font.h1, color: colors.text },
  when: { ...font.body, color: colors.textMuted, marginTop: 4 },
  label: { ...font.small, color: colors.textFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm },
  summary: { ...font.body, color: colors.text, lineHeight: 22 },
  scoreRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  scoreChip: { alignItems: 'center', backgroundColor: colors.cardAlt, borderRadius: radii.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  scoreValue: { ...font.title, color: colors.text },
  scoreLabel: { ...font.small, color: colors.textFaint },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  tag: { backgroundColor: '#EEF2FF', borderRadius: radii.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3 },
  tagText: { ...font.small, color: '#4338CA', fontWeight: '600' },
  detail: { ...font.body, color: colors.textMuted, marginTop: spacing.md, lineHeight: 20 },
  detailLabel: { fontWeight: '600', color: colors.text },
  convToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: spacing.lg, paddingVertical: spacing.xs },
  convToggleText: { ...font.body, color: colors.primary, fontWeight: '600' },
  conversation: { gap: spacing.sm, marginTop: spacing.sm },
  bubble: { maxWidth: '85%', borderRadius: radii.lg, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md + 2 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  aiText: { ...font.body, color: colors.text, lineHeight: 21 },
  userText: { ...font.body, color: colors.white, lineHeight: 21 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.xl,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  deleteBtnConfirm: { backgroundColor: colors.danger },
  deleteText: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  cancelBtn: { alignItems: 'center', marginTop: spacing.md, padding: spacing.sm },
  cancelText: { ...font.body, color: colors.textMuted, fontWeight: '500' },
});
