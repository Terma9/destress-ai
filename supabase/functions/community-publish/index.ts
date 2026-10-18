/**
 * community-publish — shares a success story anonymously.
 *
 * Request:  POST { storyId, action: 'preview' }
 *           → { review }  the anonymized text + rule check, nothing is saved
 *           POST { storyId, action: 'publish', title, situation, solution, comment }
 *           → { ok: true } or 422 { error }  (the final, possibly edited text)
 *
 * The final text is reviewed again before saving, so edits can't add
 * personal details or break the rules. Saving the public copy needs the
 * server-only service role: users can't set a story to published themselves
 * (column privileges), so moderation can't be skipped.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { indexExampleStories, reviewStory, storyDocument, type StoryText } from '../_shared/community.ts';
import { getEmbedder, getLLM } from '../_shared/llm/index.ts';

const MAX_FIELD = 1000;

function parseText(body: Record<string, unknown>): StoryText | null {
  const fields = ['title', 'situation', 'solution', 'comment'] as const;
  const out = {} as StoryText;
  for (const f of fields) {
    const v = body[f] ?? '';
    if (typeof v !== 'string' || v.length > MAX_FIELD) return null;
    out[f] = v.trim();
  }
  return out.title && out.situation && out.solution ? out : null;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const storyId = typeof body?.storyId === 'string' ? body.storyId : null;
    const action = body?.action;
    if (!storyId || (action !== 'preview' && action !== 'publish')) {
      return Response.json({ error: "Send { storyId, action: 'preview' | 'publish' }." }, { status: 400 });
    }

    // RLS: only the author can load their story.
    const { data: story } = await ctx.supabase
      .from('success_stories')
      .select('id, title, situation, solution, comment')
      .eq('id', storyId)
      .maybeSingle();
    if (!story) return Response.json({ error: 'Story not found.' }, { status: 404 });

    const llm = getLLM();

    if (action === 'preview') {
      try {
        const review = await reviewStory(llm, {
          title: story.title,
          situation: story.situation,
          solution: story.solution,
          comment: (typeof body.comment === 'string' ? body.comment : story.comment) ?? '',
        });
        return Response.json({ review });
      } catch (err) {
        console.error('Review failed:', err);
        return Response.json({ error: 'Could not prepare your story. Try again.' }, { status: 502 });
      }
    }

    const final = parseText(body);
    if (!final) {
      return Response.json({ error: 'Title, situation and what helped are required (max 1000 characters each).' }, { status: 400 });
    }

    let review;
    try {
      review = await reviewStory(llm, final);
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
      const embedder = getEmbedder();
      const [vector] = await embedder.embed([storyDocument(final)]);
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false },
      });
      const { error } = await admin
        .from('success_stories')
        .update({
          status: 'published',
          public_title: final.title,
          public_situation: final.situation,
          public_solution: final.solution,
          public_comment: final.comment || null,
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
