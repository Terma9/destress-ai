/**
 * Tests RAG retrieval against the real backend, using the demo persona.
 *
 * The persona's labels say which entries are about exams or walks, so we
 * know what each search should find. Checks the top results (precision@3),
 * search across languages, that unrelated queries find little, that a long
 * check-in about four topics is split into topic chunks and found for each
 * topic, and that search never returns another user's entries.
 * Makes 1 extraction call plus a few embeddings (about a cent).
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

async function countRows(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, Prefer: 'count=exact', Range: '0-0' },
  });
  return Number(res.headers.get('content-range')?.split('/')[1]);
}
const chunks = await countRows('checkin_chunks?select=id');
check('every demo check-in is indexed (one whole-check-in chunk each)', chunks === 17, `${chunks} chunks`);

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

console.log('\n  Long check-in about four topics (through checkin-complete, with topic splitting)');
const longCheckin = [
  { role: 'assistant', content: 'Hi! How was your day?' },
  { role: 'user', content: "So much today. First, the Statistics resit is in a week and I'm already panicking, I studied until 1am again." },
  { role: 'assistant', content: "That's a lot of pressure already. What else is on your mind?" },
  { role: 'user', content: "My mum called, she's having health problems and I feel guilty that I can't visit her because of uni." },
  { role: 'assistant', content: 'That sounds really hard. Anything else weighing on you?' },
  { role: 'user', content: "Also my landlord is raising the rent next month and I honestly don't know how I'll pay it with only the café job." },
  { role: 'assistant', content: 'Was there any moment today that felt a bit lighter?' },
  { role: 'user', content: 'The only good part: I walked along the river in the evening and for twenty minutes my head was quiet.' },
];
const done = await fn(token, 'checkin-complete', { messages: longCheckin, day: new Date().toISOString().slice(0, 10), language: 'en' });
const longId = done.data?.checkin?.id;
const topics = await (await fetch(`${URL}/rest/v1/checkin_chunks?select=topic,summary,content&checkin_id=eq.${longId}`, {
  headers: { apikey: KEY, Authorization: `Bearer ${token}` },
})).json();
for (const t of topics) console.log(`      [${t.topic}] ${t.summary}`);
check('long check-in split into ≥ 3 topic chunks', topics.length >= 3, `${topics.length} chunks`);
check("topic chunks contain the user's exact words", topics.some((t) => t.content.includes('I studied until 1am again')));

for (const query of ['panicking before an exam', 'worried about paying rent', 'worried about my mum']) {
  const results = await search(token, query);
  const rank = results.findIndex((r) => r.id === longId) + 1;
  check(`"${query}" finds the long check-in`, rank > 0, rank ? `rank ${rank}` : 'not found');
}

const stranger = await signUp();
const peek = await fn(stranger, 'search-checkins', { query: 'exam' });
check("another user's search finds none of these entries", peek.status === 200 && peek.data.results.length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
