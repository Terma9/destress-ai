/**
 * Untangle: working through an acute stressor with the AI, right now.
 *
 * Unlike a generic chatbot, the AI here uses everything the app knows about
 * the user: memory, reflection answers, Deep Dive findings, past check-ins
 * found by meaning (RAG), and how earlier Untangle plans worked out
 * (intensity before → after). Two steps: a short conversation to understand
 * the problem (untangle-chat), then a structured plan (untangle-plan).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { ChatMessage, Embedder } from './llm/index.ts';
import { CRISIS_RULE } from './prompts.ts';
import { formatConversation, relatedConversations, type RelatedConversation } from './rag.ts';

export const MAX_QUESTIONS = 5;
export const PROMPT_VERSION = 'untangle-v2';

export type UntangleContext = {
  name: string | null;
  memory: string;
  reflections: { question: string; answer: string }[];
  findings: string[];
  pastSessions: {
    kind: 'calm' | 'plan';
    title: string;
    before: number;
    after: number | null;
    steps: { text: string; done: boolean }[];
    outcome: string | null;
  }[];
  /** Their active stress-solving plans, so Calm now can point to one. */
  activePlans: { title: string; problem: string }[];
  /** Past check-ins about similar situations, labelled E1, E2, … for citing. */
  related: (RelatedConversation & { ref: string })[];
};

/** Loads everything the AI should know for this problem. RAG failures don't block. */
export async function loadUntangleContext(
  db: SupabaseClient,
  embedder: Embedder,
  messages: ChatMessage[],
): Promise<UntangleContext> {
  const userText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');

  const [profile, reflections, analysis, sessions, related, active] = await Promise.all([
    db.from('profiles').select('display_name, memory').maybeSingle(),
    db.from('reflections').select('question, answer').order('updated_at', { ascending: false }).limit(3),
    db
      .from('analyses')
      .select('deep_dives(title, findings)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('untangle_sessions')
      .select('kind, title, intensity_before, intensity_after, plan, outcome_note')
      .order('updated_at', { ascending: false })
      .limit(8),
    relatedConversations(db, embedder, userText, { max: 3 }).catch((err) => {
      console.error('Finding related check-ins failed:', err);
      return [];
    }),
    db
      .from('untangle_sessions')
      .select('title, problem')
      .eq('kind', 'plan')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  type Dive = { title: string; findings: { text: string }[] };
  const dives = ((analysis.data as { deep_dives: Dive[] } | null)?.deep_dives ?? []) as Dive[];

  return {
    name: profile.data?.display_name ?? null,
    memory: profile.data?.memory ?? '',
    reflections: reflections.data ?? [],
    findings: dives.flatMap((d) => d.findings.map((f) => `${d.title}: ${f.text}`)),
    pastSessions: (sessions.data ?? []).map((s) => ({
      kind: s.kind,
      title: s.title,
      before: s.intensity_before,
      after: s.intensity_after,
      steps: (s.plan as { steps: { text: string; done: boolean }[] } | null)?.steps ?? [],
      outcome: s.outcome_note,
    })),
    activePlans: active.data ?? [],
    related: related.map((r, i) => ({ ...r, ref: `E${i + 1}` })),
  };
}

function formatContext(ctx: UntangleContext): string {
  const list = (items: string[], empty: string) => (items.length ? items.map((i) => `- ${i}`).join('\n') : empty);
  const sessions = ctx.pastSessions.map((s) => {
    const steps = s.steps.map((st) => `${st.done ? '✓' : '✗'} ${st.text}`).join('; ');
    const what = s.kind === 'calm' ? 'Calm now session' : `Plan. Steps: ${steps || '–'}`;
    return `"${s.title}": intensity ${s.before} → ${s.after ?? '?'}/10. ${what}${s.outcome ? ` · what helped: ${s.outcome}` : ''}`;
  });
  const related = ctx.related.map(
    (r) => `### [${r.ref}] ${r.created_at.slice(0, 10)} · ${r.title ?? 'Check-in'}\nMatched topic: ${r.topic}\n${formatConversation(r.messages, 4000)}`,
  );

  return `## What you know about ${ctx.name || 'the user'}
${ctx.memory || 'Nothing yet.'}

## Patterns from their Weekly Insights
${list(ctx.findings, 'None yet.')}

## Their answers to reflection questions
${list(ctx.reflections.map((r) => `Q: ${r.question} A: ${r.answer}`), 'None yet.')}

## Earlier Calm now sessions and plans, and how they worked out (✓ = step done)
${list(sessions, 'None yet.')}

## Related past check-ins (found by meaning)
Lines from "Destress AI" are your own earlier replies, not facts about the user.
${related.length ? related.join('\n\n') : 'None found.'}`;
}

/** Short text of a plan for the prompts. */
export function formatPlan(plan: Plan): string {
  const steps = plan.steps.map((s, i) => `${i + 1}. ${s.done ? '✓ ' : ''}${s.text}`).join('\n');
  return `${plan.approach ? `Approach: ${plan.approach}\n` : ''}${steps}`;
}

/** "Calm now": calm the user down during this conversation. Small tips, no plan. */
export function buildCalmPrompt(ctx: UntangleContext, intensity: number, breathed = false): string {
  const plans = ctx.activePlans.map((p) => `- "${p.title}": ${p.problem}`).join('\n');
  return `You are Destress AI in "Calm now": the user is stressed right now (${intensity}/10 when they started). Your only goal is that they feel calmer by the end of this short conversation.

## How to help
- Their first message describes what is stressing them. Base every reply on that and on what they say next; never be generic.
- Start by acknowledging what they feel, in their words, in one sentence. Stay calm and steady, like a friend who doesn't panic when they do.
- Over the conversation, mix three things, one per reply:
  1. Support: acknowledge and normalize ("It makes sense that this feels like a lot.").
  2. Small exercises they can do right now, guided step by step, one instruction at a time, then wait (${breathed ? '' : 'breathing out slowly, longer than in; '}naming 3 things they can see; dropping the shoulders; writing the worry down in one sentence; a few minutes of walking).${intensity >= 6 && !breathed ? ' Their stress is high: start with an exercise early.' : ''}
     Never repeat an exercise they already did in this conversation.
     Every exercise must fit where they are and what they can do right now. In bed or unable to sleep (dark, lying down): only things that work lying down with eyes closed, e.g. relaxing the body part by part from the feet up, a calm place in their mind, writing the thought on a note by the bed; never looking around, walking or screens. At work or among people: only discreet things. If you can't tell where they are, ask in a few words before suggesting one.${breathed ? "\n     They have just done one minute of guided slow breathing in the app. Don't suggest any breathing exercise again; you may briefly acknowledge that they took that minute." : ''}
  3. Short, practical tips for their exact situation, ideally ones that helped them before (see below), e.g. what can wait until tomorrow, the one next small thing.
- Keep every reply to 1–3 short sentences. No plans, no to-do lists, no problem-solving sessions.
- If what they describe matches one of their active plans below, mention that plan once by its title (they can open it later under "My plans"). If it sounds like something that keeps coming back and has no plan, you may suggest once, near the end, to work on it later with "Stress solving".
- When they sound calmer, say so gently and invite them to tap "I feel calmer".
- Reply in the language the user writes in.

## Their active plans
${plans || 'None.'}

## Boundaries
- You are not a therapist and don't diagnose.
${CRISIS_RULE}

${formatContext(ctx)}`;
}

/** "Stress solving": understand a recurring stressor (before the first plan) or hear how the plan goes (later). */
export function buildUntangleChatPrompt(
  ctx: UntangleContext,
  intensity: number,
  answered: number,
  currentPlan: Plan | null = null,
): string {
  if (currentPlan) {
    return `You are Destress AI in "Stress solving". The user is coming back to their plan for a stressor to tell you how it's going. Their plan right now:
${formatPlan(currentPlan)}

## How to talk
- Be warm and curious; 1–3 short sentences per reply, at most one question.
- Find out what worked, what didn't, and what changed. Celebrate progress specifically.
- If the approach should change (a step doesn't fit, something new came up), say so briefly and suggest tapping "Update my plan". Don't write the new plan in the chat.
- If the stressor sounds solved, say so and suggest tapping "Mark as solved".
- Reply in the language the user writes in.

## Boundaries
- You are not a therapist and don't diagnose.
${CRISIS_RULE}

${formatContext(ctx)}`;
  }

  // "Make my plan" only appears once the reply carries the [[ready]] marker (and after 2+ answers).
  const wrapUp =
    answered >= MAX_QUESTIONS
      ? 'You have asked enough questions. Briefly reflect what you understood, tell them to tap "Make my plan", and end with [[ready]].'
      : answered < 2
        ? 'Ask your next question. It is too early for a plan.'
        : `Do you know enough now? You know enough when you understand (1) when and how often it happens and what triggers it, (2) what is in their control, and (3) what they have tried and what helped or made it worse. If yes: briefly reflect what you understood in one or two sentences, tell them to tap "Make my plan", and end your message with [[ready]]. If not: ask about what is still missing (at most ${MAX_QUESTIONS - answered} more questions).`;

  return `You are Destress AI in "Stress solving": together with the user you work out a well-founded plan for something that keeps stressing them. It weighs on them ${intensity}/10.

## Your job in this conversation
- Understand the stressor well enough for a plan that really fits them: when and how often it happens, what triggers it, what is in their control, what they have tried and what helped or made it worse.
- Connect it to what you know (patterns from their Weekly Insights, older check-ins, earlier plans), e.g. "Last month you mentioned that late study sessions made it worse. Is that still true?"
- Ask one question at a time, 1–3 warm sentences per reply. Don't give the plan or a list of tips yet.
- Never write [[ready]] unless the instructions below allow it.
- Reply in the language the user writes in.
- They have answered ${answered} of your questions so far. ${wrapUp}

## Boundaries
- You are not a therapist and don't diagnose.
${CRISIS_RULE}

${formatContext(ctx)}`;
}

export function buildPlanPrompt(ctx: UntangleContext, intensity: number, currentPlan: Plan | null = null): string {
  const update = currentPlan
    ? `\nThis updates their existing plan. They told you how it went in the latest messages: keep what worked (and its done marks in mind), change what didn't. Their plan so far:\n${formatPlan(currentPlan)}\n`
    : '';
  return `You turn a conversation about something that keeps stressing the user of Destress AI into a well-founded, actionable plan. It weighs on them ${intensity}/10.
${update}
Rules:
- Language: clear, precise and plain, like a good coach. Concrete words, no jargon, no filler, no exclamation marks. Not oversimplified either: say exactly what to do and why.
- approach: 2–3 sentences (max 60 words): the idea behind the plan and why it fits this person, based on what you know about them (their patterns, check-ins, earlier plans). This is the argument for the plan.
- steps: 2 to 4 concrete steps, each one sentence of about 8–20 words: the action, plus when or how often (e.g. "Stop studying at 9 pm on weekdays and write tomorrow's three tasks on a note."). Specific to their situation, small enough to start this week. Build on what helped them before; avoid what made things worse.
- watch_for: one short sentence: how they will notice that the plan is working.
- minutes: roughly how long one step takes each time.
- lessons: up to 3 things this user's past check-ins show about similar situations: what helped (kind "helped") or what made it worse (kind "worse"). Each must cite at least one related past check-in by its label (e.g. "E2"), and only state what the user said or experienced there, never a suggestion Destress AI made. Leave it empty if nothing fits.
- note: one short, kind sentence about what is not in their control or what they can let go of.
- problem: one sentence restating the problem, addressed to them ("You…"). title: 2–6 words.
- Write in the language the user wrote in. Address them as "you". No diagnoses, no medical advice.
- risk_level: high if they mention self-harm, suicide or being in danger; elevated if they sound hopeless or unable to cope with life in general. Strong stress or panic about a concrete situation (an exam, a conflict, a deadline) is what Untangle is for: that is none.

${formatContext(ctx)}`;
}

export type PlanOutput = {
  title: string;
  problem: string;
  approach: string;
  watch_for: string;
  lessons: { text: string; kind: 'helped' | 'worse'; evidence: string[] }[];
  steps: { text: string; minutes: number }[];
  note: string;
  risk_level: 'none' | 'elevated' | 'high';
};

export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'problem', 'approach', 'lessons', 'steps', 'watch_for', 'note', 'risk_level'],
  properties: {
    title: { type: 'string', description: '2–6 words, e.g. "Statistics resit tomorrow".' },
    problem: { type: 'string', description: 'One sentence, addressed to the user.' },
    approach: { type: 'string', description: 'The idea behind the plan and why it fits them, 2–3 sentences.' },
    watch_for: { type: 'string', description: 'How they will notice it works, one sentence.' },
    lessons: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'kind', 'evidence'],
        properties: {
          text: { type: 'string', description: 'The lesson, in one short sentence.' },
          kind: { type: 'string', enum: ['helped', 'worse'] },
          evidence: { type: 'array', items: { type: 'string' }, description: 'Labels like ["E1"].' },
        },
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'minutes'],
        properties: {
          text: { type: 'string', description: 'One concrete action.' },
          minutes: { type: 'integer', description: 'Roughly how long it takes.' },
        },
      },
    },
    note: { type: 'string' },
    risk_level: { type: 'string', enum: ['none', 'elevated', 'high'] },
  },
} as const;

export type Plan = {
  approach?: string;
  watch_for?: string;
  /** What past check-ins show; stored as `lessons` in untangle_sessions.plan. evidence = check-in ids. */
  lessons: { text: string; kind: 'helped' | 'worse'; evidence: string[] }[];
  steps: { text: string; minutes: number; done: boolean }[];
  note: string;
};

/** Maps citations to check-in ids and drops unsupported lessons; keeps 1–3 sane steps. */
export function validatePlan(output: PlanOutput, related: UntangleContext['related']): Plan | null {
  const idByRef = new Map(related.map((r) => [r.ref.toUpperCase(), r.id]));
  const lessons = output.lessons.slice(0, 3).flatMap((h) => {
    const ids = [...new Set(h.evidence.map((ref) => idByRef.get(ref.trim().toUpperCase())))].filter(
      (id): id is string => !!id,
    );
    return ids.length && h.text.trim() ? [{ text: h.text.trim(), kind: h.kind, evidence: ids }] : [];
  });
  const steps = output.steps
    .filter((s) => s.text.trim())
    .slice(0, 4)
    .map((s) => ({ text: s.text.trim(), minutes: Math.max(1, Math.min(240, Math.round(s.minutes) || 10)), done: false }));
  if (!steps.length) return null;
  return {
    approach: output.approach.trim(),
    watch_for: output.watch_for.trim(),
    lessons,
    steps,
    note: output.note.trim(),
  };
}

export type OpenPlan = {
  id: string;
  title: string;
  problem: string;
  intensity_before: number;
  intensity_after: number | null;
  steps: { text: string; done: boolean }[];
};

/** Active stress-solving plans the check-in asks about, most recently touched first. */
export async function fetchOpenPlans(db: SupabaseClient): Promise<OpenPlan[]> {
  const { data, error } = await db
    .from('untangle_sessions')
    .select('id, title, problem, intensity_before, intensity_after, plan')
    .eq('kind', 'plan')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(3);
  if (error) throw error;
  return (data ?? []).map(({ plan, ...s }) => ({ ...s, steps: (plan as Plan).steps }));
}

/**
 * Saves how active plans are going (from the check-in extraction). Returns
 * the plans that worked, so the check-in can suggest marking them solved;
 * the success story is only created when the user marks a plan solved.
 */
export async function recordPlanOutcomes(
  db: SupabaseClient,
  plans: (OpenPlan & { ref: string })[],
  outcomes: { plan: string; outcome: string; what_helped: string; theme: string; intensity_after: number | null }[],
): Promise<{ id: string; title: string }[]> {
  const byRef = new Map(plans.map((p) => [p.ref.toUpperCase(), p]));
  const successes: { id: string; title: string }[] = [];

  for (const o of outcomes) {
    const plan = byRef.get(o.plan.trim().toUpperCase());
    if (!plan || o.outcome === 'not_discussed') continue;

    const { error } = await db
      .from('untangle_sessions')
      .update({
        outcome: o.outcome,
        outcome_note: o.what_helped.trim() || null,
        outcome_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // How much it weighs on them now comes from the check-in.
        ...(o.intensity_after !== null ? { intensity_after: o.intensity_after } : {}),
      })
      .eq('id', plan.id);
    if (error) throw error;
    if (o.outcome === 'worked') successes.push({ id: plan.id, title: plan.title });
  }
  return successes;
}

/**
 * The plan the user is coming back to, when the request carries its
 * `sessionId` (RLS: only their own). Null when starting a new one.
 */
export async function loadPlanSession(
  db: SupabaseClient,
  body: unknown,
): Promise<{ id: string; plan: Plan; plan_history: unknown[]; intensity_before: number } | null> {
  const id = (body as { sessionId?: unknown })?.sessionId;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db
    .from('untangle_sessions')
    .select('id, plan, plan_history, intensity_before')
    .eq('id', id)
    .eq('kind', 'plan')
    .maybeSingle();
  return data ?? null;
}
