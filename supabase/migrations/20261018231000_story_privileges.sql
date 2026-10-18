-- Publishing must not bypass moderation.
--
-- RLS lets users manage their own success stories, so without this they
-- could set status = 'published' (with any text) straight through the API.
-- Column-level privileges close that: users may only create a private story
-- and edit their own comment. Publishing happens only in the
-- community-publish Edge Function, after anonymization and moderation,
-- using the server-only service role.

revoke insert, update on public.success_stories from authenticated;

grant insert (session_id, theme, title, situation, solution, comment, intensity_before, intensity_after)
  on public.success_stories to authenticated;
grant update (comment) on public.success_stories to authenticated;

-- Taking a story off the community needs no moderation, so users may do it themselves.
create function public.unpublish_story(p_story uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.success_stories
  set status = 'private', published_at = null,
      public_title = null, public_situation = null, public_solution = null, public_comment = null,
      embedding = null
  where id = p_story and user_id = auth.uid();
$$;

revoke execute on function public.unpublish_story from public, anon;
grant execute on function public.unpublish_story to authenticated;
