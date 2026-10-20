/**
 * checkin-complete — finishes a check-in.
 *
 * Request:  POST { messages: [...], day?: 'YYYY-MM-DD' }
 * Response: { checkin, metrics, successes } — the saved check-in (with the
 *           reasons behind its suggested values), today's tracker values, and
 *           the open plans that worked (the app suggests marking them solved).
 *
 * One entry per day: if the user already checked in today (and reopened the
 * check-in to continue), the whole conversation is analyzed again and that
 * day's entry is updated instead of creating a second one.
 *
 * Steps: AI extracts structured data → split into topic chunks and embed
 * them for RAG search → match outcomes of open Untangle plans → save it all
 * in ONE transaction (save_checkin: entry, today's tracker values, memory,
 * chunks, plan outcomes). AI work happens before the transaction, so a slow
 * or failed AI call never leaves a half-saved check-in.
 * Runs as the calling user (RLS).
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { checkQuota } from '../_shared/quota.ts';
import { span, traced } from '../_shared/tracing.ts';
import { getEmbedder, getLLM } from '../_shared/llm/index.ts';
import { type Chunk, topicChunks } from '../_shared/rag.ts';
import {
  buildExtractionSystemPrompt,
  CHECKIN_SCHEMA,
  type CheckinExtraction,
  formatTranscript,
  sanitize,
} from '../_shared/extraction.ts';
import { fetchOpenPlans, type OpenPlan, planOutcomeUpdates } from '../_shared/untangle.ts';
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

    const { memory, topics, plan_outcomes, reasons, ...record } = extraction;

    // 2. Embed the topics for RAG search, before saving: AI calls stay outside
    //    the transaction. If this fails, the entry is saved without chunks and
    //    indexMissing() adds a whole-check-in chunk later.
    const chunks = topicChunks({ ...record, messages }, topics);
    let indexed: (Chunk & { embedding: string })[] = [];
    try {
      const vectors = await getEmbedder(trace).embed(chunks.map((c) => c.content));
      indexed = chunks.map((c, i) => ({ ...c, embedding: JSON.stringify(vectors[i]) }));
    } catch (err) {
      console.error('Embedding the check-in failed, saving without search index:', err);
    }

    // 3. How open Untangle plans turned out, matched to their ids.
    const outcomes = planOutcomeUpdates(planRefs, plan_outcomes);

    // 4. Save everything in one transaction (save_checkin): the entry, the
    //    day's values, the memory, the RAG chunks and the plan outcomes.
    //    Either all of it is saved, or nothing is.
    const { data: saved, error: saveError } = await span(
      'save-checkin',
      async () =>
        await db.rpc('save_checkin', {
          p_day: day,
          p_checkin: { ...record, score_reasons: reasons, messages },
          p_memory: memory,
          p_chunks: indexed,
          p_outcomes: outcomes.map(({ id, outcome, outcome_note, intensity_after }) => ({ id, outcome, outcome_note, intensity_after })),
        }),
      { input: { chunks: indexed.length, plan_outcomes: outcomes.length } },
    );
    if (saveError || !saved) {
      console.error('Saving check-in failed:', saveError);
      return Response.json({ error: 'Could not save the check-in.' }, { status: 500 });
    }
    const { checkin, metrics } = saved as { checkin: Record<string, unknown>; metrics: Record<string, unknown> | null };
    // Plans that worked: the app suggests marking them solved.
    const successes = outcomes.filter((o) => o.outcome === 'worked').map(({ id, title }) => ({ id, title }));

    return Response.json({ checkin, metrics, successes });
  })),
};
