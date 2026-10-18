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
import { getEmbedder, getLLM, type ChatMessage } from '../_shared/llm/index.ts';
import { buildCheckinSystemPrompt, START_CHECKIN_MESSAGE } from '../_shared/prompts.ts';
import { embedMissing, type Match, searchCheckins } from '../_shared/rag.ts';
import { INVALID_MESSAGES_ERROR, parseDay, parseLanguage, parseMessages } from '../_shared/validation.ts';

/**
 * RAG: past check-ins similar in meaning to what the user just said, so the
 * AI can recall e.g. what helped before a previous exam. Skips the recent
 * check-ins (already in the prompt). Never blocks the chat: on any error the
 * conversation simply continues without these.
 */
async function findRelated(
  db: Parameters<typeof embedMissing>[0],
  messages: ChatMessage[],
  recentIds: string[],
): Promise<Match[]> {
  try {
    const embedder = getEmbedder();
    if (!messages.length) {
      // New check-in: make sure older entries are indexed. A no-op once they are.
      await embedMissing(db, embedder);
      return [];
    }
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return [];
    const matches = await searchCheckins(db, embedder, lastUser.content, 6);
    return matches.filter((m) => !recentIds.includes(m.id)).slice(0, 3);
  } catch (err) {
    console.error('Finding related check-ins failed:', err);
    return [];
  }
}

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
    const [profile, checkins, metrics, reflections] = await Promise.all([
      ctx.supabase.from('profiles').select('display_name, memory').maybeSingle(),
      ctx.supabase
        .from('checkins')
        .select('id, created_at, title, summary, follow_ups')
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3),
      ctx.supabase
        .from('daily_metrics')
        .select('day, stress, emotion, sleep')
        .order('day', { ascending: false })
        .limit(7),
      ctx.supabase
        .from('reflections')
        .select('question, answer')
        .order('updated_at', { ascending: false })
        .limit(3),
    ]);

    const related = await findRelated(ctx.supabase, messages, (checkins.data ?? []).map((c) => c.id));

    const system = buildCheckinSystemPrompt(
      {
        name: profile.data?.display_name ?? null,
        memory: profile.data?.memory ?? '',
        recentCheckins: checkins.data ?? [],
        recentMetrics: metrics.data ?? [],
        reflections: reflections.data ?? [],
        related,
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
