/**
 * The app's connection to the AI Edge Functions (check-in, voice, Deep Dives).
 *
 * checkin-chat streams its reply, so we read the response piece by piece
 * with expo/fetch (React Native's built-in fetch can't stream bodies).
 */
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
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

const deviceLanguage = () => Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2);

/** Ask for the session each time so we always send a fresh (auto-refreshed) token. */
async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');
  return token;
}

async function throwIfFailed(res: { ok: boolean; status: number; json(): Promise<any> }) {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status}).`);
  }
}

async function post(name: string, messages: ChatMessage[]) {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, day: dateKey(new Date()), language: deviceLanguage() }),
  });
  await throwIfFailed(res);
  return res;
}

/**
 * Uploads a voice recording and returns the transcript.
 * Phones record an .m4a file on disk; browsers record webm data in memory.
 */
export async function transcribeAudio(uri: string): Promise<string> {
  let body: Blob;
  let contentType: string;
  if (Platform.OS === 'web') {
    body = await (await globalThis.fetch(uri)).blob();
    contentType = body.type || 'audio/webm';
  } else {
    // The HIGH_QUALITY recording preset produces AAC in an .m4a (MPEG-4) file on iOS and Android.
    body = new File(uri);
    contentType = 'audio/mp4';
  }

  const res = await fetch(`${FUNCTIONS_URL}/transcribe?language=${deviceLanguage()}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': contentType },
    body,
  });
  await throwIfFailed(res);
  const { text } = (await res.json()) as { text: string };
  return text;
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

/** Fills an empty account with three weeks of demo check-ins; returns how many were added. */
export async function loadDemoData(): Promise<number> {
  const res = await fetch(`${FUNCTIONS_URL}/seed-demo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ day: dateKey(new Date()) }),
  });
  await throwIfFailed(res);
  const { inserted } = (await res.json()) as { inserted: number };
  return inserted;
}

/** Analyzes the user's check-ins into Deep Dives; resolves once they're saved. */
export async function generateDeepDives(): Promise<void> {
  const res = await fetch(`${FUNCTIONS_URL}/deep-dive-generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: deviceLanguage() }),
  });
  await throwIfFailed(res);
}

/** Sends the finished conversation; the server extracts and saves it. */
export async function completeCheckin(messages: ChatMessage[]): Promise<CheckinResult> {
  const res = await post('checkin-complete', messages);
  return (await res.json()) as CheckinResult;
}
