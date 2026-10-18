/**
 * Turning a finished check-in conversation into structured data.
 *
 * One AI call returns both the check-in record and the user's updated
 * memory text, using structured output so the result always matches
 * CHECKIN_SCHEMA and fits straight into the database columns.
 */
import type { ChatMessage } from './llm/index.ts';

export const MOODS = ['great', 'good', 'ok', 'low', 'stressed'] as const;
export const THEMES = [
  'work',
  'study',
  'sleep',
  'family',
  'relationships',
  'social',
  'health',
  'money',
  'other',
] as const;
export const RISK_LEVELS = ['none', 'elevated', 'high'] as const;

export type CheckinExtraction = {
  title: string;
  summary: string;
  mood: (typeof MOODS)[number];
  stress: number | null;
  emotion: number | null;
  sleep: number | null;
  themes: (typeof THEMES)[number][];
  helped: string[];
  follow_ups: string[];
  risk_level: (typeof RISK_LEVELS)[number];
  memory: string;
};

const score = (description: string) => ({
  type: ['integer', 'null'],
  description: `${description} 0–10. null if the conversation gives no basis for it.`,
});

// Strict structured output requires every property to be listed in
// `required` and `additionalProperties: false` on each object.
export const CHECKIN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'summary',
    'mood',
    'stress',
    'emotion',
    'sleep',
    'themes',
    'helped',
    'follow_ups',
    'risk_level',
    'memory',
  ],
  properties: {
    title: { type: 'string', description: 'Short diary title, max 6 words.' },
    summary: {
      type: 'string',
      description: 'Warm 2–3 sentence summary addressed to the user ("You…"), in the language of the conversation.',
    },
    mood: { type: 'string', enum: MOODS, description: 'Overall mood today.' },
    stress: score('Stress level, where 10 is extremely stressed.'),
    emotion: score('Emotional wellbeing, where 10 is very good.'),
    sleep: score('Sleep quality last night, where 10 is excellent.'),
    themes: {
      type: 'array',
      items: { type: 'string', enum: THEMES },
      description: 'Life areas that caused stress or were discussed.',
    },
    helped: {
      type: 'array',
      items: { type: 'string' },
      description: 'Things that helped the user, in a few words each. Empty if none.',
    },
    follow_ups: {
      type: 'array',
      items: { type: 'string' },
      description: 'Things worth asking about in the next check-in, phrased as short notes. Max 2.',
    },
    risk_level: {
      type: 'string',
      enum: RISK_LEVELS,
      description:
        'high: mentions self-harm, suicide or being in danger. elevated: hopelessness or severe distress without that. none: otherwise.',
    },
    memory: {
      type: 'string',
      description: 'The updated memory text, see instructions.',
    },
  },
} as const;

export function buildExtractionSystemPrompt(input: {
  name: string | null;
  memory: string;
  day: string;
}): string {
  return `You analyze a finished check-in conversation from Destress AI, a stress-management app, and fill in a structured record.

Rules:
- Base everything only on what the user actually said. Don't invent details.
- Use null for a score the conversation gives no basis for.
- Keep "helped" and "follow_ups" short and concrete.

Updating the memory:
The memory is a short profile of the user that the companion reads before every check-in. Rewrite it by merging the current memory with anything new and lasting from this conversation: recurring stressors, patterns (e.g. "sleeps badly before deadlines"), what helps, goals, important upcoming events. Drop details that are no longer relevant. Write in English, plain sentences, at most 120 words. Refer to the user by name or as "they"; don't assume their gender. Record only what the user said or showed, not suggestions the companion made. Leave out passing small talk.

User's name: ${input.name || 'unknown'}
Date of this check-in: ${input.day}
Current memory: ${input.memory || '(empty — this may be their first check-in)'}`;
}

/** The conversation as one transcript, so the model analyzes it instead of continuing it. */
export function formatTranscript(messages: ChatMessage[]): ChatMessage[] {
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Destress AI'}: ${m.content}`)
    .join('\n\n');
  return [{ role: 'user', content: `Here is the check-in conversation:\n\n${transcript}` }];
}

/** Defensive clean-up: the database rejects out-of-range scores, so clamp them first. */
export function sanitize(e: CheckinExtraction): CheckinExtraction {
  const clamp = (n: number | null) =>
    n === null || Number.isNaN(n) ? null : Math.max(0, Math.min(10, Math.round(n)));
  return {
    ...e,
    title: e.title.trim().slice(0, 80) || 'Check-in',
    stress: clamp(e.stress),
    emotion: clamp(e.emotion),
    sleep: clamp(e.sleep),
    follow_ups: e.follow_ups.slice(0, 2),
    memory: e.memory.trim().slice(0, 1500),
  };
}
