import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#EAF2FF' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="diary/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="deep-dives" />
        <Stack.Screen name="knowledge" />
        <Stack.Screen name="exercise/[id]" />
        <Stack.Screen name="article/[id]" />
        <Stack.Screen name="deep-dive/[id]" />
        <Stack.Screen name="entry/[id]" />
      </Stack>
    </SafeAreaProvider>
  );
}
