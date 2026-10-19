// Loads the demo persona into a fresh anonymous account and prints what arrived.
// Usage: node --env-file=.env scripts/check-demo.mjs
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
const { data: auth, error: authError } = await db.auth.signInAnonymously();
if (authError) throw authError;

const day = new Date().toLocaleDateString('sv');
const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/seed-demo`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${auth.session.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ day }),
});
console.log('seed-demo:', res.status, await res.text());

const count = async (table, filter = (q) => q) =>
  (await filter(db.from(table).select('*', { count: 'exact', head: true }))).count;
const { data: days } = await db.from('checkins').select('day, title, stress, emotion').order('day');
console.log('check-ins:', days.length, '| first', days[0]?.day, '| last', days.at(-1)?.day, '| today', day);
console.log('sundays:', days.filter((d) => new Date(`${d.day}T12:00:00`).getDay() === 0).map((d) => `${d.day} ${d.title} s${d.stress} m${d.emotion}`));
console.log('metrics:', await count('daily_metrics'), '| chunks:', await count('checkin_chunks'));
console.log('analyses:', await count('analyses'), '| patterns:', await count('deep_dives'));
const { data: sessions } = await db.from('untangle_sessions').select('kind, status, title, plan_history');
console.log('untangle:', sessions.map((s) => `${s.kind}/${s.status} "${s.title}" v${s.plan_history.length + 1}`));
const { data: feed } = await db.rpc('community_feed', {});
const mine = feed.find((f) => f.is_mine);
console.log('community story:', mine?.title, '| comments:', mine?.comments);
const { data: patterns } = await db.from('deep_dives').select('title, findings');
console.log('evidence ids mapped:', patterns.map((p) => p.findings.map((f) => f.evidence.length)));
