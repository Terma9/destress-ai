/**
 * Floating, frosted tab bar. The active tab gets a soft clay pill that
 * slides over when you switch tabs.
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { Tabs } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, fields, fontFamily, shadow } from '@/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** The tabs shown in the bar, in order. Other routes in the group stay reachable but hidden. */
const TABS = [
  { name: 'home', label: 'Today', icon: 'home-outline', active: 'home' },
  { name: 'calendar', label: 'Calendar', icon: 'calendar-outline', active: 'calendar' },
  { name: 'untangle', label: 'Untangle', icon: 'compass-outline', active: 'compass' },
  { name: 'community', label: 'Community', icon: 'people-outline', active: 'people' },
] as const;

export function TabBar({ state, navigation, insets }: TabBarProps) {
  const [width, setWidth] = useState(0);
  const current = state.routes[state.index]?.name;
  const activeIndex = TABS.findIndex((t) => t.name === current);
  const itemWidth = width / TABS.length;

  const x = useSharedValue(0);
  useEffect(() => {
    if (itemWidth && activeIndex >= 0) {
      x.value = withSpring(activeIndex * itemWidth, { damping: 20, stiffness: 220, mass: 0.8 });
    }
  }, [activeIndex, itemWidth]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12), pointerEvents: 'box-none' }]}>
      <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.frost]} />
        {width > 0 && activeIndex >= 0 && (
          <Animated.View style={[styles.pillTrack, { width: itemWidth }, pill]}>
            <View style={styles.pill} />
          </Animated.View>
        )}
        {TABS.map((tab, i) => {
          const route = state.routes.find((r) => r.name === tab.name);
          const focused = i === activeIndex;
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={styles.item}
              onPress={() => {
                if (!route) return;
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}>
              <Ionicons
                name={(focused ? tab.active : tab.icon) as ComponentProps<typeof Ionicons>['name']}
                size={21}
                color={focused ? fields.stress.ink : colors.textMuted}
              />
              <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14 },
  bar: {
    height: 64,
    borderRadius: 26,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    ...shadow.lifted,
  },
  frost: { backgroundColor: 'rgba(255,255,255,0.72)' },
  pillTrack: { position: 'absolute', top: 6, bottom: 6, left: 0, paddingHorizontal: 8 },
  pill: { flex: 1, borderRadius: 18, backgroundColor: fields.stress.from },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontFamily: fontFamily.medium, fontSize: 10, color: colors.textMuted },
  labelActive: { fontFamily: fontFamily.semibold, color: fields.stress.ink },
});
