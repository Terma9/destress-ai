/**
 * Local app state (zustand) with AsyncStorage persistence: the user's name,
 * daily mood check-in, activity history (for the streak), exercise sessions,
 * article read-state and preferences.
 * Diary entries and tracker values are not here — they live in Supabase
 * (see src/data/checkins.ts and src/data/metrics.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MoodKey } from '@/data/content';
import { todayKey } from '@/lib/dates';

export type ExerciseSession = {
  id: string;
  exerciseId: string;
  minutes: number;
  completedAt: number;
};

type AppState = {
  onboarded: boolean;
  name: string;
  /** True for the demo account (Jonas): the AI then always writes in English, like the demo data. */
  demo: boolean;
  todayMood: MoodKey | null;
  todayMoodDate: string | null;
  activityDates: string[];
  sessions: ExerciseSession[];
  readArticles: string[];
  reminderEnabled: boolean;
  setOnboarded: (v: boolean) => void;
  setName: (name: string) => void;
  setDemo: (v: boolean) => void;
  setTodayMood: (m: MoodKey) => void;
  /** Counts today toward the streak (e.g. after a finished check-in). */
  recordActivity: () => void;
  addSession: (exerciseId: string, minutes: number) => void;
  markArticleRead: (id: string) => void;
  setReminderEnabled: (v: boolean) => void;
};

/** Append today's date key to the activity history (deduped). */
function withToday(dates: string[]): string[] {
  const key = todayKey();
  return dates.includes(key) ? dates : [...dates, key];
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      onboarded: false,
      name: '',
      demo: false,
      todayMood: null,
      todayMoodDate: null,
      activityDates: [],
      sessions: [],
      readArticles: [],
      reminderEnabled: false,
      setOnboarded: (v) => set({ onboarded: v }),
      setName: (name) => set({ name: name.trim() }),
      setDemo: (v) => set({ demo: v }),
      setTodayMood: (m) =>
        set((s) => ({
          todayMood: m,
          todayMoodDate: todayKey(),
          activityDates: withToday(s.activityDates),
        })),
      recordActivity: () => set((s) => ({ activityDates: withToday(s.activityDates) })),
      addSession: (exerciseId, minutes) =>
        set((s) => ({
          sessions: [
            { id: `s-${Date.now()}`, exerciseId, minutes, completedAt: Date.now() },
            ...s.sessions,
          ],
          activityDates: withToday(s.activityDates),
        })),
      markArticleRead: (id) =>
        set((s) => ({
          readArticles: s.readArticles.includes(id) ? s.readArticles : [...s.readArticles, id],
        })),
      setReminderEnabled: (v) => set({ reminderEnabled: v }),
    }),
    {
      name: 'destress-ai-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Drop data earlier versions kept locally and that now lives in Supabase:
      // diary entries (v1) and tracker values (v2).
      version: 2,
      migrate: (persisted) => {
        const { entries: _entries, metrics: _metrics, ...rest } = persisted as Record<string, unknown>;
        return rest as unknown as AppState;
      },
    },
  ),
);

/** Mood for today only — yesterday's selection no longer counts. */
export function selectTodayMood(s: { todayMood: MoodKey | null; todayMoodDate: string | null }) {
  return s.todayMoodDate === todayKey() ? s.todayMood : null;
}
