/**
 * One month for the calendar: the tracker values per day and that day's
 * check-in. Both come straight from Supabase (RLS: only the user's rows).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { Checkin } from '@/data/checkins';
import type { DailyMetric } from '@/data/metrics';
import { dateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export type MonthData = {
  /** YYYY-MM-DD → that day's values. */
  metrics: Map<string, DailyMetric>;
  /** YYYY-MM-DD → that day's check-in (the latest, if there were several). */
  checkins: Map<string, Checkin>;
  /** Average stress, sleep and mood of the month before (null if no data), for "vs last month". */
  previous: { stress: number | null; sleep: number | null; mood: number | null };
};

/** Average of the known values, rounded to one decimal; null if there are none. */
export function average(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? Math.round((known.reduce((a, b) => a + b, 0) / known.length) * 10) / 10 : null;
}

/** First and last day of a month as YYYY-MM-DD. `month` is 0-based like Date. */
export function monthRange(year: number, month: number): { first: string; last: string } {
  return { first: dateKey(new Date(year, month, 1)), last: dateKey(new Date(year, month + 1, 0)) };
}

export async function fetchMonth(year: number, month: number): Promise<MonthData> {
  const { first, last } = monthRange(year, month);
  const prev = monthRange(year, month - 1);
  const [metrics, checkins] = await Promise.all([
    // This month and the one before (for the averages comparison) in one query.
    supabase.from('daily_metrics').select('day, stress, emotion, sleep, source').gte('day', prev.first).lte('day', last),
    supabase
      .from('checkins')
      .select('id, day, created_at, title, summary, mood, stress, emotion, sleep, themes, helped, follow_ups, risk_level, score_reasons')
      .not('completed_at', 'is', null)
      .gte('day', first)
      .lte('day', last)
      .order('created_at'),
  ]);
  if (metrics.error) throw new Error(metrics.error.message);
  if (checkins.error) throw new Error(checkins.error.message);
  const all = metrics.data as DailyMetric[];
  const before = all.filter((m) => m.day < first);
  return {
    metrics: new Map(all.filter((m) => m.day >= first).map((m) => [m.day, m])),
    checkins: new Map((checkins.data as Checkin[]).map((c) => [c.day ?? dateKey(new Date(c.created_at)), c])),
    previous: {
      stress: average(before.map((m) => m.stress)),
      sleep: average(before.map((m) => m.sleep)),
      mood: average(before.map((m) => m.emotion)),
    },
  };
}

/** The month's data; reloads when the screen comes into view or the month changes. */
export function useMonth(year: number, month: number) {
  const [data, setData] = useState<MonthData | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setError(false);
    fetchMonth(year, month)
      .then(setData)
      .catch(() => setError(true));
  }, [year, month]);
  useFocusEffect(load);
  return { data, error, reload: load };
}
