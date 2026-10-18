import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { Card, GradientCard, Screen } from '@/components/ui';
import { metrics as metricsMeta, weekDays, weeklyStress } from '@/data/content';
import { useAppStore, type MetricKey } from '@/store/useAppStore';
import { colors, font, radii, spacing } from '@/theme';

export default function Tracker() {
  const metrics = useAppStore((s) => s.metrics);
  const setMetric = useAppStore((s) => s.setMetric);
  const liveWeekly = [...weeklyStress.slice(0, 6), metrics.stress];

  return (
    <Screen>
      <Text style={styles.title}>Wellness Tracker</Text>
      <Text style={styles.sub}>Track your stress, emotions, and sleep</Text>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {metricsMeta.map((m) => {
          const score = metrics[m.id as MetricKey];
          return (
            <GradientCard key={m.id} colors={m.gradient}>
              <View style={styles.metricTop}>
                <View style={styles.metricLeft}>
                  <View style={styles.metricIcon}>
                    <Ionicons name={m.icon as any} size={18} color={colors.white} />
                  </View>
                  <View>
                    <Text style={styles.metricLabel}>{m.label}</Text>
                    <Text style={styles.metricScore}>
                      {score}
                      <Text style={styles.metricMax}>/{m.max}</Text>
                    </Text>
                  </View>
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => setMetric(m.id as MetricKey, score - 1)}
                    hitSlop={6}>
                    <Ionicons name="remove" size={16} color={colors.white} />
                  </Pressable>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => setMetric(m.id as MetricKey, score + 1)}
                    hitSlop={6}>
                    <Ionicons name="add" size={16} color={colors.white} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.track}>
                <View style={[styles.trackFill, { width: `${(score / m.max) * 100}%` }]} />
              </View>
              <View style={styles.metricFoot}>
                <Text style={styles.footText}>{m.lowLabel}</Text>
                <Text style={styles.footText}>Weekly Avg: {m.weeklyAvg}</Text>
                <Text style={styles.footText}>{m.highLabel}</Text>
              </View>
            </GradientCard>
          );
        })}
      </View>

      {/* Weekly chart */}
      <Card style={{ marginTop: spacing.lg }}>
        <View style={styles.chartHead}>
          <Text style={styles.chartTitle}>Stress This Week</Text>
          <View style={styles.badge}>
            <Ionicons name="trending-down" size={13} color={colors.green} />
            <Text style={styles.badgeText}>7 Days</Text>
          </View>
        </View>
        <StressChart data={liveWeekly} />
        <View style={styles.daysRow}>
          {weekDays.map((d) => (
            <Text key={d} style={styles.dayLabel}>{d}</Text>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

function StressChart({ data }: { data: number[] }) {
  const W = 300;
  const H = 120;
  const pad = 8;
  const max = 10;
  const step = (W - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - v / max) * (H - pad * 2);
    return { x, y };
  });
  const poly = points.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `M ${points[0].x},${H - pad} ` + points.map((p) => `L ${p.x},${p.y}`).join(' ') + ` L ${points[points.length - 1].x},${H - pad} Z`;

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Path d={area} fill="#FEE2E2" opacity={0.5} />
      <Polyline points={poly} fill="none" stroke={colors.danger} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={colors.white} stroke={colors.danger} strokeWidth={2} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h1, color: colors.text },
  sub: { ...font.body, color: colors.textMuted, marginTop: 2 },
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
  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  chartTitle: { ...font.title, color: colors.text },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  badgeText: { ...font.tiny, color: colors.green, fontWeight: '600' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 6 },
  dayLabel: { ...font.tiny, color: colors.textFaint },
});
