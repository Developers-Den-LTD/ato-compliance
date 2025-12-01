// Model Router with Fallback Capabilities for ATO Document Generation
// Manages multiple LLM providers with priority-based routing and fallback

import { LLMProvider, LLMMessage, LLMResponse, LLMGenerationOptions, ProviderConfiguration, ModelRouterOptions, LLMTool, LLMStreamOptions } from './types';
import { OpenRouterAdapter } from './providers/openrouter-adapter';
import { OllamaAdapter } from './providers/ollama-adapter';
import { storage } from '../storage';
import { getOptimalEmbeddingModel, supportsBatchEmbedding, getMaxBatchSize } from './embedding-model-map';

export class ModelRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultOptions: ModelRouterOptions = {
    maxRetries: 3,
    fallbackOnError: true,
    timeoutMs: 180000, // 3 minutes for complex ATO document generation with local models
  };

  constructor() {
    // Initialize providers lazily to avoid API key requirements at startup
    // Providers will be created when first needed
  }

  /**
   * Get or create a provider instance
   */
  private async getOrCreateProvider(providerName: string): Promise<LLMProvider | null> {
    if (this.providers.has(providerName)) {
      return this.providers.get(providerName)!;
    }

    try {
      let provider: LLMProvider | null = null;
      
      switch (providerName) {
        case 'mock':
          const { MockAdapter } = await import('./providers/mock-adapter');
          provider = new MockAdapter();
          break;
        case 'openrouter':
          provider = new OpenRouterAdapter();
          break;
        case 'ollama':
          provider = new OllamaAdapter();
          break;
        default:
          console.warn(`Unknown provider: ${providerName}`);
          return null;
      }

      if (provider) {
        // Load configuration from database and update provider
        try {
          const settings = await storage.getProviderSettingsByProvider(providerName);
          if (settings && settings.configuration) {
            // Update provider configuration if it has an updateConfiguration method
            if ('updateConfiguration' in provider && typeof provider.updateConfiguration === 'function') {
              (provider as any).updateConfiguration(settings.configuration);
            }
          }
        } catch (error) {
          console.warn(`Failed to load configuration for ${providerName}:`, error instanceof Error ? error.message : String(error));
        }

        this.providers.set(providerName, provider);
        return provider;
      }
    } catch (error) {
      console.warn(`Failed to create provider ${providerName}:`, error instanceof Error ? error.message : String(error));
      return null;
    }

    return null;
  }

  /**
   * Get provider configurations from database, ordered by priority
   */
  private async getProviderConfigurations(): Promise<ProviderConfiguration[]> {
    try {
      const settings = await storage.getProviderSettings();
      return settings
        .filter(s => s.isEnabled === true)
        .map(s => ({
          provider: s.provider,
          isEnabled: s.isEnabled ?? true,
          priority: s.priority ?? 1,
          isDefault: s.isDefault ?? false,
          configuration: s.configuration || {},
        }))
        .sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1)); // Lower priority number = higher priority
    } catch (error) {
      console.warn('Failed to load provider configurations, using defaults:', error instanceof Error ? error.message : String(error));
      return this.getDefaultConfigurations();
    }
  }

  /**
   * Fallback configurations when database is unavailable
   */
  private getDefaultConfigurations(): ProviderConfiguration[] {
    // Check if mock LLM is enabled
    if (process.env.MOCK_LLM_ENABLED === 'true') {
      return [
        { provider: 'mock', isEnabled: true, priority: 1, isDefault: true, configuration: {} },
      ];
    }
    
    return [
      { provider: 'openrouter', isEnabled: true, priority: 1, isDefault: true, configuration: {} },
      { provider: 'ollama', isEnabled: true, priority: 2, isDefault: false, configuration: {} },
    ];
  }

  /**
   * Chat completion with streaming support and tools
   */
  async chatCompletionStream(options: {
    messages: LLMMessage[];
    tools?: LLMTool[];
    onChunk: (chunk: any) => void;
    temperature?: number;
    maxTokens?: number;
  }): Promise<void> {
    const providers = await this.getProviderConfigurations();
    let lastError: Error | null = null;

    for (const config of providers) {
      try {
        const provider = await this.getOrCreateProvider(config.provider);
        if (!provider) continue;

        // Check if provider supports streaming with tools
        if ('chatCompletionStream' in provider && typeof provider.chatCompletionStream === 'function') {
          await (provider as any).chatCompletionStream({
            messages: options.messages,
            tools: options.tools,
            onChunk: options.onChunk,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          });
          return;
        } else {
          // Fallback to non-streaming completion for providers without streaming support
          const response = await provider.generateText(options.messages, {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          });
          
          // Simulate streaming by sending the entire response as one chunk
          options.onChunk({ content: response.content });
          return;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Provider ${config.provider} failed for streaming:`, lastError.message);
        
        if (!this.defaultOptions.fallbackOnError) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('All providers failed for streaming chat completion');
  }

  /**
   * Get ordered list of available providers
   */
  async getAvailableProviders(): Promise<LLMProvider[]> {
    const configurations = await this.getProviderConfigurations();
    const availableProviders: LLMProvider[] = [];

    for (const config of configurations) {
      const provider = await this.getOrCreateProvider(config.provider);
      if (provider && await provider.isAvailable()) {
        availableProviders.push(provider);
      }
    }

    return availableProviders;
  }

  /**
   * Generate text with automatic provider fallback
   */
  async generateText(
    messages: LLMMessage[], 
    options: LLMGenerationOptions & ModelRouterOptions = {}
  ): Promise<LLMResponse> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const availableProviders = await this.getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new Error('No LLM providers are currently available');
    }

    let lastError: Error | null = null;
    let attemptCount = 0;

    for (const provider of availableProviders) {
      if (attemptCount >= mergedOptions.maxRetries!) {
        break;
      }

      try {
        console.log(`Attempting generation with provider: ${provider.name}`);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Generation timeout')), mergedOptions.timeoutMs);
        });

        const generationPromise = provider.generateText(messages, options);
        const response = await Promise.race([generationPromise, timeoutPromise]);

        console.log(`Successfully generated text using provider: ${provider.name}`);
        return response;

      } catch (error) {
        lastError = error as Error;
        attemptCount++;
        console.warn(`Provider ${provider.name} failed (attempt ${attemptCount}):`, error instanceof Error ? error.message : String(error));

        if (!mergedOptions.fallbackOnError || attemptCount >= mergedOptions.maxRetries!) {
          break;
        }

        // Brief delay before trying next provider
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(
      `All LLM providers failed after ${attemptCount} attempts. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Generate JSON with automatic provider fallback
   */
  async generateJSON<T = any>(
    messages: LLMMessage[], 
    options: LLMGenerationOptions & ModelRouterOptions = {}
  ): Promise<T> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const availableProviders = await this.getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new Error('No LLM providers are currently available');
    }

    let lastError: Error | null = null;
    let attemptCount = 0;

    for (const provider of availableProviders) {
      if (attemptCount >= mergedOptions.maxRetries!) {
        break;
      }

      try {
        console.log(`Attempting JSON generation with provider: ${provider.name}`);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Generation timeout')), mergedOptions.timeoutMs);
        });

        const generationPromise = provider.generateJSON<T>(messages, options);
        const response = await Promise.race([generationPromise, timeoutPromise]);

        console.log(`Successfully generated JSON using provider: ${provider.name}`);
        return response;

      } catch (error) {
        lastError = error as Error;
        attemptCount++;
        console.warn(`Provider ${provider.name} failed (attempt ${attemptCount}):`, error instanceof Error ? error.message : String(error));

        if (!mergedOptions.fallbackOnError || attemptCount >= mergedOptions.maxRetries!) {
          break;
        }

        // Brief delay before trying next provider
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(
      `All LLM providers failed after ${attemptCount} attempts. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Get a specific provider by name
   */
  async getProvider(name: string): Promise<LLMProvider | undefined> {
    return await this.getOrCreateProvider(name) || undefined;
  }

  /**
   * Test connectivity for all providers
   */
  async testProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const providerNames = ['openrouter', 'ollama'];
    
    for (const name of providerNames) {
      try {
        const provider = await this.getOrCreateProvider(name);
        if (provider) {
          results[name] = await provider.isAvailable();
        } else {
          results[name] = false;
        }
      } catch (error) {
        results[name] = false;
      }
    }

    return results;
  }

  /**
   * Get available models from all providers
   */
  async getAllAvailableModels(): Promise<Record<string, string[]>> {
    const models: Record<string, string[]> = {};
    const providerNames = ['openrouter', 'ollama'];
    
    for (const name of providerNames) {
      try {
        const provider = await this.getOrCreateProvider(name);
        if (provider && await provider.isAvailable()) {
          models[name] = provider.getAvailableModels();
        }
      } catch (error) {
        // Provider not available, skip
      }
    }

    return models;
  }

  /**
   * Update provider configuration in database
   */
  async updateProviderConfiguration(config: ProviderConfiguration): Promise<void> {
    try {
      const existing = await storage.getProviderSettingsByProvider(config.provider);

      if (existing) {
        await storage.updateProviderSettings(existing.id, {
          isEnabled: config.isEnabled,
          priority: config.priority,
          configuration: config.configuration,
          isDefault: config.isDefault,
        });
      } else {
        await storage.createProviderSettings({
          provider: config.provider as any,
          isEnabled: config.isEnabled,
          priority: config.priority,
          configuration: config.configuration,
          isDefault: config.isDefault,
        });
      }

      // Clear the provider cache to force recreation with new configuration
      this.providers.delete(config.provider);
    } catch (error) {
      console.warn('Failed to update provider configuration:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Generate embeddings with automatic provider fallback and dynamic model selection
   * Uses optimal embedding models for each provider with batch processing support
   */
  async generateEmbeddings(
    texts: string[],
    model?: string,
    options: ModelRouterOptions = {}
  ): Promise<number[][]> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    // For embeddings, prefer order: Ollama (air-gapped), OpenAI (direct), OpenRouter (fallback)
    const preferredOrder = ['ollama', 'openai', 'openrouter'];
    const providers: { provider: LLMProvider, name: string }[] = [];

    for (const providerName of preferredOrder) {
      const provider = await this.getOrCreateProvider(providerName);
      if (provider && await provider.isAvailable() && provider.generateEmbeddings) {
        providers.push({ provider, name: providerName });
      }
    }

    if (providers.length === 0) {
      throw new Error('No providers with embedding support are currently available');
    }

    let lastError: Error | null = null;
    let attemptCount = 0;

    for (const { provider, name } of providers) {
      if (attemptCount >= mergedOptions.maxRetries!) {
        break;
      }

      try {
        console.log(`Attempting embeddings generation with provider: ${name}`);

        // Use dynamic model selection if no specific model provided
        const modelToUse = model || getOptimalEmbeddingModel(name)?.model;
        
        // Handle batch processing for providers that support it
        const maxBatch = getMaxBatchSize(name);
        const supportsBatch = supportsBatchEmbedding(name);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Embedding generation timeout')), mergedOptions.timeoutMs);
        });

        let embeddingPromise: Promise<number[][]>;
        
        if (supportsBatch || texts.length <= maxBatch) {
          // Single batch or provider supports large batches
          embeddingPromise = provider.generateEmbeddings!(texts, modelToUse);
        } else {
          // Split into smaller batches
          const batches: Promise<number[][]>[] = [];
          for (let i = 0; i < texts.length; i += maxBatch) {
            const batch = texts.slice(i, i + maxBatch);
            batches.push(provider.generateEmbeddings!(batch, modelToUse));
          }
          embeddingPromise = Promise.all(batches).then(results => results.flat());
        }
        
        const embeddings = await Promise.race([embeddingPromise, timeoutPromise]);

        console.log(`Successfully generated ${embeddings.length} embeddings using provider: ${name} with model: ${modelToUse}`);
        return embeddings;

      } catch (error) {
        lastError = error as Error;
        attemptCount++;
        console.warn(`Provider ${provider.name} failed for embeddings (attempt ${attemptCount}):`, error instanceof Error ? error.message : String(error));

        if (!mergedOptions.fallbackOnError || attemptCount >= mergedOptions.maxRetries!) {
          break;
        }

        // Brief delay before trying next provider
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(
      `All embedding providers failed after ${attemptCount} attempts. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }
}

// Singleton instance for the application
export const modelRouter = new ModelRouter();
