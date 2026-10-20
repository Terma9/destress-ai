/**
 * checkin-complete — finishes a check-in.
 *
 * Request:  POST { messages: [...], day?: 'YYYY-MM-DD' }
 * Response: { checkin, metrics, successes } — the saved check-in (with the
 *           reasons behind its suggested values), today's tracker values, and
 *           success stories created from plans that worked.
 *
 * One entry per day: if the user already checked in today (and reopened the
 * check-in to continue), the whole conversation is analyzed again and that
 * day's entry is updated instead of creating a second one.
 *
 * Steps: AI extracts structured data → save check-in → update today's
 * tracker values → save the updated memory → split into topic chunks for
 * RAG search → record how open Untangle plans turned out.
 * Runs as the calling user (RLS).
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { checkQuota } from '../_shared/quota.ts';
import { span, traced } from '../_shared/tracing.ts';
import { getEmbedder, getLLM } from '../_shared/llm/index.ts';
import { saveChunks, topicChunks } from '../_shared/rag.ts';
import {
  buildExtractionSystemPrompt,
  CHECKIN_SCHEMA,
  type CheckinExtraction,
  formatTranscript,
  sanitize,
} from '../_shared/extraction.ts';
import { fetchOpenPlans, type OpenPlan, recordPlanOutcomes } from '../_shared/untangle.ts';
import { INVALID_MESSAGES_ERROR, parseDay, parseMessages } from '../_shared/validation.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, traced('checkin-complete', async (req, ctx, trace) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }
    const overQuota = await checkQuota(ctx.supabase);
    if (overQuota) return overQuota;

    const body = await req.json().catch(() => null);
    const messages = parseMessages(body);
    if (!messages || !messages.some((m) => m.role === 'user')) {
      return Response.json(
        { error: `${INVALID_MESSAGES_ERROR} The conversation needs at least one user message.` },
        { status: 400 },
      );
    }
    const day = parseDay(body);
    const db = ctx.supabase;

    const [{ data: profile }, openPlans] = await span('load-context', () => Promise.all([
      db.from('profiles').select('display_name, memory').maybeSingle(),
      fetchOpenPlans(db).catch((err): OpenPlan[] => {
        console.error('Loading open plans failed:', err);
        return [];
      }),
    ]));
    const planRefs = openPlans.map((p, i) => ({ ...p, ref: `P${i + 1}` }));

    // 1. Ask the AI for the structured record + updated memory.
    let extraction: CheckinExtraction;
    try {
      const raw = await getLLM(trace).generateJson<CheckinExtraction>({
        task: 'extract',
        system: buildExtractionSystemPrompt({
          name: profile?.display_name ?? null,
          memory: profile?.memory ?? '',
          day,
          openPlans: planRefs,
        }),
        messages: formatTranscript(messages),
        schemaName: 'checkin',
        schema: CHECKIN_SCHEMA,
      });
      extraction = sanitize(raw);
    } catch (err) {
      console.error('Extraction failed:', err);
      return Response.json({ error: 'The AI could not summarize this check-in. Try again.' }, { status: 502 });
    }

    // 2. Save the check-in: update today's entry if there is one, otherwise create it.
    const { memory, topics, plan_outcomes, reasons, ...record } = extraction;
    const { data: existingEntry } = await span('find-today-entry', async () =>
      await db
        .from('checkins')
        .select('id')
        .eq('day', day)
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    const row = { ...record, score_reasons: reasons, messages, day, completed_at: new Date().toISOString() };
    const columns =
      'id, created_at, day, title, summary, mood, stress, emotion, sleep, themes, helped, follow_ups, risk_level, score_reasons';
    const { data: checkin, error: checkinError } = await span(
      'save-checkin',
      async () =>
        existingEntry
          ? await db.from('checkins').update(row).eq('id', existingEntry.id).select(columns).single()
          : await db.from('checkins').insert(row).select(columns).single(),
      { input: { mode: existingEntry ? 'update' : 'insert' } },
    );
    if (checkinError) {
      console.error('Saving check-in failed:', checkinError);
      return Response.json({ error: 'Could not save the check-in.' }, { status: 500 });
    }

    // 3. Update today's tracker values. Values the user set by hand win;
    //    scores the conversation didn't cover keep their previous value.
    const { data: existing } = await span('load-metrics', async () =>
      await db
        .from('daily_metrics')
        .select('stress, emotion, sleep, source')
        .eq('day', day)
        .maybeSingle(),
    );

    let metrics = existing;
    const hasScores = record.stress !== null || record.emotion !== null || record.sleep !== null;
    if (existing?.source !== 'manual' && hasScores) {
      const { data, error } = await span('save-metrics', async () => await db
        .from('daily_metrics')
        .upsert(
          {
            day,
            stress: record.stress ?? existing?.stress ?? null,
            emotion: record.emotion ?? existing?.emotion ?? null,
            sleep: record.sleep ?? existing?.sleep ?? null,
            source: 'ai',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,day' },
        )
        .select('day, stress, emotion, sleep, source')
        .single());
      if (error) console.error('Updating daily metrics failed:', error);
      else metrics = data;
    }

    // 4. Save the updated memory for the next check-in.
    const { error: memoryError } = await span('save-memory', async () =>
      await db
        .from('profiles')
        .update({ memory, updated_at: new Date().toISOString() })
        .eq('id', ctx.userClaims!.id),
    );
    if (memoryError) console.error('Updating memory failed:', memoryError);

    // 5. Index the check-in for RAG search: one chunk per topic. If this
    //    fails, indexMissing() later adds a whole-check-in chunk instead.
    //    A continued entry replaces its old chunks, since the topics may have changed.
    try {
      await span('index-checkin', async () => {
        if (existingEntry) await db.from('checkin_chunks').delete().eq('checkin_id', checkin.id);
        await saveChunks(db, getEmbedder(trace), checkin.id, topicChunks({ ...record, messages }, topics));
      });
    } catch (err) {
      console.error('Indexing check-in failed:', err);
    }

    // 6. Untangle follow-up: save how open plans turned out; plans that
    //    worked become private success stories the user can review.
    let successes: { id: string; title: string }[] = [];
    try {
      successes = await span('plan-outcomes', () => recordPlanOutcomes(db, planRefs, plan_outcomes), {
        input: { open_plans: planRefs.length },
      });
    } catch (err) {
      console.error('Recording plan outcomes failed:', err);
    }

    return Response.json({ checkin, metrics, successes });
    })),
};
