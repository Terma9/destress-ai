import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, ProgressBar, Screen } from '@/components/ui';
import { deepDives } from '@/data/content';
import { colors, font, radii, spacing } from '@/theme';

export default function DeepDives() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text style={styles.title}>AI Deep Dives</Text>
      <Text style={styles.sub}>Personalized insights powered by AI</Text>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {deepDives.map((d) => (
          <Card key={d.id}>
            <View style={styles.head}>
              <View style={[styles.icon, { backgroundColor: d.gradient[0] }]}>
                <Ionicons name={d.icon as any} size={20} color={colors.white} />
              </View>
              <Text style={styles.cardTitle}>{d.title}</Text>
            </View>
            <Text style={styles.body}>{d.description}</Text>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressVal}>{d.progress}%</Text>
            </View>
            <ProgressBar progress={d.progress / 100} color={d.gradient[0]} />
            <Pressable
              style={styles.explore}
              onPress={() => router.push({ pathname: '/deep-dive/[id]', params: { id: d.id } })}>
              <Text style={[styles.exploreText, { color: d.gradient[0] }]}>Explore Deeper →</Text>
            </Pressable>
          </Card>
        ))}
      </View>
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
  title: { ...font.h1, color: colors.text },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...font.title, color: colors.text, flex: 1 },
  body: { ...font.body, color: colors.textMuted, lineHeight: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: 6 },
  progressLabel: { ...font.small, color: colors.textMuted },
  progressVal: { ...font.small, color: colors.text, fontWeight: '600' },
  explore: { marginTop: spacing.md },
  exploreText: { ...font.body, fontWeight: '600' },
});
