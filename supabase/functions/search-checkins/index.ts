/**
 * search-checkins — finds the user's check-ins by meaning.
 *
 * Request:  POST { query: 'when was I calm?' }
 * Response: { results: [{ id, created_at, title, summary, mood, topic, chunk_summary, similarity }] }
 *
 * Searches the topic chunks and returns the best match per check-in. Also
 * indexes check-ins that have no chunks yet, so older entries become
 * searchable the first time someone searches.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { checkQuota } from '../_shared/quota.ts';
import { getEmbedder } from '../_shared/llm/index.ts';
import { indexMissing, searchCheckins } from '../_shared/rag.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }
    const overQuota = await checkQuota(ctx.supabase);
    if (overQuota) return overQuota;
    const body = await req.json().catch(() => null);
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    if (!query || query.length > 300) {
      return Response.json({ error: 'Send { query } with 1–300 characters.' }, { status: 400 });
    }

    try {
      const embedder = getEmbedder();
      await indexMissing(ctx.supabase, embedder);
      const matches = await searchCheckins(ctx.supabase, embedder, query);
      const results = matches.map(({ checkin_id, ...m }) => ({ id: checkin_id, ...m }));
      return Response.json({ results });
    } catch (err) {
      console.error('Search failed:', err);
      return Response.json({ error: 'Search failed. Try again.' }, { status: 502 });
    }
  }),
};
