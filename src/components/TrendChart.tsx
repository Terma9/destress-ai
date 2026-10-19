/**
 * The month at a glance: stress, sleep and mood over the days of the month,
 * with each average below compared to last month.
 *
 * Kept calm on purpose: the lines are a 3-day average drawn as soft curves
 * (daily values zigzag too much to read), small gaps are bridged, and only
 * the value in focus (the one picked in the calendar) is drawn strongly with
 * a soft fill; the other two stay faint in the background for comparison.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { Logo } from '@/components/brand';
import { FIELD_LABELS } from '@/components/fields';
import { average } from '@/data/calendar';
import { colors, type FieldKey, fields, font, fontFamily, radii, shadow, spacing } from '@/theme';

const KINDS: FieldKey[] = ['stress', 'sleep', 'mood'];
const HEIGHT = 112;
const PAD_X = 6;
const PAD_Y = 10;
/** Missing days up to this length are bridged; longer gaps break the line. */
const MAX_GAP = 3;

type Series = Record<FieldKey, (number | null)[]>;
type Point = { x: number; y: number };

/** 3-day centred average over the known values (a day without data stays empty). */
function smooth(values: (number | null)[]): (number | null)[] {
  return values.map((v, i) => {
    if (v === null) return null;
    const window = [values[i - 1], v, values[i + 1]].filter((n): n is number => n !== null && n !== undefined);
    return window.reduce((a, b) => a + b, 0) / window.length;
  });
}

/** Splits into runs of known values, bridging gaps of up to MAX_GAP days. */
function runs(values: (number | null)[]): [number, number][][] {
  const out: [number, number][][] = [];
  let current: [number, number][] = [];
  let lastIndex = -Infinity;
  values.forEach((v, i) => {
    if (v === null) return;
    if (i - lastIndex > MAX_GAP + 1 && current.length) {
      out.push(current);
      current = [];
    }
    current.push([i, v]);
    lastIndex = i;
  });
  if (current.length) out.push(current);
  return out;
}

/** A smooth curve through the points (Catmull-Rom converted to cubic Béziers). */
function curve(points: Point[]): string {
  if (points.length < 2) return '';
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function TrendChart({
  series,
  selectedIndex,
  previous,
  focus,
  onFocus,
}: {
  /** One value per day of the month (null = no data). */
  series: Series;
  selectedIndex: number | null;
  previous: Record<FieldKey, number | null>;
  /** The value drawn strongly; the other two stay faint. */
  focus: FieldKey;
  onFocus: (kind: FieldKey) => void;
}) {
  const [width, setWidth] = useState(0);
  const days = series.stress.length;
  const x = (i: number) => PAD_X + (i * (width - 2 * PAD_X)) / Math.max(days - 1, 1);
  const y = (v: number) => PAD_Y + (1 - v / 10) * (HEIGHT - 2 * PAD_Y);

  const lines = Object.fromEntries(
    KINDS.map((k) => [k, runs(smooth(series[k])).map((run) => run.map(([i, v]) => ({ x: x(i), y: y(v) })))]),
  ) as Record<FieldKey, Point[][]>;

  const hasData = KINDS.some((k) => series[k].some((v) => v !== null));
  const f = fields[focus];
  const background = KINDS.filter((k) => k !== focus);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.label}>THIS MONTH</Text>
        <Text style={styles.hint}>3-day average</Text>
      </View>
      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && hasData && (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={f.strong} stopOpacity={0.22} />
                <Stop offset="1" stopColor={f.strong} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Week markers instead of a grid. */}
            {Array.from({ length: Math.floor((days - 1) / 7) }, (_, w) => (
              <Line key={w} x1={x((w + 1) * 7)} x2={x((w + 1) * 7)} y1={PAD_Y} y2={HEIGHT - PAD_Y} stroke={colors.sand} strokeWidth={1} />
            ))}
            <Line x1={PAD_X} x2={width - PAD_X} y1={HEIGHT - PAD_Y} y2={HEIGHT - PAD_Y} stroke={colors.sand} strokeWidth={1} />

            {selectedIndex !== null && (
              <Line
                x1={x(selectedIndex)}
                x2={x(selectedIndex)}
                y1={2}
                y2={HEIGHT - PAD_Y}
                stroke={colors.ink}
                strokeOpacity={0.25}
                strokeWidth={1}
                strokeDasharray="3,3"
              />
            )}

            {/* The other two values: thin and faint, for comparison. */}
            {background.map((k) =>
              lines[k].map((pts, i) => (
                <Path key={`${k}-${i}`} d={curve(pts)} fill="none" stroke={fields[k].strong} strokeOpacity={0.35} strokeWidth={1.5} strokeLinecap="round" />
              )),
            )}

            {/* The value in focus: soft fill + strong line. */}
            {lines[focus].map((pts, i) =>
              pts.length > 1 ? (
                <Path
                  key={`fill-${i}`}
                  d={`${curve(pts)} L${pts[pts.length - 1].x.toFixed(1)},${HEIGHT - PAD_Y} L${pts[0].x.toFixed(1)},${HEIGHT - PAD_Y} Z`}
                  fill="url(#focusFill)"
                />
              ) : null,
            )}
            {lines[focus].map((pts, i) =>
              pts.length > 1 ? (
                <Path key={`line-${i}`} d={curve(pts)} fill="none" stroke={f.deep} strokeWidth={2.75} strokeLinecap="round" />
              ) : (
                <Circle key={`dot-${i}`} cx={pts[0].x} cy={pts[0].y} r={3} fill={f.deep} />
              ),
            )}

            {/* The selected day's point on the line in focus. */}
            {selectedIndex !== null && series[focus][selectedIndex] !== null && (
              <Circle
                cx={x(selectedIndex)}
                cy={y(smooth(series[focus])[selectedIndex]!)}
                r={4.5}
                fill="#FFFFFF"
                stroke={f.deep}
                strokeWidth={2.5}
              />
            )}
          </Svg>
        )}
        {!hasData && (
          <View style={styles.empty}>
            <Logo size={34} />
            <Text style={styles.emptyText}>Your lines appear after your first check-ins.</Text>
          </View>
        )}
      </View>

      <View style={styles.averages}>
        {KINDS.map((k) => {
          const avg = average(series[k]);
          const prev = previous[k];
          const diff = avg !== null && prev !== null ? Math.round((avg - prev) * 10) / 10 : null;
          const active = k === focus;
          return (
            <Pressable
              key={k}
              onPress={() => onFocus(k)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${FIELD_LABELS[k]} in the chart`}
              style={[styles.avg, active && { backgroundColor: fields[k].from }]}>
              <View style={styles.avgHead}>
                <View style={[styles.dot, { backgroundColor: fields[k].strong, opacity: active ? 1 : 0.5 }]} />
                <Text style={[styles.avgLabel, { color: fields[k].ink }]}>{FIELD_LABELS[k]}</Text>
              </View>
              <Text style={[styles.avgValue, { color: fields[k].ink }]}>{avg ?? '–'}</Text>
              <Text style={styles.avgDiff}>
                {diff === null ? 'avg' : diff === 0 ? 'same as last month' : `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)} vs last month`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, ...shadow.card },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { ...font.label, color: colors.textMuted },
  hint: { ...font.tiny, color: colors.textFaint },
  chart: { height: HEIGHT, marginTop: spacing.sm, justifyContent: 'center' },
  empty: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 6 },
  emptyText: { ...font.small, color: colors.textMuted, textAlign: 'center' },
  averages: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
  avg: { flex: 1, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 6 },
  avgHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  avgLabel: { fontFamily: fontFamily.semibold, fontSize: 12 },
  avgValue: { fontFamily: fontFamily.bold, fontSize: 22, letterSpacing: -0.5, marginTop: 2 },
  avgDiff: { ...font.tiny, color: colors.textMuted },
});
