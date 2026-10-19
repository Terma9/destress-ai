/**
 * Untangle sessions as stored in Supabase, in two kinds:
 *   calm — "Calm Now": a calming conversation with a before/after rating
 *   plan — "Stress Solving": one living plan per stressor ("My plans")
 * Making or updating a plan goes through the untangle-plan Edge Function (it
 * calls the AI); saving a calm session, ticking off steps and marking a plan
 * solved are plain RLS-protected writes.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { ChatMessage } from '@/ai/checkinClient';
import type { EvidenceEntry } from '@/data/deepDives';
import { supabase } from '@/lib/supabase';

export type Plan = {
  approach?: string;
  watch_for?: string;
  lessons: { text: string; kind: 'helped' | 'worse'; evidence: string[] }[];
  steps: { text: string; minutes: number; done: boolean }[];
  note: string;
};

export type UntangleSession = {
  id: string;
  kind: 'calm' | 'plan';
  status: 'active' | 'solved';
  created_at: string;
  updated_at: string;
  title: string;
  problem: string;
  messages: ChatMessage[];
  intensity_before: number;
  intensity_after: number | null;
  plan: Plan | null;
  plan_history: { plan: Plan; replaced_at: string }[];
  /** Latest progress note from a check-in, e.g. what helped. */
  outcome_note: string | null;
  risk_level: 'none' | 'elevated' | 'high';
};

const COLUMNS =
  'id, kind, status, created_at, updated_at, title, problem, messages, intensity_before, intensity_after, plan, plan_history, outcome_note, risk_level';

export async function fetchSessions(): Promise<UntangleSession[]> {
  const { data, error } = await supabase
    .from('untangle_sessions')
    .select(COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data as UntangleSession[];
}

/** One plan plus the past check-ins its lessons cite. */
export async function fetchSession(id: string): Promise<{ session: UntangleSession; evidence: EvidenceEntry[] } | null> {
  const { data, error } = await supabase.from('untangle_sessions').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const session = data as UntangleSession;

  const ids = [...new Set((session.plan?.lessons ?? []).flatMap((l) => l.evidence))];
  if (!ids.length) return { session, evidence: [] };
  const { data: evidence, error: evidenceError } = await supabase
    .from('checkins')
    .select('id, created_at, title, mood')
    .in('id', ids);
  if (evidenceError) throw new Error(evidenceError.message);
  return { session, evidence: evidence as EvidenceEntry[] };
}

export async function savePlan(id: string, plan: Plan) {
  const { error } = await supabase
    .from('untangle_sessions')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Keeps what the user told about their plan, without changing the plan. */
export async function saveThread(id: string, messages: ChatMessage[]) {
  const { error } = await supabase
    .from('untangle_sessions')
    .update({ messages, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Saves a finished Calm Now conversation with how intense it was before and after. */
export async function saveCalmSession(messages: ChatMessage[], before: number, after: number) {
  const first = messages.find((m) => m.role === 'user')?.content.trim() ?? 'Calm Now';
  const { error } = await supabase.from('untangle_sessions').insert({
    kind: 'calm',
    title: first.length > 60 ? `${first.slice(0, 57)}…` : first,
    problem: first,
    messages,
    intensity_before: before,
    intensity_after: after,
    plan: null,
    completed_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/**
 * Marks a plan as solved and keeps it as a private success story, which the
 * user can then share in the community. Returns the story id.
 */
export async function markSolved(session: UntangleSession, theme: string): Promise<string> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('untangle_sessions')
    .update({ status: 'solved', outcome: 'worked', outcome_at: now, updated_at: now, completed_at: now })
    .eq('id', session.id);
  if (error) throw new Error(error.message);

  const steps = session.plan?.steps ?? [];
  const done = steps.filter((s) => s.done).map((s) => s.text);
  const { data, error: storyError } = await supabase
    .from('success_stories')
    .insert({
      session_id: session.id,
      theme,
      title: session.title,
      situation: session.problem,
      solution: [session.plan?.approach, ...(done.length ? done : steps.map((s) => s.text))].filter(Boolean).join(' '),
      intensity_before: session.intensity_before,
      intensity_after: session.intensity_after,
    })
    .select('id')
    .single();
  if (storyError) throw new Error(storyError.message);
  return data.id as string;
}

/** The user's sessions, most recently touched first; reloads when the screen comes into view. */
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
