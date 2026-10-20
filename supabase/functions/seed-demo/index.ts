/**
 * seed-demo — fills an empty account with the demo persona Jonas (4 weeks).
 *
 * Request:  POST { day?: 'YYYY-MM-DD' }  (the user's local date; everything is
 *           dated relative to it, so the demo always looks recent)
 * Response: { inserted } — the number of check-ins added.
 *
 * Loads every feature's data: check-ins + calendar values, the AI's memory,
 * last week's Weekly Insights, a Calm Now session, two Stress Solving plans
 * (one active, one solved) and the solved plan's story in the community with comments.
 * Only works on accounts without check-ins, so real entries never mix with demo data.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { checkQuota } from '../_shared/quota.ts';
import { span, traced } from '../_shared/tracing.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { indexExampleStories, storyDocument } from '../_shared/community.ts';
import * as demo from '../_shared/fixtures/demo-jonas.ts';
import { getEmbedder } from '../_shared/llm/index.ts';
import { indexMissing } from '../_shared/rag.ts';
import { parseDay } from '../_shared/validation.ts';

const DAY_MS = 86_400_000;
const toDate = (day: string) => new Date(`${day}T12:00:00Z`);
const toDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Turns (week, weekday) into a date. Week 4 ends on the most recent Sunday
 * before today; week 5 is the days after it. Null for days not yet past.
 */
function dater(today: string) {
  const t = toDate(today);
  const weekday = ((t.getUTCDay() + 6) % 7) + 1; // 1 = Monday … 7 = Sunday
  const lastSunday = new Date(t.getTime() - (weekday === 7 ? 7 : weekday) * DAY_MS);
  return (week: number, day: number, time = '19:00:00'): string | null => {
    const date = new Date(lastSunday.getTime() + ((week - 4) * 7 + (day - 7)) * DAY_MS);
    if (toDay(date) >= today) return null;
    return `${toDay(date)}T${time}Z`;
  };
}

export default {
  fetch: withSupabase({ auth: 'user' }, traced('seed-demo', async (req, ctx, trace) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }
    const overQuota = await checkQuota(ctx.supabase);
    if (overQuota) return overQuota;
    const today = parseDay(await req.json().catch(() => null)) ?? toDay(new Date());
    const at = dater(today);
    const db = ctx.supabase;
    const userId = ctx.userClaims!.id;

    const { count } = await db.from('checkins').select('id', { count: 'exact', head: true });
    if (count) {
      return Response.json({ error: 'Demo data can only be added to an account without check-ins.' }, { status: 409 });
    }

    // ─── Check-ins + calendar values ──────────────────────────────────────
    const entries = demo.checkins
      .map((c) => ({ c, when: at(c.week, c.weekday) }))
      .filter((e): e is { c: demo.DemoCheckin; when: string } => e.when !== null);

    const { data: inserted, error } = await db
      .from('checkins')
      .insert(
        entries.map(({ c, when }) => ({
          title: c.title,
          summary: c.summary,
          mood: c.mood,
          stress: c.stress,
          sleep: c.sleep,
          emotion: c.emotion,
          themes: c.themes,
          helped: c.helped,
          score_reasons: c.reasons,
          messages: c.messages,
          risk_level: 'none',
          day: when.slice(0, 10),
          created_at: when,
          completed_at: when,
        })),
      )
      .select('id');
    if (error || !inserted) {
      console.error('Seeding check-ins failed:', error);
      return Response.json({ error: 'Could not add the demo data.' }, { status: 500 });
    }
    // Rows come back in insert order: map the fixture keys to the new ids.
    const idOf = new Map(entries.map(({ c }, i) => [c.key, inserted[i].id as string]));
    const ids = (keys: string[]) => keys.map((k) => idOf.get(k)).filter((id): id is string => !!id);
    const withIds = <T extends { evidence: string[] }>(items: T[]) => items.map((x) => ({ ...x, evidence: ids(x.evidence) }));

    const { error: metricsError } = await db.from('daily_metrics').upsert(
      entries.map(({ c, when }) => ({
        day: when.slice(0, 10),
        stress: c.stress,
        emotion: c.emotion,
        sleep: c.sleep,
        source: 'ai',
      })),
      { onConflict: 'user_id,day', ignoreDuplicates: true },
    );
    if (metricsError) console.error('Seeding metrics failed:', metricsError);

    await db
      .from('profiles')
      .update({ display_name: demo.name, memory: demo.memory, updated_at: new Date().toISOString() })
      .eq('id', userId);

    // Mark the account as a demo account. app_metadata can only be set with the
    // service role and travels in the user's login token, so tracing can trust
    // it: demo traces (fictional Jonas) are sent to Langfuse unmasked.
    const { error: flagError } = await createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    }).auth.admin.updateUserById(userId, { app_metadata: { demo: true } });
    if (flagError) console.error('Marking the demo account failed:', flagError);

    // ─── Weekly Insights from the end of week 4 (fixed, so they stay simple) ─────────────────────────
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
    const weekOf = (w: number) => {
      const cs = demo.checkins.filter((c) => c.week === w);
      return { stress: avg(cs.map((c) => c.stress)), sleep: avg(cs.map((c) => c.sleep)), mood: avg(cs.map((c) => c.emotion)) };
    };
    const a = demo.analysis;
    const { data: analysis, error: analysisError } = await db
      .from('analyses')
      .insert({
        created_at: at(a.week, 7, '20:30:00'),
        checkin_count: demo.checkins.filter((c) => c.week <= a.week).length,
        insight: a.insight,
        model: 'demo',
        prompt_version: 'demo',
        week: { checkins: demo.checkins.filter((c) => c.week === a.week).length, thisWeek: weekOf(a.week), lastWeek: weekOf(a.week - 1) },
        worked: a.worked,
        question: a.question,
      })
      .select('id')
      .single();
    if (analysisError) console.error('Seeding the analysis failed:', analysisError);
    if (analysis) {
      await db.from('deep_dives').insert(
        a.patterns.map((p, position) => ({
          analysis_id: analysis.id,
          position,
          title: p.title,
          description: p.description,
          icon: p.icon,
          findings: withIds(p.findings),
          questions: p.questions,
        })),
      );
    }

    // ─── Untangle: Calm Now + two plans ───────────────────────────────────
    const calm = demo.calmSession;
    const boss = demo.bossPlan;
    const sleep = demo.sleepPlan;
    const planOf = (p: typeof boss.plan) => ({ ...p, lessons: withIds(p.lessons) });
    const solvedAt = at(sleep.solvedWeek, sleep.solvedWeekday);
    const { data: sessions, error: untangleError } = await db
      .from('untangle_sessions')
      .insert([
        {
          kind: 'calm',
          title: calm.title,
          problem: calm.messages[0].content,
          messages: calm.messages,
          intensity_before: calm.before,
          intensity_after: calm.after,
          plan: null,
          status: 'active',
          plan_history: [],
          outcome: null,
          outcome_note: null,
          outcome_at: null,
          created_at: at(calm.week, calm.weekday, '15:15:00'),
          updated_at: at(calm.week, calm.weekday, '15:30:00'),
          completed_at: at(calm.week, calm.weekday, '15:30:00'),
        },
        {
          kind: 'plan',
          status: 'active',
          title: boss.title,
          problem: boss.problem,
          messages: boss.messages,
          intensity_before: boss.before,
          intensity_after: boss.after,
          plan: planOf(boss.plan),
          plan_history: [],
          outcome: 'partly',
          outcome_note: 'Markus agreed to the 4 pm rule. Late tasks now wait until the morning.',
          outcome_at: at(4, 2, '20:00:00'),
          completed_at: null,
          created_at: at(boss.week, boss.weekday, '21:00:00'),
          updated_at: at(4, 2, '20:00:00'),
        },
        {
          kind: 'plan',
          status: 'solved',
          title: sleep.title,
          problem: sleep.problem,
          messages: sleep.messages,
          intensity_before: sleep.before,
          intensity_after: sleep.after,
          plan: planOf(sleep.plan),
          plan_history: [],
          outcome: 'worked',
          outcome_note: 'Walks after work and no phone in the bedroom. Now I sleep 7 to 8 hours.',
          outcome_at: solvedAt,
          created_at: at(sleep.week, sleep.weekday, '20:00:00'),
          updated_at: solvedAt,
          completed_at: solvedAt,
        },
      ])
      .select('id, title');
    if (untangleError) console.error('Seeding Untangle failed:', untangleError);

    // ─── The solved plan's story, published, with comments ────────────────
    // Publishing needs the service role (users can't set published themselves).
    const sleepSession = sessions?.find((s) => s.title === sleep.title);
    try {
      const embedder = getEmbedder(trace);
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false },
      });
      const story = sleep.story;
      const [vector] = await embedder.embed([storyDocument({ title: story.title, body: story.body })]);
      const publishedAt = at(sleep.solvedWeek, 6, '11:00:00');
      // Like the real flow: the user creates the private story, the server publishes it.
      const { data: saved, error: storyError } = await db
        .from('success_stories')
        .insert({
          session_id: sleepSession?.id ?? null,
          theme: 'sleep',
          title: sleep.title,
          situation: sleep.problem,
          solution: sleep.plan.steps.map((s) => s.text).join(' '),
          intensity_before: sleep.before,
          intensity_after: sleep.after,
        })
        .select('id')
        .single();
      if (storyError) throw storyError;
      const { error: publishError } = await admin
        .from('success_stories')
        .update({
          body: story.body,
          status: 'published',
          is_demo: true, // only this demo account sees it, not every visitor
          public_title: story.title,
          public_body: story.body,
          published_at: publishedAt,
          created_at: solvedAt,
          embedding: JSON.stringify(vector),
        })
        .eq('id', saved.id)
        .eq('user_id', userId);
      if (publishError) throw publishError;
      await admin.from('story_comments').insert(
        story.comments.map((c, i) => ({
          story_id: saved.id,
          author_name: c.author,
          body: c.body,
          created_at: new Date(Date.parse(publishedAt!) + (i + 1) * 5 * 3_600_000).toISOString(),
        })),
      );
    } catch (err) {
      console.error('Seeding the story failed:', err);
    }

    // Make the check-ins searchable by meaning right away (RAG), and the example stories matchable.
    try {
      const embedder = getEmbedder(trace);
      await indexMissing(db, embedder);
      await indexExampleStories(db, embedder);
    } catch (err) {
      console.error('Indexing the demo failed:', err);
    }

    return Response.json({ inserted: inserted.length });
    })),
};
