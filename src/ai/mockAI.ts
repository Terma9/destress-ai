/**
 * Mock AI layer. These functions define the SAME signatures the real Claude
 * service will implement in Phase 5, so screens can swap `mockAI` → `claude`
 * with no changes. See plan Phase 5.
 */
import { checkInPrompts } from '@/data/content';

export type DiaryEntryDraft = {
  transcript: string;
  mood?: string;
};

export type DiarySummary = {
  title: string;
  summary: string;
  moodEmoji: string;
};

/** Returns the AI's opening check-in question for a new diary session. */
export async function getCheckInPrompt(): Promise<string> {
  const i = Math.floor(Math.random() * checkInPrompts.length);
  return checkInPrompts[i];
}

/** Mood key → emoji, mirroring the Home check-in options. */
const moodEmojis: Record<string, string> = {
  great: '😊',
  good: '🙂',
  ok: '😐',
  low: '😔',
  stressed: '😰',
};

/** Turns a raw entry into a clean, summarized diary card (mocked). */
export async function summarizeEntry(draft: DiaryEntryDraft): Promise<DiarySummary> {
  const text = draft.transcript.trim();
  const firstWords = text.split(/\s+/).slice(0, 4).join(' ');
  const title = firstWords ? capitalize(firstWords) : 'Daily Reflection';
  const summary = text
    ? `You reflected on your day: “${truncate(text, 90)}”. Noticing this is a healthy step.`
    : 'A brief moment of reflection was logged.';
  return {
    title,
    summary,
    moodEmoji: (draft.mood && moodEmojis[draft.mood]) || '🙂',
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}
