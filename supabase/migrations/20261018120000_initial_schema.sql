-- Initial schema for Destress AI: profiles, check-ins and daily metrics.
-- Every table is private per user, enforced by Row Level Security.

-- ─── profiles ────────────────────────────────────────────────────────────
-- One row per user. `memory` is the AI's running summary of what it has
-- learned about the user; it is sent along with each check-in.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  memory       text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── checkins ────────────────────────────────────────────────────────────
-- One row per AI check-in conversation. The full chat is kept as JSON;
-- the remaining columns are what the AI extracts when the user finishes.
create table public.checkins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  messages     jsonb not null default '[]'::jsonb,
  title        text,
  summary      text,
  mood         text check (mood in ('great', 'good', 'ok', 'low', 'stressed')),
  stress       smallint check (stress between 0 and 10),
  emotion      smallint check (emotion between 0 and 10),
  sleep        smallint check (sleep between 0 and 10),
  themes       text[] not null default '{}',
  helped       text[] not null default '{}',
  follow_ups   text[] not null default '{}',
  risk_level   text not null default 'none' check (risk_level in ('none', 'elevated', 'high'))
);

create index checkins_user_created_idx on public.checkins (user_id, created_at desc);

-- ─── daily_metrics ───────────────────────────────────────────────────────
-- One row per user per day for the Wellness Tracker. Filled by the AI from
-- check-ins, and overwritten when the user adjusts a value by hand.
create table public.daily_metrics (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  stress     smallint check (stress between 0 and 10),
  emotion    smallint check (emotion between 0 and 10),
  sleep      smallint check (sleep between 0 and 10),
  source     text not null default 'ai' check (source in ('ai', 'manual')),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ─── Row Level Security ──────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.checkins      enable row level security;
alter table public.daily_metrics enable row level security;

create policy "Users manage their own profile" on public.profiles
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Users manage their own check-ins" on public.checkins
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage their own metrics" on public.daily_metrics
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- New tables are not exposed to the Data API automatically (project setting),
-- so grant signed-in users access explicitly. The anon role gets nothing.
-- Anonymous sign-ins still run as `authenticated`.
grant select, insert, update, delete on public.profiles      to authenticated;
grant select, insert, update, delete on public.checkins      to authenticated;
grant select, insert, update, delete on public.daily_metrics to authenticated;

-- ─── Auto-create a profile for every new user ────────────────────────────
-- security definer: runs with the function owner's rights, because the new
-- user has no session yet when auth.users receives the row.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
