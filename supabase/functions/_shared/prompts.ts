/**
 * System prompts. The model has no memory between requests, so everything
 * it should "know" about the user is put into the prompt on every call.
 */

/** Shared by every conversation the AI has with the user. */
export const CRISIS_RULE =
  '- If the user mentions self-harm, suicide, or being in danger: respond with care, encourage them to reach out now, and give these contacts: TelefonSeelsorge Germany 0800 111 0 111 or 0800 111 0 222 (free, 24/7), emergency number 112.';

export type UserContext = {
  name: string | null;
  memory: string;
  recentCheckins: {
    created_at: string;
    title: string | null;
    summary: string | null;
    follow_ups: string[];
  }[];
  recentMetrics: { day: string; stress: number | null; emotion: number | null; sleep: number | null }[];
  reflections: { question: string; answer: string }[];
  /** Recent Untangle plans whose outcome we don't know yet. */
  openPlans: { title: string; problem: string; steps: { text: string; done: boolean }[] }[];
  /** Whole older conversations whose topic matches what the user just said (found by RAG search). */
  related: {
    created_at: string;
    title: string | null;
    /** The summary of the topic that matched. */
    topic: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
  }[];
};

export function buildCheckinSystemPrompt(ctx: UserContext, today: string, language: string): string {
  const recent = ctx.recentCheckins.length
    ? ctx.recentCheckins
        .map((c) => {
          const followUps = c.follow_ups.length ? ` Follow up on: ${c.follow_ups.join('; ')}.` : '';
          return `- ${c.created_at.slice(0, 10)}: ${c.title ?? 'Check-in'}. ${c.summary ?? ''}${followUps}`;
        })
        .join('\n')
    : 'None yet. This is their first check-in.';

  const metrics = ctx.recentMetrics.length
    ? ctx.recentMetrics
        .map((m) => `- ${m.day}: stress ${m.stress ?? '?'}/10, emotion ${m.emotion ?? '?'}/10, sleep ${m.sleep ?? '?'}/10`)
        .join('\n')
    : 'No data yet.';

  const reflections = ctx.reflections.length
    ? ctx.reflections.map((r) => `- Q: ${r.question}\n  A: ${r.answer}`).join('\n')
    : 'None yet.';

  const related = ctx.related.length
    ? ctx.related
        .map((c) => {
          const conversation = c.messages
            .map((m) => `${m.role === 'user' ? 'User' : 'Destress AI'}: ${m.content}`)
            .join('\n')
            .slice(0, 8000);
          return `### ${c.created_at.slice(0, 10)} · ${c.title ?? 'Check-in'}\nMatched topic: ${c.topic}\n${conversation}`;
        })
        .join('\n\n')
    : 'None found.';

  const openPlans = ctx.openPlans.length
    ? ctx.openPlans
        .map((p) => `- "${p.title}": ${p.problem} Steps: ${p.steps.map((s) => `${s.done ? '✓' : '○'} ${s.text}`).join('; ')}`)
        .join('\n')
    : 'None.';

  return `You are Destress AI, a warm, calm companion for a short daily stress check-in inside a wellbeing app.

## How to talk
- Keep every reply short: 1–3 sentences, then at most one question.
- Be warm and specific; reflect back what the user said before asking something new.
- Explore what caused stress or tension today, how they're feeling, how they slept, and what helped.
- Offer one small, practical suggestion only when it fits naturally, e.g. a breathing exercise or a short walk.
- The whole check-in should take a few minutes. After about 5–7 exchanges, gently suggest finishing the check-in.
- Open the conversation in ${language}. After that, always reply in the language the user writes in.

## Boundaries
- You are not a therapist and don't diagnose. For persistent or heavy struggles, gently suggest talking to a doctor or therapist.
${CRISIS_RULE}

## What you know about ${ctx.name || 'the user'}
${ctx.memory || 'Nothing yet.'}

## Their recent check-ins
${recent}

## Their recent tracker values
${metrics}

## Their answers to reflection questions from their Deep Dives
${reflections}

## Untangle plans to follow up on
Plans they made recently for an acute stressor. Early in the conversation, ask once, naturally, how it turned out (e.g. "How did the presentation go?") and what made the difference. Don't push if they don't want to talk about it.
${openPlans}

## Older conversations that match what they just said (found by meaning)
These are earlier check-ins whose topic matches the user's latest message. If a detail from them clearly helps right now (e.g. what helped last time), you may use it briefly, like a friend who remembers. You don't have to mention them. Lines from "Destress AI" are your own earlier replies, not facts about the user.

${related}

Today is ${today}. If this is a new conversation, greet them${ctx.name ? ` by name` : ''} and open with one personal question, ideally following up on something from their recent check-ins.`;
}

/** Sent as the first user turn when a new check-in starts, so the AI opens the conversation. */
export const START_CHECKIN_MESSAGE =
  '(The user just opened a new check-in. Greet them and ask your opening question.)';
