-- Weekly Insights: the analysis becomes a weekly look back.
-- week:     this week's averages vs last week (computed by code, not the AI)
-- worked:   short items of what helped this week [{text, source}]
-- question: one open question to carry into the next week
alter table public.analyses
  add column week jsonb not null default '{}',
  add column worked jsonb not null default '[]',
  add column question text;
