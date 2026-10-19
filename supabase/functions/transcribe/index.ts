/**
 * transcribe — turns a voice recording into text.
 *
 * Request:  POST, body = the raw audio file (Content-Type: audio/...),
 *           optional ?language=de as a hint
 * Response: { text }
 *
 * The audio is only held in memory for this request and never stored:
 * the app keeps the text, not the recording (data minimization).
 */
import { withSupabase } from 'npm:@supabase/server@1';
import { checkQuota } from '../_shared/quota.ts';
import { getTranscriber } from '../_shared/llm/index.ts';

/** ~2 minutes of compressed speech is around 1–2 MB; the API itself allows 25 MB. */
const MAX_BYTES = 10 * 1024 * 1024;

export default {
  fetch: withSupabase({ auth: 'user' }, async (req) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST.' }, { status: 405 });
    }
    const overQuota = await checkQuota(ctx.supabase);
    if (overQuota) return overQuota;

    const mimeType = req.headers.get('content-type') ?? '';
    if (!mimeType.startsWith('audio/')) {
      return Response.json({ error: 'Send the recording as the request body with an audio/* Content-Type.' }, { status: 415 });
    }

    const audio = new Uint8Array(await req.arrayBuffer());
    if (audio.byteLength === 0) {
      return Response.json({ error: 'The recording is empty.' }, { status: 400 });
    }
    if (audio.byteLength > MAX_BYTES) {
      return Response.json({ error: 'The recording is too long. Keep it under about 2 minutes.' }, { status: 413 });
    }

    const lang = new URL(req.url).searchParams.get('language') ?? undefined;
    const language = lang && /^[a-z]{2}$/i.test(lang) ? lang.toLowerCase() : undefined;

    try {
      const text = await getTranscriber().transcribe({ audio, mimeType, language });
      return Response.json({ text });
    } catch (err) {
      console.error('Transcription failed:', err);
      return Response.json({ error: "Couldn't transcribe the recording. Try again." }, { status: 502 });
    }
  }),
};
