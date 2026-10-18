-- Success stories and the community.
--
-- 1. The next check-in asks how an Untangle plan went; the outcome is saved
--    on the session.
-- 2. When it worked, a private success story is created for the user.
-- 3. The user can publish it: an anonymized, moderated copy (public_*)
--    becomes visible to others, who can vote on it.
--
-- Anonymity is enforced in the database: other users never read
-- success_stories directly (RLS only allows the owner). They read
-- published stories through community_feed(), which never returns user_id.

-- ─── Outcome of an Untangle plan ─────────────────────────────────────────
alter table public.untangle_sessions
  add column outcome      text check (outcome in ('worked', 'partly', 'not_yet')),
  add column outcome_note text,          -- what made the difference, from the check-in
  add column outcome_at   timestamptz;

-- ─── success_stories ─────────────────────────────────────────────────────
create table public.success_stories (
  id               uuid primary key default gen_random_uuid(),
  -- null only for the app's example stories
  user_id          uuid default auth.uid() references auth.users (id) on delete cascade,
  session_id       uuid unique references public.untangle_sessions (id) on delete set null,
  created_at       timestamptz not null default now(),
  theme            text not null,
  title            text not null,
  situation        text not null,
  solution         text not null,
  comment          text,               -- the user's own words, optional
  intensity_before smallint check (intensity_before between 0 and 10),
  intensity_after  smallint check (intensity_after between 0 and 10),
  -- The published copy: anonymized and moderated. Only these are ever shown to others.
  status           text not null default 'private' check (status in ('private', 'published')),
  public_title     text,
  public_situation text,
  public_solution  text,
  public_comment   text,
  published_at     timestamptz,
  is_example       boolean not null default false,
  embedding        extensions.vector(1536)  -- of the published text, for "For you"
);

create index success_stories_user_idx on public.success_stories (user_id, created_at desc);
create index success_stories_published_idx on public.success_stories (published_at desc) where status = 'published';

alter table public.success_stories enable row level security;

create policy "Users manage their own success stories" on public.success_stories
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.success_stories to authenticated;

-- ─── Votes and reports ───────────────────────────────────────────────────
-- Written only through the functions below, which check that the story is published.
create table public.story_votes (
  story_id uuid not null references public.success_stories (id) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  value    smallint not null check (value in (-1, 1)),
  primary key (story_id, user_id)
);

create table public.story_reports (
  story_id   uuid not null references public.success_stories (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason     text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

alter table public.story_votes   enable row level security;
alter table public.story_reports enable row level security;
create policy "Users see their own votes" on public.story_votes for select to authenticated using (user_id = auth.uid());
create policy "Users see their own reports" on public.story_reports for select to authenticated using (user_id = auth.uid());
grant select on public.story_votes, public.story_reports to authenticated;

-- A story with this many reports is hidden until someone reviews it.
create function public.is_hidden(p_story uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select count(*) >= 3 from public.story_reports where story_id = p_story;
$$;

-- ─── community_feed ──────────────────────────────────────────────────────
-- Published stories for everyone, without any author information.
-- security definer: it must read other users' published stories, which RLS
-- hides; so it filters by hand and never returns user_id.
-- p_for_me: rank by similarity to the caller's own check-in topics
-- (the average of their chunk embeddings) instead of by votes.
create function public.community_feed(p_theme text default null, p_for_me boolean default false, p_limit int default 30)
returns table (
  id               uuid,
  theme            text,
  title            text,
  situation        text,
  solution         text,
  comment          text,
  intensity_before smallint,
  intensity_after  smallint,
  published_at     timestamptz,
  helpful          bigint,
  my_vote          smallint,
  is_mine          boolean,
  is_example       boolean,
  relevance        float
)
language sql stable security definer set search_path = ''
as $$
  with me as (
    select extensions.avg(k.embedding) as interest
    from public.checkin_chunks k
    where k.user_id = auth.uid()
  ),
  votes as (
    select v.story_id,
           count(*) filter (where v.value = 1) as ups,
           coalesce(sum(v.value), 0) as score
    from public.story_votes v
    group by v.story_id
  )
  select s.id, s.theme, s.public_title, s.public_situation, s.public_solution, s.public_comment,
         s.intensity_before, s.intensity_after, s.published_at,
         coalesce(vt.ups, 0) as helpful,
         (select mv.value from public.story_votes mv where mv.story_id = s.id and mv.user_id = auth.uid()) as my_vote,
         coalesce(s.user_id = auth.uid(), false) as is_mine,
         s.is_example,
         case when s.embedding is not null and me.interest is not null
              then 1 - (s.embedding operator(extensions.<=>) me.interest) end as relevance
  from public.success_stories s
  cross join me
  left join votes vt on vt.story_id = s.id
  where s.status = 'published'
    and not public.is_hidden(s.id)
    and (p_theme is null or s.theme = p_theme)
  order by
    case when p_for_me then 1 - (s.embedding operator(extensions.<=>) me.interest) end desc nulls last,
    coalesce(vt.score, 0) desc,
    s.published_at desc
  limit least(p_limit, 50);
$$;

-- ─── Voting and reporting ────────────────────────────────────────────────
-- value 1 = helpful, -1 = not helpful for me (lowers the ranking, never shown), 0 = remove vote.
create function public.vote_story(p_story uuid, p_value smallint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_value not in (-1, 0, 1) then raise exception 'Invalid vote'; end if;
  if not exists (select 1 from public.success_stories where id = p_story and status = 'published') then
    raise exception 'Story not found';
  end if;
  if p_value = 0 then
    delete from public.story_votes where story_id = p_story and user_id = auth.uid();
  else
    insert into public.story_votes (story_id, user_id, value) values (p_story, auth.uid(), p_value)
    on conflict (story_id, user_id) do update set value = excluded.value;
  end if;
end;
$$;

create function public.report_story(p_story uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.success_stories where id = p_story and status = 'published') then
    raise exception 'Story not found';
  end if;
  insert into public.story_reports (story_id, user_id, reason) values (p_story, auth.uid(), left(p_reason, 500))
  on conflict (story_id, user_id) do nothing;
end;
$$;

-- Example stories are created by this migration without embeddings; this
-- lets the app fill those in once. It can only touch example stories that
-- have no embedding yet.
create function public.set_example_embedding(p_story uuid, p_embedding extensions.vector(1536))
returns void
language sql security definer set search_path = ''
as $$
  update public.success_stories set embedding = p_embedding
  where id = p_story and is_example and embedding is null;
$$;

create function public.examples_without_embedding()
returns table (id uuid, content text)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.public_title || E'\n' || s.public_situation || E'\n' || s.public_solution
  from public.success_stories s
  where s.is_example and s.embedding is null;
$$;

revoke execute on function public.is_hidden, public.community_feed, public.vote_story, public.report_story,
  public.set_example_embedding, public.examples_without_embedding from public, anon;
grant execute on function public.community_feed, public.vote_story, public.report_story,
  public.set_example_embedding, public.examples_without_embedding to authenticated;

-- ─── Example stories ─────────────────────────────────────────────────────
-- Shown with an "Example" label, so nobody mistakes them for real users.
insert into public.success_stories
  (user_id, theme, title, situation, solution, intensity_before, intensity_after,
   status, public_title, public_situation, public_solution, public_comment, published_at, is_example)
select null, t.theme, t.title, t.situation, t.solution, t.before, t.after,
       'published', t.title, t.situation, t.solution, t.comment, now() - (t.days || ' days')::interval, true
from (values
  ('study', 'Exam the next morning', 'Panicking the night before a resit and wanting to study through the night.',
   'Asked my study group for one worked example, did only that one topic, then set a hard stop and went to bed.', 8, 4,
   'Sleeping instead of cramming felt wrong, but I remembered more the next day.', 2),
  ('study', 'Thesis deadline spiral', 'Two weeks before a deadline, every open task felt equally urgent and I froze.',
   'Wrote every task on paper, picked the three that matter most for the grade and ignored the rest for a day.', 7, 4,
   null, 5),
  ('work', 'Presentation tomorrow, part missing', 'A teammate hadn''t sent their part the evening before a presentation.',
   'Sent one clear message with a deadline and prepared a short fallback slide for their part.', 8, 5,
   'The fallback slide was what calmed me, not the message.', 3),
  ('work', 'Too many meetings to think', 'Back-to-back meetings left no time for actual work and I felt behind all day.',
   'Blocked two 90-minute focus slots in my calendar for the week and declined one recurring meeting.', 6, 3,
   null, 8),
  ('relationships', 'After an argument', 'Kept replaying an argument with my partner and couldn''t focus on anything.',
   'Wrote down what I actually wanted to say, waited until the evening, then talked calmly for ten minutes.', 7, 3,
   'Waiting a few hours made the conversation much better.', 4),
  ('family', 'Worried about a parent''s health', 'Felt guilty for not being able to visit a sick parent because of studies.',
   'Scheduled a short video call every other evening and planned one visit on the next free weekend.', 7, 4,
   null, 6),
  ('money', 'Rent going up', 'Found out rent is increasing and didn''t know how to cover it.',
   'Made a simple list of fixed costs, found two subscriptions to cancel and asked about one extra shift a month.', 7, 4,
   'Having numbers on paper was less scary than the vague worry.', 9),
  ('sleep', 'Lying awake before a big day', 'Couldn''t fall asleep because my mind kept running through the next day.',
   'Got up, wrote tomorrow''s to-do list in two minutes, then did slow breathing in bed.', 6, 3,
   null, 7),
  ('social', 'Dreading a party', 'Felt anxious about going to a party where I only knew one person.',
   'Agreed with my friend to arrive together and planned to leave after an hour if it felt bad. Stayed three.', 6, 2,
   null, 10),
  ('health', 'Tension headache from stress', 'Long study days left my neck tense and gave me headaches.',
   'Set a timer for a five-minute walk every 90 minutes and drank water each time.', 6, 3,
   'The walks also gave me new ideas.', 11)
) as t(theme, title, situation, solution, before, after, comment, days);
