-- Cost protection for the public demo: every Edge Function that calls the AI
-- first asks use_ai_quota(). It counts the call and says no when the account
-- has used its daily calls, or when all accounts together have used the
-- app's daily budget (protects against someone creating many accounts).
-- The OpenAI spending limit stays the last line of defence.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default current_date,
  calls   integer not null default 0,
  primary key (user_id, day)
);
create index ai_usage_day_idx on public.ai_usage (day);

-- No policies: only use_ai_quota() reads and writes it.
alter table public.ai_usage enable row level security;

create function public.use_ai_quota(p_user_limit int, p_global_limit int)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  used  int;
  total bigint;
begin
  if auth.uid() is null then return false; end if;
  select coalesce(sum(calls), 0) into total from public.ai_usage where day = current_date;
  if total >= p_global_limit then return false; end if;
  insert into public.ai_usage (user_id, day, calls) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into used;
  return used <= p_user_limit;
end;
$$;

revoke execute on function public.use_ai_quota from public, anon;
grant execute on function public.use_ai_quota to authenticated;
