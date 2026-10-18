import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, Chip, EmptyState, GradientCard, Screen, SectionHeader } from '@/components/ui';
import { articles, knowledgeCategories } from '@/data/content';
import { useAppStore } from '@/store/useAppStore';
import { colors, font, gradients, radii, spacing } from '@/theme';

export default function Knowledge() {
  const router = useRouter();
  const readArticles = useAppStore((s) => s.readArticles);
  const [cat, setCat] = useState<string>('All');
  const [q, setQ] = useState('');

  const featured = articles.find((a) => a.featured);
  const list = useMemo(
    () =>
      articles.filter(
        (a) =>
          !a.featured &&
          (cat === 'All' || a.category === cat) &&
          (q === '' || a.title.toLowerCase().includes(q.toLowerCase())),
      ),
    [cat, q],
  );

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text style={styles.title}>Knowledge Bits</Text>
      <Text style={styles.sub}>Bite-sized wisdom for your wellness journey</Text>

      <View style={styles.search}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search topics..."
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {knowledgeCategories.map((c) => (
          <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />
        ))}
      </ScrollView>

      {featured && (cat === 'All' || cat === featured.category) && (
        <GradientCard colors={gradients.featured} style={{ marginTop: spacing.md }}>
          <View style={styles.featRow}>
            <Ionicons name="star" size={14} color="#FDE047" />
            <Text style={styles.featBadge}>Featured</Text>
          </View>
          <Text style={styles.featTitle}>{featured.title}</Text>
          <Text style={styles.featBody}>{featured.description}</Text>
          <View style={styles.featFoot}>
            <View style={styles.meta}>
              <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.9)" />
              <Text style={styles.featMeta}>{featured.minutes} min read</Text>
            </View>
            <Pressable
              style={styles.readBtn}
              onPress={() => router.push({ pathname: '/article/[id]', params: { id: featured.id } })}>
              <Text style={styles.readBtnText}>Read Now</Text>
            </Pressable>
          </View>
        </GradientCard>
      )}

      <SectionHeader title="Explore Topics" />
      {list.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="search-outline" size={32} color={colors.textFaint} />}
          title="No articles found"
          caption="Try a different search term or category."
        />
      ) : (
        list.map((a) => {
          const isRead = readArticles.includes(a.id);
          return (
            <Card
              key={a.id}
              style={{ marginBottom: spacing.md }}
              onPress={() => router.push({ pathname: '/article/[id]', params: { id: a.id } })}>
              <View style={styles.artRow}>
                <View style={[styles.artIcon, { backgroundColor: a.tint + '22' }]}>
                  <Ionicons name={a.icon as any} size={20} color={a.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.artTitle}>{a.title}</Text>
                  <Text style={styles.artDesc}>{a.description}</Text>
                  <View style={styles.artFoot}>
                    <View style={styles.meta}>
                      <Ionicons name="time-outline" size={13} color={colors.textFaint} />
                      <Text style={styles.artMeta}>{a.minutes} min</Text>
                    </View>
                    <Text style={[styles.artMeta, { color: a.tint, fontWeight: '600' }]}>{a.category}</Text>
                    {isRead ? (
                      <View style={styles.readBadge}>
                        <Ionicons name="checkmark" size={11} color={colors.green} />
                        <Text style={styles.readBadgeText}>Read</Text>
                      </View>
                    ) : (
                      <Text style={[styles.artMeta, { color: colors.primary, fontWeight: '600' }]}>Read →</Text>
                    )}
                  </View>
                </View>
              </View>
            </Card>
          );
        })
      )}
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    height: 46,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, ...font.body, color: colors.text },
  chips: { gap: spacing.sm, paddingVertical: spacing.md },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featBadge: { ...font.small, color: colors.white, fontWeight: '600' },
  featTitle: { ...font.h3, color: colors.white, marginTop: 6 },
  featBody: { ...font.body, color: 'rgba(255,255,255,0.92)', marginTop: 4, lineHeight: 20 },
  featFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  featMeta: { ...font.small, color: 'rgba(255,255,255,0.9)' },
  readBtn: { backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill },
  readBtnText: { color: colors.purple, fontWeight: '600', fontSize: 13 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  artRow: { flexDirection: 'row', gap: spacing.md },
  artIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  artTitle: { ...font.title, color: colors.text },
  artDesc: { ...font.body, color: colors.textMuted, marginTop: 2, lineHeight: 19 },
  artFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  artMeta: { ...font.small, color: colors.textMuted },
  readBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  readBadgeText: { ...font.tiny, color: colors.green, fontWeight: '700' },
});
