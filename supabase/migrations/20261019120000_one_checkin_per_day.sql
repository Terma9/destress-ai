-- One check-in per day, and the reasons behind the AI's suggested values.
--
-- `day` is the user's local calendar day (sent by the app). Opening the
-- check-in again on the same day continues that day's entry instead of
-- creating a new one; the Edge Function updates the row for that day.
-- No unique constraint: older test accounts can hold several rows per day,
-- and the function always picks the latest.

alter table public.checkins add column day date;
update public.checkins set day = (created_at at time zone 'UTC')::date where day is null;
create index checkins_user_day_idx on public.checkins (user_id, day);

-- Why the AI suggested each value, shown in the review step:
-- { "stress": "You mentioned the deadline twice.", "sleep": "...", "mood": "..." }
alter table public.checkins add column score_reasons jsonb not null default '{}'::jsonb;
