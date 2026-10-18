/**
 * RAG (retrieval-augmented generation) for check-ins.
 *
 * Indexing:  each finished check-in is turned into one text ("document"),
 *            embedded, and the vector is stored in checkins.embedding.
 * Retrieval: a query text is embedded the same way, and match_checkins
 *            returns the check-ins whose vectors are closest — by meaning,
 *            not by shared words, and across languages.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { ChatMessage, Embedder } from './llm/index.ts';

/** Below this similarity a "match" is usually only loosely related. Tuned on the demo persona. */
export const MIN_SIMILARITY = 0.3;

export type Match = {
  id: string;
  created_at: string;
  title: string | null;
  summary: string | null;
  mood: string | null;
  helped: string[];
  similarity: number;
};

/** What gets embedded for a check-in: the AI's summary plus the user's own words. */
export function checkinDocument(c: { title: string | null; summary: string | null; messages: ChatMessage[] }): string {
  const words = c.messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .join(' / ');
  return `${c.title ?? 'Check-in'}\n${c.summary ?? ''}\nIn their words: ${words}`.slice(0, 6000);
}

/**
 * Embeds the user's check-ins that don't have a vector yet (older entries,
 * or ones where embedding failed). Safe to call often: it does nothing when
 * everything is embedded.
 */
export async function embedMissing(db: SupabaseClient, embedder: Embedder, limit = 50): Promise<number> {
  const { data: rows, error } = await db
    .from('checkins')
    .select('id, title, summary, messages')
    .is('embedding', null)
    .not('completed_at', 'is', null)
    .limit(limit);
  if (error) throw error;
  if (!rows?.length) return 0;

  const vectors = await embedder.embed(rows.map(checkinDocument));
  await Promise.all(
    rows.map((row, i) => db.from('checkins').update({ embedding: JSON.stringify(vectors[i]) }).eq('id', row.id)),
  );
  return rows.length;
}

/** The user's check-ins closest in meaning to `query`, most similar first. */
export async function searchCheckins(
  db: SupabaseClient,
  embedder: Embedder,
  query: string,
  count = 5,
): Promise<Match[]> {
  const [vector] = await embedder.embed([query]);
  const { data, error } = await db.rpc('match_checkins', {
    query_embedding: JSON.stringify(vector),
    match_count: count,
  });
  if (error) throw error;
  return (data as Match[]).filter((m) => m.similarity >= MIN_SIMILARITY);
}
