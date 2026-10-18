-- RAG v2: search by topic instead of by whole check-in.
--
-- One embedding per check-in blurred long check-ins that cover several
-- topics (a search for one topic could miss them). Now the extraction model
-- splits each check-in into topic chunks (summary + the user's own messages
-- on that topic), and each chunk gets its own embedding. Search finds the
-- best chunk; the chat then gets the whole conversation it belongs to
-- ("small-to-big retrieval").

-- ─── Replace the per-check-in vector ─────────────────────────────────────
-- Migrations are append-only: instead of editing the previous migration,
-- this one removes what it added. The vectors can be recreated any time.
drop function public.match_checkins(extensions.vector, int);
alter table public.checkins drop column embedding;

-- ─── checkin_chunks ──────────────────────────────────────────────────────
create table public.checkin_chunks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  topic      text not null,   -- a theme like 'study', or 'all' for a whole check-in
  summary    text not null,   -- one or two sentences about this topic
  content    text not null,   -- exactly the text that was embedded
  embedding  extensions.vector(1536) not null
);

create index checkin_chunks_checkin_idx on public.checkin_chunks (checkin_id);
create index checkin_chunks_embedding_idx on public.checkin_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.checkin_chunks enable row level security;

create policy "Users manage their own chunks" on public.checkin_chunks
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid())
  );

grant select, insert, update, delete on public.checkin_chunks to authenticated;

-- ─── match_chunks ────────────────────────────────────────────────────────
-- The chunks closest to a query vector, with their check-in's basic fields.
-- security invoker: RLS applies, so users only search their own chunks.
create function public.match_chunks(query_embedding extensions.vector(1536), match_count int default 10)
returns table (
  checkin_id    uuid,
  created_at    timestamptz,
  title         text,
  summary       text,
  mood          text,
  topic         text,
  chunk_summary text,
  similarity    float
)
language sql stable security invoker set search_path = ''
as $$
  select k.checkin_id, c.created_at, c.title, c.summary, c.mood, k.topic, k.summary,
         1 - (k.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.checkin_chunks k
  join public.checkins c on c.id = k.checkin_id
  where c.completed_at is not null
  order by k.embedding operator(extensions.<=>) query_embedding
  limit least(match_count, 30);
$$;

revoke execute on function public.match_chunks from public, anon;
grant execute on function public.match_chunks to authenticated;
