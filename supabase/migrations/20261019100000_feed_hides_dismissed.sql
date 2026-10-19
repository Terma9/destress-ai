-- "Not for me" and "Report" now also hide the story from that user's feed.
-- Other users still see it (a single report or downvote doesn't remove a
-- story for everyone; three reports still hide it for all, as before).
-- Same signature and return type, so the function is replaced in place.

create or replace function public.community_feed(p_theme text default null, p_for_me boolean default false, p_limit int default 30)
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
    -- Hidden for this user: marked "not for me" or reported by them.
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
