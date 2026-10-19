-- Community as a small blog: stories become personal posts (5–10+ sentences)
-- with comments. As before, others only ever see the anonymized, moderated
-- public_* copy, and only through security-definer functions that never
-- return user_id. Comments are written only by the community-comment Edge
-- Function (after AI moderation + anonymization), never directly.

-- ─── Blog text ───────────────────────────────────────────────────────────
alter table public.success_stories
  add column body        text,   -- the author's private draft of the post
  add column public_body text;   -- the published, anonymized post

-- The author may edit their draft (and their comment), never the public copy.
grant update (comment, body) on public.success_stories to authenticated;

-- ─── Comments ────────────────────────────────────────────────────────────
create table public.story_comments (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.success_stories (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete cascade,   -- null for example comments
  body       text not null check (length(body) between 1 and 1000),
  is_example boolean not null default false,
  created_at timestamptz not null default now()
);
create index story_comments_story_idx on public.story_comments (story_id, created_at);

-- RLS on, no policies for users: reading goes through story_comments(),
-- writing through the Edge Function (service role).
alter table public.story_comments enable row level security;
grant select, insert, delete on public.story_comments to service_role;

-- ─── Feed (now with the post text and a comment count) ───────────────────
drop function public.community_feed(text, boolean, int);

create function public.community_feed(p_theme text default null, p_for_me boolean default false, p_limit int default 30)
returns table (
  id               uuid,
  theme            text,
  title            text,
  body             text,
  intensity_before smallint,
  intensity_after  smallint,
  published_at     timestamptz,
  helpful          bigint,
  comments         bigint,
  my_vote          smallint,
  is_mine          boolean,
  is_example       boolean,
  relevance        float
)
language sql stable security definer set search_path = ''
as $$
  with me as (
    select extensions.avg(k.embedding) as interest
    from public.checkin_chunks k
    where k.user_id = auth.uid()
  ),
  votes as (
    select v.story_id,
           count(*) filter (where v.value = 1) as ups,
           coalesce(sum(v.value), 0) as score
    from public.story_votes v
    group by v.story_id
  )
  select s.id, s.theme, s.public_title,
         coalesce(s.public_body, s.public_situation || ' ' || s.public_solution),
         s.intensity_before, s.intensity_after, s.published_at,
         coalesce(vt.ups, 0) as helpful,
         (select count(*) from public.story_comments c where c.story_id = s.id) as comments,
         (select mv.value from public.story_votes mv where mv.story_id = s.id and mv.user_id = auth.uid()) as my_vote,
         coalesce(s.user_id = auth.uid(), false) as is_mine,
         s.is_example,
         case when s.embedding is not null and me.interest is not null
              then 1 - (s.embedding operator(extensions.<=>) me.interest) end as relevance
  from public.success_stories s
  cross join me
  left join votes vt on vt.story_id = s.id
  where s.status = 'published'
    and not public.is_hidden(s.id)
    and (p_theme is null or s.theme = p_theme)
    and not exists (select 1 from public.story_votes dv
                    where dv.story_id = s.id and dv.user_id = auth.uid() and dv.value = -1)
    and not exists (select 1 from public.story_reports r
                    where r.story_id = s.id and r.user_id = auth.uid())
  order by
    case when p_for_me then 1 - (s.embedding operator(extensions.<=>) me.interest) end desc nulls last,
    coalesce(vt.score, 0) desc,
    s.published_at desc
  limit least(p_limit, 50);
$$;

-- One published post for the article screen.
create function public.community_story(p_story uuid)
returns table (
  id               uuid,
  theme            text,
  title            text,
  body             text,
  intensity_before smallint,
  intensity_after  smallint,
  published_at     timestamptz,
  helpful          bigint,
  my_vote          smallint,
  is_mine          boolean,
  is_example       boolean
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.theme, s.public_title,
         coalesce(s.public_body, s.public_situation || ' ' || s.public_solution),
         s.intensity_before, s.intensity_after, s.published_at,
         (select count(*) from public.story_votes v where v.story_id = s.id and v.value = 1),
         (select mv.value from public.story_votes mv where mv.story_id = s.id and mv.user_id = auth.uid()),
         coalesce(s.user_id = auth.uid(), false),
         s.is_example
  from public.success_stories s
  where s.id = p_story and s.status = 'published' and not public.is_hidden(s.id);
$$;

-- Comments of a published post, oldest first, without author information.
create function public.story_comments_of(p_story uuid)
returns table (id uuid, body text, created_at timestamptz, is_mine boolean, is_example boolean)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.body, c.created_at, coalesce(c.user_id = auth.uid(), false), c.is_example
  from public.story_comments c
  join public.success_stories s on s.id = c.story_id
  where c.story_id = p_story and s.status = 'published' and not public.is_hidden(s.id)
  order by c.created_at;
$$;

create function public.delete_my_comment(p_comment uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.story_comments where id = p_comment and user_id = auth.uid();
$$;

revoke execute on function public.community_feed, public.community_story, public.story_comments_of,
  public.delete_my_comment from public, anon;
grant execute on function public.community_feed, public.community_story, public.story_comments_of,
  public.delete_my_comment to authenticated;

-- Examples are matched for "For you" by title + post; re-embed them.
create or replace function public.examples_without_embedding()
returns table (id uuid, content text)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.public_title || E'\n' || coalesce(s.public_body, s.public_situation || E'\n' || s.public_solution)
  from public.success_stories s
  where s.is_example and s.embedding is null;
$$;

-- ─── Example posts and comments ──────────────────────────────────────────
update public.success_stories s
set public_body = t.body, embedding = null
from (values
  ('Exam the next morning', $b$It was 11pm the night before my statistics resit and I was sitting at my desk, completely panicking. My plan was to just stay up and go through everything one more time, because it felt like I didn't know anything. Every page I opened made it worse. I ended up writing a note to myself in the Calm now chat, and it asked me what I would tell a friend in my place. Honestly, the answer was obvious: go to bed. So I made a deal with myself: 30 more minutes on the three formulas I always mix up, written on one sheet, then lights out. I didn't sleep perfectly, but I slept about six hours. In the morning I looked only at that one sheet over breakfast. The exam wasn't easy, but my head was clear enough to actually think, and I passed. Next time I'll make the sheet two days before.$b$),
  ('Thesis deadline spiral', $b$Two weeks before my thesis deadline everything felt equally urgent. Literature, the results chapter, formatting, the abstract: every time I started one thing I felt guilty about another, so I mostly just scrolled on my phone and felt awful. What finally broke the spiral was ridiculously simple. I wrote every open task on a sticky note and put them on the wall. Then I picked only three for the next day, and the rule was: nothing else counts tomorrow. The first day I only finished two and felt bad about it, but by day three I was finishing all three before dinner. Seeing the wall slowly get emptier was more motivating than any to-do app. I also stopped working after 9pm, which felt impossible at first but made the mornings so much better. I submitted one day early, which never happens to me.$b$),
  ('Presentation tomorrow, part missing', $b$The evening before a big group presentation, one teammate still hadn't sent their slides, and they weren't answering. I was furious and also scared that the whole thing would fall apart in front of our professor. My first instinct was to stay up and redo their part myself. Instead I wrote down what was actually in my control. I sent one calm message: "If I don't have your slides by 8am, I'll present a short version of your part myself." Then I made three simple backup slides with the key points, which took about 40 minutes, not the whole night. At 7:30 the slides arrived, a bit messy but fine. I didn't need the backup in the end, but having it meant I actually slept. What I learned: one clear message plus a small plan B beats hours of worrying about someone else's behavior.$b$),
  ('Too many meetings to think', $b$For weeks my calendar was so full that I did my real work in the evenings, and I felt behind the entire day. I kept telling myself it would calm down next week, and it never did. In a Stress solving session I realized I had never actually said no to a single meeting. So I tried a small experiment: I blocked two mornings a week from 9 to 11 as focus time and declined anything that landed there, with a friendly note. I was sure people would be annoyed. Almost nobody even noticed, and two meetings turned into short emails. The first week I still checked my inbox during focus time, so I started closing it completely. Now those two mornings are when most of my important work gets done. My evenings are mine again, and I don't feel behind all day anymore.$b$),
  ('After an argument', $b$After a stupid argument with my partner, I couldn't stop replaying it. Every sentence, what I should have said, what they meant. I tried to study and read the same paragraph about ten times. Talking to them right away didn't work because we were both still upset. What helped was writing it all down: first everything I was angry about, without filtering, and then, on a new page, what I actually needed. That second page was surprisingly short: I wanted to feel listened to. Then I went for a 20 minute walk without my phone. When I came back, I could talk about the need instead of the whole fight, and the conversation went completely differently. We were fine by the evening. Writing first and talking later is now my rule, and it has saved us a few times since.$b$),
  ('Worried about a parent''s health', $b$When my mum got sick, I felt guilty every single day that I couldn't visit because of my exams. I'd sit in the library feeling like a bad daughter and get nothing done, which made the guilt worse. My check-ins showed me how much this was weighing on me, and in Stress solving we came up with something small: a fixed video call every evening at 7, just 15 minutes. It sounds tiny, but knowing I'd see her face every evening took away the constant background worry. On the calls we sometimes didn't even talk about her health, just normal things. I also planned one visit right after my last exam, so there was a date to hold on to. The guilt didn't disappear completely, but it stopped running my days. And she told me later that the calls were the best part of her day too.$b$),
  ('Rent going up', $b$When I got the letter that my rent was going up, I panicked. I didn't even open my banking app for days because I was scared of the numbers. That avoidance was honestly the worst part, because the worry was everywhere and I had no idea how bad it actually was. One Sunday I finally sat down with a cup of tea and wrote down every fixed cost and every income, nothing else. It took about an hour. The gap was real, but smaller than the monster in my head. I cancelled two subscriptions I didn't use, asked about more shifts at my job, and checked whether I could get housing support, which I could. It's still tight, but now it's a plan and not a fog. The lesson for me: looking at the numbers is scary for one hour, not looking is scary for weeks.$b$),
  ('Lying awake before a big day', $b$Before every big day I lie awake for hours, going through everything that could go wrong. The more I tried to force myself to sleep, the more awake I got. My weekly insights showed that my worst nights were always before important days, which wasn't a surprise, but seeing it so clearly made me want to try something. Now I do a "brain dump" about an hour before bed: I write down everything I'm worried about and, next to each point, the first tiny thing I'll do about it tomorrow. Then I close the notebook, and that's the deal: it's on paper now, my head doesn't need to hold it. If I still wake up thinking, I remind myself it's in the notebook. It doesn't work every single time, but I fall asleep much faster than before. My sleep scores before big days went up from around 3 to 6 or 7.$b$),
  ('Dreading a party', $b$I was invited to a birthday party where I only knew the host, and for days I dreaded it. I kept imagining standing alone in a corner with my phone. I almost cancelled twice. What helped was making it smaller in my head. I decided I would go for just one hour, and if I hated it, I could leave without any guilt. I also prepared two easy questions I could ask anyone, like how they knew the host. When I got there it was awkward for the first ten minutes, I won't lie. But the questions worked, and I ended up in a long conversation in the kitchen about travel. I stayed three hours. The exit plan is what made me go at all. Knowing I was allowed to leave took so much pressure off that I didn't want to anymore.$b$),
  ('Tension headache from stress', $b$During a long exam phase, I had headaches almost every afternoon. My neck and shoulders were rock hard from sitting at my desk for eight hours straight, and painkillers had become a daily thing, which worried me. My check-ins showed a pattern: the headache days were the days I didn't take any breaks. So I set a timer for every 50 minutes and did two minutes of shoulder rolls and stretching, and once a day I went for a short walk outside. At first it felt like wasted study time and I kept skipping the breaks. But after a week, the headaches came less often, and I actually got more done because I wasn't fighting the pain all afternoon. I still forget the breaks on busy days, and then I notice it right away. If the headaches had continued, I would have seen a doctor, but for me the breaks really made the difference.$b$)
) as t(title, body)
where s.is_example and s.title = t.title;

insert into public.story_comments (story_id, body, is_example, created_at)
select s.id, c.body, true, s.published_at + (c.hours || ' hours')::interval
from public.success_stories s
join (values
  ('Exam the next morning', 'The one-sheet idea is so good. I always try to reread everything and end up remembering nothing.', 5),
  ('Exam the next morning', 'Thank you for this. I have a resit on Friday and was planning an all-nighter. Going to bed instead.', 30),
  ('Thesis deadline spiral', 'Three tasks per day is such a simple rule but I can see why it works. Stealing this!', 8),
  ('Thesis deadline spiral', 'The part about stopping at 9pm hit me. I always think working late helps but my mornings are terrible.', 50),
  ('Presentation tomorrow, part missing', 'Plan B in 40 minutes instead of redoing everything. That is a really healthy way to handle it.', 3),
  ('Presentation tomorrow, part missing', 'Been there so many times. The calm message is a great idea, I usually send five angry ones.', 26),
  ('Too many meetings to think', 'I love that almost nobody noticed. We always think saying no is a bigger deal than it is.', 12),
  ('Too many meetings to think', 'Trying the two focus mornings next week. Thanks for sharing how it actually went.', 40),
  ('After an argument', 'Writing first, talking later. Such a good rule. The "what I actually need" page is brilliant.', 6),
  ('After an argument', 'This made me tear up a bit. Glad you two were okay by the evening.', 20),
  ('Worried about a parent''s health', 'Sending you and your mum lots of warmth. The fixed call time is such a lovely idea.', 4),
  ('Worried about a parent''s health', 'I live far from my dad and feel the same guilt. I think I will try the evening calls too.', 36),
  ('Rent going up', 'Scary for one hour vs. scary for weeks. I needed to read that today, thank you.', 9),
  ('Rent going up', 'Good reminder to check for housing support, I did not even know that existed for students.', 28),
  ('Lying awake before a big day', 'The brain dump with a tiny next step next to each worry is the key part I think. Going to try it tonight.', 7),
  ('Lying awake before a big day', 'From 3 to 6 or 7 is a huge difference! Thanks for sharing the numbers.', 44),
  ('Dreading a party', 'The exit plan trick is so true. Once I know I can leave, I usually stay.', 2),
  ('Dreading a party', 'Asking how people know the host is such a good easy opener. Thank you!', 22),
  ('Tension headache from stress', 'The 50 minute timer helped me too. Also drinking more water made a difference for me.', 10),
  ('Tension headache from stress', 'Thanks for mentioning seeing a doctor if it continues. Good to hear the breaks helped.', 33)
) as c(title, body, hours) on c.title = s.title
where s.is_example;
