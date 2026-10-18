import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, GradientCard, ProgressBar, Screen, SectionHeader } from '@/components/ui';
import { articles, deepDives, exercises } from '@/data/content';
import { colors, font, radii, spacing } from '@/theme';

export default function DeepDiveDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dive = deepDives.find((d) => d.id === id) ?? deepDives[0];
  const exercise = exercises.find((e) => e.id === dive.exerciseId) ?? exercises[0];
  const article = articles.find((a) => a.id === dive.articleId) ?? articles[0];

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Header */}
      <GradientCard colors={dive.gradient}>
        <View style={styles.headRow}>
          <View style={styles.headIcon}>
            <Ionicons name={dive.icon as any} size={22} color={colors.white} />
          </View>
          <Text style={styles.headTitle}>{dive.title}</Text>
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressLabel}>{dive.progress}%</Text>
        </View>
        <ProgressBar progress={dive.progress / 100} color={colors.white} track="rgba(255,255,255,0.3)" />
      </GradientCard>

      {/* Findings */}
      <SectionHeader title="What I've noticed" />
      <Card>
        {dive.findings.map((f, i) => (
          <View key={i} style={[styles.findingRow, i > 0 && { marginTop: spacing.md }]}>
            <View style={[styles.bullet, { backgroundColor: dive.gradient[0] }]}>
              <Ionicons name="sparkles" size={11} color={colors.white} />
            </View>
            <Text style={styles.findingText}>{f}</Text>
          </View>
        ))}
      </Card>

      {/* Reflection */}
      <SectionHeader title="Reflect on this" />
      <Card>
        {dive.reflection.map((q, i) => (
          <View key={i} style={[styles.findingRow, i > 0 && { marginTop: spacing.md }]}>
            <View style={[styles.bullet, { backgroundColor: colors.purple }]}>
              <Text style={styles.bulletNum}>{i + 1}</Text>
            </View>
            <Text style={styles.findingText}>{q}</Text>
          </View>
        ))}
        <Text style={styles.reflectHint}>
          Take these into your next diary entry — writing your answers down helps.
        </Text>
      </Card>

      {/* Recommendations */}
      <SectionHeader title="Recommended for you" />
      <Card
        style={{ marginBottom: spacing.md }}
        onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}>
        <View style={styles.recRow}>
          <View style={[styles.recIcon, { backgroundColor: exercise.tint + '22' }]}>
            <Ionicons name={exercise.icon as any} size={22} color={exercise.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recKicker}>EXERCISE · {exercise.minutes} MIN</Text>
            <Text style={styles.recTitle}>{exercise.title}</Text>
            <Text style={styles.recDesc}>{exercise.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </View>
      </Card>
      <Card
        onPress={() => router.push({ pathname: '/article/[id]', params: { id: article.id } })}>
        <View style={styles.recRow}>
          <View style={[styles.recIcon, { backgroundColor: article.tint + '22' }]}>
            <Ionicons name={article.icon as any} size={22} color={article.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recKicker}>KNOWLEDGE BIT · {article.minutes} MIN READ</Text>
            <Text style={styles.recTitle}>{article.title}</Text>
            <Text style={styles.recDesc}>{article.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </View>
      </Card>
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
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: { ...font.h3, color: colors.white, flex: 1 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: 6,
  },
  progressLabel: { ...font.small, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  findingRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  bullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  bulletNum: { color: colors.white, fontSize: 12, fontWeight: '700' },
  findingText: { ...font.body, color: colors.text, flex: 1, lineHeight: 21 },
  reflectHint: { ...font.small, color: colors.textFaint, marginTop: spacing.lg, fontStyle: 'italic' },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  recIcon: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recKicker: { ...font.tiny, color: colors.textFaint, fontWeight: '700', letterSpacing: 0.4 },
  recTitle: { ...font.title, color: colors.text, marginTop: 2 },
  recDesc: { ...font.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
});
