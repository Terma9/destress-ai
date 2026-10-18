import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Screen, SectionHeader } from '@/components/ui';
import { exercises } from '@/data/content';
import { useAppStore } from '@/store/useAppStore';
import { colors, font, gradients, radii, spacing } from '@/theme';

export default function Practice() {
  const router = useRouter();
  const sessions = useAppStore((s) => s.sessions);
  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);

  return (
    <Screen>
      <Text style={styles.title}>Guided Exercises</Text>
      <Text style={styles.sub}>Breathe, meditate, and relax</Text>

      {sessions.length > 0 && (
        <View style={styles.sessionChip}>
          <Ionicons name="checkmark-circle" size={15} color={colors.green} />
          <Text style={styles.sessionChipText}>
            {sessions.length} session{sessions.length > 1 ? 's' : ''} completed · {Math.round(totalMinutes)} min practiced
          </Text>
        </View>
      )}

      {/* Quick relief */}
      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.quickTitle}>Feeling Stressed Right Now?</Text>
        <Text style={styles.quickSub}>Try this quick 2-minute breathing exercise for immediate relief</Text>
        <Pressable onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: 'box', minutes: '2' } })}>
          <LinearGradient colors={gradients.quickRelief} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.quickBtn}>
            <Ionicons name="play" size={16} color={colors.white} />
            <Text style={styles.quickBtnText}>Quick Relief (2 min)</Text>
          </LinearGradient>
        </Pressable>
      </Card>

      <SectionHeader title="All Exercises" />
      {exercises.map((ex) => (
        <Card key={ex.id} style={{ marginBottom: spacing.md }}>
          <View style={styles.exRow}>
            <View style={[styles.exIcon, { backgroundColor: ex.tint + '22' }]}>
              <Ionicons name={ex.icon as any} size={22} color={ex.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exTitle}>{ex.title}</Text>
              <Text style={styles.exDesc}>{ex.description}</Text>
              <View style={styles.metaRow}>
                <View style={styles.meta}>
                  <Ionicons name="time-outline" size={13} color={colors.textFaint} />
                  <Text style={styles.metaText}>{ex.minutes} min</Text>
                </View>
                <Text style={[styles.metaText, { color: colors.primary, fontWeight: '600' }]}>{ex.level}</Text>
                <View style={styles.meta}>
                  <Ionicons name="star" size={13} color={colors.star} />
                  <Text style={styles.metaText}>{ex.rating}</Text>
                </View>
              </View>
            </View>
          </View>
          <Pressable style={styles.startBtn} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: ex.id } })}>
            <Ionicons name="play" size={14} color={colors.white} />
            <Text style={styles.startText}>Start Exercise</Text>
          </Pressable>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h1, color: colors.text },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2 },
  sessionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginTop: spacing.md,
  },
  sessionChipText: { ...font.small, color: '#166534', fontWeight: '600' },
  quickTitle: { ...font.title, color: colors.text },
  quickSub: { ...font.body, color: colors.textMuted, marginTop: 4, lineHeight: 19 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: radii.pill,
    marginTop: spacing.md,
  },
  quickBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  exRow: { flexDirection: 'row', gap: spacing.md },
  exIcon: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exTitle: { ...font.title, color: colors.text },
  exDesc: { ...font.body, color: colors.textMuted, marginTop: 2, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...font.small, color: colors.textMuted },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    height: 42,
    borderRadius: radii.pill,
    marginTop: spacing.md,
  },
  startText: { color: colors.white, fontWeight: '600', fontSize: 13 },
});
