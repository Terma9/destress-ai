/**
 * community-publish — shares a success story anonymously, as a blog post.
 *
 * Request:  POST { storyId, action: 'preview', draft? }
 *           → { review }  the anonymized post + rule check, nothing is saved.
 *             Without a draft, the AI writes the post from the story and the
 *             user's own words while solving it; with a draft, it only anonymizes.
 *           POST { storyId, action: 'publish', title, body }
 *           → { ok: true } or 422 { error }  (the final, possibly edited text)
 *
 * The final text is reviewed again before saving, so edits can't add
 * personal details or break the rules. Saving the public copy needs the
 * server-only service role: users can't set a story to published themselves
 * (column privileges), so moderation can't be skipped.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { checkQuota } from '../_shared/quota.ts';
import { startTrace } from '../_shared/tracing.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { indexExampleStories, reviewStory, storyDocument, storyMaterial } from '../_shared/community.ts';
import { getEmbedder, getLLM } from '../_shared/llm/index.ts';

const MAX_TITLE = 120;
const MAX_BODY = 4000;

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim().length <= max ? v.trim() : null);

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }
    const overQuota = await checkQuota(ctx.supabase);
    if (overQuota) return overQuota;
    const trace = startTrace('community-publish', req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const storyId = typeof body?.storyId === 'string' ? body.storyId : null;
    const action = body?.action;
    if (!storyId || (action !== 'preview' && action !== 'publish')) {
      return Response.json({ error: "Send { storyId, action: 'preview' | 'publish' }." }, { status: 400 });
    }

    // RLS: only the author can load their story (and the plan behind it).
    const { data: story } = await ctx.supabase
      .from('success_stories')
      .select('id, title, situation, solution, comment, body, untangle_sessions(messages, plan)')
      .eq('id', storyId)
      .maybeSingle();
    if (!story) return Response.json({ error: 'Story not found.' }, { status: 404 });

    const llm = getLLM(trace);

    if (action === 'preview') {
      const draft = str(body?.draft, MAX_BODY) ?? story.body ?? '';
      const session = story.untangle_sessions as unknown as {
        messages: { role: string; content: string }[];
        plan: { approach?: string; steps: { text: string; done: boolean }[] } | null;
      } | null;
      const userWords = (session?.messages ?? [])
        .filter((m) => m.role === 'user')
        .map((m) => m.content.trim())
        .slice(-12);
      try {
        const review = await reviewStory(llm, {
          title: story.title,
          draft: draft || undefined,
          material: storyMaterial(
            { title: story.title, situation: story.situation, solution: story.solution, comment: story.comment ?? '' },
            session?.plan ?? null,
            userWords,
          ),
        });
        return Response.json({ review });
      } catch (err) {
        console.error('Review failed:', err);
        return Response.json({ error: 'Could not prepare your story. Try again.' }, { status: 502 });
      }
    }

    const title = str(body?.title, MAX_TITLE);
    const text = str(body?.body, MAX_BODY);
    if (!title || !text) {
      return Response.json({ error: `A title and your story are required (max ${MAX_BODY} characters).` }, { status: 400 });
    }

    let review;
    try {
      review = await reviewStory(llm, { title, draft: text });
    } catch (err) {
      console.error('Review failed:', err);
      return Response.json({ error: 'Could not check your story. Try again.' }, { status: 502 });
    }
    if (review.crisis || !review.allowed) {
      return Response.json(
        { error: review.reason || "This story can't be shared in the community.", crisis: review.crisis },
        { status: 422 },
      );
    }
    if (review.personal_details.length) {
      return Response.json(
        { error: `It still contains personal details: ${review.personal_details.join(', ')}. Please remove them.` },
        { status: 422 },
      );
    }

    try {
      const embedder = getEmbedder(trace);
      const [vector] = await embedder.embed([storyDocument({ title, body: text })]);
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false },
      });
      const { error } = await admin
        .from('success_stories')
        .update({
          status: 'published',
          public_title: title,
          public_body: text,
          published_at: new Date().toISOString(),
          embedding: JSON.stringify(vector),
        })
        .eq('id', story.id)
        .eq('user_id', ctx.userClaims!.id);
      if (error) throw error;

      // Keep the example stories matchable for "For you" (a no-op once done).
      await indexExampleStories(ctx.supabase, embedder).catch((err) => console.error('Indexing examples failed:', err));
    } catch (err) {
      console.error('Publishing failed:', err);
      return Response.json({ error: 'Could not publish your story. Try again.' }, { status: 500 });
    }
    return Response.json({ ok: true });
  }),
};
