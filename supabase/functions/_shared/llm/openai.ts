/**
 * OpenAI adapter: implements LLMProvider with OpenAI's Responses API, and
 * Transcriber with OpenAI's speech-to-text endpoint.
 *
 * Every call is reported to `record` (if given) with its input, output,
 * token usage and timing, so it can be traced. Recording never changes the
 * result: a call that fails is reported and then fails as before.
 */
import OpenAI, { toFile } from 'npm:openai@7';
import type { ChatMessage, Embedder, JsonSchema, JsonTask, LLMProvider, RecordCall, Transcriber } from './types.ts';

const EXTENSIONS: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'm4a',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mpeg': 'mp3',
};

/** Token counts from a Responses API result, in Langfuse's usage names. */
type ResponsesUsage = {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens_details?: { reasoning_tokens?: number };
};
function usageOf(usage: ResponsesUsage | null | undefined): Record<string, number> | undefined {
  if (!usage) return undefined;
  return {
    input: usage.input_tokens,
    output: usage.output_tokens,
    // Part of `input` that was cheaper because OpenAI had it cached.
    ...(usage.input_tokens_details?.cached_tokens ? { cache_read_input_tokens: usage.input_tokens_details.cached_tokens } : {}),
  };
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function createOpenAIEmbedder(config: { apiKey: string; model: string; record?: RecordCall }): Embedder {
  const client = new OpenAI({ apiKey: config.apiKey });

  return {
    name: 'openai',
    model: config.model,

    async embed(texts) {
      if (!texts.length) return [];
      const startTime = new Date();
      try {
        // One request for many texts: cheaper and faster than one request each.
        const result = await client.embeddings.create({ model: config.model, input: texts });
        config.record?.({
          name: 'embed',
          kind: 'embedding',
          model: config.model,
          input: texts,
          output: `${result.data.length} vectors`,
          usage: { input: result.usage.prompt_tokens },
          startTime,
          endTime: new Date(),
          metadata: { texts: texts.length },
        });
        return result.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
      } catch (err) {
        config.record?.({ name: 'embed', kind: 'embedding', model: config.model, input: texts, output: null, startTime, endTime: new Date(), error: errorText(err) });
        throw err;
      }
    },
  };
}

export function createOpenAITranscriber(config: { apiKey: string; model: string; record?: RecordCall }): Transcriber {
  const client = new OpenAI({ apiKey: config.apiKey });

  return {
    name: 'openai',

    async transcribe({ audio, mimeType, language }) {
      const type = mimeType.split(';')[0];
      const startTime = new Date();
      // Audio isn't sent to tracing, only its size and type.
      const input = { audio: `${Math.round(audio.byteLength / 1024)} KB ${type}`, language: language ?? null };
      try {
        // The API detects the format from the file name, so give it the right extension.
        const file = await toFile(audio, `recording.${EXTENSIONS[type] ?? 'webm'}`, { type });
        // gpt-transcribe takes a list of expected languages; older models take one `language`.
        const languageHint = language
          ? config.model === 'gpt-transcribe'
            ? { languages: [language] }
            : { language }
          : {};
        const result = await client.audio.transcriptions.create({
          file,
          model: config.model,
          ...languageHint,
        } as Parameters<typeof client.audio.transcriptions.create>[0]);
        const text = result.text.trim();
        config.record?.({ name: 'transcribe', kind: 'generation', model: config.model, input, output: text, startTime, endTime: new Date() });
        return text;
      } catch (err) {
        config.record?.({ name: 'transcribe', kind: 'generation', model: config.model, input, output: null, startTime, endTime: new Date(), error: errorText(err) });
        throw err;
      }
    },
  };
}

export function createOpenAIProvider(config: {
  apiKey: string;
  chatModel: string;
  extractModel: string;
  analysisModel: string;
  record?: RecordCall;
}): LLMProvider {
  const client = new OpenAI({ apiKey: config.apiKey });
  const models = { chat: config.chatModel, extract: config.extractModel, analysis: config.analysisModel };

  return {
    name: 'openai',
    models,

    async *streamChat({ system, messages }: { system: string; messages: ChatMessage[] }) {
      const startTime = new Date();
      const input = { system, messages };
      let output = '';
      let usage: Record<string, number> | undefined;
      let firstTokenAt: Date | undefined;
      try {
        const stream = await client.responses.create({
          model: models.chat,
          instructions: system,
          input: messages,
          stream: true,
        });
        // A response can contain more than one output item. We seldom saw the
        // model send its reply twice that way, so only the first item's text is used.
        let firstItem: string | null = null;
        for await (const event of stream) {
          if (event.type === 'response.output_text.delta') {
            firstItem ??= event.item_id;
            if (event.item_id !== firstItem) continue;
            firstTokenAt ??= new Date();
            output += event.delta;
            yield event.delta;
          } else if (event.type === 'response.completed') {
            // Token counts only arrive with the last event of a stream.
            usage = usageOf(event.response.usage);
          } else if (event.type === 'error') {
            throw new Error(`OpenAI stream error: ${event.message}`);
          }
        }
        config.record?.({
          name: 'chat',
          kind: 'generation',
          model: models.chat,
          input,
          output,
          usage,
          startTime,
          endTime: new Date(),
          // How long the user waited for the first word: what streaming is for.
          metadata: firstTokenAt ? { time_to_first_token_ms: firstTokenAt.getTime() - startTime.getTime() } : undefined,
        });
      } catch (err) {
        config.record?.({ name: 'chat', kind: 'generation', model: models.chat, input, output, usage, startTime, endTime: new Date(), error: errorText(err) });
        throw err;
      }
    },

    async generateJson<T>({
      task,
      system,
      messages,
      schemaName,
      schema,
    }: {
      task: JsonTask;
      system: string;
      messages: ChatMessage[];
      schemaName: string;
      schema: JsonSchema;
    }): Promise<T> {
      const startTime = new Date();
      const name = `json:${schemaName}`;
      const input = { system, messages };
      const metadata = { task, schema: schemaName };
      try {
        const response = await client.responses.create({
          model: models[task],
          instructions: system,
          input: messages,
          // Structured output: the model must return JSON matching `schema`.
          text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } },
        });
        const result = JSON.parse(response.output_text) as T;
        config.record?.({
          name,
          kind: 'generation',
          model: models[task],
          input,
          output: result,
          usage: usageOf(response.usage),
          startTime,
          endTime: new Date(),
          metadata,
        });
        return result;
      } catch (err) {
        config.record?.({ name, kind: 'generation', model: models[task], input, output: null, startTime, endTime: new Date(), error: errorText(err), metadata });
        throw err;
      }
    },
  };
}
