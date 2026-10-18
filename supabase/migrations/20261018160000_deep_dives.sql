-- Deep Dives: AI analyses of a user's check-ins, with cited evidence and
-- reflection questions the user can answer.

-- ─── analyses ────────────────────────────────────────────────────────────
-- One row per "Analyze my entries" run. Keeps the code-computed facts and
-- which model/prompt produced the result, so runs can be compared in evals.
create table public.analyses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  checkin_count    integer not null,
  insight          text not null,
  stats            jsonb not null default '{}'::jsonb,
  model            text not null,
  prompt_version   text not null,
  dropped_findings integer not null default 0
);

create index analyses_user_created_idx on public.analyses (user_id, created_at desc);

-- ─── deep_dives ──────────────────────────────────────────────────────────
-- 2–3 topics per analysis. `findings` is a list of { text, evidence: [checkin ids] }.
create table public.deep_dives (
  id          uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position    smallint not null,
  title       text not null,
  description text not null,
  icon        text not null,
  findings    jsonb not null default '[]'::jsonb,
  questions   text[] not null default '{}'
);

create index deep_dives_analysis_idx on public.deep_dives (analysis_id, position);

-- ─── reflections ─────────────────────────────────────────────────────────
-- The user's written answer to one reflection question. The question text is
-- copied in, so the check-in AI can read question + answer together.
create table public.reflections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deep_dive_id   uuid not null references public.deep_dives (id) on delete cascade,
  question_index smallint not null,
  question       text not null,
  answer         text not null check (char_length(answer) between 1 and 2000),
  updated_at     timestamptz not null default now(),
  unique (deep_dive_id, question_index)
);

-- ─── Row Level Security ──────────────────────────────────────────────────
alter table public.analyses    enable row level security;
alter table public.deep_dives  enable row level security;
alter table public.reflections enable row level security;

create policy "Users manage their own analyses" on public.analyses
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A row may only point at a parent the same user owns. Foreign keys alone
-- don't check that: they would accept another user's (guessed) id.
create policy "Users manage their own deep dives" on public.deep_dives
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = auth.uid())
  );

create policy "Users manage their own reflections" on public.reflections
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.deep_dives d where d.id = deep_dive_id and d.user_id = auth.uid())
  );

grant select, insert, update, delete on public.analyses    to authenticated;
grant select, insert, update, delete on public.deep_dives  to authenticated;
grant select, insert, update, delete on public.reflections to authenticated;
