/**
 * Weekly Insights (stored as analyses + deep_dives, the patterns). Generating
 * goes through the deep-dive-generate Edge Function (it calls the AI), and the
 * app triggers it by itself once it's due; everything else is plain
 * reads/writes protected by RLS.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { generateDeepDives } from '@/ai/checkinClient';
import type { MoodKey } from '@/data/content';
import { supabase } from '@/lib/supabase';
import { gradients } from '@/theme';

/** Keep in sync with supabase/functions/_shared/analysis.ts. */
export const MIN_CHECKINS = 3;
export const NEW_CHECKINS_FOR_REFRESH = 3;
export const DAYS_BETWEEN = 7;
const DAY_MS = 86_400_000;

export type WeekValues = { stress: number | null; sleep: number | null; mood: number | null };
export type Week = { checkins: number; thisWeek: WeekValues; lastWeek: WeekValues };
export type Worked = { text: string; source: 'checkin' | 'untangle' };

export type Finding = { text: string; evidence: string[] };

export type DeepDive = {
  id: string;
  position: number;
  title: string;
  description: string;
  icon: string;
  findings: Finding[];
  questions: string[];
  /** The user's saved answers, by question index. */
  answers: Record<number, string>;
};

export type Analysis = {
  id: string;
  created_at: string;
  checkin_count: number;
  insight: string;
  /** Empty object for analyses written before Weekly Insights. */
  week: Partial<Week>;
  worked: Worked[];
  question: string | null;
  deepDives: DeepDive[];
};

export type EvidenceEntry = { id: string; created_at: string; title: string | null; mood: MoodKey | null };

const DIVE_COLUMNS = 'id, position, title, description, icon, findings, questions, reflections(question_index, answer)';

type DiveRow = Omit<DeepDive, 'answers'> & { reflections: { question_index: number; answer: string }[] };

function toDeepDive({ reflections, ...row }: DiveRow): DeepDive {
  return { ...row, answers: Object.fromEntries(reflections.map((r) => [r.question_index, r.answer])) };
}

/** How each deep-dive icon key looks in the app. */
export function diveStyle(icon: string): { name: string; gradient: readonly [string, string] } {
  const styles: Record<string, { name: string; gradient: readonly [string, string] }> = {
    sleep: { name: 'moon-outline', gradient: gradients.sleep },
    study: { name: 'school-outline', gradient: gradients.primary },
    work: { name: 'briefcase-outline', gradient: gradients.stress },
    calm: { name: 'leaf-outline', gradient: ['#10B981', '#06B6D4'] },
    social: { name: 'people-outline', gradient: gradients.community },
    family: { name: 'home-outline', gradient: gradients.emotion },
    money: { name: 'wallet-outline', gradient: ['#F59E0B', '#F97316'] },
    health: { name: 'walk-outline', gradient: ['#10B981', '#22C55E'] },
  };
  return styles[icon] ?? { name: 'heart-outline', gradient: gradients.stress };
}

export const answeredCount = (d: DeepDive) => d.questions.filter((_, i) => d.answers[i]).length;

/** The newest analysis with its deep dives and answers, or null if there is none yet. */
export async function fetchLatestAnalysis(): Promise<Analysis | null> {
  const { data, error } = await supabase
    .from('analyses')
    .select(`id, created_at, checkin_count, insight, week, worked, question, deep_dives(${DIVE_COLUMNS})`)
    .order('created_at', { ascending: false })
    .order('position', { referencedTable: 'deep_dives' })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { deep_dives, ...analysis } = data as Omit<Analysis, 'deepDives'> & { deep_dives: DiveRow[] };
  return { ...analysis, deepDives: deep_dives.map(toDeepDive) };
}

async function countCheckins(since?: string): Promise<number> {
  let query = supabase.from('checkins').select('id', { count: 'exact', head: true }).not('completed_at', 'is', null);
  if (since) query = query.gt('completed_at', since);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type DeepDivesState = {
  analysis: Analysis | null;
  /** All completed check-ins, for the unlock progress. */
  total: number;
  /** Check-ins since the latest analysis, for "Refresh". */
  newSince: number;
};

/** Everything the Deep Dives screen needs; reloads when the screen comes into view. */
export function useDeepDives() {
  const [state, setState] = useState<DeepDivesState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    (async () => {
      const analysis = await fetchLatestAnalysis();
      const [total, newSince] = await Promise.all([
        countCheckins(),
        analysis ? countCheckins(analysis.created_at) : Promise.resolve(0),
      ]);
      return { analysis, total, newSince };
    })()
      .then((s) => {
        setState(s);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useFocusEffect(load);
  return { state, error, reload: load };
}

/** True when new Weekly Insights should be written now. */
export function insightsDue(s: DeepDivesState): boolean {
  if (!s.analysis) return s.total >= MIN_CHECKINS;
  return Date.now() - Date.parse(s.analysis.created_at) >= DAYS_BETWEEN * DAY_MS && s.newSince >= NEW_CHECKINS_FOR_REFRESH;
}

// One generation at a time per app session, even if several screens ask.
let generating: Promise<void> | null = null;

export type WeeklyStatus =
  | { status: 'loading' }
  | { status: 'locked'; total: number }
  | { status: 'preparing' }
  | { status: 'ready'; analysis: Analysis; fresh: boolean };

/**
 * The Weekly Insights for the Today card: loads the latest, and if new ones
 * are due, writes them in the background (no button needed).
 */
export function useWeeklyInsights(): WeeklyStatus {
  const [state, setState] = useState<WeeklyStatus>({ status: 'loading' });
  const load = useCallback(() => {
    let cancelled = false;
    const show = async () => {
      const analysis = await fetchLatestAnalysis();
      const [total, newSince] = await Promise.all([
        countCheckins(),
        analysis ? countCheckins(analysis.created_at) : Promise.resolve(0),
      ]);
      return { analysis, total, newSince };
    };
    const toStatus = (s: DeepDivesState): WeeklyStatus =>
      s.analysis
        ? { status: 'ready', analysis: s.analysis, fresh: Date.now() - Date.parse(s.analysis.created_at) < 3 * DAY_MS }
        : { status: 'locked', total: s.total };
    show()
      .then(async (s) => {
        if (cancelled) return;
        if (!insightsDue(s)) return setState(toStatus(s));
        setState({ status: 'preparing' });
        generating ??= generateDeepDives().finally(() => {
          generating = null;
        });
        await generating.catch(() => {});
        if (!cancelled) setState(toStatus(await show()));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  useFocusEffect(load);
  return state;
}

/** The latest Today's Insight sentence, or null before the first analysis. */
export function useLatestInsight(): string | null {
  const [insight, setInsight] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      supabase
        .from('analyses')
        .select('insight')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setInsight(data?.insight ?? null));
    }, []),
  );
  return insight;
}

export async function fetchDeepDive(id: string): Promise<{ dive: DeepDive; evidence: EvidenceEntry[] } | null> {
  const { data, error } = await supabase.from('deep_dives').select(DIVE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const dive = toDeepDive(data as DiveRow);

  // Cited check-ins the user has since deleted simply don't come back.
  const ids = [...new Set(dive.findings.flatMap((f) => f.evidence))];
  const { data: evidence, error: evidenceError } = await supabase
    .from('checkins')
    .select('id, created_at, title, mood')
    .in('id', ids);
  if (evidenceError) throw new Error(evidenceError.message);
  return { dive, evidence: evidence as EvidenceEntry[] };
}

/** Saves (or replaces) the answer to one reflection question. */
export async function saveReflection(deepDiveId: string, index: number, question: string, answer: string) {
  const { error } = await supabase.from('reflections').upsert(
    {
      deep_dive_id: deepDiveId,
      question_index: index,
      question,
      answer,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'deep_dive_id,question_index' },
  );
  if (error) throw new Error(error.message);
}
