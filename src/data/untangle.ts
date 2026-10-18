/**
 * Untangle sessions as stored in Supabase. Creating one goes through the
 * untangle-plan Edge Function (it calls the AI); ticking off steps and
 * rating the intensity afterwards are plain RLS-protected updates.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { EvidenceEntry } from '@/data/deepDives';
import { supabase } from '@/lib/supabase';

export type Plan = {
  lessons: { text: string; kind: 'helped' | 'worse'; evidence: string[] }[];
  steps: { text: string; minutes: number; done: boolean }[];
  note: string;
};

export type UntangleSession = {
  id: string;
  created_at: string;
  title: string;
  problem: string;
  intensity_before: number;
  intensity_after: number | null;
  plan: Plan;
  risk_level: 'none' | 'elevated' | 'high';
  completed_at: string | null;
};

const COLUMNS = 'id, created_at, title, problem, intensity_before, intensity_after, plan, risk_level, completed_at';

export async function fetchSessions(): Promise<UntangleSession[]> {
  const { data, error } = await supabase
    .from('untangle_sessions')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return data as UntangleSession[];
}

/** One session plus the past check-ins its lessons cite. */
export async function fetchSession(id: string): Promise<{ session: UntangleSession; evidence: EvidenceEntry[] } | null> {
  const { data, error } = await supabase.from('untangle_sessions').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const session = data as UntangleSession;

  const ids = [...new Set(session.plan.lessons.flatMap((l) => l.evidence))];
  if (!ids.length) return { session, evidence: [] };
  const { data: evidence, error: evidenceError } = await supabase
    .from('checkins')
    .select('id, created_at, title, mood')
    .in('id', ids);
  if (evidenceError) throw new Error(evidenceError.message);
  return { session, evidence: evidence as EvidenceEntry[] };
}

export async function savePlan(id: string, plan: Plan) {
  const { error } = await supabase.from('untangle_sessions').update({ plan }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Records how intense the stress is now, which closes the session. */
export async function rateAfter(id: string, intensity: number) {
  const { error } = await supabase
    .from('untangle_sessions')
    .update({ intensity_after: intensity, completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** The user's sessions, newest first; reloads when the screen comes into view. */
export function useUntangleSessions() {
  const [sessions, setSessions] = useState<UntangleSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fetchSessions()
      .then((rows) => {
        setSessions(rows);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, []);
  useFocusEffect(load);
  return { sessions, error, reload: load };
}
