/**
 * seed-demo — fills an empty account with the demo persona Jonas (4 weeks).
 *
 * Request:  POST { day?: 'YYYY-MM-DD' }  (the user's local date; everything is
 *           dated relative to it, so the demo always looks recent)
 * Response: { inserted } — the number of check-ins added.
 *
 * Loads every feature's data: check-ins + calendar values, the AI's memory,
 * last Weekly Insights (this week's are then generated live by the app),
 * a Calm now session, two Stress solving plans (one with an earlier version,
 * one solved) and the solved plan's story in the community with comments.
 * Only works on accounts without check-ins, so real entries never mix with demo data.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { checkQuota } from '../_shared/quota.ts';
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
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
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

    // ─── Weekly Insights from the end of week 2 ───────────────────────────
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

    // ─── Untangle: Calm now + two plans ───────────────────────────────────
    const calm = demo.calmSession;
    const sun = demo.sundayPlan;
    const pres = demo.presentationPlan;
    const planOf = (p: typeof sun.v2) => ({ ...p, lessons: withIds(p.lessons) });
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
          created_at: at(calm.week, calm.weekday, '20:15:00'),
          updated_at: at(calm.week, calm.weekday, '20:30:00'),
          completed_at: at(calm.week, calm.weekday, '20:30:00'),
        },
        {
          kind: 'plan',
          status: 'active',
          title: sun.title,
          problem: sun.problem,
          messages: sun.messages,
          intensity_before: sun.before,
          intensity_after: sun.after,
          plan: planOf(sun.v2),
          plan_history: [{ plan: planOf(sun.v1), replaced_at: at(sun.updatedWeek, sun.updatedWeekday, '20:00:00') }],
          outcome: 'partly',
          outcome_note: 'The Friday shutdown worked: the first calm Sunday in a month.',
          outcome_at: at(4, 7, '19:30:00'),
          completed_at: null,
          created_at: at(sun.week, sun.weekday, '20:00:00'),
          updated_at: at(4, 7, '19:30:00'),
        },
        {
          kind: 'plan',
          status: 'solved',
          title: pres.title,
          problem: pres.problem,
          messages: pres.messages,
          intensity_before: pres.before,
          intensity_after: pres.after,
          plan: planOf(pres.plan),
          plan_history: [],
          outcome: 'worked',
          outcome_note: 'Preparing answers to the questions I feared, and rehearsing out loud.',
          outcome_at: at(pres.week, pres.solvedWeekday),
          created_at: at(pres.week, pres.weekday, '20:00:00'),
          updated_at: at(pres.week, pres.solvedWeekday),
          completed_at: at(pres.week, pres.solvedWeekday),
        },
      ])
      .select('id, title');
    if (untangleError) console.error('Seeding Untangle failed:', untangleError);

    // ─── The solved plan's story, published, with comments ────────────────
    // Publishing needs the service role (users can't set published themselves).
    const presSession = sessions?.find((s) => s.title === pres.title);
    try {
      const embedder = getEmbedder();
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false },
      });
      const story = pres.story;
      const [vector] = await embedder.embed([storyDocument({ title: story.title, body: story.body })]);
      const publishedAt = at(pres.week, 6, '11:00:00');
      // Like the real flow: the user creates the private story, the server publishes it.
      const { data: saved, error: storyError } = await db
        .from('success_stories')
        .insert({
          session_id: presSession?.id ?? null,
          theme: 'work',
          title: pres.title,
          situation: pres.problem,
          solution: pres.plan.steps.map((s) => s.text).join(' '),
          intensity_before: pres.before,
          intensity_after: pres.after,
        })
        .select('id')
        .single();
      if (storyError) throw storyError;
      const { error: publishError } = await admin
        .from('success_stories')
        .update({
          body: story.body,
          status: 'published',
          public_title: story.title,
          public_body: story.body,
          published_at: publishedAt,
          created_at: at(pres.week, pres.solvedWeekday),
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
      const embedder = getEmbedder();
      await indexMissing(db, embedder);
      await indexExampleStories(db, embedder);
    } catch (err) {
      console.error('Indexing the demo failed:', err);
    }

    return Response.json({ inserted: inserted.length });
  }),
};
