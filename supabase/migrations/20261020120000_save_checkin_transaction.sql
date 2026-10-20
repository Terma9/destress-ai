-- Saving a check-in as one transaction.
--
-- checkin-complete used to write to five places one after another: the
-- check-in, the day's tracker values, the AI's memory, the RAG chunks and the
-- outcomes of open Untangle plans. If one write failed, the earlier ones
-- stayed: half a check-in. When a day's entry was continued, its old chunks
-- were deleted before the new ones were saved, so a failure in between left
-- the entry without a search index.
--
-- Now the Edge Function does all AI work first (extraction, embeddings) and
-- then calls this function once. A Postgres function runs in a single
-- transaction: either every write succeeds, or none of them does.
--
-- security invoker: it runs with the caller's rights, so row-level security
-- applies to every statement exactly as before. It can't do anything the
-- user couldn't do with single requests.

create function public.save_checkin(
  p_day      date,
  p_checkin  jsonb,   -- title, summary, mood, stress, emotion, sleep, themes, helped, follow_ups, risk_level, score_reasons, messages
  p_memory   text,
  p_chunks   jsonb,   -- [{ topic, title, summary, content, embedding }] with embedding as '[0.1, …]'
  p_outcomes jsonb    -- [{ id, outcome, outcome_note, intensity_after }] for open Untangle plans
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_new      public.checkins := jsonb_populate_record(null::public.checkins, p_checkin);
  v_id       uuid;
  v_existing public.daily_metrics;
  v_metrics  public.daily_metrics;
begin
  -- 1. One entry per day: continue today's entry, or create it.
  select c.id into v_id
  from public.checkins c
  where c.day = p_day and c.completed_at is not null
  order by c.created_at desc
  limit 1;

  if v_id is null then
    insert into public.checkins (messages, title, summary, mood, stress, emotion, sleep, themes, helped,
                                 follow_ups, risk_level, score_reasons, day, completed_at)
    values (v_new.messages, v_new.title, v_new.summary, v_new.mood, v_new.stress, v_new.emotion, v_new.sleep,
            coalesce(v_new.themes, '{}'), coalesce(v_new.helped, '{}'), coalesce(v_new.follow_ups, '{}'),
            coalesce(v_new.risk_level, 'none'), coalesce(v_new.score_reasons, '{}'), p_day, now())
    returning id into v_id;
  else
    update public.checkins
    set messages = v_new.messages, title = v_new.title, summary = v_new.summary, mood = v_new.mood,
        stress = v_new.stress, emotion = v_new.emotion, sleep = v_new.sleep,
        themes = coalesce(v_new.themes, '{}'), helped = coalesce(v_new.helped, '{}'),
        follow_ups = coalesce(v_new.follow_ups, '{}'), risk_level = coalesce(v_new.risk_level, 'none'),
        score_reasons = coalesce(v_new.score_reasons, '{}'), completed_at = now()
    where id = v_id;
    -- The topics may have changed; the new chunks follow below, in the same transaction.
    delete from public.checkin_chunks where checkin_id = v_id;
  end if;

  -- 2. The day's tracker values. Values the user set by hand win; scores the
  --    conversation didn't cover keep their previous value.
  select * into v_existing from public.daily_metrics m where m.day = p_day;
  if v_existing.source is distinct from 'manual'
     and (v_new.stress is not null or v_new.emotion is not null or v_new.sleep is not null) then
    insert into public.daily_metrics (day, stress, emotion, sleep, source, updated_at)
    values (p_day, coalesce(v_new.stress, v_existing.stress), coalesce(v_new.emotion, v_existing.emotion),
            coalesce(v_new.sleep, v_existing.sleep), 'ai', now())
    on conflict (user_id, day) do update
      set stress = excluded.stress, emotion = excluded.emotion, sleep = excluded.sleep,
          source = 'ai', updated_at = now()
    returning * into v_metrics;
  else
    v_metrics := v_existing;
  end if;

  -- 3. What the AI remembers for the next check-in.
  update public.profiles set memory = p_memory, updated_at = now() where id = auth.uid();

  -- 4. The RAG index: one chunk per topic, embedded before this call.
  insert into public.checkin_chunks (checkin_id, topic, title, summary, content, embedding)
  select v_id, c->>'topic', c->>'title', c->>'summary', c->>'content', (c->>'embedding')::extensions.vector
  from jsonb_array_elements(coalesce(p_chunks, '[]')) c;

  -- 5. How open Untangle plans turned out, as far as the conversation said.
  update public.untangle_sessions s
  set outcome = o->>'outcome',
      outcome_note = nullif(o->>'outcome_note', ''),
      outcome_at = now(),
      updated_at = now(),
      intensity_after = coalesce((o->>'intensity_after')::smallint, s.intensity_after)
  from jsonb_array_elements(coalesce(p_outcomes, '[]')) o
  where s.id = (o->>'id')::uuid;

  return jsonb_build_object(
    'checkin', (select to_jsonb(c) - 'messages' - 'user_id' from public.checkins c where c.id = v_id),
    'metrics', case when v_metrics.day is null then null
                    else jsonb_build_object('day', v_metrics.day, 'stress', v_metrics.stress, 'emotion', v_metrics.emotion,
                                            'sleep', v_metrics.sleep, 'source', v_metrics.source) end
  );
end;
$$;

revoke execute on function public.save_checkin from public, anon;
grant execute on function public.save_checkin to authenticated;
