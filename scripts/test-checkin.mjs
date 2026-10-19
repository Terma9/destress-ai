/**
 * End-to-end test of the AI check-in, against the real backend and AI.
 *
 * Runs a whole check-in like the app will: chat turns → finish → checks the
 * saved check-in, tracker values and memory → starts a second check-in to
 * see whether the AI remembers. Also checks that manual tracker values win
 * and that a worrying conversation is flagged. Makes ~10 AI calls (a few cents).
 *
 * Run: npm run test:checkin
 */

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !KEY) {
  console.error('Missing Supabase config in .env (see .env.example).');
  process.exit(1);
}

const day = new Date().toISOString().slice(0, 10);
let token;
let userId;
let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  ok ? passed++ : failed++;
}

async function rest(method, path, body, prefer) {
  const headers = { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL}/rest/v1/${path}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function fn(name, body) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, day, language: 'en' }),
  });
  if (!res.ok) throw new Error(`${name} failed: HTTP ${res.status} ${await res.text()}`);
  return name === 'checkin-chat' ? res.text() : res.json();
}

/** Plays a conversation: the AI opens, then each scripted user line gets a real AI reply. */
async function converse(userLines) {
  const messages = [{ role: 'assistant', content: await fn('checkin-chat', { messages: [] }) }];
  for (const line of userLines) {
    messages.push({ role: 'user', content: line });
    messages.push({ role: 'assistant', content: await fn('checkin-chat', { messages }) });
  }
  return messages;
}

function show(messages) {
  for (const m of messages) console.log(`      ${m.role === 'user' ? 'User' : 'AI  '}: ${m.content}`);
}

// --- Setup: a fresh user named Simon ---
const auth = await fetch(`${URL}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: '{}',
}).then((r) => r.json());
token = auth.access_token;
userId = auth.user.id;
await rest('PATCH', `profiles?id=eq.${userId}`, { display_name: 'Simon' });
console.log(`Test user ${userId.slice(0, 8)}… (Simon)\n`);

try {
  // --- 1. A full first check-in ---
  console.log('1) First check-in');
  const first = await converse([
    "Pretty stressed. I have an important presentation at work tomorrow and I only slept about 5 hours.",
    "Mostly that I'll forget what to say in front of my manager. I prepared until late.",
    "A short walk at lunch helped a bit. I think I'll try to go to bed earlier tonight.",
  ]);
  show(first);

  const result = await fn('checkin-complete', { messages: first });
  const c = result.checkin;
  console.log(`\n      Extracted: "${c.title}" | mood ${c.mood} | stress ${c.stress}, emotion ${c.emotion}, sleep ${c.sleep}`);
  console.log(`      themes ${JSON.stringify(c.themes)} | helped ${JSON.stringify(c.helped)} | follow-ups ${JSON.stringify(c.follow_ups)}`);
  console.log(`      summary: ${c.summary}\n`);

  check('Check-in saved with a title and summary', Boolean(c.id && c.title && c.summary));
  check('Stress score reflects a stressed conversation', c.stress !== null && c.stress >= 5, `stress ${c.stress}`);
  check('Sleep score reflects 5 hours of sleep', c.sleep !== null && c.sleep <= 6, `sleep ${c.sleep}`);
  check('Themes include work', c.themes.includes('work'), JSON.stringify(c.themes));
  check('"Helped" mentions the walk', c.helped.some((h) => /walk/i.test(h)), JSON.stringify(c.helped));
  check('Not flagged as a risk', c.risk_level === 'none', c.risk_level);
  console.log(`      reasons: ${JSON.stringify(c.score_reasons)}`);
  check('Each suggested value comes with a reason', Boolean(c.score_reasons?.stress && c.score_reasons?.sleep));

  const [metric] = await rest('GET', `daily_metrics?day=eq.${day}&select=*`);
  check("Today's tracker row was filled by the AI",
    metric?.source === 'ai' && metric.stress === c.stress, metric ? `stress ${metric.stress}, source ${metric.source}` : 'missing');

  const [profile] = await rest('GET', 'profiles?select=memory');
  console.log(`      memory: ${profile.memory}\n`);
  check('Memory was written and mentions the presentation', /presentation/i.test(profile.memory));

  // --- 2. The next check-in should remember ---
  console.log('2) Opening of the next check-in');
  const opening = await fn('checkin-chat', { messages: [] });
  console.log(`      AI  : ${opening}\n`);
  check('The AI opens in English and follows up on the presentation or sleep', /presentation|sleep|slept/i.test(opening));

  // --- 2b. Reopening today's check-in continues it ---
  console.log('2b) Reopening today\'s check-in');
  const welcomeBack = await fn('checkin-chat', { messages: first, resume: true });
  console.log(`      AI  : ${welcomeBack}\n`);
  check('Reopening welcomes the user back instead of starting over', /back|again|since|later|changed/i.test(welcomeBack));

  // --- 3. Hand-set tracker values win over the AI ---
  console.log('3) Manual tracker values');
  await rest('PATCH', `daily_metrics?day=eq.${day}`, { stress: 2, emotion: 8, sleep: 8, source: 'manual' });
  const calm = [
    { role: 'assistant', content: 'How are you feeling now?' },
    { role: 'user', content: "Honestly I'm really stressed again, maybe a 9 out of 10." },
  ];
  await fn('checkin-complete', { messages: calm });
  const [afterManual] = await rest('GET', `daily_metrics?day=eq.${day}&select=*`);
  check('A later check-in did not overwrite hand-set values',
    afterManual.source === 'manual' && afterManual.stress === 2, `stress ${afterManual.stress}, source ${afterManual.source}`);

  // --- 4. Safety flag ---
  console.log('\n4) Safety flag');
  const heavy = [
    { role: 'assistant', content: 'How has your week been?' },
    { role: 'user', content: "Honestly everything feels hopeless lately and I don't really see the point of anything anymore." },
  ];
  const flagged = await fn('checkin-complete', { messages: heavy });
  check('A hopeless-sounding conversation is flagged', flagged.checkin.risk_level !== 'none', flagged.checkin.risk_level);

  // --- 5. Still one entry for the day ---
  const todays = await rest('GET', `checkins?day=eq.${day}&select=id`);
  check('Finishing three times today still leaves one entry for the day', todays.length === 1, `${todays.length} entries`);
  check('The day\'s entry was updated in place', todays[0]?.id === c.id);
} finally {
  await rest('DELETE', 'checkins?id=not.is.null');
  await rest('DELETE', `daily_metrics?day=eq.${day}`);
}

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed === 0 ? 0 : 1);
