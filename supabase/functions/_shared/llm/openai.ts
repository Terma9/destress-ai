/**
 * OpenAI adapter: implements LLMProvider with OpenAI's Responses API, and
 * Transcriber with OpenAI's speech-to-text endpoint.
 */
import OpenAI, { toFile } from 'npm:openai@7';
import type { ChatMessage, Embedder, JsonSchema, JsonTask, LLMProvider, Transcriber } from './types.ts';

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

export function createOpenAIEmbedder(config: { apiKey: string; model: string }): Embedder {
  const client = new OpenAI({ apiKey: config.apiKey });

  return {
    name: 'openai',
    model: config.model,

    async embed(texts) {
      if (!texts.length) return [];
      // One request for many texts: cheaper and faster than one request each.
      const result = await client.embeddings.create({ model: config.model, input: texts });
      return result.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    },
  };
}

export function createOpenAITranscriber(config: { apiKey: string; model: string }): Transcriber {
  const client = new OpenAI({ apiKey: config.apiKey });

  return {
    name: 'openai',

    async transcribe({ audio, mimeType, language }) {
      const type = mimeType.split(';')[0];
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
      return result.text.trim();
    },
  };
}

export function createOpenAIProvider(config: {
  apiKey: string;
  chatModel: string;
  extractModel: string;
  analysisModel: string;
}): LLMProvider {
  const client = new OpenAI({ apiKey: config.apiKey });
  const models = { chat: config.chatModel, extract: config.extractModel, analysis: config.analysisModel };

  return {
    name: 'openai',
    models,

    async *streamChat({ system, messages }: { system: string; messages: ChatMessage[] }) {
      const stream = await client.responses.create({
        model: models.chat,
        instructions: system,
        input: messages,
        stream: true,
      });
      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
          yield event.delta;
        } else if (event.type === 'error') {
          throw new Error(`OpenAI stream error: ${event.message}`);
        }
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
      const response = await client.responses.create({
        model: models[task],
        instructions: system,
        input: messages,
        // Structured output: the model must return JSON matching `schema`.
        text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } },
      });
      return JSON.parse(response.output_text) as T;
    },
  };
}
