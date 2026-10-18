/**
 * Picks the AI provider and models from server secrets, so they can be
 * changed without touching code or shipping an app update:
 *
 *   LLM_PROVIDER       openai (default)
 *   LLM_CHAT_MODEL     model for the check-in conversation
 *   LLM_EXTRACT_MODEL  model for turning a conversation into structured data
 *   OPENAI_API_KEY     required when LLM_PROVIDER=openai
 */
import { createOpenAIProvider } from './openai.ts';
import type { LLMProvider } from './types.ts';

export type { ChatMessage, LLMProvider } from './types.ts';

export function getLLM(): LLMProvider {
  const provider = Deno.env.get('LLM_PROVIDER') ?? 'openai';

  switch (provider) {
    case 'openai': {
      const apiKey = Deno.env.get('OPENAI_API_KEY');
      if (!apiKey) throw new Error('OPENAI_API_KEY is not set (Supabase → Edge Functions → Secrets).');
      return createOpenAIProvider({
        apiKey,
        chatModel: Deno.env.get('LLM_CHAT_MODEL') ?? 'gpt-5.5',
        extractModel: Deno.env.get('LLM_EXTRACT_MODEL') ?? 'gpt-5.5',
      });
    }
    default:
      throw new Error(`Unknown LLM_PROVIDER "${provider}".`);
  }
}
