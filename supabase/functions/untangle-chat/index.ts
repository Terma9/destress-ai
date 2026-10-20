/**
 * untangle-chat — one turn of an Untangle conversation, in one of two modes.
 *
 * Request:  POST { messages: [...], intensity: 0–10, mode: 'calm' | 'plan', sessionId?, breathed? }
 * Response: the AI's reply, streamed as plain text.
 *
 * calm — "Calm Now": calming, small tips, no plan.
 * plan — "Stress Solving": questions until "Make my plan"; with sessionId the
 *        user is telling how their existing plan goes.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { checkQuota } from '../_shared/quota.ts';
import { startTrace } from '../_shared/tracing.ts';
import { getEmbedder, getLLM } from '../_shared/llm/index.ts';
import { buildCalmPrompt, buildUntangleChatPrompt, loadPlanSession, loadUntangleContext, PROMPT_VERSION } from '../_shared/untangle.ts';
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

    const calm = (body as { mode?: unknown })?.mode === 'calm';
    // Calm Now and Stress Solving share this function; in Langfuse they are two features.
    const trace = startTrace(calm ? 'calm-now' : 'stress-solving', req, { prompt_version: PROMPT_VERSION });

    let system: string;
    let llm;
    try {
      const context = await loadUntangleContext(ctx.supabase, getEmbedder(trace), messages);
      if (calm) {
        system = buildCalmPrompt(context, intensity, (body as { breathed?: unknown }).breathed === true);
      } else {
        const session = await loadPlanSession(ctx.supabase, body);
        const answered = messages.filter((m) => m.role === 'user').length - 1;
        system = buildUntangleChatPrompt(context, intensity, answered, session?.plan ?? null);
      }
      llm = getLLM(trace);
    } catch (err) {
      console.error('Preparing Untangle chat failed:', err);
      return Response.json({ error: 'Could not start the conversation. Try again.' }, { status: 500 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of llm.streamChat({ system, messages })) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          console.error(`[${llm.name}] untangle chat failed:`, err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  }),
};
