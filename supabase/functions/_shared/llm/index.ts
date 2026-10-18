/**
 * Picks the AI providers and models from server secrets, so they can be
 * changed without touching code or shipping an app update:
 *
 *   LLM_PROVIDER         openai (default)
 *   LLM_CHAT_MODEL       model for the check-in conversation
 *   LLM_EXTRACT_MODEL    model for turning a conversation into structured data
 *   TRANSCRIBE_PROVIDER  openai (default) — set separately, since not every
 *                        chat provider offers speech-to-text
 *   TRANSCRIBE_MODEL     speech-to-text model
 *   OPENAI_API_KEY       required whenever a provider is openai
 */
import { createOpenAIProvider, createOpenAITranscriber } from './openai.ts';
import type { LLMProvider, Transcriber } from './types.ts';

export type { ChatMessage, LLMProvider, Transcriber } from './types.ts';

function openAIKey(): string {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set (Supabase → Edge Functions → Secrets).');
  return apiKey;
}

export function getLLM(): LLMProvider {
  const provider = Deno.env.get('LLM_PROVIDER') ?? 'openai';

  switch (provider) {
    case 'openai':
      return createOpenAIProvider({
        apiKey: openAIKey(),
        chatModel: Deno.env.get('LLM_CHAT_MODEL') ?? 'gpt-5.5',
        extractModel: Deno.env.get('LLM_EXTRACT_MODEL') ?? 'gpt-5.5',
      });
    default:
      throw new Error(`Unknown LLM_PROVIDER "${provider}".`);
  }
}

export function getTranscriber(): Transcriber {
  const provider = Deno.env.get('TRANSCRIBE_PROVIDER') ?? 'openai';

  switch (provider) {
    case 'openai':
      return createOpenAITranscriber({
        apiKey: openAIKey(),
        model: Deno.env.get('TRANSCRIBE_MODEL') ?? 'gpt-transcribe',
      });
    default:
      throw new Error(`Unknown TRANSCRIBE_PROVIDER "${provider}".`);
  }
}
