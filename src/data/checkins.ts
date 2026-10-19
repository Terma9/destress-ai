/**
 * Check-ins as stored in Supabase — the single source of truth for diary
 * entries. Reads go straight to the database; RLS returns only the
 * signed-in user's rows, so no user filter is needed here.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { type MoodKey, moods } from '@/data/content';
import { supabase } from '@/lib/supabase';

export type Checkin = {
  id: string;
  created_at: string;
  /** The user's local calendar day of the entry (one entry per day). */
  day: string | null;
  title: string | null;
  summary: string | null;
  mood: MoodKey | null;
  stress: number | null;
  emotion: number | null;
  sleep: number | null;
  themes: string[];
  helped: string[];
  follow_ups: string[];
  risk_level: 'none' | 'elevated' | 'high';
  score_reasons: { stress?: string; sleep?: string; mood?: string };
};

export type CheckinWithMessages = Checkin & {
  messages: { role: 'user' | 'assistant'; content: string }[];
};

const LIST_COLUMNS =
  'id, created_at, day, title, summary, mood, stress, emotion, sleep, themes, helped, follow_ups, risk_level, score_reasons';

export async function fetchCheckins(): Promise<Checkin[]> {
  const { data, error } = await supabase
    .from('checkins')
    .select(LIST_COLUMNS)
    .not('completed_at', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Checkin[];
}

export async function fetchCheckin(id: string): Promise<CheckinWithMessages | null> {
  const { data, error } = await supabase
    .from('checkins')
    .select(`${LIST_COLUMNS}, messages`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CheckinWithMessages | null;
}

export async function deleteCheckin(id: string): Promise<void> {
  const { error } = await supabase.from('checkins').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Loads the user's check-ins, and reloads whenever the screen comes back into view. */
export function useCheckins() {
  const [checkins, setCheckins] = useState<Checkin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchCheckins()
      .then((rows) => {
        setCheckins(rows);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useFocusEffect(load);

  return { checkins, error, reload: load };
}

export function moodEmoji(mood: MoodKey | null): string {
  return moods.find((m) => m.key === mood)?.emoji ?? '🙂';
}

/** Today's entry with its conversation, so the check-in can continue it. Null if there is none yet. */
export async function fetchEntryForDay(day: string): Promise<CheckinWithMessages | null> {
  const { data, error } = await supabase
    .from('checkins')
    .select(`${LIST_COLUMNS}, messages`)
    .eq('day', day)
    .not('completed_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CheckinWithMessages | null;
}

export type DayValues = { stress: number | null; sleep: number | null; mood: number | null };

/**
 * Saves the values the user confirmed in the review step, on the entry and in
 * the calendar. Values the user changed count as their own ("manual"), which
 * the AI never overwrites later; unchanged AI suggestions stay "ai".
 */
export async function saveDayValues(entryId: string, day: string, values: DayValues, changedByUser: boolean) {
  const { stress, sleep, mood } = values;
  const [entry, metric] = await Promise.all([
    supabase.from('checkins').update({ stress, sleep, emotion: mood }).eq('id', entryId),
    changedByUser
      ? supabase
          .from('daily_metrics')
          .upsert(
            { day, stress, sleep, emotion: mood, source: 'manual', updated_at: new Date().toISOString() },
            { onConflict: 'user_id,day' },
          )
      : Promise.resolve({ error: null }),
  ]);
  if (entry.error) throw new Error(entry.error.message);
  if (metric.error) throw new Error(metric.error.message);
}
