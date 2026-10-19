/**
 * End-to-end test of success stories and the community, against the real
 * backend and AI.
 *
 * Untangle plan → the next check-in asks how it went → "it worked" becomes
 * a private success story → preview removes personal details → publishing
 * with personal details or harmful content is refused → a clean story is
 * published → another user sees it without any author info, votes on it,
 * and gets "For you" ranked by their own topics. Also checks that the
 * API can't be used to skip moderation. ~10 AI calls (a few cents).
 *
 * Run: npm run test:community
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

const day = new Date().toISOString().slice(0, 10);

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
    body: JSON.stringify({ day, language: 'en', ...body }),
  });
  const data = name.endsWith('-chat') ? await res.text() : await res.json().catch(() => null);
  return { status: res.status, data };
}

async function rest(token, method, path, body) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const feed = (token, args = {}) => rest(token, 'POST', 'rpc/community_feed', { p_limit: 50, ...args });

const author = await signUp();
await fn(author, 'seed-demo', {});

console.log('\n1. The next check-in follows up on an Untangle plan');
const problem = [{ role: 'user', content: 'My group presentation is tomorrow at 9 and a teammate still has not sent his part.' }];
problem.push({ role: 'assistant', content: (await fn(author, 'untangle-chat', { messages: problem, intensity: 8 })).data });
const plan = await fn(author, 'untangle-plan', { messages: problem, intensity: 8 });
check('Untangle plan saved', plan.status === 200, plan.data?.id);

const opening = (await fn(author, 'checkin-chat', { messages: [] })).data;
console.log(`      AI: ${opening}`);
check('the check-in asks how the presentation went', /presentation/i.test(opening));

const checkin = [
  { role: 'assistant', content: opening },
  { role: 'user', content: 'It went well! I sent a clear message, he replied late, and the backup slide I prepared calmed me down the most.' },
];
const done = await fn(author, 'checkin-complete', { messages: checkin });
const success = done.data?.successes?.[0];
check('"it worked" becomes a success story', !!success, success?.title);
const { data: sessions } = await rest(author, 'GET', 'untangle_sessions?select=outcome');
check('plan outcome recorded', sessions?.[0]?.outcome === 'worked', sessions?.[0]?.outcome);
const { data: stories } = await rest(author, 'GET', `success_stories?id=eq.${success?.id}&select=status,solution`);
check('the story starts private', stories?.[0]?.status === 'private');

console.log('\n2. Moderation can not be skipped');
const bypass = await rest(author, 'PATCH', `success_stories?id=eq.${success.id}`, { status: 'published', public_title: 'spam' });
check('setting status = published through the API is refused', bypass.status === 403 || bypass.status === 401, `HTTP ${bypass.status}`);

console.log('\n3. Preview removes personal details');
const personal = 'Lukas from my TU Berlin course finally sent it at 10pm. Ask me on Instagram @simon.k if you want the slide.';
const preview = await fn(author, 'community-publish', { storyId: success.id, action: 'preview', comment: personal });
const review = preview.data?.review;
console.log(`      comment → ${review?.comment}`);
console.log(`      removed: ${review?.personal_details?.join(', ')}`);
check('preview works and is allowed', preview.status === 200 && review?.allowed === true);
check('personal details are detected', review?.personal_details?.length >= 2);
const rewritten = [review?.title, review?.situation, review?.solution, review?.comment].join(' ');
check('anonymized text no longer contains them', !/Lukas|TU Berlin|@simon/i.test(rewritten));

console.log('\n4. Publishing checks the final text again');
const leaky = await fn(author, 'community-publish', {
  storyId: success.id, action: 'publish', title: review.title, situation: review.situation, solution: review.solution, comment: personal,
});
check('publishing with personal details is refused', leaky.status === 422, leaky.data?.error);
const harmful = await fn(author, 'community-publish', {
  storyId: success.id, action: 'publish', title: review.title, situation: review.situation, solution: review.solution,
  comment: 'Honestly just take a few of your sleeping pills with wine, that is what really calms me down.',
});
check('publishing medication advice is refused', harmful.status === 422, harmful.data?.error);
const ok = await fn(author, 'community-publish', {
  storyId: success.id, action: 'publish', title: review.title, situation: review.situation, solution: review.solution, comment: review.comment,
});
check('the anonymized story is published', ok.status === 200, ok.data?.error);
if (ok.status !== 200) {
  console.log(`
${passed} passed, ${failed + 1} failed (stopping: nothing to read)`);
  process.exit(1);
}

console.log('\n5. Another user reads and votes');
const reader = await signUp();
const { data: items } = await feed(reader);
const mine = items.find((s) => s.id === success.id);
check('the story is in the feed', !!mine, mine?.title);
check('the feed never contains user_id', items.every((s) => !('user_id' in s)));
check('example stories are labelled as examples', items.some((s) => s.is_example));
const direct = await rest(reader, 'GET', `success_stories?id=eq.${success.id}&select=id`);
check("reading other users' stories directly returns nothing", Array.isArray(direct.data) && direct.data.length === 0);

await rest(reader, 'POST', 'rpc/vote_story', { p_story: success.id, p_value: 1 });
let after = (await feed(reader)).data.find((s) => s.id === success.id);
check('upvote counts as "helpful"', after.helpful === 1 && after.my_vote === 1, `helpful ${after.helpful}`);
await rest(reader, 'POST', 'rpc/vote_story', { p_story: success.id, p_value: -1 });
check('"not for me" hides the story from that reader', !(await feed(reader)).data.some((s) => s.id === success.id));
const forAuthor = (await feed(author)).data.find((s) => s.id === success.id);
check('others still see it, and the downvote is never shown as a count', forAuthor?.helpful === 0 && forAuthor?.is_mine === true);
await rest(reader, 'POST', 'rpc/vote_story', { p_story: success.id, p_value: 0 });
check('undo brings it back', (await feed(reader)).data.some((s) => s.id === success.id));

const critic = await signUp();
await rest(critic, 'POST', 'rpc/report_story', { p_story: success.id, p_reason: 'test' });
check('reporting hides it for the reporter', !(await feed(critic)).data.some((s) => s.id === success.id));
check('one report does not hide it for everyone', (await feed(reader)).data.some((s) => s.id === success.id));

console.log('\n6. "For you" ranks by the reader\'s own topics');
await fn(reader, 'seed-demo', {}); // the student persona: exams, sleep, walks
const { data: forMe } = await feed(reader, { p_for_me: true });
console.log(`      top 3: ${forMe.slice(0, 3).map((s) => `${s.title} (${s.theme}, ${s.relevance?.toFixed(2)})`).join(' · ')}`);
check('relevance is computed', forMe.slice(0, 3).every((s) => typeof s.relevance === 'number'));
check('top match fits the student (study or sleep)', ['study', 'sleep'].includes(forMe[0]?.theme), forMe[0]?.theme);

console.log('\n7. Unpublish');
await rest(author, 'POST', 'rpc/unpublish_story', { p_story: success.id });
check('the author can take it down again', !(await feed(reader)).data.some((s) => s.id === success.id));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
