/**
 * Daily AI limits (cost protection for the public demo). Each Edge Function
 * that calls the AI checks this first; one request counts as one call.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { span } from './tracing.ts';

/** Per account and day. A full check-in takes about 10–15 calls. */
const USER_DAILY_CALLS = 80;
/** All accounts together per day, in case someone creates many accounts. */
const GLOBAL_DAILY_CALLS = 4000;

/** Null if the call may go ahead, otherwise the 429 response to return. */
export async function checkQuota(db: SupabaseClient): Promise<Response | null> {
  const { data: allowed, error } = await span(
    'check-quota',
    async () => await db.rpc('use_ai_quota', { p_user_limit: USER_DAILY_CALLS, p_global_limit: GLOBAL_DAILY_CALLS }),
    { output: (r) => ({ allowed: r.data }) },
  );
  if (error) {
    // Fail closed: without a working counter, don't spend money.
    console.error('Quota check failed:', error);
    return Response.json({ error: 'The AI is not available right now. Try again later.' }, { status: 503 });
  }
  if (!allowed) {
    return Response.json(
      { error: "You've reached today's limit for AI requests in this demo. Come back tomorrow." },
      { status: 429 },
    );
  }
  return null;
}
