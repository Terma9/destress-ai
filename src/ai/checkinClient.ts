/**
 * The app's connection to the AI check-in Edge Functions.
 *
 * checkin-chat streams its reply, so we read the response piece by piece
 * with expo/fetch (React Native's built-in fetch can't stream bodies).
 */
import { fetch } from 'expo/fetch';
import { dateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type CheckinResult = {
  checkin: {
    id: string;
    created_at: string;
    title: string;
    summary: string;
    mood: 'great' | 'good' | 'ok' | 'low' | 'stressed';
    stress: number | null;
    emotion: number | null;
    sleep: number | null;
    themes: string[];
    helped: string[];
    follow_ups: string[];
    risk_level: 'none' | 'elevated' | 'high';
  };
  metrics: { day: string; stress: number | null; emotion: number | null; sleep: number | null; source: string } | null;
};

const FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;

async function post(name: string, messages: ChatMessage[]) {
  // Ask for the session each time so we always send a fresh (auto-refreshed) token.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      day: dateKey(new Date()),
      language: Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status}).`);
  }
  return res;
}

/** Streams the AI's next message; `onText` receives the reply so far after each piece. */
export async function streamCheckinReply(
  messages: ChatMessage[],
  onText: (textSoFar: string) => void,
): Promise<string> {
  const res = await post('checkin-chat', messages);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  return text;
}

/** Sends the finished conversation; the server extracts and saves it. */
export async function completeCheckin(messages: ChatMessage[]): Promise<CheckinResult> {
  const res = await post('checkin-complete', messages);
  return (await res.json()) as CheckinResult;
}
