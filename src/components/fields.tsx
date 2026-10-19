/**
 * The three color fields (stress = clay, sleep = indigo, mood = sage) and
 * the helpers that turn a 0–10 value into a word or a color shade.
 */
import { StyleSheet, Text, View } from 'react-native';
import { CountUp, LivingGradient, Sparkline } from '@/components/motion';
import { type FieldKey, fields, fontFamily, radii } from '@/theme';

export const FIELD_LABELS: Record<FieldKey, string> = { stress: 'Stress', sleep: 'Sleep', mood: 'Mood' };

/**
 * Background and text color for a 0–10 value: four steps from the field's
 * lightest tint to its deepest tone, so stronger values read stronger.
 */
export function fieldShade(kind: FieldKey, value: number): { bg: string; text: string } {
  const f = fields[kind];
  if (value <= 3) return { bg: f.from, text: f.ink };
  if (value <= 5) return { bg: f.to, text: f.ink };
  if (value <= 7) return { bg: f.strong, text: '#FFFFFF' };
  return { bg: f.deep, text: '#FFFFFF' };
}

/** A color field tile: label, the value counting up, and a 7-day line. */
export function FieldTile({
  kind,
  value,
  history,
  delay = 0,
}: {
  kind: FieldKey;
  value: number | null;
  history: (number | null)[];
  delay?: number;
}) {
  const f = fields[kind];
  return (
    <LivingGradient colors={[f.from, f.to, f.from]} style={styles.tile} speed={9000 + delay * 4}>
      <Text style={[styles.label, { color: f.ink }]}>{FIELD_LABELS[kind]}</Text>
      {value === null ? (
        <Text style={[styles.value, { color: f.ink, opacity: 0.45 }]}>–</Text>
      ) : (
        <CountUp value={value} style={[styles.value, { color: f.ink }]} />
      )}
      <View style={styles.spark}>
        <Sparkline values={history} color={f.ink} />
      </View>
    </LivingGradient>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    height: 116,
    borderRadius: radii.lg - 2,
    padding: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  label: { fontFamily: fontFamily.semibold, fontSize: 12 },
  value: { fontFamily: fontFamily.bold, fontSize: 34, letterSpacing: -1, lineHeight: 38 },
  spark: { position: 'absolute', right: 10, bottom: 12, opacity: 0.55 },
});
