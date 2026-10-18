/**
 * seed-demo — fills an empty account with three weeks of demo check-ins.
 *
 * Request:  POST { day?: 'YYYY-MM-DD' }  (the user's local date; entries are
 *           dated relative to it, so the demo always looks recent)
 * Response: { inserted } — the number of check-ins added.
 *
 * Lets a visitor (or an interviewer) try Deep Dives without writing 17
 * check-ins first. The same persona is the ground truth for the evals.
 * Only works on accounts without check-ins, so real entries never mix with demo data.
 */
import { withSupabase } from 'npm:@supabase/server@1';
import persona from '../_shared/fixtures/student-persona.json' with { type: 'json' };
import { parseDay } from '../_shared/validation.ts';

/** `day` minus `daysAgo` calendar days, as YYYY-MM-DD. */
function shiftDay(day: string, daysAgo: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }
    const today = parseDay(await req.json().catch(() => null));
    const db = ctx.supabase;

    const { count } = await db.from('checkins').select('id', { count: 'exact', head: true });
    if (count) {
      return Response.json({ error: 'Demo data can only be added to an account without check-ins.' }, { status: 409 });
    }

    const rows = persona.checkins.map(({ daysAgo, labels: _labels, ...entry }) => {
      const at = `${shiftDay(today, daysAgo)}T18:00:00Z`;
      return { ...entry, risk_level: 'none', created_at: at, completed_at: at };
    });

    // One insert with many rows is one statement: either all check-ins are saved or none.
    const { error } = await db.from('checkins').insert(rows);
    if (error) {
      console.error('Seeding check-ins failed:', error);
      return Response.json({ error: 'Could not add the demo data.' }, { status: 500 });
    }

    // Tracker values for the same days. ignoreDuplicates keeps any day the user already has.
    const metrics = persona.checkins.map((c) => ({
      day: shiftDay(today, c.daysAgo),
      stress: c.stress,
      emotion: c.emotion,
      sleep: c.sleep,
      source: 'ai',
    }));
    const { error: metricsError } = await db
      .from('daily_metrics')
      .upsert(metrics, { onConflict: 'user_id,day', ignoreDuplicates: true });
    if (metricsError) console.error('Seeding metrics failed:', metricsError);

    // Give the AI the persona's memory, unless it already knows something about the user.
    const { error: memoryError } = await db
      .from('profiles')
      .update({ memory: persona.memory, updated_at: new Date().toISOString() })
      .eq('id', ctx.userClaims!.id)
      .eq('memory', '');
    if (memoryError) console.error('Seeding memory failed:', memoryError);

    return Response.json({ inserted: rows.length });
  }),
};
