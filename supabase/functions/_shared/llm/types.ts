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

export interface LLMProvider {
  /** Provider name, e.g. "openai" — useful in logs. */
  readonly name: string;

  /** Stream a chat reply as text chunks, as the model writes it. */
  streamChat(input: { system: string; messages: ChatMessage[] }): AsyncIterable<string>;

  /** Ask for an answer that must match `schema`, returned as a parsed object. */
  generateJson<T>(input: {
    system: string;
    messages: ChatMessage[];
    schemaName: string;
    schema: JsonSchema;
  }): Promise<T>;
}
