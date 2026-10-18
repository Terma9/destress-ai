-- Hybrid topic labels: next to the fixed category (`topic`, e.g. 'study'),
-- each chunk gets a free-text title (e.g. 'Statistics resit'). The category
-- stays countable for statistics; the title is precise for display and for
-- the chat's context. Older chunks keep a null title.

alter table public.checkin_chunks add column title text;

-- The return type changes, so the function is replaced, not altered.
drop function public.match_chunks(extensions.vector, int);

create function public.match_chunks(query_embedding extensions.vector(1536), match_count int default 10)
returns table (
  checkin_id    uuid,
  created_at    timestamptz,
  title         text,
  summary       text,
  mood          text,
  topic         text,
  topic_title   text,
  chunk_summary text,
  similarity    float
)
language sql stable security invoker set search_path = ''
as $$
  select k.checkin_id, c.created_at, c.title, c.summary, c.mood, k.topic, k.title, k.summary,
         1 - (k.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.checkin_chunks k
  join public.checkins c on c.id = k.checkin_id
  where c.completed_at is not null
  order by k.embedding operator(extensions.<=>) query_embedding
  limit least(match_count, 30);
$$;

revoke execute on function public.match_chunks from public, anon;
grant execute on function public.match_chunks to authenticated;
