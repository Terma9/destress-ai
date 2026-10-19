import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.ivory } }}>
      <Tabs.Screen name="home" options={{ title: 'Today' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="untangle" options={{ title: 'Untangle' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      {/* Reachable from other screens, but not in the tab bar. Exercises and Knowledge are set aside for now. */}
      <Tabs.Screen name="diary" options={{ href: null }} />
      <Tabs.Screen name="tracker" options={{ href: null }} />
      <Tabs.Screen name="practice" options={{ href: null }} />
    </Tabs>
  );
}
