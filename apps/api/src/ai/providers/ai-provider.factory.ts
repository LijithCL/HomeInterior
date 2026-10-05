import { Logger } from '@nestjs/common';
import type { Provider } from '@nestjs/common';
import { AI_PROVIDER } from './ai-provider.interface';
import { StubAiProvider } from './stub-ai.provider';
import { AnthropicAiProvider } from './anthropic-ai.provider';

const logger = new Logger('AiProviderFactory');

// The one place that decides which AiProvider implementation is live. Per
// the user's choice for this phase: no ANTHROPIC_API_KEY means no real API
// calls, so the app falls back to the free, deterministic stub. Dropping a
// key into apps/api/.env later switches every AI feature to the real model
// with no other code change.
export const aiProviderFactory: Provider = {
  provide: AI_PROVIDER,
  useFactory: () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      logger.log(
        'ANTHROPIC_API_KEY is set — using AnthropicAiProvider (real API calls, billed).',
      );
      return new AnthropicAiProvider(apiKey);
    }
    logger.log(
      'No ANTHROPIC_API_KEY set — using StubAiProvider (no API calls, no cost).',
    );
    return new StubAiProvider();
  },
};
