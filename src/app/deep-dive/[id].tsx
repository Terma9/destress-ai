import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { InlineLoader, SoftDots } from '@/components/brand';
import { Card, EmptyState, GradientCard, ProgressBar, Screen, SectionHeader } from '@/components/ui';
import { moodEmoji } from '@/data/checkins';
import {
  answeredCount,
  type DeepDive,
  diveStyle,
  type EvidenceEntry,
  fetchDeepDive,
  saveReflection,
} from '@/data/deepDives';
import { colors, font, radii, spacing } from '@/theme';

export default function DeepDiveDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<{ dive: DeepDive; evidence: EvidenceEntry[] } | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchDeepDive(id)
        .then((d) => {
          setData(d);
          setError(false);
        })
        .catch(() => setError(true));
    }, [id]),
  );

  const back = (
    <View style={styles.topRow}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
  );

  if (error || data === null) {
    return (
      <Screen>
        {back}
        <EmptyState
          icon={<Ionicons name="alert-circle-outline" size={32} color={colors.textFaint} />}
          title={error ? "Couldn't load this pattern" : 'This pattern no longer exists'}
        />
      </Screen>
    );
  }
  if (data === undefined) {
    return (
      <Screen>
        {back}
        <InlineLoader />
      </Screen>
    );
  }

  const { dive, evidence } = data;
  const look = diveStyle(dive.icon);
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const answered = answeredCount(dive);

  function onSaved(index: number, answer: string) {
    setData((d) => d && { ...d, dive: { ...d.dive, answers: { ...d.dive.answers, [index]: answer } } });
  }

  return (
    <Screen>
      {back}

      <GradientCard colors={look.gradient}>
        <View style={styles.headRow}>
          <View style={styles.headIcon}>
            <Ionicons name={look.name as any} size={22} color={colors.white} />
          </View>
          <Text style={styles.headTitle}>{dive.title}</Text>
        </View>
        <Text style={styles.headBody}>{dive.description}</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Reflections answered</Text>
          <Text style={styles.progressLabel}>
            {answered} of {dive.questions.length}
          </Text>
        </View>
        <ProgressBar
          progress={dive.questions.length ? answered / dive.questions.length : 0}
          color={colors.white}
          track="rgba(255,255,255,0.3)"
        />
      </GradientCard>

      <SectionHeader title="What I've noticed" />
      <Card>
        {dive.findings.map((f, i) => (
          <View key={i} style={i > 0 && { marginTop: spacing.lg }}>
            <View style={styles.findingRow}>
              <View style={[styles.bullet, { backgroundColor: look.gradient[0] }]}>
                <Ionicons name="sparkles" size={11} color={colors.white} />
              </View>
              <Text style={styles.findingText}>{f.text}</Text>
            </View>
            <View style={styles.chips}>
              {f.evidence
                .map((eid) => byId.get(eid))
                .filter((e): e is EvidenceEntry => !!e)
                .map((e) => (
                  <Pressable
                    key={e.id}
                    style={styles.chip}
                    onPress={() => router.push({ pathname: '/entry/[id]', params: { id: e.id } })}>
                    <Text style={styles.chipText} numberOfLines={1}>
                      {moodEmoji(e.mood)}{' '}
                      {new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ·{' '}
                      {e.title ?? 'Check-in'}
                    </Text>
                  </Pressable>
                ))}
            </View>
          </View>
        ))}
        <Text style={styles.hint}>Tap an entry to see what you wrote that day.</Text>
      </Card>

      <SectionHeader title="Reflect on this" />
      <Card>
        {dive.questions.map((q, i) => (
          <Reflection
            key={i}
            diveId={dive.id}
            index={i}
            question={q}
            saved={dive.answers[i] ?? ''}
            onSaved={onSaved}
          />
        ))}
        <Text style={styles.hint}>Your answers help Destress AI understand you better in your next check-ins.</Text>
      </Card>

      <Text style={styles.disclaimer}>
        AI-generated from your check-ins. It can be wrong, and it isn't medical advice.
      </Text>
    </Screen>
  );
}

function Reflection({
  diveId,
  index,
  question,
  saved,
  onSaved,
}: {
  diveId: string;
  index: number;
  question: string;
  saved: string;
  onSaved: (index: number, answer: string) => void;
}) {
  const [draft, setDraft] = useState(saved);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const answer = draft.trim();
  const changed = answer !== saved && answer.length > 0;

  async function save() {
    setStatus('saving');
    try {
      await saveReflection(diveId, index, question, answer);
      onSaved(index, answer);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <View style={index > 0 && { marginTop: spacing.lg }}>
      <View style={styles.findingRow}>
        <View style={[styles.bullet, { backgroundColor: saved ? colors.green : colors.purple }]}>
          {saved ? (
            <Ionicons name="checkmark" size={13} color={colors.white} />
          ) : (
            <Text style={styles.bulletNum}>{index + 1}</Text>
          )}
        </View>
        <Text style={styles.findingText}>{question}</Text>
      </View>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder="Write your thoughts…"
        placeholderTextColor={colors.textFaint}
        multiline
        maxLength={2000}
      />
      {(changed || status === 'error') && (
        <Pressable style={styles.saveBtn} onPress={save} disabled={status === 'saving'}>
          {status === 'saving' ? (
            <SoftDots color={colors.white} size={6} />
          ) : (
            <Text style={styles.saveText}>{status === 'error' ? "Couldn't save — retry" : 'Save answer'}</Text>
          )}
        </Pressable>
      )}
    </View>
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
  headBody: { ...font.body, color: 'rgba(255,255,255,0.92)', lineHeight: 20, marginTop: spacing.md },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginLeft: 34 },
  chip: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  chipText: { ...font.small, color: colors.text },
  hint: { ...font.small, color: colors.textFaint, marginTop: spacing.lg, fontStyle: 'italic' },
  input: {
    ...font.body,
    color: colors.text,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 70,
    marginTop: spacing.sm,
    marginLeft: 34,
    textAlignVertical: 'top',
  },
  saveBtn: {
    alignSelf: 'flex-end',
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
    minWidth: 110,
    alignItems: 'center',
  },
  saveText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  disclaimer: { ...font.small, color: colors.textFaint, textAlign: 'center', marginTop: spacing.lg },
});
