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
};

/** First and last day of a month as YYYY-MM-DD. `month` is 0-based like Date. */
export function monthRange(year: number, month: number): { first: string; last: string } {
  return { first: dateKey(new Date(year, month, 1)), last: dateKey(new Date(year, month + 1, 0)) };
}

export async function fetchMonth(year: number, month: number): Promise<MonthData> {
  const { first, last } = monthRange(year, month);
  // Check-ins are timestamps; widen by a day on each side so time zones can't cut one off.
  const from = new Date(year, month, 0).toISOString();
  const to = new Date(year, month + 1, 1, 23, 59).toISOString();
  const [metrics, checkins] = await Promise.all([
    supabase.from('daily_metrics').select('day, stress, emotion, sleep, source').gte('day', first).lte('day', last),
    supabase
      .from('checkins')
      .select('id, created_at, title, summary, mood, stress, emotion, sleep, themes, helped, follow_ups, risk_level')
      .not('completed_at', 'is', null)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at'),
  ]);
  if (metrics.error) throw new Error(metrics.error.message);
  if (checkins.error) throw new Error(checkins.error.message);
  return {
    metrics: new Map((metrics.data as DailyMetric[]).map((m) => [m.day, m])),
    checkins: new Map((checkins.data as Checkin[]).map((c) => [dateKey(new Date(c.created_at)), c])),
  };
}

/** The month's data; reloads when the screen comes into view or the month changes. */
export function useMonth(year: number, month: number) {
  const [data, setData] = useState<MonthData | null>(null);
  const [error, setError] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setError(false);
      fetchMonth(year, month)
        .then(setData)
        .catch(() => setError(true));
    }, [year, month]),
  );
  return { data, error };
}
