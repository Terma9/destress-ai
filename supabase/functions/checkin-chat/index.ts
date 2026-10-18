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
import { buildCheckinSystemPrompt, START_CHECKIN_MESSAGE, type UserContext } from '../_shared/prompts.ts';
import { indexMissing, relatedConversations } from '../_shared/rag.ts';
import { fetchOpenPlans } from '../_shared/untangle.ts';
import { INVALID_MESSAGES_ERROR, parseDay, parseLanguage, parseMessages } from '../_shared/validation.ts';

/** How many older conversations RAG may add to the prompt. Each is a whole check-in, so keep it small. */
const MAX_RELATED = 2;

type Related = UserContext['related'][number];

/**
 * RAG, small-to-big: find the topic chunks closest to what the user just
 * said, then hand the model the whole conversations they come from, so it
 * can recall details (e.g. what helped before a previous exam). Skips the
 * recent check-ins (already in the prompt). Never blocks the chat: on any
 * error the conversation simply continues without these.
 */
async function findRelated(
  db: Parameters<typeof indexMissing>[0],
  messages: ChatMessage[],
  recentIds: string[],
): Promise<Related[]> {
  try {
    const embedder = getEmbedder();
    if (!messages.length) {
      // New check-in: make sure older entries are indexed. A no-op once they are.
      await indexMissing(db, embedder);
      return [];
    }
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return [];
    return await relatedConversations(db, embedder, lastUser.content, { excludeIds: recentIds, max: MAX_RELATED });
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
    const [profile, checkins, metrics, reflections, openPlans] = await Promise.all([
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
      fetchOpenPlans(ctx.supabase).catch((err) => {
        console.error('Loading open plans failed:', err);
        return [];
      }),
    ]);

    const related = await findRelated(ctx.supabase, messages, (checkins.data ?? []).map((c) => c.id));

    const system = buildCheckinSystemPrompt(
      {
        name: profile.data?.display_name ?? null,
        memory: profile.data?.memory ?? '',
        recentCheckins: checkins.data ?? [],
        recentMetrics: metrics.data ?? [],
        reflections: reflections.data ?? [],
        openPlans,
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
