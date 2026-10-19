/**
 * The month at a glance: stress, sleep and mood as three lines in one chart,
 * with each average below it compared to last month. Deliberately sparse:
 * no axis labels beyond 0/5/10, a marker for the selected day, nothing else.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Logo } from '@/components/brand';
import { FIELD_LABELS } from '@/components/fields';
import { average } from '@/data/calendar';
import { colors, type FieldKey, fields, font, fontFamily, radii, shadow, spacing } from '@/theme';

const KINDS: FieldKey[] = ['stress', 'sleep', 'mood'];
const HEIGHT = 120;
const PAD = 8;

type Series = Record<FieldKey, (number | null)[]>;

export function TrendChart({
  series,
  selectedIndex,
  previous,
}: {
  /** One value per day of the month (null = no data). */
  series: Series;
  selectedIndex: number | null;
  previous: Record<FieldKey, number | null>;
}) {
  const [width, setWidth] = useState(0);
  const days = series.stress.length;
  const x = (i: number) => PAD + (i * (width - 2 * PAD)) / Math.max(days - 1, 1);
  const y = (v: number) => PAD + (1 - v / 10) * (HEIGHT - 2 * PAD);

  /** Splits a series at gaps so missing days don't get bridged by a line. */
  const segments = (values: (number | null)[]) => {
    const out: string[][] = [[]];
    values.forEach((v, i) => {
      if (v === null) out.push([]);
      else out[out.length - 1].push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    });
    return out.filter((s) => s.length > 0);
  };

  const hasData = KINDS.some((k) => series[k].some((v) => v !== null));

  return (
    <View style={styles.card}>
      <Text style={styles.label}>THIS MONTH</Text>
      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {[0, 5, 10].map((v) => (
              <Line key={v} x1={PAD} x2={width - PAD} y1={y(v)} y2={y(v)} stroke={colors.sand} strokeWidth={1} />
            ))}
            {selectedIndex !== null && (
              <Line
                x1={x(selectedIndex)}
                x2={x(selectedIndex)}
                y1={PAD / 2}
                y2={HEIGHT - PAD / 2}
                stroke={colors.ink}
                strokeOpacity={0.18}
                strokeWidth={1.5}
                strokeDasharray="3,3"
              />
            )}
            {KINDS.map((k) =>
              segments(series[k]).map((pts, i) =>
                pts.length === 1 ? (
                  <Circle key={`${k}-${i}`} cx={pts[0].split(',')[0]} cy={pts[0].split(',')[1]} r={2.5} fill={fields[k].strong} />
                ) : (
                  <Polyline
                    key={`${k}-${i}`}
                    points={pts.join(' ')}
                    fill="none"
                    stroke={fields[k].strong}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ),
              ),
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
          return (
            <View key={k} style={styles.avg}>
              <View style={styles.avgHead}>
                <View style={[styles.dot, { backgroundColor: fields[k].strong }]} />
                <Text style={[styles.avgLabel, { color: fields[k].ink }]}>{FIELD_LABELS[k]}</Text>
              </View>
              <Text style={[styles.avgValue, { color: fields[k].ink }]}>{avg ?? '–'}</Text>
              <Text style={styles.avgDiff}>
                {diff === null ? 'avg' : diff === 0 ? 'same as last month' : `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)} vs last month`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, ...shadow.card },
  label: { ...font.label, color: colors.textMuted },
  chart: { height: HEIGHT, marginTop: spacing.sm, justifyContent: 'center' },
  empty: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 6 },
  emptyText: { ...font.small, color: colors.textMuted, textAlign: 'center' },
  averages: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  avg: { flex: 1 },
  avgHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  avgLabel: { fontFamily: fontFamily.semibold, fontSize: 12 },
  avgValue: { fontFamily: fontFamily.bold, fontSize: 22, letterSpacing: -0.5, marginTop: 2 },
  avgDiff: { ...font.tiny, color: colors.textMuted },
});
