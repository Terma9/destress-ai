-- Usernames in the community. The example posts and comments get realistic
-- usernames (a few stay anonymous). Real users are shown as "Anonymous":
-- their account name is never exposed (privacy by design).
alter table public.success_stories add column author_name text;
alter table public.story_comments  add column author_name text;

update public.success_stories s set author_name = v.name
from (values
  ('Exam the next morning', 'mira.k'),
  ('Thesis deadline spiral', 'jonas_writes'),
  ('Too many meetings to think', 'Daniel R.'),
  ('After an argument', 'sunny_side'),
  ('Worried about a parent''s health', 'Lea'),
  ('Lying awake before a big day', 'nightowl92'),
  ('Dreading a party', 'Tobi'),
  ('Tension headache from stress', 'anna.moves')
) as v(title, name)
where s.is_example and s.title = v.title;

update public.story_comments c set author_name = v.name
from (values
  ('The one-sheet idea', 'felix_studies'),
  ('Thank you for this. I have a resit', 'Hanna'),
  ('Three tasks per day', 'maxi.b'),
  ('Plan B in 40 minutes', 'Sophie L.'),
  ('Been there so many times', 'chris_k'),
  ('I love that almost nobody', 'paula.codes'),
  ('Writing first, talking later', 'Nora'),
  ('Sending you and your mum', 'jule_'),
  ('I live far from my dad', 'Ben'),
  ('Scary for one hour', 'kai.m'),
  ('The brain dump', 'lotte'),
  ('From 3 to 6 or 7', 'sam_runs'),
  ('The exit plan trick', 'Emily'),
  ('The 50 minute timer', 'yusuf.a'),
  ('Thanks for mentioning seeing a doctor', 'Clara')
) as v(snippet, name)
where c.is_example and c.body like v.snippet || '%';

-- The read functions return the name (never the account behind it).
drop function public.community_feed(text, boolean, int);
create function public.community_feed(p_theme text default null, p_for_me boolean default false, p_limit int default 30)
returns table (
  id               uuid,
  theme            text,
  title            text,
  body             text,
  author_name      text,
  intensity_before smallint,
  intensity_after  smallint,
  published_at     timestamptz,
  helpful          bigint,
  comments         bigint,
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
  select s.id, s.theme, s.public_title,
         coalesce(s.public_body, s.public_situation || ' ' || s.public_solution),
         s.author_name,
         s.intensity_before, s.intensity_after, s.published_at,
         coalesce(vt.ups, 0) as helpful,
         (select count(*) from public.story_comments c where c.story_id = s.id) as comments,
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
    and not exists (select 1 from public.story_votes dv
                    where dv.story_id = s.id and dv.user_id = auth.uid() and dv.value = -1)
    and not exists (select 1 from public.story_reports r
                    where r.story_id = s.id and r.user_id = auth.uid())
  order by
    case when p_for_me then 1 - (s.embedding operator(extensions.<=>) me.interest) end desc nulls last,
    coalesce(vt.score, 0) desc,
    s.published_at desc
  limit least(p_limit, 50);
$$;

drop function public.community_story(uuid);
create function public.community_story(p_story uuid)
returns table (
  id               uuid,
  theme            text,
  title            text,
  body             text,
  author_name      text,
  intensity_before smallint,
  intensity_after  smallint,
  published_at     timestamptz,
  helpful          bigint,
  my_vote          smallint,
  is_mine          boolean,
  is_example       boolean
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.theme, s.public_title,
         coalesce(s.public_body, s.public_situation || ' ' || s.public_solution),
         s.author_name,
         s.intensity_before, s.intensity_after, s.published_at,
         (select count(*) from public.story_votes v where v.story_id = s.id and v.value = 1),
         (select mv.value from public.story_votes mv where mv.story_id = s.id and mv.user_id = auth.uid()),
         coalesce(s.user_id = auth.uid(), false),
         s.is_example
  from public.success_stories s
  where s.id = p_story and s.status = 'published' and not public.is_hidden(s.id);
$$;

drop function public.story_comments_of(uuid);
create function public.story_comments_of(p_story uuid)
returns table (id uuid, body text, author_name text, created_at timestamptz, is_mine boolean, is_example boolean)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.body, c.author_name, c.created_at, coalesce(c.user_id = auth.uid(), false), c.is_example
  from public.story_comments c
  join public.success_stories s on s.id = c.story_id
  where c.story_id = p_story and s.status = 'published' and not public.is_hidden(s.id)
  order by c.created_at;
$$;

revoke execute on function public.community_feed, public.community_story, public.story_comments_of from public, anon;
grant execute on function public.community_feed, public.community_story, public.story_comments_of to authenticated;
