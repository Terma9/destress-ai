/**
 * Warms up the backend when the app starts.
 *
 * Edge Functions don't run all the time: after a deploy or a few idle minutes
 * the first request has to start the function first ("cold start"), which
 * can take seconds. A cheap GET request now starts them in the background,
 * so the first real use of each feature is fast.
 *
 * Free and harmless: every function answers GET with 204 right away (in
 * traced(), _shared/tracing.ts), before the quota check and any AI call. The login
 * token is sent because Supabase's gateway rejects requests without one
 * before the function starts.
 */
const FUNCTIONS = [
  'checkin-chat',
  'checkin-complete',
  'untangle-chat',
  'untangle-plan',
  'search-checkins',
  'deep-dive-generate',
  'community-publish',
  'community-comment',
  'transcribe',
  'seed-demo',
];

let warmed = false;

/** Starts all functions once per app start. Never throws, never waits. */
export function warmUpFunctions(accessToken: string): void {
  if (warmed) return;
  warmed = true;
  for (const name of FUNCTIONS) {
    fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
  }
}
