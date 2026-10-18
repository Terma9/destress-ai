/**
 * Daily tracker values (stress, emotion, sleep) stored in Supabase.
 * One row per user per day: filled by the AI after a check-in, or set by hand
 * in the Tracker (source "manual" — the AI never overwrites those).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { MetricKey } from '@/data/content';
import { dateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export type DailyMetric = {
  day: string;
  stress: number | null;
  emotion: number | null;
  sleep: number | null;
  source: 'ai' | 'manual';
};

/** The last 7 calendar days as YYYY-MM-DD, oldest first, ending today. */
export function lastSevenDays(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return dateKey(d);
  });
}

export async function fetchRecentMetrics(): Promise<DailyMetric[]> {
  const { data, error } = await supabase
    .from('daily_metrics')
    .select('day, stress, emotion, sleep, source')
    .gte('day', lastSevenDays()[0])
    .order('day');
  if (error) throw new Error(error.message);
  return data as DailyMetric[];
}

/** Saves today's values as set by hand. Upsert: creates the row or updates it. */
export async function saveManualMetrics(row: Omit<DailyMetric, 'source'>): Promise<void> {
  const { error } = await supabase
    .from('daily_metrics')
    .upsert(
      { ...row, source: 'manual', updated_at: new Date().toISOString() },
      { onConflict: 'user_id,day' },
    );
  if (error) throw new Error(error.message);
}

/** Average of the non-empty values, rounded to one decimal; null when there's no data. */
export function average(rows: DailyMetric[], key: MetricKey): number | null {
  const values = rows.map((r) => r[key]).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/**
 * Loads the last 7 days (reloading when the screen comes into view) and lets
 * the user change today's values. Changes show instantly and save in the background.
 */
export function useDailyMetrics() {
  const [rows, setRows] = useState<DailyMetric[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchRecentMetrics()
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useFocusEffect(load);

  const today = dateKey(new Date());
  const todayRow = rows?.find((r) => r.day === today) ?? null;

  const setTodayValue = useCallback(
    async (key: MetricKey, value: number) => {
      if (!rows) return;
      const previous = rows;
      const current = rows.find((r) => r.day === today);
      const next: DailyMetric = {
        day: today,
        stress: current?.stress ?? null,
        emotion: current?.emotion ?? null,
        sleep: current?.sleep ?? null,
        source: 'manual',
        [key]: Math.max(0, Math.min(10, value)),
      };
      // Optimistic update: show the new value now, undo it if saving fails.
      setRows([...rows.filter((r) => r.day !== today), next].sort((a, b) => a.day.localeCompare(b.day)));
      try {
        await saveManualMetrics({ day: next.day, stress: next.stress, emotion: next.emotion, sleep: next.sleep });
      } catch (err) {
        setRows(previous);
        setError((err as Error).message);
      }
    },
    [rows, today],
  );

  return { rows, todayRow, error, reload: load, setTodayValue };
}
