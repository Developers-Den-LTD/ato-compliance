// Dynamic Embedding Model Mapping
// Maps LLM providers to their optimal embedding models with capabilities

export interface EmbeddingModelConfig {
  model: string;
  dimensions: number;
  provider: string;
  maxTokens: number;
  costPer1kTokens?: number;
  description?: string;
}

export interface ProviderEmbeddingConfig {
  defaultModel: string;
  models: EmbeddingModelConfig[];
  capabilities: {
    batchProcessing: boolean;
    maxBatchSize: number;
    airGapped: boolean;
  };
}

export const EMBEDDING_MODEL_MAP: Record<string, ProviderEmbeddingConfig> = {
  'openai': {
    defaultModel: 'text-embedding-3-small',
    models: [
      {
        model: 'text-embedding-3-small',
        dimensions: 1536,
        provider: 'openai',
        maxTokens: 8191,
        costPer1kTokens: 0.00002,
        description: 'Latest small embedding model, good performance/cost ratio'
      },
      {
        model: 'text-embedding-3-large',
        dimensions: 3072,
        provider: 'openai',
        maxTokens: 8191,
        costPer1kTokens: 0.00013,
        description: 'Latest large embedding model, highest accuracy'
      },
      {
        model: 'text-embedding-ada-002',
        dimensions: 1536,
        provider: 'openai',
        maxTokens: 8191,
        costPer1kTokens: 0.0001,
        description: 'Legacy model, still reliable'
      }
    ],
    capabilities: {
      batchProcessing: true,
      maxBatchSize: 2048,
      airGapped: false
    }
  },
  'openrouter': {
    defaultModel: 'openai/text-embedding-3-small',
    models: [
      {
        model: 'openai/text-embedding-3-small',
        dimensions: 1536,
        provider: 'openrouter',
        maxTokens: 8191,
        costPer1kTokens: 0.00002,
        description: 'OpenAI embedding via OpenRouter - cost effective'
      },
      {
        model: 'openai/text-embedding-3-large',
        dimensions: 3072,
        provider: 'openrouter',
        maxTokens: 8191,
        costPer1kTokens: 0.00013,
        description: 'OpenAI large embedding via OpenRouter - highest accuracy'
      },
      {
        model: 'openai/text-embedding-ada-002',
        dimensions: 1536,
        provider: 'openrouter',
        maxTokens: 8191,
        costPer1kTokens: 0.0001,
        description: 'OpenAI legacy embedding via OpenRouter - stable'
      },
      {
        model: 'voyage-ai/voyage-3',
        dimensions: 1024,
        provider: 'openrouter',
        maxTokens: 32000,
        costPer1kTokens: 0.00012,
        description: 'Voyage AI embedding - optimized for retrieval'
      },
      {
        model: 'voyage-ai/voyage-3-lite',
        dimensions: 512,
        provider: 'openrouter',
        maxTokens: 32000,
        costPer1kTokens: 0.00007,
        description: 'Voyage AI lite embedding - fast and efficient'
      },
      {
        model: 'cohere/embed-english-v3.0',
        dimensions: 1024,
        provider: 'openrouter',
        maxTokens: 512,
        costPer1kTokens: 0.0001,
        description: 'Cohere embedding - specialized for English text'
      }
    ],
    capabilities: {
      batchProcessing: true,
      maxBatchSize: 100,
      airGapped: false
    }
  },
  'ollama': {
    defaultModel: 'nomic-embed-text',
    models: [
      {
        model: 'nomic-embed-text',
        dimensions: 768,
        provider: 'ollama',
        maxTokens: 2048,
        description: 'Local embedding model, good for air-gapped environments'
      },
      {
        model: 'mxbai-embed-large',
        dimensions: 1024,
        provider: 'ollama',
        maxTokens: 512,
        description: 'Large local embedding model'
      },
      {
        model: 'snowflake-arctic-embed',
        dimensions: 1024,
        provider: 'ollama',
        maxTokens: 512,
        description: 'Arctic embedding model for specialized tasks'
      }
    ],
    capabilities: {
      batchProcessing: false,
      maxBatchSize: 1,
      airGapped: true
    }
  },
  'anthropic': {
    defaultModel: 'voyage-2',
    models: [
      {
        model: 'voyage-2',
        dimensions: 1024,
        provider: 'anthropic',
        maxTokens: 4000,
        description: 'Anthropic-optimized embedding model'
      }
    ],
    capabilities: {
      batchProcessing: false,
      maxBatchSize: 1,
      airGapped: false
    }
  }
};

/**
 * Get the optimal embedding model for a provider
 */
export function getOptimalEmbeddingModel(providerName: string): EmbeddingModelConfig | null {
  const config = EMBEDDING_MODEL_MAP[providerName];
  if (!config) return null;
  
  const defaultModel = config.models.find(m => m.model === config.defaultModel);
  return defaultModel || config.models[0] || null;
}

/**
 * Get all available embedding models for a provider
 */
export function getProviderEmbeddingModels(providerName: string): EmbeddingModelConfig[] {
  const config = EMBEDDING_MODEL_MAP[providerName];
  return config?.models || [];
}

/**
 * Check if provider supports batch embedding processing
 */
export function supportsBatchEmbedding(providerName: string): boolean {
  const config = EMBEDDING_MODEL_MAP[providerName];
  return config?.capabilities.batchProcessing || false;
}

/**
 * Get maximum batch size for a provider
 */
export function getMaxBatchSize(providerName: string): number {
  const config = EMBEDDING_MODEL_MAP[providerName];
  return config?.capabilities.maxBatchSize || 1;
}

/**
 * Check if provider works in air-gapped environments
 */
export function isAirGappedCapable(providerName: string): boolean {
  const config = EMBEDDING_MODEL_MAP[providerName];
  return config?.capabilities.airGapped || false;
}

/**
 * Get embedding model by exact model name across all providers
 */
export function getEmbeddingModelConfig(modelName: string): EmbeddingModelConfig | null {
  for (const providerConfig of Object.values(EMBEDDING_MODEL_MAP)) {
    const model = providerConfig.models.find(m => m.model === modelName);
    if (model) return model;
  }
  return null;
}
