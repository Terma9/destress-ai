/**
 * Loads the demo persona (Jonas, 4 weeks) — from the start screen or from the
 * web demo's side panel, also after someone has already started the app
 * normally. The demo needs an empty account, so an account that already has
 * entries (its own, or an earlier demo) is swapped for a fresh anonymous one.
 */
import { loadDemoData } from '@/ai/checkinClient';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

export async function startDemo(): Promise<void> {
  const { count, error } = await supabase.from('checkins').select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  if (count) {
    await supabase.auth.signOut();
    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) throw new Error(signInError.message);
  }
  await loadDemoData();
  // The server marked this account as a demo account; a fresh login token carries that mark.
  await supabase.auth.refreshSession();
  useAppStore.setState({ name: 'Jonas', demo: true, onboarded: true, activityDates: [] });
}
