-- Untangle becomes two modes:
--   calm — "Calm now": a short calming conversation, rated before/after, no plan
--   plan — "Stress solving": a saved plan per stressor that the user keeps
--          talking about; it can change over time and be marked solved.
alter table public.untangle_sessions
  add column kind text not null default 'plan' check (kind in ('calm', 'plan')),
  add column status text not null default 'active' check (status in ('active', 'solved')),
  -- earlier versions of the plan: [{ plan, replaced_at }]
  add column plan_history jsonb not null default '[]',
  add column updated_at timestamptz not null default now();

-- Calm sessions have no plan.
alter table public.untangle_sessions alter column plan drop not null;
