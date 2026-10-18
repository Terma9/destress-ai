/**
 * Row Level Security test against the real Supabase project.
 *
 * Signs in two fresh anonymous users and checks that each one can only
 * read, write, change and delete their own rows. Uses only the publishable
 * key — exactly the access a real app user (or attacker) has.
 *
 * Run: npm run test:rls
 */

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !KEY) {
  console.error('Missing Supabase config in .env (see .env.example).');
  process.exit(1);
}

async function call(method, path, { token, body, prefer } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function signInAnonymously() {
  const { status, data } = await call('POST', '/auth/v1/signup', { body: {} });
  if (status !== 200) throw new Error(`Anonymous sign-in failed: ${data?.msg ?? status}`);
  return { token: data.access_token, id: data.user.id };
}

let passed = 0;
let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  ok ? passed++ : failed++;
}

const today = new Date().toISOString().slice(0, 10);
const TEST_TITLE = 'RLS test check-in';

// 1. Without a login, every table is locked
for (const table of ['profiles', 'checkins', 'daily_metrics']) {
  const { status } = await call('GET', `/rest/v1/${table}?select=*&limit=1`);
  check(`${table}: no access without a login (HTTP ${status})`, status === 401 || status === 403);
}

// 2. Two separate users
const simon = await signInAnonymously();
const anna = await signInAnonymously();
console.log(`      user A = ${simon.id.slice(0, 8)}…   user B = ${anna.id.slice(0, 8)}…`);

try {
  // 3. The trigger created a profile, and A only sees their own
  const profiles = await call('GET', '/rest/v1/profiles?select=id', { token: simon.token });
  check('Profile was created automatically and A sees only their own',
    profiles.data?.length === 1 && profiles.data[0].id === simon.id);

  // 4. A writes their own data
  const created = await call('POST', '/rest/v1/checkins', {
    token: simon.token,
    prefer: 'return=representation',
    body: { title: TEST_TITLE, summary: 'Testing', stress: 5, themes: ['work'] },
  });
  check(`A can save their own check-in (HTTP ${created.status})`, created.status === 201);
  const checkinId = created.data?.[0]?.id;

  const metric = await call('POST', '/rest/v1/daily_metrics', {
    token: simon.token,
    body: { day: today, stress: 5, emotion: 6, sleep: 3 },
  });
  check(`A can save their own daily metric (HTTP ${metric.status})`, metric.status === 201);

  const own = await call('GET', '/rest/v1/checkins?select=title,user_id', { token: simon.token });
  check('A reads back their check-in; user_id was filled in by the database',
    own.data?.length === 1 && own.data[0].user_id === simon.id);

  // 5. B cannot see A's data
  const bCheckins = await call('GET', '/rest/v1/checkins?select=*', { token: anna.token });
  check(`B sees 0 check-ins (got ${bCheckins.data?.length})`, bCheckins.data?.length === 0);
  const bMetrics = await call('GET', '/rest/v1/daily_metrics?select=*', { token: anna.token });
  check(`B sees 0 daily metrics (got ${bMetrics.data?.length})`, bMetrics.data?.length === 0);

  // 6. B cannot write into A's account
  const inject = await call('POST', '/rest/v1/checkins', {
    token: anna.token,
    body: { user_id: simon.id, title: 'Injected by B' },
  });
  check(`B cannot save a check-in as A (HTTP ${inject.status})`, inject.status === 401 || inject.status === 403);

  // 7. B cannot change or delete A's data — the rows are invisible to B
  const update = await call('PATCH', `/rest/v1/checkins?id=eq.${checkinId}`, {
    token: anna.token,
    prefer: 'return=representation',
    body: { title: 'Changed by B' },
  });
  check(`B's update of A's check-in affects 0 rows`, Array.isArray(update.data) && update.data.length === 0);

  const del = await call('DELETE', `/rest/v1/checkins?id=eq.${checkinId}`, {
    token: anna.token,
    prefer: 'return=representation',
  });
  check(`B's delete of A's check-in affects 0 rows`, Array.isArray(del.data) && del.data.length === 0);

  // 8. Table rules: scores must be 0..10
  const invalid = await call('POST', '/rest/v1/checkins', {
    token: simon.token,
    body: { title: 'invalid', stress: 15 },
  });
  check(`Database rejects stress = 15 (HTTP ${invalid.status})`, invalid.status === 400);

  // 9. A's data is untouched
  const after = await call('GET', '/rest/v1/checkins?select=title', { token: simon.token });
  check("A's check-in is unchanged after B's attempts",
    after.data?.length === 1 && after.data[0].title === TEST_TITLE);
} finally {
  await call('DELETE', `/rest/v1/checkins?title=eq.${encodeURIComponent(TEST_TITLE)}`, { token: simon.token });
  await call('DELETE', `/rest/v1/daily_metrics?day=eq.${today}`, { token: simon.token });
}

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed === 0 ? 0 : 1);
