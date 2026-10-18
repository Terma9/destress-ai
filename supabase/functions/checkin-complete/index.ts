/**
 * checkin-complete — finishes a check-in.
 *
 * Request:  POST { messages: [...], day?: 'YYYY-MM-DD' }
 * Response: { checkin, metrics } — the saved check-in and today's tracker values.
 *
 * Steps: AI extracts structured data → save check-in → update today's
 * tracker values → save the updated memory. Runs as the calling user (RLS).
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { getLLM } from '../_shared/llm/index.ts';
import {
  buildExtractionSystemPrompt,
  CHECKIN_SCHEMA,
  type CheckinExtraction,
  formatTranscript,
  sanitize,
} from '../_shared/extraction.ts';
import { INVALID_MESSAGES_ERROR, parseDay, parseMessages } from '../_shared/validation.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }

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

    const { data: profile } = await db.from('profiles').select('display_name, memory').maybeSingle();

    // 1. Ask the AI for the structured record + updated memory.
    let extraction: CheckinExtraction;
    try {
      const raw = await getLLM().generateJson<CheckinExtraction>({
        system: buildExtractionSystemPrompt({
          name: profile?.display_name ?? null,
          memory: profile?.memory ?? '',
          day,
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

    // 2. Save the check-in (user_id is filled in from the login by the database).
    const { memory, ...record } = extraction;
    const { data: checkin, error: checkinError } = await db
      .from('checkins')
      .insert({ ...record, messages, completed_at: new Date().toISOString() })
      .select('id, created_at, title, summary, mood, stress, emotion, sleep, themes, helped, follow_ups, risk_level')
      .single();
    if (checkinError) {
      console.error('Saving check-in failed:', checkinError);
      return Response.json({ error: 'Could not save the check-in.' }, { status: 500 });
    }

    // 3. Update today's tracker values. Values the user set by hand win;
    //    scores the conversation didn't cover keep their previous value.
    const { data: existing } = await db
      .from('daily_metrics')
      .select('stress, emotion, sleep, source')
      .eq('day', day)
      .maybeSingle();

    let metrics = existing;
    const hasScores = record.stress !== null || record.emotion !== null || record.sleep !== null;
    if (existing?.source !== 'manual' && hasScores) {
      const { data, error } = await db
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
        .single();
      if (error) console.error('Updating daily metrics failed:', error);
      else metrics = data;
    }

    // 4. Save the updated memory for the next check-in.
    const { error: memoryError } = await db
      .from('profiles')
      .update({ memory, updated_at: new Date().toISOString() })
      .eq('id', ctx.userClaims!.id);
    if (memoryError) console.error('Updating memory failed:', memoryError);

    return Response.json({ checkin, metrics });
  }),
};
