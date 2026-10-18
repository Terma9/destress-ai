-- RAG: find check-ins by meaning instead of by keyword.
-- Each check-in gets an embedding (a vector that represents its meaning);
-- match_checkins returns the check-ins closest to a query vector.

create extension if not exists vector with schema extensions;

-- 1536 numbers = the output size of OpenAI's text-embedding-3-small.
-- Switching to a model with another size means a new column and re-embedding:
-- vectors from different models can't be compared with each other.
alter table public.checkins add column embedding extensions.vector(1536);

-- HNSW: an index for "nearest neighbours", so search stays fast with many rows.
create index checkins_embedding_idx on public.checkins
  using hnsw (embedding extensions.vector_cosine_ops);

-- security invoker: runs with the caller's rights, so RLS applies and a user
-- only ever searches their own check-ins.
create function public.match_checkins(query_embedding extensions.vector(1536), match_count int default 5)
returns table (
  id         uuid,
  created_at timestamptz,
  title      text,
  summary    text,
  mood       text,
  helped     text[],
  similarity float
)
language sql stable security invoker set search_path = ''
as $$
  select c.id, c.created_at, c.title, c.summary, c.mood, c.helped,
         1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.checkins c
  where c.embedding is not null and c.completed_at is not null
  order by c.embedding operator(extensions.<=>) query_embedding
  limit least(match_count, 20);
$$;

-- Functions are executable by everyone by default; only signed-in users need it.
revoke execute on function public.match_checkins from public, anon;
grant execute on function public.match_checkins to authenticated;
