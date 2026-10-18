/**
 * checkin-chat — one turn of the AI check-in conversation.
 *
 * Request:  POST { messages: [{ role: 'user' | 'assistant', content }] }
 *           (empty list = start a new check-in; the AI opens)
 * Response: the AI's reply, streamed as plain text chunks.
 *
 * Runs as the calling user (RLS applies), so it can only load their own data.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { getLLM, type ChatMessage } from '../_shared/llm/index.ts';
import { buildCheckinSystemPrompt, START_CHECKIN_MESSAGE } from '../_shared/prompts.ts';

const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 4000;

function parseMessages(body: unknown): ChatMessage[] | null {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) return null;
  for (const m of messages) {
    if (
      !m ||
      (m.role !== 'user' && m.role !== 'assistant') ||
      typeof m.content !== 'string' ||
      m.content.length > MAX_MESSAGE_LENGTH
    ) {
      return null;
    }
  }
  return messages as ChatMessage[];
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }

    const messages = parseMessages(await req.json().catch(() => null));
    if (!messages) {
      return Response.json(
        { error: `Send { messages: [...] } with at most ${MAX_MESSAGES} messages of up to ${MAX_MESSAGE_LENGTH} characters.` },
        { status: 400 },
      );
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
      new Date().toISOString().slice(0, 10),
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
    const body = new ReadableStream<Uint8Array>({
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

    return new Response(body, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  }),
};
