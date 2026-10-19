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

export const MAX_QUESTIONS = 3;
export const PROMPT_VERSION = 'untangle-v1';

export type UntangleContext = {
  name: string | null;
  memory: string;
  reflections: { question: string; answer: string }[];
  findings: string[];
  pastSessions: { title: string; before: number; after: number | null; steps: { text: string; done: boolean }[] }[];
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

  const [profile, reflections, analysis, sessions, related] = await Promise.all([
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
      .select('title, intensity_before, intensity_after, plan')
      .not('completed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5),
    relatedConversations(db, embedder, userText, { max: 3 }).catch((err) => {
      console.error('Finding related check-ins failed:', err);
      return [];
    }),
  ]);

  type Dive = { title: string; findings: { text: string }[] };
  const dives = ((analysis.data as { deep_dives: Dive[] } | null)?.deep_dives ?? []) as Dive[];

  return {
    name: profile.data?.display_name ?? null,
    memory: profile.data?.memory ?? '',
    reflections: reflections.data ?? [],
    findings: dives.flatMap((d) => d.findings.map((f) => `${d.title}: ${f.text}`)),
    pastSessions: (sessions.data ?? []).map((s) => ({
      title: s.title,
      before: s.intensity_before,
      after: s.intensity_after,
      steps: (s.plan as { steps: { text: string; done: boolean }[] }).steps,
    })),
    related: related.map((r, i) => ({ ...r, ref: `E${i + 1}` })),
  };
}

function formatContext(ctx: UntangleContext): string {
  const list = (items: string[], empty: string) => (items.length ? items.map((i) => `- ${i}`).join('\n') : empty);
  const sessions = ctx.pastSessions.map((s) => {
    const steps = s.steps.map((st) => `${st.done ? '✓' : '✗'} ${st.text}`).join('; ');
    return `"${s.title}": intensity ${s.before} → ${s.after ?? '?'}/10. Steps: ${steps}`;
  });
  const related = ctx.related.map(
    (r) => `### [${r.ref}] ${r.created_at.slice(0, 10)} · ${r.title ?? 'Check-in'}\nMatched topic: ${r.topic}\n${formatConversation(r.messages, 4000)}`,
  );

  return `## What you know about ${ctx.name || 'the user'}
${ctx.memory || 'Nothing yet.'}

## Patterns from their Deep Dives
${list(ctx.findings, 'None yet.')}

## Their answers to reflection questions
${list(ctx.reflections.map((r) => `Q: ${r.question} A: ${r.answer}`), 'None yet.')}

## Earlier Untangle sessions and how they worked out (✓ = step done)
${list(sessions, 'None yet.')}

## Related past check-ins (found by meaning)
Lines from "Destress AI" are your own earlier replies, not facts about the user.
${related.length ? related.join('\n\n') : 'None found.'}`;
}

export function buildUntangleChatPrompt(ctx: UntangleContext, intensity: number, answered: number): string {
  const wrapUp =
    answered >= MAX_QUESTIONS - 1
      ? 'You have asked enough questions. Briefly reflect what you understood and tell them to tap "Make my plan".'
      : `Ask your next question. You may ask ${MAX_QUESTIONS - answered} more at most; if the picture is already clear, tell them to tap "Make my plan" instead.`;

  return `You are Destress AI, helping the user untangle something that is stressing them right now. Their stress intensity is ${intensity}/10.

## Your job in this short conversation
- Understand the problem just well enough to make a small, concrete plan afterwards: what exactly is going on, by when, what is in their control, what they have already tried.
- Ask one short question at a time, 1–2 calm, warm sentences per reply. Don't give the plan or a list of tips yet.
- Use what you know about them (below) to ask sharper questions, e.g. about something that helped or made it worse before.
- Reply in the language the user writes in.
- They have answered ${answered} of your questions so far. ${wrapUp}

## Boundaries
- You are not a therapist and don't diagnose.
${CRISIS_RULE}

${formatContext(ctx)}`;
}

export function buildPlanPrompt(ctx: UntangleContext, intensity: number): string {
  return `You turn a short conversation about an acute stressor into a small, concrete plan for the user of Destress AI. Their stress intensity is ${intensity}/10.

Rules:
- steps: 1 to 3 steps, specific to their situation. The first step must be doable right now in 10 minutes or less. Build on what helped them before and on steps that lowered their intensity in earlier Untangle sessions; avoid what made things worse.
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
  lessons: { text: string; kind: 'helped' | 'worse'; evidence: string[] }[];
  steps: { text: string; minutes: number }[];
  note: string;
  risk_level: 'none' | 'elevated' | 'high';
};

export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'problem', 'lessons', 'steps', 'note', 'risk_level'],
  properties: {
    title: { type: 'string', description: '2–6 words, e.g. "Statistics resit tomorrow".' },
    problem: { type: 'string', description: 'One sentence, addressed to the user.' },
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
    .slice(0, 3)
    .map((s) => ({ text: s.text.trim(), minutes: Math.max(1, Math.min(240, Math.round(s.minutes) || 10)), done: false }));
  if (!steps.length) return null;
  return { lessons, steps, note: output.note.trim() };
}

/** How long after an Untangle plan the check-in still asks how it went. */
const FOLLOW_UP_DAYS = 7;

export type OpenPlan = {
  id: string;
  title: string;
  problem: string;
  intensity_before: number;
  intensity_after: number | null;
  steps: { text: string; done: boolean }[];
};

/** Recent Untangle plans whose outcome isn't known yet, newest first. */
export async function fetchOpenPlans(db: SupabaseClient): Promise<OpenPlan[]> {
  const since = new Date(Date.now() - FOLLOW_UP_DAYS * 86_400_000).toISOString();
  const { data, error } = await db
    .from('untangle_sessions')
    .select('id, title, problem, intensity_before, intensity_after, plan')
    .is('outcome', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) throw error;
  return (data ?? []).map(({ plan, ...s }) => ({ ...s, steps: (plan as Plan).steps }));
}

/**
 * Saves how open plans turned out (from the check-in extraction). Plans
 * that worked, fully or partly, become a private success story; returns those.
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
        // The "how intense is it now" answer comes from this check-in, not from the plan screen.
        ...(o.intensity_after !== null && plan.intensity_after === null
          ? { intensity_after: o.intensity_after, completed_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', plan.id);
    if (error) throw error;

    if (o.outcome === 'worked' || o.outcome === 'partly') {
      const doneSteps = plan.steps.filter((s) => s.done).map((s) => s.text);
      const { data, error: storyError } = await db
        .from('success_stories')
        .insert({
          session_id: plan.id,
          theme: o.theme,
          title: plan.title,
          situation: plan.problem,
          solution: o.what_helped.trim() || doneSteps.join(' ') || plan.steps[0]?.text || '',
          intensity_before: plan.intensity_before,
          intensity_after: o.intensity_after ?? plan.intensity_after,
        })
        .select('id, title')
        .single();
      if (storyError) throw storyError;
      successes.push(data);
    }
  }
  return successes;
}
