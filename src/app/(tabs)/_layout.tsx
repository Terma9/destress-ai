import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '@/theme';

import type { ColorValue } from 'react-native';

type TabIcon = keyof typeof Ionicons.glyphMap;

const icon = (name: TabIcon) => ({ color, size }: { color: ColorValue; size: number }) =>
  <Ionicons name={name} size={size ?? 22} color={color as string} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="tracker" options={{ title: 'Tracker', tabBarIcon: icon('trending-up-outline') }} />
      <Tabs.Screen name="diary" options={{ title: 'Diary', tabBarIcon: icon('book-outline') }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice', tabBarIcon: icon('barbell-outline') }} />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: icon('people-outline') }} />
    </Tabs>
  );
}
