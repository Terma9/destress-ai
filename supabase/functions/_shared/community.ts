/**
 * Community: sharing success stories anonymously, as small personal blog posts.
 *
 * Before anything is shown to others, one structured-output call reviews it:
 * it writes (or, for the user's own draft, only anonymizes) the post without
 * personal details (names, places, employers, dates…), lists what it removed,
 * and checks the community rules. The user sees and edits that preview;
 * publishing reviews the final text once more, so edits can't sneak personal
 * details or harmful content in. Comments go through the same kind of check.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Embedder, LLMProvider } from './llm/index.ts';

export type StoryText = { title: string; situation: string; solution: string; comment: string };

/** A blog post: what is reviewed and published. */
export type Post = { title: string; body: string };

export type Review = Post & {
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
  required: ['allowed', 'reason', 'crisis', 'personal_details', 'title', 'body'],
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
    body: text('The anonymized blog post, first person, 6–12 sentences.'),
  },
} as const;

const ANONYMIZE = `Remove or generalize names of people, places, universities, employers, courses, exact dates and other identifying details ("Lukas" → "a teammate", "TU Berlin" → "my university", "on 14 October" → "one evening").`;

const REVIEW_PROMPT = `You prepare a personal story before it is shared anonymously as a short blog post in the peer-support community of Destress AI, a stress-management app. Readers are other users looking for honest stories of what helped real people.

1. The post:
   - If the input contains a "Draft" by the author, keep it as it is and only anonymize it (and fix nothing else). Their voice matters more than polish.
   - Otherwise write the post from their own words: first person ("I…"), 6–12 sentences, natural and personal like a short blog post, not like a report. Tell it as a story: how stressed they were and what it felt like, what they tried, what didn't work at first, what helped in the end, and what they would tell others. Use only what is in the input; don't invent events, feelings or results. Write in the language of their words.
   Anonymize either way: ${ANONYMIZE} The title: max 6 words, personal, anonymized.
2. personal_details: list every identifying detail you found in the input. Empty if there were none. Identifying means it could point to a specific person, place or organization: names, handles, contact details, named institutions, employers, courses, addresses, exact calendar dates. Ordinary time words ("tomorrow", "9am", "next week") and generic roles ("a teammate", "my boss") are not identifying.
3. Rules. Set allowed to false if the text contains: self-harm or suicide content, medical or medication advice, attacks on or mockery of others, sexual or hateful content, advertising, or nothing about coping with stress. Strong emotions and honest struggles are fine.
4. crisis: true if the text mentions self-harm, suicide or being in danger.`;

/**
 * Reviews a post. `material` is what the post is written from (the story and
 * the user's own words from the plan conversation); `draft` is the author's
 * own text, which is only anonymized, never rewritten.
 */
export async function reviewStory(llm: LLMProvider, input: { title: string; material?: string; draft?: string }): Promise<Review> {
  const content = input.draft
    ? `Title: ${input.title}\n\nDraft:\n${input.draft}`
    : `Title: ${input.title}\n\n${input.material ?? ''}`;
  const review = await llm.generateJson<Review>({
    task: 'analysis',
    system: REVIEW_PROMPT,
    messages: [{ role: 'user', content }],
    schemaName: 'story_review',
    schema: REVIEW_SCHEMA,
  });
  return { ...review, title: review.title.trim().slice(0, 80), body: review.body.trim() };
}

/** What a post is written from: the story plus the user's own words while solving it. */
export function storyMaterial(story: StoryText, plan: { approach?: string; steps: { text: string; done: boolean }[] } | null, userWords: string[]): string {
  return [
    `Situation: ${story.situation}`,
    `What helped: ${story.solution}`,
    story.comment ? `Their comment: ${story.comment}` : '',
    plan ? `Their plan: ${plan.approach ?? ''} Steps: ${plan.steps.map((s) => `${s.done ? '(done) ' : ''}${s.text}`).join('; ')}` : '',
    userWords.length ? `In their own words while working on it:\n${userWords.map((w) => `- ${w}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** The text a published post is embedded with, for "For you" matching. */
export const storyDocument = (p: Post) => `${p.title}\n${p.body}`;

// ─── Comments ────────────────────────────────────────────────────────────

export type CommentReview = { allowed: boolean; reason: string; crisis: boolean; text: string };

export const COMMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['allowed', 'reason', 'crisis', 'text'],
  properties: {
    allowed: { type: 'boolean' },
    reason: text('If not allowed: one short, kind sentence for the user explaining why. Otherwise empty.'),
    crisis: { type: 'boolean', description: 'True if the comment mentions self-harm, suicide or being in danger.' },
    text: text('The anonymized comment; otherwise unchanged.'),
  },
} as const;

const COMMENT_PROMPT = `You check a comment before it appears under a personal story in the peer-support community of Destress AI, a stress-management app.

1. Anonymize: ${ANONYMIZE} Change nothing else; keep their words and tone.
2. Set allowed to false if the comment: attacks, mocks or judges the author or others; gives medical or medication advice; contains self-harm or suicide content, sexual or hateful content, advertising or links; or is spam. Supportive words, own experiences, questions and gentle tips are welcome.
3. crisis: true if it mentions self-harm, suicide or being in danger.`;

export async function reviewComment(llm: LLMProvider, comment: string): Promise<CommentReview> {
  const review = await llm.generateJson<CommentReview>({
    task: 'extract',
    system: COMMENT_PROMPT,
    messages: [{ role: 'user', content: comment }],
    schemaName: 'comment_review',
    schema: COMMENT_SCHEMA,
  });
  return { ...review, text: review.text.trim().slice(0, 1000) };
}

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
