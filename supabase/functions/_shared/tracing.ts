/**
 * Tracing with Langfuse: every AI call a request makes shows up in Langfuse
 * with its model, input, output, token usage (and from that, cost), timing
 * and errors.
 *
 * How it works
 *   - One request = one trace, e.g. "untangle-chat". Each AI call inside it
 *     (chat, structured output, embeddings, speech-to-text) becomes one
 *     observation in that trace.
 *   - Spans are sent as OpenTelemetry (OTLP) JSON over plain HTTP to
 *     Langfuse's OTel endpoint, without an SDK: one small fetch, nothing to
 *     install in the Deno runtime, and every field is visible right here.
 *   - Sending happens after the response, via EdgeRuntime.waitUntil, so the
 *     user never waits for it.
 *
 * Fails open: without keys, or if Langfuse is slow or down, tracing is
 * skipped and the app works exactly as before. (The AI quota does the
 * opposite and fails closed, because it protects costs.)
 *
 * Privacy: these are stress diaries. For real users, inputs and outputs are
 * masked before anything leaves the server; only metadata is sent (model,
 * tokens, timing, sizes). Demo accounts (fictional Jonas, flagged by
 * seed-demo in the account's app_metadata) are sent in full, so traces can
 * be shown. User ids are the anonymous account ids, never names or emails.
 *
 * Secrets: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL
 * (https://cloud.langfuse.com for the EU region).
 */
import type { AICall, RecordCall } from './llm/index.ts';

export type Trace = {
  /** The Langfuse trace id (32 hex characters). */
  readonly id: string;
  /** Pass this trace to getLLM / getEmbedder / getTranscriber. */
  readonly record: RecordCall;
};

type Metadata = Record<string, string | number | boolean>;

/** Starts the trace for one request. `name` is the feature, e.g. "untangle-chat". */
export function startTrace(name: string, req: Request, metadata: Metadata = {}): Trace {
  const id = randomHex(16);
  const config = langfuseConfig();
  if (!config) return { id, record: () => {} };

  const claims = jwtClaims(req);
  const demo = claims.app_metadata?.demo === true;
  const userId = claims.sub ?? 'unknown';
  const traceAttributes = [
    attr('langfuse.trace.name', name),
    attr('langfuse.user.id', userId),
    // A session groups one user's traces of one day, e.g. a whole check-in conversation.
    attr('langfuse.session.id', `${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}`),
    attr('langfuse.trace.tags', [name, demo ? 'demo' : 'user']),
    attr('langfuse.environment', demo ? 'demo' : 'production'),
    ...Object.entries(metadata).map(([key, value]) => attr(`langfuse.trace.metadata.${key}`, value)),
  ];

  const pending: OtlpSpan[] = [];
  let sending: Promise<void> | null = null;

  const flush = () => {
    if (sending || !pending.length) return;
    sending = send(config, pending.splice(0)).finally(() => {
      sending = null;
      flush(); // calls that finished while we were sending
    });
    // Keep the function alive until the spans are sent, without delaying the response.
    (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(sending);
  };

  const record: RecordCall = (call) => {
    try {
      pending.push(toSpan(id, call, traceAttributes, demo));
      flush();
    } catch (err) {
      console.warn('Tracing skipped:', err);
    }
  };

  return { id, record };
}

// ─── Langfuse connection ─────────────────────────────────────────────────

type LangfuseConfig = { url: string; auth: string };

function langfuseConfig(): LangfuseConfig | null {
  const publicKey = Deno.env.get('LANGFUSE_PUBLIC_KEY');
  const secretKey = Deno.env.get('LANGFUSE_SECRET_KEY');
  if (!publicKey || !secretKey) return null;
  const base = (Deno.env.get('LANGFUSE_BASE_URL') ?? 'https://cloud.langfuse.com').replace(/\/$/, '');
  return { url: `${base}/api/public/otel/v1/traces`, auth: `Basic ${btoa(`${publicKey}:${secretKey}`)}` };
}

async function send(config: LangfuseConfig, spans: OtlpSpan[]): Promise<void> {
  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: config.auth,
        'Content-Type': 'application/json',
        'x-langfuse-ingestion-version': '4',
      },
      body: JSON.stringify({
        resourceSpans: [
          {
            resource: { attributes: [attr('service.name', 'destress-ai')] },
            scopeSpans: [{ scope: { name: 'destress-ai' }, spans }],
          },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`Langfuse rejected ${spans.length} span(s): ${res.status} ${await res.text()}`);
  } catch (err) {
    console.warn('Langfuse unreachable, tracing skipped:', err instanceof Error ? err.message : err);
  }
}

// ─── One AI call → one OpenTelemetry span ────────────────────────────────

type OtlpValue =
  | { stringValue: string }
  | { intValue: string }
  | { doubleValue: number }
  | { boolValue: boolean }
  | { arrayValue: { values: { stringValue: string }[] } };
type OtlpAttribute = { key: string; value: OtlpValue };
type OtlpSpan = {
  traceId: string;
  spanId: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
  status: { code: number; message?: string };
};

function toSpan(traceId: string, call: AICall, traceAttributes: OtlpAttribute[], demo: boolean): OtlpSpan {
  const attributes = [
    ...traceAttributes,
    // Embeddings are recorded as generations too: model, tokens and cost work the same way.
    attr('langfuse.observation.type', 'generation'),
    attr('langfuse.observation.model.name', call.model),
    attr('langfuse.observation.input', JSON.stringify(demo ? call.input : masked(call.input))),
    attr('langfuse.observation.output', JSON.stringify(demo ? call.output : masked(call.output))),
    ...(call.usage ? [attr('langfuse.observation.usage_details', JSON.stringify(call.usage))] : []),
    attr('langfuse.observation.metadata.kind', call.kind),
    ...Object.entries(call.metadata ?? {}).map(([key, value]) => attr(`langfuse.observation.metadata.${key}`, value)),
    ...(call.error
      ? [attr('langfuse.observation.level', 'ERROR'), attr('langfuse.observation.status_message', call.error)]
      : []),
  ];
  return {
    traceId,
    spanId: randomHex(8),
    name: call.name,
    kind: 3, // CLIENT: a call to another service
    startTimeUnixNano: nanos(call.startTime),
    endTimeUnixNano: nanos(call.endTime),
    attributes,
    status: call.error ? { code: 2, message: call.error } : { code: 1 },
  };
}

/** What's left of a real user's text after masking: its shape and size, never the words. */
function masked(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return `[masked: ${value.length} chars]`;
  if (Array.isArray(value)) return `[masked: ${value.length} items]`;
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, v]) => [key, masked(v)]));
  }
  return value; // numbers and booleans, e.g. scores in structured output
}

function attr(key: string, value: string | number | boolean | string[]): OtlpAttribute {
  if (Array.isArray(value)) return { key, value: { arrayValue: { values: value.map((v) => ({ stringValue: v })) } } };
  if (typeof value === 'boolean') return { key, value: { boolValue: value } };
  if (typeof value === 'number') {
    return { key, value: Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value } };
  }
  return { key, value: { stringValue: value } };
}

const nanos = (date: Date) => (BigInt(date.getTime()) * 1_000_000n).toString();

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The caller's JWT claims. The token was already verified by withSupabase,
 * so this only reads it. app_metadata can only be set by the server.
 */
function jwtClaims(req: Request): { sub?: string; app_metadata?: { demo?: boolean } } {
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
  } catch {
    return {};
  }
}
