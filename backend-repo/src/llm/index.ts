// LLM Provider Layer - Main Export
// Enterprise ATO Document Generation with AI

import { modelRouter } from './model-router';

export { AnthropicAdapter } from './providers/anthropic-adapter';
export { OpenAIAdapter } from './providers/openai-adapter';
export { OllamaAdapter } from './providers/ollama-adapter';
export { ModelRouter, modelRouter } from './model-router';

export type {
  LLMMessage,
  LLMResponse,
  LLMGenerationOptions,
  LLMProvider,
  ProviderConfiguration,
  ModelRouterOptions,
  ATOGenerationRequest,
  ATOGenerationResponse,
} from './types';

// Re-export singleton for easy access
export const llm = modelRouter;
