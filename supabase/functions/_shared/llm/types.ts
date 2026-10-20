/**
 * The provider-neutral AI interface. Edge Functions only talk to this
 * interface, never to a vendor SDK directly — so switching from OpenAI to
 * another provider means adding one adapter, not rewriting the functions.
 */

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** A JSON Schema object describing the shape we want the model to return. */
export type JsonSchema = Record<string, unknown>;

/** What a structured-output call is for; each task can use its own model. */
export type JsonTask = 'extract' | 'analysis';

export interface LLMProvider {
  /** Provider name, e.g. "openai" — useful in logs. */
  readonly name: string;

  /** The model used per task, e.g. to record which model produced a result. */
  readonly models: { chat: string } & Record<JsonTask, string>;

  /** Stream a chat reply as text chunks, as the model writes it. */
  streamChat(input: { system: string; messages: ChatMessage[] }): AsyncIterable<string>;

  /** Ask for an answer that must match `schema`, returned as a parsed object. */
  generateJson<T>(input: {
    task: JsonTask;
    system: string;
    messages: ChatMessage[];
    schemaName: string;
    schema: JsonSchema;
  }): Promise<T>;
}

/**
 * Speech-to-text. Separate from LLMProvider because not every chat provider
 * offers it, so the two can be configured independently.
 */
export interface Transcriber {
  readonly name: string;

  /** Turns recorded speech into text. `language` is an ISO code hint like "de". */
  transcribe(input: { audio: Uint8Array; mimeType: string; language?: string }): Promise<string>;
}

/**
 * Text embeddings: turns texts into vectors that represent their meaning,
 * so similar texts end up close together (used for RAG search).
 * Separate setting again: not every chat provider offers embeddings.
 */
export interface Embedder {
  readonly name: string;
  /** Stored with the vectors' column size in mind: changing it means re-embedding. */
  readonly model: string;

  /** One vector per input text, in the same order. */
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * One finished AI call, as the adapters report it for tracing: what went in,
 * what came out, how many tokens it used and how long it took. Adapters fill
 * it in; what happens with it (e.g. sending it to Langfuse) is not their concern.
 */
export type AICall = {
  /** What the call was, e.g. "chat", "json:plan", "embed", "transcribe". */
  name: string;
  kind: 'generation' | 'embedding';
  model: string;
  input: unknown;
  output: unknown;
  /** Token counts by type, e.g. { input: 812, output: 64 }. */
  usage?: Record<string, number>;
  startTime: Date;
  endTime: Date;
  /** Set when the call failed. */
  error?: string;
  metadata?: Record<string, string | number | boolean>;
};

/** Receives each finished AI call. Optional everywhere: without it, nothing is recorded. */
export type RecordCall = (call: AICall) => void;
