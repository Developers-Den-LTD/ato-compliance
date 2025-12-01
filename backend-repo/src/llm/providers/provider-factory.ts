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
  let provider: LLMProvider | null = null;
  
  switch (name) {
    case 'anthropic':
      provider = new AnthropicAdapter();
      break;
    case 'openai':
      provider = new OpenAIAdapter();
      break;
    case 'ollama':
      provider = new OllamaAdapter();
      break;
    case 'mock':
      provider = new MockAdapter();
      break;
    default:
      return null;
  }
  
  // Apply configuration if provided
  if (provider && config && 'updateConfiguration' in provider) {
    (provider as any).updateConfiguration(config);
  }
  
  return provider;
}

/**
 * Updates provider configuration dynamically
 */
export function updateProviderConfig(provider: LLMProvider, config: ProviderConfig): void {
  if ('updateConfig' in provider && typeof provider.updateConfig === 'function') {
    (provider as any).updateConfig(config);
  }
}
