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
    day: string;
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
    /** Why the AI suggested each value, for the review step. */
    score_reasons: { stress?: string; sleep?: string; mood?: string };
  };
  metrics: { day: string; stress: number | null; emotion: number | null; sleep: number | null; source: string } | null;
  /** Success stories created because an Untangle plan worked. */
  successes: { id: string; title: string }[];
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

/** POSTs JSON to an Edge Function as the signed-in user, with the user's local day and language. */
async function post(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ day: dateKey(new Date()), language: deviceLanguage(), ...body }),
  });
  await throwIfFailed(res);
  return res;
}

/** Reads a streamed text response piece by piece; `onText` receives the text so far. */
async function readStream(res: Awaited<ReturnType<typeof post>>, onText: (textSoFar: string) => void) {
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
  options: { resume?: boolean } = {},
): Promise<string> {
  return readStream(await post('checkin-chat', { messages, resume: options.resume === true }), onText);
}

/** Streams the AI's next Untangle question. The first message is the user's problem. */
export async function streamUntangleReply(
  messages: ChatMessage[],
  intensity: number,
  onText: (textSoFar: string) => void,
): Promise<string> {
  return readStream(await post('untangle-chat', { messages, intensity }), onText);
}

/** Turns the Untangle conversation into a saved plan; returns the session id. */
export async function createUntanglePlan(messages: ChatMessage[], intensity: number): Promise<string> {
  const res = await post('untangle-plan', { messages, intensity });
  return ((await res.json()) as { id: string }).id;
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

export type SearchResult = {
  id: string;
  created_at: string;
  title: string | null;
  summary: string | null;
  mood: 'great' | 'good' | 'ok' | 'low' | 'stressed' | null;
  /** Category of the matched topic, or 'all' when the whole check-in matched. */
  topic: string;
  /** Free-text name of the matched topic, e.g. "Statistics resit". */
  topic_title: string | null;
  similarity: number;
};

/** Finds check-ins by meaning (RAG retrieval), most similar first. */
export async function searchCheckins(query: string): Promise<SearchResult[]> {
  const res = await fetch(`${FUNCTIONS_URL}/search-checkins`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  await throwIfFailed(res);
  const { results } = (await res.json()) as { results: SearchResult[] };
  return results;
}

/** Writes the user's Weekly Insights (sends today's local date); resolves once they're saved. */
export async function generateDeepDives(): Promise<void> {
  await post('deep-dive-generate', {});
}

/** Sends the finished conversation; the server extracts and saves it. */
export async function completeCheckin(messages: ChatMessage[]): Promise<CheckinResult> {
  const res = await post('checkin-complete', { messages });
  return (await res.json()) as CheckinResult;
}
