/**
 * Request validation shared by the check-in functions. Limits keep a single
 * request from sending huge (and expensive) amounts of text to the AI.
 */
import type { ChatMessage } from './llm/index.ts';

export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_LENGTH = 4000;

export const INVALID_MESSAGES_ERROR = `Send { messages: [...] } with at most ${MAX_MESSAGES} messages of up to ${MAX_MESSAGE_LENGTH} characters.`;

export function parseMessages(body: unknown): ChatMessage[] | null {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) return null;
  for (const m of messages) {
    if (
      !m ||
      (m.role !== 'user' && m.role !== 'assistant') ||
      typeof m.content !== 'string' ||
      m.content.length > MAX_MESSAGE_LENGTH
    ) {
      return null;
    }
  }
  return messages as ChatMessage[];
}

/** The app's language as a readable name (e.g. "de" → "German"); defaults to English. */
export function parseLanguage(body: unknown): string {
  const code = (body as { language?: unknown })?.language;
  if (typeof code === 'string' && /^[a-z]{2}$/i.test(code)) {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' }).of(code.toLowerCase()) ?? 'English';
    } catch {
      // unknown code — fall through to the default
    }
  }
  return 'English';
}

/** The user's local calendar day (YYYY-MM-DD) as sent by the app; falls back to the UTC date. */
export function parseDay(body: unknown): string {
  const day = (body as { day?: unknown })?.day;
  if (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day))) {
    return day;
  }
  return new Date().toISOString().slice(0, 10);
}
