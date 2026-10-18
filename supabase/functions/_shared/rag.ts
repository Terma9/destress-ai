/**
 * RAG (retrieval-augmented generation) for check-ins: "small-to-big".
 *
 * Indexing:  after a check-in, the extraction model splits it into topics.
 *            Each topic becomes one chunk = its summary + the user's own
 *            messages about it, and gets its own embedding. Small, focused
 *            chunks match a search sharply, even in long check-ins that
 *            cover many topics.
 * Retrieval: a query is embedded the same way; match_chunks finds the
 *            closest chunks, and we keep the best one per check-in.
 *            The chat then gets the whole conversation of those check-ins
 *            (the "big" part), which carries all the details.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { ChatMessage, Embedder } from './llm/index.ts';

/** Below this similarity a "match" is usually only loosely related. Tuned on the demo persona. */
export const MIN_SIMILARITY = 0.3;

/** `topic` = fixed category (countable), `title` = free-text name (precise). */
export type Chunk = { topic: string; title: string; summary: string; content: string };

export type Match = {
  checkin_id: string;
  created_at: string;
  title: string | null;
  summary: string | null;
  mood: string | null;
  topic: string;
  /** The matched chunk's title; null for chunks indexed before titles existed. */
  topic_title: string | null;
  chunk_summary: string;
  similarity: number;
};

const userMessages = (messages: ChatMessage[]) => messages.filter((m) => m.role === 'user').map((m) => m.content.trim());

/**
 * Builds the topic chunks from the extraction's topics. The model only names
 * message labels ("U2"); the user's words are filled in here verbatim, so
 * nothing gets paraphrased. Falls back to one whole-check-in chunk.
 */
export function topicChunks(
  checkin: { title: string | null; summary: string | null; messages: ChatMessage[] },
  topics: { topic: string; title: string; summary: string; messages: string[] }[],
): Chunk[] {
  const said = userMessages(checkin.messages);
  const chunks = topics.flatMap((t) => {
    const words = [...new Set(t.messages)]
      .map((label) => said[Number(label.replace(/\D/g, '')) - 1])
      .filter((w): w is string => !!w);
    const summary = t.summary.trim();
    if (!summary) return [];
    const title = t.title.trim().slice(0, 60) || t.topic;
    // The title is embedded too: it names the topic precisely ("Statistics resit").
    const content = `${title} (${t.topic}): ${summary}${words.length ? `\nIn their words: ${words.join(' / ')}` : ''}`;
    return [{ topic: t.topic, title, summary, content: content.slice(0, 6000) }];
  });
  return chunks.length ? chunks : [wholeChunk(checkin)];
}

/** One chunk for the whole check-in: for older entries and demo data without topics. */
export function wholeChunk(c: { title: string | null; summary: string | null; messages: ChatMessage[] }): Chunk {
  const summary = c.summary ?? c.title ?? 'Check-in';
  const content = `${c.title ?? 'Check-in'}\n${summary}\nIn their words: ${userMessages(c.messages).join(' / ')}`;
  return { topic: 'all', title: c.title ?? 'Check-in', summary, content: content.slice(0, 6000) };
}

/** Embeds the chunks (one request) and stores them for the check-in. */
export async function saveChunks(db: SupabaseClient, embedder: Embedder, checkinId: string, chunks: Chunk[]) {
  const vectors = await embedder.embed(chunks.map((c) => c.content));
  const { error } = await db.from('checkin_chunks').insert(
    chunks.map((c, i) => ({ ...c, checkin_id: checkinId, embedding: JSON.stringify(vectors[i]) })),
  );
  if (error) throw error;
}

/**
 * Indexes check-ins that have no chunks yet (older entries, demo data, or
 * where indexing failed) as one whole-check-in chunk each. Safe to call
 * often: once everything is indexed it's a single cheap query.
 */
export async function indexMissing(db: SupabaseClient, embedder: Embedder, limit = 50): Promise<number> {
  const { data, error } = await db
    .from('checkins')
    .select('id, title, summary, messages, checkin_chunks(id)')
    .not('completed_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const missing = (data ?? []).filter((c) => !c.checkin_chunks.length).slice(0, limit);
  if (!missing.length) return 0;

  const chunks = missing.map((c) => wholeChunk(c as { title: string | null; summary: string | null; messages: ChatMessage[] }));
  const vectors = await embedder.embed(chunks.map((c) => c.content));
  const { error: insertError } = await db.from('checkin_chunks').insert(
    chunks.map((c, i) => ({ ...c, checkin_id: missing[i].id, embedding: JSON.stringify(vectors[i]) })),
  );
  if (insertError) throw insertError;
  return missing.length;
}

/** Check-ins closest in meaning to `query`: the best chunk per check-in, most similar first. */
export async function searchCheckins(
  db: SupabaseClient,
  embedder: Embedder,
  query: string,
  count = 5,
): Promise<Match[]> {
  const [vector] = await embedder.embed([query]);
  const { data, error } = await db.rpc('match_chunks', {
    query_embedding: JSON.stringify(vector),
    match_count: count * 4, // several chunks can belong to the same check-in
  });
  if (error) throw error;

  const best = new Map<string, Match>();
  for (const m of data as Match[]) {
    if (m.similarity >= MIN_SIMILARITY && !best.has(m.checkin_id)) best.set(m.checkin_id, m);
  }
  return [...best.values()].slice(0, count);
}
