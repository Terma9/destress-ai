import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { colors, font, spacing } from '@/theme';

// Keep the splash screen up until the typeface has loaded, so text never jumps.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ivory } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="diary/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="untangle/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="untangle/[id]" />
            <Stack.Screen name="success/[id]" />
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
    backgroundColor: colors.ivory,
  },
  title: { ...font.h2, color: colors.text, marginBottom: spacing.sm },
  body: { ...font.body, color: colors.textMuted, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.xl },
});
