/**
 * The review step after a check-in: the AI suggests stress, sleep and mood
 * from the conversation, each with a short reason, and the user confirms or
 * adjusts them before they go into the calendar. This is what replaces
 * manual tracking: the AI does the work, the user keeps the final say.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SoftDots } from '@/components/brand';
import { FIELD_LABELS } from '@/components/fields';
import { AiMark, PressableScale } from '@/components/motion';
import type { DayValues } from '@/data/checkins';
import { colors, type FieldKey, fields, font, fontFamily, gradients, radii, shadow, spacing } from '@/theme';

const KINDS: { kind: FieldKey; key: keyof DayValues; hint: string }[] = [
  { kind: 'stress', key: 'stress', hint: '0 calm · 10 overwhelming' },
  { kind: 'sleep', key: 'sleep', hint: '0 barely slept · 10 deeply rested' },
  { kind: 'mood', key: 'mood', hint: '0 very low · 10 great' },
];

export function DayReview({
  suggested,
  reasons,
  saving,
  onSave,
}: {
  suggested: DayValues;
  reasons: { stress?: string; sleep?: string; mood?: string };
  saving: boolean;
  onSave: (values: DayValues, changedByUser: boolean) => void;
}) {
  const [values, setValues] = useState<DayValues>(suggested);
  const changed = KINDS.some(({ key }) => values[key] !== suggested[key]);

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeInDown.duration(420)}>
        <Text style={styles.title}>Here's how your day looked</Text>
        <View style={{ marginTop: 6 }}>
          <AiMark label="SUGGESTED FROM YOUR CONVERSATION · ADJUST ANYTHING" size={11} />
        </View>
      </Animated.View>

      {KINDS.map(({ kind, key, hint }, i) => (
        <Animated.View key={kind} entering={FadeInDown.duration(420).delay(120 + i * 110)}>
          <ValueRow
            kind={kind}
            value={values[key]}
            reason={(reasons as Record<string, string | undefined>)[kind === 'mood' ? 'mood' : kind] ?? ''}
            hint={hint}
            edited={values[key] !== suggested[key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
          />
        </Animated.View>
      ))}

      <Animated.View entering={FadeInUp.duration(400).delay(520)}>
        <PressableScale onPress={() => onSave(values, changed)} disabled={saving} accessibilityLabel="Save to my calendar">
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.save}>
            {saving ? (
              <SoftDots color={colors.ivory} size={6} />
            ) : (
              <>
                <Ionicons name="calendar-outline" size={18} color={colors.ivory} />
                <Text style={styles.saveText}>Save to my calendar</Text>
              </>
            )}
          </LinearGradient>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

function ValueRow({
  kind,
  value,
  reason,
  hint,
  edited,
  onChange,
}: {
  kind: FieldKey;
  value: number | null;
  reason: string;
  hint: string;
  edited: boolean;
  onChange: (v: number) => void;
}) {
  const f = fields[kind];
  const step = (delta: number) => onChange(Math.max(0, Math.min(10, (value ?? 5) + delta)));
  return (
    <LinearGradient colors={[f.from, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.row}>
      <View style={styles.rowHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: f.ink }]}>{FIELD_LABELS[kind]}</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
        <Pressable onPress={() => step(-1)} hitSlop={6} style={styles.stepBtn} accessibilityLabel={`Lower ${kind}`}>
          <Ionicons name="remove" size={18} color={f.ink} />
        </Pressable>
        <Text style={[styles.value, { color: f.ink }]}>{value ?? '–'}</Text>
        <Pressable onPress={() => step(1)} hitSlop={6} style={styles.stepBtn} accessibilityLabel={`Raise ${kind}`}>
          <Ionicons name="add" size={18} color={f.ink} />
        </Pressable>
      </View>

      <View style={styles.track}>
        {Array.from({ length: 11 }, (_, n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            accessibilityLabel={`${FIELD_LABELS[kind]} ${n}`}
            style={[
              styles.notch,
              { backgroundColor: value !== null && n <= value ? f.strong : 'rgba(255,255,255,0.9)' },
              value === n && { backgroundColor: f.deep, transform: [{ scaleY: 1.35 }] },
            ]}
          />
        ))}
      </View>

      {reason ? (
        <View style={styles.reasonRow}>
          <Ionicons name={edited ? 'create-outline' : 'sparkles'} size={12} color={edited ? colors.textMuted : f.deep} />
          <Text style={styles.reason}>{edited ? 'Changed by you' : reason}</Text>
        </View>
      ) : (
        <Text style={styles.reason}>{value === null ? "This didn't come up, set it if you like." : ''}</Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  title: { ...font.h2, color: colors.ink },
  row: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    ...shadow.soft,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: fontFamily.bold, fontSize: 15 },
  hint: { ...font.tiny, color: colors.textMuted, marginTop: 1 },
  value: { fontFamily: fontFamily.bold, fontSize: 26, minWidth: 34, textAlign: 'center', letterSpacing: -0.5 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { flexDirection: 'row', gap: 4, height: 12, alignItems: 'center' },
  notch: { flex: 1, height: 8, borderRadius: 4 },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  reason: { ...font.small, color: colors.inkSoft, flex: 1, lineHeight: 17 },
  save: {
    height: 56,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    ...shadow.lifted,
  },
  saveText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.ivory },
});
