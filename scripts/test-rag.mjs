/**
 * Tests RAG retrieval against the real backend, using the demo persona.
 *
 * The persona's labels say which entries are about exams or walks, so we
 * know what each search should find. Checks the top results (precision@3),
 * search across languages, that unrelated queries find little, and that
 * search never returns another user's entries. Costs a fraction of a cent.
 *
 * Run: npm run test:rag
 */
import { readFileSync } from 'node:fs';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !KEY) {
  console.error('Missing Supabase config in .env (see .env.example).');
  process.exit(1);
}

const persona = JSON.parse(
  readFileSync(new globalThis.URL('../supabase/functions/_shared/fixtures/student-persona.json', import.meta.url)),
);
const labelsByTitle = new Map(persona.checkins.map((c) => [c.title, c.labels]));

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
  return (await res.json()).access_token;
}

async function fn(token, name, body) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function search(token, query) {
  const { status, data } = await fn(token, 'search-checkins', { query });
  if (status !== 200) throw new Error(`search failed: HTTP ${status} ${JSON.stringify(data)}`);
  console.log(`\n  "${query}"`);
  for (const r of data.results) {
    console.log(`      ${r.similarity.toFixed(2)}  ${r.title}  [${(labelsByTitle.get(r.title) ?? []).join(', ')}]`);
  }
  return data.results;
}

/** Share of the top 3 results that carry one of `labels`. */
function precisionAt3(results, labels) {
  const top = results.slice(0, 3);
  const hits = top.filter((r) => (labelsByTitle.get(r.title) ?? []).some((l) => labels.includes(l))).length;
  return top.length ? hits / top.length : 0;
}

const token = await signUp();
const seeded = await fn(token, 'seed-demo', { day: new Date().toISOString().slice(0, 10) });
check('demo persona loaded and embedded', seeded.status === 200, `${seeded.data?.inserted} check-ins`);

const { count } = await (async () => {
  const res = await fetch(`${URL}/rest/v1/checkins?select=id&embedding=not.is.null`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, Prefer: 'count=exact', Range: '0-0' },
  });
  return { count: Number(res.headers.get('content-range')?.split('/')[1]) };
})();
check('every check-in has an embedding', count === 17, `${count} of 17`);

const exams = await search(token, 'stressed and sleeping badly before an exam');
const p1 = precisionAt3(exams, ['pre_exam', 'exam_day']);
check('exam query: top 3 are exam entries', p1 === 1, `precision@3 = ${p1.toFixed(2)}`);
check(
  'exam query also finds the German entries',
  exams.some((r) => labelsByTitle.has(r.title) && /Prüfung/.test(r.title)),
);

const calm = await search(token, 'what helped me feel calm');
const p2 = precisionAt3(calm, ['walk', 'post_exam']);
check('calm query: top 3 are calm days', p2 >= 2 / 3, `precision@3 = ${p2.toFixed(2)}`);

const german = await search(token, 'Spaziergang an der frischen Luft');
const p3 = precisionAt3(german, ['walk']);
check('German query finds English walk entries', p3 >= 2 / 3, `precision@3 = ${p3.toFixed(2)}`);

const unrelated = await search(token, 'recipe for tomato pasta');
check('unrelated query finds (almost) nothing', unrelated.length <= 1, `${unrelated.length} results`);

const stranger = await signUp();
const peek = await fn(stranger, 'search-checkins', { query: 'exam' });
check("another user's search finds none of these entries", peek.status === 200 && peek.data.results.length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
