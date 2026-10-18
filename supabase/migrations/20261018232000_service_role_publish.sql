-- The community-publish Edge Function saves the published copy with the
-- service role. That role bypasses RLS, but still needs table privileges:
-- new tables aren't exposed automatically in this project, so grant them.
grant select, update on public.success_stories to service_role;
