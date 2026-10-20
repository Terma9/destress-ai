/**
 * Tracing with Langfuse: the whole path of a request becomes one trace,
 * from the moment it arrives until the last byte of the answer is sent.
 *
 *   Trace "checkin-chat"                      ← root span: the whole request
 *    ├─ check-quota            (database)
 *    ├─ load-context           (database: memory, recent check-ins, metrics …)
 *    ├─ find-related           (RAG)
 *    │   ├─ embed              (AI: the last message as a vector)
 *    │   ├─ match-chunks       (database: vector search)
 *    │   └─ load-conversations (database)
 *    └─ chat                   (AI: the streamed reply)
 *
 * How it works
 *   - traced() wraps a function's handler. It opens the root span, runs the
 *     handler and closes the root span when the response is complete (for a
 *     streamed answer: after its last chunk).
 *   - span() times one step. AsyncLocalStorage remembers which span is
 *     running, so steps and AI calls inside it become its children
 *     automatically, also in shared helpers that know nothing about tracing
 *     (that's what OpenTelemetry calls context propagation).
 *   - AI calls are reported by the adapters (llm/openai.ts) through
 *     trace.record and become generations with model, tokens and timing.
 *   - Spans are sent as OpenTelemetry (OTLP) JSON over plain HTTP to
 *     Langfuse's OTel endpoint, no SDK. Sending happens in the background
 *     (EdgeRuntime.waitUntil), so the user never waits for it.
 *
 * Fails open: without keys, or if Langfuse is slow or down, tracing is
 * skipped and the app works exactly as before. (The AI quota does the
 * opposite and fails closed, because it protects costs.)
 *
 * Privacy: these are stress diaries. For real users, every input and output
 * is masked before anything leaves the server; only shapes, sizes, timing and
 * numbers are sent. Demo accounts (fictional Jonas, flagged by seed-demo in
 * the account's app_metadata) are sent in full, so traces can be shown.
 * User ids are the anonymous account ids, never names or emails.
 *
 * Secrets: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL
 * (https://cloud.langfuse.com for the EU region).
 */
import type { AICall, RecordCall } from './llm/index.ts';

type Metadata = Record<string, string | number | boolean>;

export type Trace = {
  /** The Langfuse trace id (32 hex characters). */
  readonly id: string;
  /** Pass the trace to getLLM / getEmbedder / getTranscriber; they report each AI call here. */
  readonly record: RecordCall;
  /** Renames the trace once the request shows what it is (e.g. "calm-now"). */
  setName(name: string): void;
};

/** What a step shows in Langfuse besides its timing. Masked for real users. */
type StepInfo<T> = { input?: unknown; output?: (result: T) => unknown };

// ─── Context: which trace and which span are running right now ───────────

type Context = { trace: TraceState; parentId: string };

// AsyncLocalStorage keeps a value across awaits for everything started inside
// run(), and keeps concurrent requests apart. If the runtime lacks it, steps
// still work, they just aren't traced.
const store = await import('node:async_hooks')
  .then(({ AsyncLocalStorage }) => new AsyncLocalStorage<Context>())
  .catch(() => null);

/**
 * Times one step of the current request, e.g. a database query. Anything that
 * runs inside `fn` (further steps, AI calls) becomes a child of this step.
 * Outside a traced request it simply runs `fn`.
 */
export async function span<T>(name: string, fn: () => Promise<T>, info: StepInfo<T> = {}): Promise<T> {
  const context = store?.getStore();
  if (!context) return fn();
  const { trace } = context;
  const spanId = randomHex(8);
  const startTime = new Date();
  try {
    const result = await store!.run({ trace, parentId: spanId }, fn);
    trace.add({
      spanId,
      parentId: context.parentId,
      name,
      type: 'span',
      startTime,
      endTime: new Date(),
      input: info.input,
      output: info.output?.(result),
    });
    return result;
  } catch (err) {
    trace.add({ spanId, parentId: context.parentId, name, type: 'span', startTime, endTime: new Date(), input: info.input, error: errorText(err) });
    throw err;
  }
}

/**
 * Wraps an Edge Function handler so each request is one trace. The handler
 * gets the trace as third argument.
 */
export function traced<C>(
  name: string,
  handler: (req: Request, ctx: C, trace: Trace) => Promise<Response>,
  metadata: Metadata = {},
): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    const config = langfuseConfig();
    if (!config) return handler(req, ctx, { id: randomHex(16), record: () => {}, setName: () => {} });

    const trace = new TraceState(config, name, req, metadata);
    const requestInput = (req.headers.get('Content-Type') ?? '').includes('json')
      ? req.clone().json().catch(() => null)
      : Promise.resolve({ body: req.headers.get('Content-Type') ?? 'none' });

    let response: Response;
    try {
      response = store ? await store.run({ trace, parentId: trace.rootId }, () => handler(req, ctx, trace)) : await handler(req, ctx, trace);
    } catch (err) {
      trace.finish(await requestInput, null, 500, errorText(err));
      throw err;
    }

    // A streamed answer is complete only after its last chunk: watch it pass by.
    const type = response.headers.get('Content-Type') ?? '';
    if (response.body && type.startsWith('text/plain')) {
      const decoder = new TextDecoder();
      let text = '';
      const watch = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          if (text.length < 20_000) text += decoder.decode(chunk, { stream: true });
          controller.enqueue(chunk);
        },
        async flush() {
          trace.finish(await requestInput, text, response.status);
        },
      });
      return new Response(response.body.pipeThrough(watch), { status: response.status, headers: response.headers });
    }

    const output = type.includes('json') ? await response.clone().json().catch(() => null) : null;
    trace.finish(await requestInput, output, response.status);
    return response;
  };
}

// ─── One trace: collects its spans and sends them ────────────────────────

type Observation = {
  spanId: string;
  parentId: string | null;
  name: string;
  type: 'span' | 'generation';
  startTime: Date;
  endTime: Date;
  input?: unknown;
  output?: unknown;
  error?: string;
  level?: 'WARNING' | 'ERROR';
  attributes?: OtlpAttribute[];
};

class TraceState implements Trace {
  readonly id = randomHex(16);
  readonly rootId = randomHex(8);
  private readonly startTime = new Date();
  private readonly demo: boolean;
  private readonly userId: string;
  private readonly pending: OtlpSpan[] = [];
  private sending: Promise<void> | null = null;

  constructor(
    private readonly config: LangfuseConfig,
    private name: string,
    req: Request,
    private readonly metadata: Metadata,
  ) {
    const claims = jwtClaims(req);
    this.demo = claims.app_metadata?.demo === true;
    this.userId = claims.sub ?? 'unknown';
  }

  setName(name: string) {
    this.name = name;
  }

  /** An AI call reported by an adapter: a generation under the step that made it. */
  readonly record: RecordCall = (call: AICall) => {
    const parentId = store?.getStore()?.parentId ?? this.rootId;
    this.add({
      spanId: randomHex(8),
      parentId,
      name: call.name,
      type: 'generation',
      startTime: call.startTime,
      endTime: call.endTime,
      input: call.input,
      output: call.output,
      error: call.error,
      attributes: [
        attr('langfuse.observation.model.name', call.model),
        ...(call.usage ? [attr('langfuse.observation.usage_details', JSON.stringify(call.usage))] : []),
        attr('langfuse.observation.metadata.kind', call.kind),
        ...Object.entries(call.metadata ?? {}).map(([key, value]) => attr(`langfuse.observation.metadata.${key}`, value)),
      ],
    });
  };

  /** Closes the root span: the whole request, with the request body as input and the answer as output. */
  finish(input: unknown, output: unknown, status: number, error?: string) {
    const date = this.startTime.toISOString().slice(0, 10);
    this.add({
      spanId: this.rootId,
      parentId: null,
      name: this.name,
      type: 'span',
      startTime: this.startTime,
      endTime: new Date(),
      input,
      output,
      error,
      level: status >= 500 ? 'ERROR' : status >= 400 ? 'WARNING' : undefined,
      attributes: [
        attr('langfuse.trace.name', this.name),
        attr('langfuse.user.id', this.userId),
        // A session groups one user's traces of one day, e.g. a whole check-in conversation.
        attr('langfuse.session.id', `${this.userId.slice(0, 8)}-${date}`),
        attr('langfuse.trace.tags', [this.name, this.demo ? 'demo' : 'user']),
        attr('langfuse.trace.metadata.http_status', status),
        ...Object.entries(this.metadata).map(([key, value]) => attr(`langfuse.trace.metadata.${key}`, value)),
      ],
    });
  }

  add(o: Observation) {
    try {
      const failed = o.error !== undefined;
      this.pending.push({
        traceId: this.id,
        spanId: o.spanId,
        ...(o.parentId ? { parentSpanId: o.parentId } : {}),
        name: o.name,
        kind: o.type === 'generation' ? 3 : 1, // CLIENT for calls to the AI, INTERNAL for our own steps
        startTimeUnixNano: nanos(o.startTime),
        endTimeUnixNano: nanos(o.endTime),
        attributes: [
          attr('langfuse.observation.type', o.type),
          attr('langfuse.environment', this.demo ? 'demo' : 'production'),
          ...(o.input !== undefined ? [attr('langfuse.observation.input', JSON.stringify(this.demo ? o.input : masked(o.input)))] : []),
          ...(o.output !== undefined ? [attr('langfuse.observation.output', JSON.stringify(this.demo ? o.output : masked(o.output)))] : []),
          ...(failed || o.level
            ? [attr('langfuse.observation.level', o.level ?? 'ERROR'), ...(o.error ? [attr('langfuse.observation.status_message', o.error)] : [])]
            : []),
          ...(o.attributes ?? []),
        ],
        status: failed ? { code: 2, message: o.error } : { code: 1 },
      });
      this.flush();
    } catch (err) {
      console.warn('Tracing skipped:', err);
    }
  }

  private flush() {
    if (this.sending || !this.pending.length) return;
    this.sending = send(this.config, this.pending.splice(0)).finally(() => {
      this.sending = null;
      this.flush(); // spans that finished while we were sending
    });
    // Keep the function alive until the spans are sent, without delaying the response.
    (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(this.sending);
  }
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
    console.warn('Langfuse unreachable, tracing skipped:', errorText(err));
  }
}

// ─── OpenTelemetry format ────────────────────────────────────────────────

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
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
  status: { code: number; message?: string };
};

/** What's left of a real user's data after masking: its shape and size, never the words. */
function masked(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return `[masked: ${value.length} chars]`;
  if (Array.isArray(value)) return `[masked: ${value.length} items]`;
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, v]) => [key, masked(v)]));
  }
  return value; // numbers and booleans, e.g. counts or scores
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
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

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
