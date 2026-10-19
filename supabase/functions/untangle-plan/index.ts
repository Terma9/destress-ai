/**
 * untangle-plan — turns a Stress solving conversation into a saved plan, or
 * updates an existing one (sessionId); the old version goes to plan_history.
 *
 * Request:  POST { messages: [...], intensity: 0–10, sessionId? }
 * Response: { id }  — the saved untangle_sessions row
 *
 * One structured-output call: title, problem, 1–3 steps, "what helped you
 * before" citing past check-ins (validated here), a note and a risk level.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { checkQuota } from '../_shared/quota.ts';
import { getEmbedder, getLLM } from '../_shared/llm/index.ts';
import {
  buildPlanPrompt,
  loadPlanSession,
  loadUntangleContext,
  PLAN_SCHEMA,
  type PlanOutput,
  validatePlan,
} from '../_shared/untangle.ts';
import { formatTranscript } from '../_shared/extraction.ts';
import { INVALID_MESSAGES_ERROR, parseIntensity, parseMessages } from '../_shared/validation.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }
    const overQuota = await checkQuota(ctx.supabase);
    if (overQuota) return overQuota;
    const body = await req.json().catch(() => null);
    const messages = parseMessages(body);
    const intensity = parseIntensity(body);
    if (!messages || messages[0]?.role !== 'user' || intensity === null) {
      return Response.json(
        { error: `${INVALID_MESSAGES_ERROR} Start with the user's problem and send intensity 0–10.` },
        { status: 400 },
      );
    }
    const db = ctx.supabase;

    let output: PlanOutput;
    let context;
    let session: Awaited<ReturnType<typeof loadPlanSession>> = null;
    try {
      [context, session] = await Promise.all([
        loadUntangleContext(db, getEmbedder(), messages),
        loadPlanSession(db, body),
      ]);
      output = await getLLM().generateJson<PlanOutput>({
        task: 'analysis',
        system: buildPlanPrompt(context, intensity, session?.plan ?? null),
        messages: formatTranscript(messages),
        schemaName: 'untangle_plan',
        schema: PLAN_SCHEMA,
      });
    } catch (err) {
      console.error('Making the plan failed:', err);
      return Response.json({ error: 'The AI could not make a plan. Try again.' }, { status: 502 });
    }

    const plan = validatePlan(output, context.related);
    if (!plan) {
      return Response.json({ error: 'The AI could not make a plan. Try again.' }, { status: 502 });
    }

    // An update keeps the old version in the history.
    if (session) {
      const { error } = await db
        .from('untangle_sessions')
        .update({
          problem: output.problem.trim() || undefined,
          messages,
          plan,
          plan_history: [...session.plan_history, { plan: session.plan, replaced_at: new Date().toISOString() }],
          risk_level: output.risk_level,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);
      if (error) {
        console.error('Updating the plan failed:', error);
        return Response.json({ error: 'Could not save the plan.' }, { status: 500 });
      }
      return Response.json({ id: session.id });
    }

    const { data, error } = await db
      .from('untangle_sessions')
      .insert({
        kind: 'plan',
        title: output.title.trim().slice(0, 80) || 'Untangle',
        problem: output.problem.trim(),
        messages,
        intensity_before: intensity,
        plan,
        risk_level: output.risk_level,
      })
      .select('id')
      .single();
    if (error) {
      console.error('Saving the plan failed:', error);
      return Response.json({ error: 'Could not save the plan.' }, { status: 500 });
    }
    return Response.json({ id: data.id });
  }),
};
