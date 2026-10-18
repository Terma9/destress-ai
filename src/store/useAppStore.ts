/**
 * Global app state (zustand) with AsyncStorage persistence.
 * Holds the user's name, daily mood check-in, diary entries, activity history
 * (for the streak), exercise sessions and article read-state — shared across
 * Home, Diary, Tracker, Practice and Knowledge so the app feels alive.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MoodKey } from '@/data/content';
import { todayKey } from '@/lib/dates';

export type DiaryEntry = {
  id: string;
  title: string;
  summary: string;
  moodEmoji: string;
  createdAt: number;
};

export type ExerciseSession = {
  id: string;
  exerciseId: string;
  minutes: number;
  completedAt: number;
};

export type MetricKey = 'stress' | 'emotion' | 'sleep';
export type Metrics = Record<MetricKey, number>;

type AppState = {
  onboarded: boolean;
  name: string;
  todayMood: MoodKey | null;
  todayMoodDate: string | null;
  activityDates: string[];
  entries: DiaryEntry[];
  sessions: ExerciseSession[];
  readArticles: string[];
  metrics: Metrics;
  reminderEnabled: boolean;
  setOnboarded: (v: boolean) => void;
  setName: (name: string) => void;
  setTodayMood: (m: MoodKey) => void;
  addEntry: (e: Omit<DiaryEntry, 'id' | 'createdAt'>) => void;
  removeEntry: (id: string) => void;
  addSession: (exerciseId: string, minutes: number) => void;
  markArticleRead: (id: string) => void;
  setMetric: (key: MetricKey, value: number) => void;
  setReminderEnabled: (v: boolean) => void;
};

const seedEntries: DiaryEntry[] = [
  {
    id: 'seed-1',
    title: 'Morning Walk',
    summary: 'Going for a walk helped clear mind. Felt much calmer and more focused.',
    moodEmoji: '😊',
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: 'seed-2',
    title: 'Busy Workday',
    summary: 'Back-to-back meetings left little room to breathe, but I paused for a short reset.',
    moodEmoji: '😐',
    createdAt: Date.now() - 1000 * 60 * 60 * 28,
  },
];

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
      todayMood: null,
      todayMoodDate: null,
      activityDates: [],
      entries: seedEntries,
      sessions: [],
      readArticles: [],
      metrics: { stress: 3, emotion: 8, sleep: 7 },
      reminderEnabled: false,
      setOnboarded: (v) => set({ onboarded: v }),
      setName: (name) => set({ name: name.trim() }),
      setTodayMood: (m) =>
        set((s) => ({
          todayMood: m,
          todayMoodDate: todayKey(),
          activityDates: withToday(s.activityDates),
        })),
      addEntry: (e) =>
        set((s) => ({
          entries: [
            { ...e, id: `e-${Date.now()}`, createdAt: Date.now() },
            ...s.entries,
          ],
          activityDates: withToday(s.activityDates),
        })),
      removeEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
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
      setMetric: (key, value) =>
        set((s) => ({
          metrics: { ...s.metrics, [key]: Math.max(0, Math.min(10, value)) },
        })),
      setReminderEnabled: (v) => set({ reminderEnabled: v }),
    }),
    {
      name: 'destress-ai-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Mood for today only — yesterday's selection no longer counts. */
export function selectTodayMood(s: { todayMood: MoodKey | null; todayMoodDate: string | null }) {
  return s.todayMoodDate === todayKey() ? s.todayMood : null;
}
