// Provider Factory
// Creates and configures LLM provider instances with dynamic configuration

import { LLMProvider } from '../types';
import { AnthropicAdapter } from './anthropic-adapter';
import { OpenAIAdapter } from './openai-adapter';
import { OllamaAdapter } from './ollama-adapter';
import { MockAdapter } from './mock-adapter';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  organizationId?: string;
  [key: string]: any;
}

/**
 * Creates a configured provider instance
 */
export function createProvider(name: string, config?: ProviderConfig): LLMProvider | null {
  switch (name) {
    case 'anthropic':
      return new AnthropicAdapter(config);
    case 'openai':
      return new OpenAIAdapter(config);
    case 'ollama':
      return new OllamaAdapter(config);
    case 'mock':
      return new MockAdapter();
    default:
      return null;
  }
}

/**
 * Updates provider configuration dynamically
 */
export function updateProviderConfig(provider: LLMProvider, config: ProviderConfig): void {
  if ('updateConfig' in provider && typeof provider.updateConfig === 'function') {
    (provider as any).updateConfig(config);
  }
}
