/**
 * End-to-end test of Deep Dives, against the real backend and AI.
 *
 * Fresh account → too few check-ins is refused → load the demo persona →
 * generate → checks the saved analysis and every citation → a second run
 * is refused until there are new check-ins → reflections save, and another
 * user can neither read the analysis nor attach a reflection to it.
 * Makes 1 AI call (a few cents). Quality is measured separately by the evals.
 *
 * Run: npm run test:deep-dives
 */

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !KEY) {
  console.error('Missing Supabase config in .env (see .env.example).');
  process.exit(1);
}

let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  ok ? passed++ : failed++;
}

async function signUp() {
  const res = await fetch(`${URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`Anonymous sign-up failed: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function rest(token, method, path, body, prefer) {
  const headers = { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL}/rest/v1/${path}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function fn(token, name, body = {}) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ day: new Date().toISOString().slice(0, 10), language: 'en', ...body }),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const token = await signUp();

console.log('\n1. Locked until enough check-ins');
const early = await fn(token, 'deep-dive-generate');
check('generating with 0 check-ins is refused', early.status === 409, early.data?.error);

console.log('\n2. Demo data');
const seeded = await fn(token, 'seed-demo');
check('demo persona loaded', seeded.status === 200 && seeded.data?.inserted === 17, `${seeded.data?.inserted} check-ins`);

console.log('\n3. Generate (one AI call, ~30 s)');
const started = Date.now();
const gen = await fn(token, 'deep-dive-generate');
check('analysis generated', gen.status === 200 && !!gen.data?.analysisId, `${((Date.now() - started) / 1000).toFixed(0)} s`);

const { data: analyses } = await rest(
  token,
  'GET',
  'analyses?select=*,deep_dives(*)&order=created_at.desc&limit=1',
);
const analysis = analyses?.[0];
const dives = (analysis?.deep_dives ?? []).sort((a, b) => a.position - b.position);
const { data: checkins } = await rest(token, 'GET', 'checkins?select=id');
const ownIds = new Set(checkins.map((c) => c.id));

check('insight written', analysis?.insight?.length > 10, analysis?.insight);
check('2–3 deep dives', dives.length >= 2 && dives.length <= 3, `${dives.length}`);
check('model and prompt version recorded', !!analysis?.model && !!analysis?.prompt_version, `${analysis?.model}, ${analysis?.prompt_version}`);
check('stats computed by code', analysis?.stats?.checkins === 17, `dropped findings: ${analysis?.dropped_findings}`);

const findings = dives.flatMap((d) => d.findings);
check('every finding cites ≥ 2 entries', findings.length > 0 && findings.every((f) => f.evidence.length >= 2));
check('every citation is one of the user\'s check-ins', findings.every((f) => f.evidence.every((id) => ownIds.has(id))));
check('every deep dive has reflection questions', dives.every((d) => d.questions.length >= 1));

for (const d of dives) {
  console.log(`\n      [${d.icon}] ${d.title}\n      ${d.description}`);
  for (const f of d.findings) console.log(`        • ${f.text} (${f.evidence.length} entries)`);
  for (const q of d.questions) console.log(`        ? ${q}`);
}

console.log('\n4. Refresh rule');
const again = await fn(token, 'deep-dive-generate');
check('second run without new check-ins is refused', again.status === 409, again.data?.error);

console.log('\n5. Reflections and privacy');
const dive = dives[0];
const reflection = { deep_dive_id: dive.id, question_index: 0, question: dive.questions[0], answer: 'Test answer.' };
const saved = await rest(token, 'POST', 'reflections?on_conflict=deep_dive_id,question_index', reflection, 'resolution=merge-duplicates');
check('own reflection saved', saved.status === 201, `HTTP ${saved.status}`);
const updated = await rest(
  token,
  'POST',
  'reflections?on_conflict=deep_dive_id,question_index',
  { ...reflection, answer: 'Changed my mind.' },
  'resolution=merge-duplicates,return=representation',
);
check('saving again replaces the answer (upsert)', updated.data?.[0]?.answer === 'Changed my mind.');

const stranger = await signUp();
const peek = await rest(stranger, 'GET', `analyses?id=eq.${analysis.id}&select=id`);
check("another user can't read the analysis", Array.isArray(peek.data) && peek.data.length === 0);
const sneak = await rest(stranger, 'POST', 'reflections', { ...reflection, answer: 'Not mine.' });
check("another user can't attach a reflection to it", sneak.status === 403 || sneak.status === 401, `HTTP ${sneak.status}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
