/**
 * Community: sharing success stories anonymously.
 *
 * Before anything is shown to others, one structured-output call reviews it:
 * it rewrites the story without personal details (names, places, employers,
 * dates…), lists what it removed, and checks the community rules. The user
 * sees that anonymized preview and decides; publishing reviews the final
 * text once more, so edits can't sneak personal details or harmful content in.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Embedder, LLMProvider } from './llm/index.ts';

export type StoryText = { title: string; situation: string; solution: string; comment: string };

export type Review = StoryText & {
  allowed: boolean;
  /** Short, kind explanation for the user when not allowed. */
  reason: string;
  crisis: boolean;
  /** Personal details found in the text that was reviewed (and removed in the rewrite). */
  personal_details: string[];
};

const text = (description: string) => ({ type: 'string', description });

export const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['allowed', 'reason', 'crisis', 'personal_details', 'title', 'situation', 'solution', 'comment'],
  properties: {
    allowed: { type: 'boolean' },
    reason: text('If not allowed: one short, kind sentence for the user explaining why. Otherwise empty.'),
    crisis: { type: 'boolean', description: 'True if the text mentions self-harm, suicide or being in danger.' },
    personal_details: {
      type: 'array',
      items: { type: 'string' },
      description: 'Every identifying detail in the original text, e.g. "Lukas", "TU Berlin", "on 14 October". Empty if none.',
    },
    title: text('Anonymized title, max 6 words.'),
    situation: text('Anonymized situation, first person ("I…"), 1–2 sentences.'),
    solution: text('Anonymized "what helped", first person, 1–2 sentences, keeping the concrete strategy.'),
    comment: text('Anonymized personal comment, first person. Empty if the original is empty.'),
  },
} as const;

const REVIEW_PROMPT = `You review a success story before it is shared anonymously in the peer-support community of Destress AI, a stress-management app. Readers are other users looking for strategies that helped real people.

1. Anonymize: rewrite title, situation, solution and comment so nobody could identify the author or anyone they mention. Remove or generalize names of people, places, universities, employers, courses, exact dates and other identifying details ("Lukas" → "a teammate", "TU Berlin" → "my university", "on Friday" → "soon"). Keep the meaning, the concrete strategy and the author's voice. Write in the first person ("I…"), in the original language. Don't add anything new.
2. personal_details: list every identifying detail you found in the original text. Empty if there were none. Identifying means it could point to a specific person, place or organization: names, handles, contact details, named institutions, employers, courses, addresses, exact calendar dates. Ordinary time words ("tomorrow", "9am", "next week") and generic roles ("a teammate", "my boss") are not identifying.
3. Rules. Set allowed to false if the text contains: self-harm or suicide content, medical or medication advice, attacks on or mockery of others, sexual or hateful content, advertising, or nothing about coping with stress. Strong emotions and honest struggles are fine.
4. crisis: true if the text mentions self-harm, suicide or being in danger.`;

export async function reviewStory(llm: LLMProvider, story: StoryText): Promise<Review> {
  const review = await llm.generateJson<Review>({
    task: 'analysis',
    system: REVIEW_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Title: ${story.title}\nSituation: ${story.situation}\nWhat helped: ${story.solution}\nComment: ${story.comment || '(none)'}`,
      },
    ],
    schemaName: 'story_review',
    schema: REVIEW_SCHEMA,
  });
  return {
    ...review,
    title: review.title.trim().slice(0, 80),
    situation: review.situation.trim(),
    solution: review.solution.trim(),
    comment: review.comment.trim(),
  };
}

/** The text a published story is embedded with, for "For you" matching. */
export const storyDocument = (s: StoryText) => `${s.title}\n${s.situation}\n${s.solution}`;

/**
 * The example stories ship without embeddings (a migration can't call the
 * AI). This fills them in once; afterwards it's a single cheap query.
 */
export async function indexExampleStories(db: SupabaseClient, embedder: Embedder): Promise<void> {
  const { data, error } = await db.rpc('examples_without_embedding');
  if (error) throw error;
  const rows = (data ?? []) as { id: string; content: string }[];
  if (!rows.length) return;
  const vectors = await embedder.embed(rows.map((r) => r.content));
  await Promise.all(
    rows.map((r, i) => db.rpc('set_example_embedding', { p_story: r.id, p_embedding: JSON.stringify(vectors[i]) })),
  );
}
