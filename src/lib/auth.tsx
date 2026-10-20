/**
 * Makes sure every device has a Supabase account before the app is used.
 *
 * On start: reuse the login saved on this device, or create an anonymous
 * account. The rest of the app reads the result with useAuth().
 * Also keeps the profile's display name in sync with the onboarding name,
 * so the AI can greet the user by name.
 */
import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from './supabase';
import { warmUpFunctions } from './warmup';

type AuthState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; session: Session; userId: string };

const AuthContext = createContext<AuthState>({ status: 'loading' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = useAppStore((s) => s.name);

  const signIn = useCallback(async () => {
    setError(null);
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setSession(data.session);
      return;
    }
    const { data: created, error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError || !created.session) {
      setError(signInError?.message ?? 'Sign-in failed.');
      return;
    }
    setSession(created.session);
  }, []);

  useEffect(() => {
    signIn();
    // Keep the session current when Supabase refreshes the token.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next) setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, [signIn]);

  // Start the backend functions in the background, so the first use of each feature is fast.
  useEffect(() => {
    if (session) warmUpFunctions(session.access_token);
  }, [session]);

  // Phones pause timers in the background, so only refresh tokens while the app is open.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, []);

  // Copy the onboarding name into the profile (also covers names set before this existed).
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId || !name) return;
    supabase
      .from('profiles')
      .update({ display_name: name, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .then(({ error: updateError }) => {
        if (updateError) console.warn('Could not save display name:', updateError.message);
      });
  }, [userId, name]);

  const value: AuthState = session
    ? { status: 'ready', session, userId: session.user.id }
    : error
      ? { status: 'error', message: error, retry: signIn }
      : { status: 'loading' };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
