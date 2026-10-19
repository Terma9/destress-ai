/**
 * Calendar: a month of stress, sleep or mood as color fields. Tap a day to
 * see its values and check-in. The list of all entries (with search by
 * meaning) is one tap away in the top right.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn as Appear, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { InlineLoader } from '@/components/brand';
import { FIELD_LABELS, fieldShade } from '@/components/fields';
import { FadeIn, PressableScale } from '@/components/motion';
import { Card, EmptyState, Screen } from '@/components/ui';
import { useMonth } from '@/data/calendar';
import type { DailyMetric } from '@/data/metrics';
import { dateKey } from '@/lib/dates';
import { colors, type FieldKey, fields, font, fontFamily, gradients, radii, shadow, spacing } from '@/theme';
import { LinearGradient } from 'expo-linear-gradient';

const KINDS: FieldKey[] = ['stress', 'sleep', 'mood'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The tracked value of a kind; mood is stored as the "emotion" score. */
const valueOf = (m: DailyMetric | undefined, kind: FieldKey) =>
  m ? (kind === 'mood' ? m.emotion : m[kind]) : null;

export default function Calendar() {
  const router = useRouter();
  const now = new Date();
  const today = dateKey(now);
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [kind, setKind] = useState<FieldKey>('stress');
  const [selected, setSelected] = useState(today);
  const { data, error } = useMonth(view.year, view.month);

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const leading = (new Date(view.year, view.month, 1).getDay() + 6) % 7; // Monday first
  const monthName = new Date(view.year, view.month, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });

  function shift(delta: number) {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(dateKey(d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() ? now : d));
  }

  const metric = data?.metrics.get(selected);
  const checkin = data?.checkins.get(selected);
  const selectedDate = new Date(`${selected}T12:00:00`);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{monthName}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => shift(-1)} hitSlop={8} style={styles.round} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={18} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => shift(1)} hitSlop={8} style={styles.round} accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={18} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/diary')} hitSlop={8} style={styles.round} accessibilityLabel="All entries and search">
            <Ionicons name="search" size={17} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      <Segmented value={kind} onChange={setKind} />

      <View style={styles.week}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      {error ? (
        <EmptyState
          icon={<Ionicons name="cloud-offline-outline" size={32} color={colors.textFaint} />}
          title="Couldn't load this month"
          caption="Check your connection and come back to this tab."
        />
      ) : !data ? (
        <InlineLoader />
      ) : (
        <View style={styles.grid} key={`${view.year}-${view.month}-${kind}`}>
          {Array.from({ length: leading }, (_, i) => (
            <View key={`pad-${i}`} style={styles.cellBox} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = dateKey(new Date(view.year, view.month, i + 1));
            const value = valueOf(data.metrics.get(day), kind);
            const shade = value !== null ? fieldShade(kind, value) : null;
            const future = day > today;
            const isSelected = day === selected;
            return (
              <Animated.View key={day} entering={Appear.duration(320).delay(i * 14)} style={styles.cellBox}>
                <Pressable
                  disabled={future}
                  onPress={() => setSelected(day)}
                  accessibilityLabel={`${day}${value !== null ? `, ${FIELD_LABELS[kind]} ${value}` : ''}`}
                  style={[
                    styles.cell,
                    shade && { backgroundColor: shade.bg },
                    day === today && !shade && styles.today,
                    isSelected && styles.selected,
                  ]}>
                  <Text
                    style={[
                      styles.cellText,
                      shade && { color: shade.text },
                      future && { color: colors.textFaint, opacity: 0.6 },
                    ]}>
                    {i + 1}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      <View style={styles.legend}>
        <Text style={styles.legendText}>low</Text>
        {[2, 5, 7, 9].map((v) => (
          <View key={v} style={[styles.swatch, { backgroundColor: fieldShade(kind, v).bg }]} />
        ))}
        <Text style={styles.legendText}>high</Text>
      </View>

      {data && (
        <FadeIn key={selected} style={{ marginTop: spacing.lg }}>
          <Card>
            <Text style={styles.dayLabel}>
              {selectedDate.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            {checkin ? (
              <Text style={styles.dayTitle}>{checkin.title ?? 'Check-in'}</Text>
            ) : (
              <Text style={styles.dayTitle}>{selected === today ? 'Tonight is still open' : 'No entry this day'}</Text>
            )}
            <View style={styles.chips}>
              {KINDS.map((k) => {
                const v = valueOf(metric, k);
                return (
                  <View key={k} style={[styles.chip, { backgroundColor: fields[k].from }]}>
                    <Text style={[styles.chipText, { color: fields[k].ink }]}>
                      {FIELD_LABELS[k]} {v ?? '–'}
                    </Text>
                  </View>
                );
              })}
            </View>
            {checkin?.summary ? <Text style={styles.summary}>{checkin.summary}</Text> : null}
            {checkin ? (
              <PressableScale
                style={styles.link}
                onPress={() => router.push({ pathname: '/entry/[id]', params: { id: checkin.id } })}>
                <Text style={styles.linkText}>Open entry</Text>
                <Ionicons name="arrow-forward" size={15} color={colors.ink} />
              </PressableScale>
            ) : selected === today ? (
              <PressableScale onPress={() => router.push('/diary/new')} style={{ marginTop: spacing.md }}>
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
                  <Text style={styles.ctaText}>Write tonight's check-in</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.white} />
                </LinearGradient>
              </PressableScale>
            ) : null}
          </Card>
        </FadeIn>
      )}
    </Screen>
  );
}

/** Stress / Sleep / Mood switcher with a pill that slides to the active option. */
function Segmented({ value, onChange }: { value: FieldKey; onChange: (k: FieldKey) => void }) {
  const [width, setWidth] = useState(0);
  const index = KINDS.indexOf(value);
  const x = useSharedValue(0);
  useEffect(() => {
    if (width) x.value = withSpring((index * width) / KINDS.length, { damping: 20, stiffness: 220 });
  }, [index, width]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={styles.segment} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}>
      {width > 0 && <Animated.View style={[styles.segmentPill, { width: width / KINDS.length }, pill]} />}
      {KINDS.map((k) => (
        <Pressable key={k} style={styles.segmentItem} onPress={() => onChange(k)} accessibilityRole="tab">
          <Text style={[styles.segmentText, k === value && { color: fields[k].ink, fontFamily: fontFamily.semibold }]}>
            {FIELD_LABELS[k]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  title: { ...font.h1, color: colors.ink, flexShrink: 1 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  segment: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: radii.md, padding: 4 },
  segmentPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 12, backgroundColor: colors.card, ...shadow.soft },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  segmentText: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.textMuted },
  week: { flexDirection: 'row', marginTop: spacing.lg, marginBottom: spacing.sm },
  weekday: { flex: 1, textAlign: 'center', ...font.small, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellBox: { width: `${100 / 7}%`, padding: 3 },
  cell: { aspectRatio: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.inkSoft },
  today: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: fields.stress.strong },
  selected: { borderWidth: 2, borderColor: colors.ink },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
  legendText: { ...font.tiny, color: colors.textMuted },
  swatch: { width: 18, height: 8, borderRadius: 3 },
  dayLabel: { ...font.small, color: colors.textMuted },
  dayTitle: { ...font.h3, color: colors.ink, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  chip: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontFamily: fontFamily.semibold, fontSize: 12 },
  summary: { ...font.body, color: colors.inkSoft, marginTop: spacing.md, lineHeight: 20 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, alignSelf: 'flex-start' },
  linkText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  ctaText: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.white },
});
