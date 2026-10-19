/**
 * Search your entries by meaning (RAG): the query is embedded on the server
 * and compared with the topic chunks of every check-in, so "when did I sleep
 * well?" also finds an entry that only says "finally rested". Each result
 * shows which topic matched; tapping it opens the entry.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { searchCheckins, type SearchResult } from '@/ai/checkinClient';
import { InlineLoader, Logo } from '@/components/brand';
import { AiMark, PressableScale } from '@/components/motion';
import { Card, Screen } from '@/components/ui';
import { colors, font, fontFamily, radii, shadow, spacing } from '@/theme';

const SUGGESTIONS = ['When did I sleep well?', 'Exam stress', 'What helped me calm down?', 'Time with friends'];

type State = { status: 'idle' } | { status: 'searching' } | { status: 'done'; results: SearchResult[] } | { status: 'error' };

export default function Search() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  async function run(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setState({ status: 'searching' });
    try {
      setState({ status: 'done', results: await searchCheckins(text) });
    } catch {
      setState({ status: 'error' });
    }
  }

  return (
    <Screen tint="indigo">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.round} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Search your days</Text>
      </View>

      <View style={styles.box}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => run(query)}
          placeholder="Ask in your own words…"
          placeholderTextColor={colors.textFaint}
          returnKeyType="search"
          style={styles.input}
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => {
              setQuery('');
              setState({ status: 'idle' });
            }}
            hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        )}
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <AiMark label="SEARCHES BY MEANING, NOT JUST WORDS" size={11} />
      </View>

      {state.status === 'idle' && (
        <View style={styles.chips}>
          {SUGGESTIONS.map((s) => (
            <PressableScale key={s} onPress={() => run(s)} style={styles.chip}>
              <Text style={styles.chipText}>{s}</Text>
            </PressableScale>
          ))}
        </View>
      )}

      {state.status === 'searching' && <InlineLoader message="Looking through your conversations…" />}

      {state.status === 'error' && <Text style={styles.note}>Search didn't work. Check your connection and try again.</Text>}

      {state.status === 'done' && state.results.length === 0 && (
        <View style={styles.empty}>
          <Logo size={44} />
          <Text style={styles.note}>Nothing close in meaning yet. Try other words, or check in a few more evenings.</Text>
        </View>
      )}

      {state.status === 'done' &&
        state.results.map((r, i) => (
          <Animated.View key={r.id} entering={FadeInDown.duration(380).delay(i * 70)} style={{ marginTop: spacing.md }}>
            <Card onPress={() => router.push({ pathname: '/entry/[id]', params: { id: r.id } })}>
              <Text style={styles.day}>
                {new Date(r.created_at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
                {r.similarity >= 0.5 ? ' · Strong match' : ''}
              </Text>
              <Text style={styles.resultTitle}>{r.title ?? 'Check-in'}</Text>
              {r.topic !== 'all' && r.topic_title ? (
                <View style={styles.matched}>
                  <Ionicons name="sparkles" size={11} color={colors.inkSoft} />
                  <Text style={styles.matchedText}>{r.topic_title}</Text>
                </View>
              ) : null}
              <Text style={styles.summary} numberOfLines={3}>
                {r.summary}
              </Text>
            </Card>
          </Animated.View>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  title: { ...font.h2, color: colors.ink },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    ...shadow.soft,
  },
  input: { ...font.body, color: colors.text, flex: 1, paddingVertical: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  chip: { backgroundColor: colors.sand, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.ink },
  note: { ...font.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  empty: { alignItems: 'center', marginTop: spacing.xl },
  day: { ...font.small, color: colors.textMuted },
  resultTitle: { ...font.title, color: colors.ink, marginTop: 2 },
  matched: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 6,
  },
  matchedText: { fontFamily: fontFamily.semibold, fontSize: 11, color: colors.inkSoft },
  summary: { ...font.body, color: colors.inkSoft, marginTop: spacing.sm, lineHeight: 20 },
});
