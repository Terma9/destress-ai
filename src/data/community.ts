/**
 * Success stories and the community feed.
 *
 * Own stories are read directly (RLS: owner only). Other people's published
 * stories come only from the community_feed() database function, which
 * never returns who wrote them. Publishing goes through the
 * community-publish Edge Function (anonymization + moderation); voting,
 * reporting and unpublishing are database functions.
 */
import { fetch } from 'expo/fetch';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type SuccessStory = {
  id: string;
  created_at: string;
  theme: string;
  title: string;
  situation: string;
  solution: string;
  comment: string | null;
  intensity_before: number | null;
  intensity_after: number | null;
  status: 'private' | 'published';
  public_title: string | null;
  public_situation: string | null;
  public_solution: string | null;
  public_comment: string | null;
};

export type FeedStory = {
  id: string;
  theme: string;
  title: string;
  situation: string;
  solution: string;
  comment: string | null;
  intensity_before: number | null;
  intensity_after: number | null;
  published_at: string;
  helpful: number;
  my_vote: -1 | 1 | null;
  is_mine: boolean;
  is_example: boolean;
  relevance: number | null;
};

export type StoryText = { title: string; situation: string; solution: string; comment: string };

export type Review = StoryText & { allowed: boolean; reason: string; crisis: boolean; personal_details: string[] };

export const THEME_LABELS: Record<string, string> = {
  study: 'Study',
  work: 'Work',
  sleep: 'Sleep',
  family: 'Family',
  relationships: 'Relationships',
  social: 'Social',
  health: 'Health',
  money: 'Money',
  other: 'Other',
};

const STORY_COLUMNS =
  'id, created_at, theme, title, situation, solution, comment, intensity_before, intensity_after, status, public_title, public_situation, public_solution, public_comment';

export async function fetchMyStories(): Promise<SuccessStory[]> {
  const { data, error } = await supabase.from('success_stories').select(STORY_COLUMNS).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as SuccessStory[];
}

export async function fetchMyStory(id: string): Promise<SuccessStory | null> {
  const { data, error } = await supabase.from('success_stories').select(STORY_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SuccessStory | null;
}

export async function saveComment(id: string, comment: string) {
  const { error } = await supabase.from('success_stories').update({ comment: comment || null }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchFeed(options: { theme?: string | null; forMe?: boolean } = {}): Promise<FeedStory[]> {
  const { data, error } = await supabase.rpc('community_feed', {
    p_theme: options.theme ?? null,
    p_for_me: options.forMe ?? false,
  });
  if (error) throw new Error(error.message);
  return data as FeedStory[];
}

/** 1 = helpful, -1 = not helpful for me (only lowers the ranking), 0 = remove the vote. */
export async function voteStory(id: string, value: -1 | 0 | 1) {
  const { error } = await supabase.rpc('vote_story', { p_story: id, p_value: value });
  if (error) throw new Error(error.message);
}

export async function reportStory(id: string, reason: string) {
  const { error } = await supabase.rpc('report_story', { p_story: id, p_reason: reason });
  if (error) throw new Error(error.message);
}

export async function unpublishStory(id: string) {
  const { error } = await supabase.rpc('unpublish_story', { p_story: id });
  if (error) throw new Error(error.message);
}

async function publishCall(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/community-publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session?.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status}).`);
  return json;
}

/** The anonymized version and rule check, without saving anything. */
export async function previewStory(id: string, comment: string): Promise<Review> {
  return (await publishCall({ storyId: id, action: 'preview', comment })).review as Review;
}

/** Publishes the final text; the server reviews it once more and may refuse with a reason. */
export async function publishStory(id: string, text: StoryText) {
  await publishCall({ storyId: id, action: 'publish', ...text });
}

export function useMyStories() {
  const [stories, setStories] = useState<SuccessStory[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      fetchMyStories()
        .then(setStories)
        .catch(() => setStories([]));
    }, []),
  );
  return stories;
}
