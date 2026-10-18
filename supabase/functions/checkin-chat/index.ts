/**
 * checkin-chat — one turn of the AI check-in conversation.
 *
 * Request:  POST { messages: [{ role: 'user' | 'assistant', content }], day?: 'YYYY-MM-DD', language?: 'en' }
 *           (empty list = start a new check-in; the AI opens. `day` = user's local
 *           date, `language` = app language the AI opens in, default English)
 * Response: the AI's reply, streamed as plain text chunks.
 *
 * Runs as the calling user (RLS applies), so it can only load their own data.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { getLLM, type ChatMessage } from '../_shared/llm/index.ts';
import { buildCheckinSystemPrompt, START_CHECKIN_MESSAGE } from '../_shared/prompts.ts';
import { INVALID_MESSAGES_ERROR, parseDay, parseLanguage, parseMessages } from '../_shared/validation.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }

    const body = await req.json().catch(() => null);
    const messages = parseMessages(body);
    if (!messages) {
      return Response.json({ error: INVALID_MESSAGES_ERROR }, { status: 400 });
    }

    // Load the user's context. RLS guarantees these queries only see their rows.
    const [profile, checkins, metrics] = await Promise.all([
      ctx.supabase.from('profiles').select('display_name, memory').maybeSingle(),
      ctx.supabase
        .from('checkins')
        .select('created_at, title, summary, follow_ups')
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3),
      ctx.supabase
        .from('daily_metrics')
        .select('day, stress, emotion, sleep')
        .order('day', { ascending: false })
        .limit(7),
    ]);

    const system = buildCheckinSystemPrompt(
      {
        name: profile.data?.display_name ?? null,
        memory: profile.data?.memory ?? '',
        recentCheckins: checkins.data ?? [],
        recentMetrics: metrics.data ?? [],
      },
      parseDay(body),
      parseLanguage(body),
    );

    let llm;
    try {
      llm = getLLM();
    } catch (err) {
      console.error(err);
      return Response.json({ error: (err as Error).message }, { status: 500 });
    }

    const input: ChatMessage[] = messages.length
      ? messages
      : [{ role: 'user', content: START_CHECKIN_MESSAGE }];

    // Forward the model's text to the app as it arrives.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of llm.streamChat({ system, messages: input })) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          console.error(`[${llm.name}] chat failed:`, err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  }),
};
