import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Screen } from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';
import { colors, font, radii, spacing } from '@/theme';

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const entry = useAppStore((s) => s.entries.find((e) => e.id === id));
  const removeEntry = useAppStore((s) => s.removeEntry);
  const [confirming, setConfirming] = useState(false);

  if (!entry) {
    // Entry was just deleted (or bad link) — nothing to show.
    return (
      <Screen>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.missing}>This entry no longer exists.</Text>
      </Screen>
    );
  }

  const created = new Date(entry.createdAt);
  const when = created.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const time = created.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const onDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    removeEntry(entry.id);
    router.back();
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.emojiWrap}>
        <Text style={{ fontSize: 40 }}>{entry.moodEmoji}</Text>
      </View>
      <Text style={styles.title}>{entry.title}</Text>
      <Text style={styles.when}>
        {when} · {time}
      </Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.summaryLabel}>Entry summary</Text>
        <Text style={styles.summary}>{entry.summary}</Text>
      </Card>

      <Pressable
        style={[styles.deleteBtn, confirming && styles.deleteBtnConfirm]}
        onPress={onDelete}>
        <Ionicons name="trash-outline" size={16} color={confirming ? colors.white : colors.danger} />
        <Text style={[styles.deleteText, confirming && { color: colors.white }]}>
          {confirming ? 'Tap again to delete' : 'Delete entry'}
        </Text>
      </Pressable>
      {confirming && (
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
  summaryLabel: { ...font.small, color: colors.textFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm },
  summary: { ...font.body, color: colors.text, lineHeight: 22 },
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
