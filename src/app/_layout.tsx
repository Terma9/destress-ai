import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { colors, font, spacing } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <AuthGate>
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
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** Shows the app only once this device has a Supabase login. */
function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.status === 'ready') return <>{children}</>;

  return (
    <View style={styles.center}>
      {auth.status === 'loading' ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          <Text style={styles.title}>Couldn't connect</Text>
          <Text style={styles.body}>Check your internet connection and try again.</Text>
          <View style={styles.button}>
            <PrimaryButton label="Try again" onPress={auth.retry} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: '#EAF2FF',
  },
  title: { ...font.h2, color: colors.text, marginBottom: spacing.sm },
  body: { ...font.body, color: colors.textMuted, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.xl },
});
