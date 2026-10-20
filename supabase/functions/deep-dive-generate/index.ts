/**
 * deep-dive-generate — writes the user's Weekly Insights: this week vs last
 * week (code), 1–3 patterns with cited entries, what worked, and a question
 * for the week ahead. The app calls it automatically once it's due.
 *
 * Request:  POST { language?: 'en' }  (the language the Deep Dives are written in)
 * Response: { analysisId }
 *
 * Steps: load check-ins → compute facts in code → one structured-output AI
 * call → validate every citation → save. Runs as the calling user (RLS).
 * Only allowed with enough check-ins, and again only after a few new ones,
 * which also keeps the cost per user in check.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { checkQuota } from '../_shared/quota.ts';
import { span, traced } from '../_shared/tracing.ts';
import {
  ANALYSIS_SCHEMA,
  type AnalysisOutput,
  buildAnalysisInput,
  buildAnalysisSystemPrompt,
  computeStats,
  computeWeek,
  DAYS_BETWEEN,
  type Entry,
  MAX_ENTRIES,
  MIN_CHECKINS,
  NEW_CHECKINS_FOR_REFRESH,
  PROMPT_VERSION,
  validateAnalysis,
} from '../_shared/analysis.ts';
import { getLLM, type ChatMessage } from '../_shared/llm/index.ts';
import { parseLanguage } from '../_shared/validation.ts';

/** The user's local date (YYYY-MM-DD) from the request, so "this week" matches their calendar. */
function parseToday(body: unknown): string {
  const day = (body as { day?: unknown })?.day;
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date().toISOString().slice(0, 10);
}

/** What the user said in a check-in, shortened so 40 entries stay a reasonable prompt size. */
function userWords(messages: ChatMessage[]): string {
  const text = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .join(' / ');
  return text.length > 600 ? `${text.slice(0, 600)}…` : text;
}

export default {
  fetch: withSupabase({ auth: 'user' }, traced('deep-dive-generate', async (req, ctx, trace) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }
    const overQuota = await checkQuota(ctx.supabase);
    if (overQuota) return overQuota;
    const body = await req.json().catch(() => null);
    const language = parseLanguage(body);
    const today = parseToday(body);
    const db = ctx.supabase;

    const [{ data: rows, error: loadError }, { data: last }, { data: profile }, { data: plans }] = await Promise.all([
      db
        .from('checkins')
        .select('id, day, created_at, title, summary, mood, stress, emotion, sleep, themes, helped, messages')
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(MAX_ENTRIES),
      db.from('analyses').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('profiles').select('display_name').maybeSingle(),
      db
        .from('untangle_sessions')
        .select('title, outcome, outcome_note')
        .not('outcome', 'is', null)
        .gte('outcome_at', new Date(Date.now() - 14 * 86_400_000).toISOString())
        .limit(10),
    ]);
    if (loadError || !rows) {
      console.error('Loading check-ins failed:', loadError);
      return Response.json({ error: 'Could not load your check-ins.' }, { status: 500 });
    }

    if (rows.length < MIN_CHECKINS) {
      return Response.json(
        { error: `Weekly Insights unlock after ${MIN_CHECKINS} check-ins. You have ${rows.length}.` },
        { status: 409 },
      );
    }
    if (last) {
      if (Date.now() - Date.parse(last.created_at) < DAYS_BETWEEN * 86_400_000) {
        return Response.json({ error: 'Your next Weekly Insights come 7 days after the last ones.' }, { status: 409 });
      }
      const { count } = await db
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .gt('completed_at', last.created_at);
      if ((count ?? 0) < NEW_CHECKINS_FOR_REFRESH) {
        return Response.json(
          { error: `A new analysis needs ${NEW_CHECKINS_FOR_REFRESH} new check-ins since the last one.` },
          { status: 409 },
        );
      }
    }

    // Short labels (E1, E2, …) instead of ids: models copy "E7" reliably, long UUIDs not always.
    const entries: Entry[] = rows.map((r, i) => ({
      ref: `E${i + 1}`,
      id: r.id,
      day: r.day ?? r.created_at.slice(0, 10),
      title: r.title,
      summary: r.summary,
      mood: r.mood,
      stress: r.stress,
      emotion: r.emotion,
      sleep: r.sleep,
      themes: r.themes,
      helped: r.helped,
      userWords: userWords(r.messages as ChatMessage[]),
    }));
    const stats = computeStats(entries);
    const week = computeWeek(entries, today);
    const outcomes = (plans ?? []).map((p) => ({ title: p.title, outcome: p.outcome, note: p.outcome_note }));

    const llm = getLLM(trace);
    let result: ReturnType<typeof validateAnalysis>;
    try {
      const output = await llm.generateJson<AnalysisOutput>({
        task: 'analysis',
        system: buildAnalysisSystemPrompt({ name: profile?.display_name ?? null, language }),
        messages: [{ role: 'user', content: buildAnalysisInput(entries, stats, week, outcomes) }],
        schemaName: 'deep_dives',
        schema: ANALYSIS_SCHEMA,
      });
      result = validateAnalysis(output, entries);
    } catch (err) {
      console.error('Analysis failed:', err);
      return Response.json({ error: 'The AI could not analyze your entries. Try again.' }, { status: 502 });
    }
    if (!result.deepDives.length) {
      return Response.json(
        { error: "No clear patterns yet. Keep checking in and try again later." },
        { status: 422 },
      );
    }

    const { data: analysis, error: analysisError } = await db
      .from('analyses')
      .insert({
        checkin_count: entries.length,
        insight: result.insight,
        stats,
        model: llm.models.analysis,
        prompt_version: PROMPT_VERSION,
        dropped_findings: result.droppedFindings,
        week,
        worked: result.worked,
        question: result.question || null,
      })
      .select('id')
      .single();
    if (analysisError) {
      console.error('Saving analysis failed:', analysisError);
      return Response.json({ error: 'Could not save the analysis.' }, { status: 500 });
    }

    const { error: divesError } = await db
      .from('deep_dives')
      .insert(result.deepDives.map((d, position) => ({ ...d, analysis_id: analysis.id, position })));
    if (divesError) {
      // Two separate writes aren't atomic, so undo the first one by hand
      // (a "compensating action"). A database transaction would do this for us.
      console.error('Saving deep dives failed:', divesError);
      await db.from('analyses').delete().eq('id', analysis.id);
      return Response.json({ error: 'Could not save the analysis.' }, { status: 500 });
    }

    return Response.json({ analysisId: analysis.id });
    }, { prompt_version: PROMPT_VERSION })),
};
