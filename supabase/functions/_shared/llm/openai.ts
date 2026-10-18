/**
 * OpenAI adapter: implements LLMProvider with OpenAI's Responses API.
 */
import OpenAI from 'npm:openai@7';
import type { ChatMessage, JsonSchema, LLMProvider } from './types.ts';

export function createOpenAIProvider(config: {
  apiKey: string;
  chatModel: string;
  extractModel: string;
}): LLMProvider {
  const client = new OpenAI({ apiKey: config.apiKey });

  return {
    name: 'openai',

    async *streamChat({ system, messages }: { system: string; messages: ChatMessage[] }) {
      const stream = await client.responses.create({
        model: config.chatModel,
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
      system,
      messages,
      schemaName,
      schema,
    }: {
      system: string;
      messages: ChatMessage[];
      schemaName: string;
      schema: JsonSchema;
    }): Promise<T> {
      const response = await client.responses.create({
        model: config.extractModel,
        instructions: system,
        input: messages,
        // Structured output: the model must return JSON matching `schema`.
        text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } },
      });
      return JSON.parse(response.output_text) as T;
    },
  };
}
