/**
 * untangle-plan — turns the Untangle conversation into a saved plan.
 *
 * Request:  POST { messages: [...], intensity: 0–10 }
 * Response: { id }  — the saved untangle_sessions row
 *
 * One structured-output call: title, problem, 1–3 steps, "what helped you
 * before" citing past check-ins (validated here), a note and a risk level.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { getEmbedder, getLLM } from '../_shared/llm/index.ts';
import {
  buildPlanPrompt,
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
    try {
      context = await loadUntangleContext(db, getEmbedder(), messages);
      output = await getLLM().generateJson<PlanOutput>({
        task: 'analysis',
        system: buildPlanPrompt(context, intensity),
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

    const { data, error } = await db
      .from('untangle_sessions')
      .insert({
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
