/**
 * Shared UI primitives for Destress AI.
 * Kept in one file for easy import: Card, GradientCard, Chip, PrimaryButton,
 * SectionHeader, StatCard, ProgressBar, Screen, ScreenHeader.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
  TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/motion';
import { colors, font, fontFamily, gradients, radii, shadow, spacing, type Tint, tints } from '@/theme';

/** Room at the bottom so content can scroll clear of the floating tab bar. */
export const TAB_BAR_SPACE = 112;

/**
 * Full-screen scrollable container: warm ivory with a soft color tint at the
 * top (clay by default; indigo for insights, sage for the community).
 */
export function Screen({
  children,
  scroll = true,
  contentStyle,
  tint = 'clay',
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  tint?: Tint;
}) {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: insets.top + spacing.md,
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: spacing.xl,
  };
  return (
    <LinearGradient
      colors={[tints[tint], colors.ivory, colors.ivory]}
      locations={[0, 0.38, 1]}
      start={{ x: 0.9, y: 0 }}
      end={{ x: 0.3, y: 1 }}
      style={StyleSheet.absoluteFill as ViewStyle}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[pad, contentStyle]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
    </LinearGradient>
  );
}

/** Big screen title + subtitle used at the top of most screens. */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.screenTitle}>{title}</Text>
      {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={[styles.card, style]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function GradientCard({
  colors: gcolors,
  children,
  style,
  onPress,
}: {
  colors: readonly [string, string];
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const inner = (
    <LinearGradient
      colors={gcolors as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradientCard, style]}>
      {children}
    </LinearGradient>
  );
  if (onPress) {
    return <PressableScale onPress={onPress}>{inner}</PressableScale>;
  }
  return inner;
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      <Text style={[styles.chipText, active ? { color: colors.white } : { color: colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale onPress={onPress}>
      <LinearGradient
        colors={gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.primaryBtn, style]}>
        {icon}
        <Text style={styles.primaryBtnText}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

/** Small white stat tile (e.g. "This Week -8%"). */
export function StatCard({
  icon,
  value,
  label,
  valueColor,
}: {
  icon?: ReactNode;
  value: string;
  label: string;
  valueColor?: string;
}) {
  return (
    <View style={[styles.card, styles.statCard]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{icon}</View>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function ProgressBar({
  progress,
  color = colors.primary,
  track = '#EFEBE4',
  height = 6,
}: {
  progress: number; // 0..1
  color?: string;
  track?: string;
  height?: number;
}) {
  return (
    <View style={{ height, borderRadius: 999, backgroundColor: track, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
          height: '100%',
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Friendly placeholder for lists with nothing to show. */
export function EmptyState({
  icon,
  title,
  caption,
  action,
}: {
  icon: ReactNode;
  title: string;
  caption?: string;
  action?: ReactNode;
}) {
  return (
    <View style={[styles.card, styles.emptyState]}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {caption ? <Text style={styles.emptyCaption}>{caption}</Text> : null}
      {action}
    </View>
  );
}

export const textStyles: Record<string, TextStyle> = {
  muted: { color: colors.textMuted, ...font.body },
  faint: { color: colors.textFaint, ...font.small },
};

const styles = StyleSheet.create({
  screenTitle: { ...font.h1, color: colors.text },
  screenSubtitle: { ...font.body, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#F3F0EA',
    ...shadow.card,
  },
  gradientCard: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadow.lifted,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  chipActive: { backgroundColor: colors.ink },
  chipIdle: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chipText: { fontFamily: fontFamily.semibold, fontSize: 12 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontFamily: fontFamily.semibold },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: { ...font.h3, color: colors.text },
  statCard: { flex: 1, gap: 4, paddingVertical: spacing.md },
  statValue: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.text },
  statLabel: { ...font.small, color: colors.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyTitle: { ...font.title, color: colors.text, textAlign: 'center' },
  emptyCaption: { ...font.body, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
