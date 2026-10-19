/**
 * community-comment — adds a comment under a published story.
 *
 * Request:  POST { storyId, text }
 * Response: { comment: { id, body, created_at, is_mine, is_example } }
 *           or 422 { error } when the comment isn't allowed
 *
 * Every comment is checked first (one structured-output call): personal
 * details are removed and the community rules applied. Users can't insert
 * comments directly (no RLS policy), so this check can't be skipped; the
 * insert uses the server-only service role.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { checkQuota } from '../_shared/quota.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { reviewComment } from '../_shared/community.ts';
import { getLLM } from '../_shared/llm/index.ts';

const MAX_COMMENT = 1000;

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }
    const overQuota = await checkQuota(ctx.supabase);
    if (overQuota) return overQuota;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const storyId = typeof body?.storyId === 'string' ? body.storyId : null;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!storyId || !text || text.length > MAX_COMMENT) {
      return Response.json({ error: `Send { storyId, text } (max ${MAX_COMMENT} characters).` }, { status: 400 });
    }

    // Only published, visible stories can be commented on.
    const { data: story } = await ctx.supabase.rpc('community_story', { p_story: storyId }).maybeSingle();
    if (!story) return Response.json({ error: 'Story not found.' }, { status: 404 });

    let review;
    try {
      review = await reviewComment(getLLM(), text);
    } catch (err) {
      console.error('Comment review failed:', err);
      return Response.json({ error: 'Could not check your comment. Try again.' }, { status: 502 });
    }
    if (review.crisis || !review.allowed || !review.text) {
      return Response.json(
        { error: review.reason || "This comment can't be posted.", crisis: review.crisis },
        { status: 422 },
      );
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const { data, error } = await admin
      .from('story_comments')
      .insert({ story_id: storyId, user_id: ctx.userClaims!.id, body: review.text })
      .select('id, body, created_at')
      .single();
    if (error) {
      console.error('Saving the comment failed:', error);
      return Response.json({ error: 'Could not post your comment. Try again.' }, { status: 500 });
    }
    return Response.json({ comment: { ...data, is_mine: true, is_example: false } });
  }),
};
