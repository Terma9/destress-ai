import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { InlineLoader } from '@/components/brand';
import { Card, Chip, GradientCard, Screen } from '@/components/ui';
import { type MetricKey, metrics as metricsMeta } from '@/data/content';
import { average, type DailyMetric, lastSevenDays, useDailyMetrics } from '@/data/metrics';
import { colors, font, radii, spacing } from '@/theme';

/** Value used the first time a metric is set by hand on a day with no value yet. */
const STARTING_VALUE = 5;

export default function Tracker() {
  const { rows, todayRow, error, setTodayValue } = useDailyMetrics();
  const [chartKey, setChartKey] = useState<MetricKey>('stress');

  return (
    <Screen>
      <Text style={styles.title}>Wellness Tracker</Text>
      <Text style={styles.sub}>Today's values come from your check-ins — adjust them anytime</Text>

      {error && <Text style={styles.error}>Couldn't load or save your values. Check your connection.</Text>}

      {rows === null && !error ? (
        <InlineLoader />
      ) : (
        <>
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            {metricsMeta.map((m) => {
              const score = todayRow?.[m.id] ?? null;
              const avg = rows ? average(rows, m.id) : null;
              const change = (delta: number) => setTodayValue(m.id, (score ?? STARTING_VALUE - delta) + delta);
              return (
                <GradientCard key={m.id} colors={m.gradient}>
                  <View style={styles.metricTop}>
                    <View style={styles.metricLeft}>
                      <View style={styles.metricIcon}>
                        <Ionicons name={m.icon as any} size={18} color={colors.white} />
                      </View>
                      <View>
                        <Text style={styles.metricLabel}>{m.label} today</Text>
                        <Text style={styles.metricScore}>
                          {score ?? '–'}
                          <Text style={styles.metricMax}>/{m.max}</Text>
                        </Text>
                      </View>
                    </View>
                    <View style={styles.stepper}>
                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() => change(-1)}
                        hitSlop={6}
                        accessibilityLabel={`Lower ${m.label}`}>
                        <Ionicons name="remove" size={16} color={colors.white} />
                      </Pressable>
                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() => change(1)}
                        hitSlop={6}
                        accessibilityLabel={`Raise ${m.label}`}>
                        <Ionicons name="add" size={16} color={colors.white} />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.trackFill, { width: `${((score ?? 0) / m.max) * 100}%` }]} />
                  </View>
                  <View style={styles.metricFoot}>
                    <Text style={styles.footText}>{m.lowLabel}</Text>
                    <Text style={styles.footText}>7-day avg: {avg ?? '–'}</Text>
                    <Text style={styles.footText}>{m.highLabel}</Text>
                  </View>
                </GradientCard>
              );
            })}
          </View>

          {todayRow && (
            <Text style={styles.source}>
              {todayRow.source === 'manual'
                ? "Today's values were set by you, so check-ins won't change them."
                : "Today's values were filled in from your check-in."}
            </Text>
          )}

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.chartTitle}>Last 7 days</Text>
            <View style={styles.chips}>
              {metricsMeta.map((m) => (
                <Chip key={m.id} label={m.label} active={chartKey === m.id} onPress={() => setChartKey(m.id)} />
              ))}
            </View>
            <WeekChart
              rows={rows ?? []}
              metric={chartKey}
              color={metricsMeta.find((m) => m.id === chartKey)!.chartColor}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}

/** Line chart of one metric over the last 7 calendar days; days without a value are left out. */
function WeekChart({ rows, metric, color }: { rows: DailyMetric[]; metric: MetricKey; color: string }) {
  const W = 300;
  const H = 120;
  const pad = 10;
  const days = lastSevenDays();
  const step = (W - pad * 2) / (days.length - 1);

  const points = days.flatMap((day, i) => {
    const value = rows.find((r) => r.day === day)?.[metric];
    if (value === null || value === undefined) return [];
    return [{ x: pad + i * step, y: pad + (1 - value / 10) * (H - pad * 2) }];
  });

  const weekday = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString('en', { weekday: 'short' });

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {[0, 5, 10].map((v) => {
          const y = pad + (1 - v / 10) * (H - pad * 2);
          return <Line key={v} x1={pad} x2={W - pad} y1={y} y2={y} stroke={colors.border} strokeWidth={1} />;
        })}
        {points.length > 1 && (
          <Polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.white} stroke={color} strokeWidth={2} />
        ))}
      </Svg>
      <View style={styles.daysRow}>
        {days.map((d) => (
          <Text key={d} style={styles.dayLabel}>
            {weekday(d)}
          </Text>
        ))}
      </View>
      {points.length === 0 && (
        <Text style={styles.chartEmpty}>No values yet. Finish a check-in or set today's values above.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h1, color: colors.text },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2 },
  error: { ...font.small, color: '#B91C1C', marginTop: spacing.md },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: { ...font.small, color: 'rgba(255,255,255,0.9)' },
  metricScore: { fontSize: 24, fontWeight: '700', color: colors.white },
  metricMax: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },
  stepper: { flexDirection: 'row', gap: spacing.sm },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: spacing.md, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 999, backgroundColor: colors.white },
  metricFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  footText: { ...font.tiny, color: 'rgba(255,255,255,0.85)' },
  source: { ...font.small, color: colors.textFaint, marginTop: spacing.md, textAlign: 'center' },
  chartTitle: { ...font.title, color: colors.text },
  chips: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 6 },
  dayLabel: { ...font.tiny, color: colors.textFaint },
  chartEmpty: { ...font.small, color: colors.textFaint, textAlign: 'center', marginTop: spacing.sm },
});
