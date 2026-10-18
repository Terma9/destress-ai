-- Untangle: working through an acute stressor with the AI, right now.
-- One row per session: the problem, a short conversation, the AI's plan,
-- and how intense the stress was before and after. The before/after pair
-- is what lets the app learn which strategies actually help this user.

create table public.untangle_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  title            text not null,
  problem          text not null,   -- the AI's one-sentence restatement of the problem
  messages         jsonb not null default '[]'::jsonb,
  intensity_before smallint not null check (intensity_before between 0 and 10),
  intensity_after  smallint check (intensity_after between 0 and 10),
  -- { lessons: [{ text, kind, evidence: [checkin ids] }], steps: [{ text, minutes, done }], note }
  plan             jsonb not null,
  risk_level       text not null default 'none' check (risk_level in ('none', 'elevated', 'high')),
  completed_at     timestamptz      -- set when the user rates the intensity afterwards
);

create index untangle_sessions_user_created_idx on public.untangle_sessions (user_id, created_at desc);

alter table public.untangle_sessions enable row level security;

create policy "Users manage their own untangle sessions" on public.untangle_sessions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.untangle_sessions to authenticated;
