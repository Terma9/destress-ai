import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Screen } from '@/components/ui';
import { articles } from '@/data/content';
import { useAppStore } from '@/store/useAppStore';
import { colors, font, radii, spacing } from '@/theme';

export default function ArticleReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const markArticleRead = useAppStore((s) => s.markArticleRead);
  const article = articles.find((a) => a.id === id) ?? articles[0];

  useEffect(() => {
    markArticleRead(article.id);
  }, [article.id]);

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.iconWrap, { backgroundColor: article.tint + '22' }]}>
        <Ionicons name={article.icon as any} size={26} color={article.tint} />
      </View>
      <Text style={[styles.category, { color: article.tint }]}>{article.category}</Text>
      <Text style={styles.title}>{article.title}</Text>
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={13} color={colors.textFaint} />
        <Text style={styles.metaText}>{article.minutes} min read</Text>
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        {article.body.map((p, i) => (
          <Text key={i} style={[styles.paragraph, i > 0 && { marginTop: spacing.md }]}>
            {p}
          </Text>
        ))}
      </Card>
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
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  category: { ...font.small, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { ...font.h1, color: colors.text, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  metaText: { ...font.small, color: colors.textFaint },
  paragraph: { ...font.body, color: colors.text, lineHeight: 22 },
});
