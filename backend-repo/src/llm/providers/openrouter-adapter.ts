// OpenRouter Provider Adapter for ATO Document Generation
// Unified API for multiple LLM providers through OpenRouter.ai

import OpenAI from "openai";
import { LLMProvider, LLMMessage, LLMResponse, LLMGenerationOptions, LLMTool } from '../types';
import { OpenRouterStreamingAdapter } from './openrouter-streaming';

// Popular models available through OpenRouter
const AVAILABLE_MODELS = [
  // OpenAI Models
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/gpt-4-turbo',
  'openai/gpt-3.5-turbo',
  
  // Anthropic Models
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku',
  'anthropic/claude-3-opus',
  
  // Meta Models
  'meta-llama/llama-3.1-405b-instruct',
  'meta-llama/llama-3.1-70b-instruct',
  'meta-llama/llama-3.1-8b-instruct',
  
  // Google Models
  'google/gemini-pro-1.5',
  'google/gemini-flash-1.5',
  
  // Mistral Models
  'mistralai/mistral-large',
  'mistralai/mistral-medium',
  
  // Other Popular Models
  'perplexity/llama-3.1-sonar-large-128k-online',
  'qwen/qwen-2-72b-instruct',
  'cohere/command-r-plus'
];

const DEFAULT_MODEL = "openai/gpt-4o-mini"; // Cost-effective default
const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1";

export class OpenRouterAdapter implements LLMProvider {
  public readonly name = 'openrouter';
  private client: OpenAI;
  private availableModels = AVAILABLE_MODELS;
  private configuration: any = {};
  private endpoint: string = DEFAULT_ENDPOINT;
  private streamingAdapter: OpenRouterStreamingAdapter;

  constructor() {
    // Initialize with default endpoint and dummy key
    this.streamingAdapter = new OpenRouterStreamingAdapter();
    this.client = new OpenAI({
      baseURL: DEFAULT_ENDPOINT,
      apiKey: 'dummy-key',
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/ato-compliance-agent",
        "X-Title": "ATO Compliance Agent"
      }
    });
  }

  /**
   * Update configuration from database
   */
  updateConfiguration(config: any): void {
    this.configuration = config;
    
    // Update endpoint if provided
    const endpoint = config.endpoint || config.baseUrl || DEFAULT_ENDPOINT;
    this.endpoint = endpoint;
    
    // Recreate client with new configuration
    if (config.apiKey) {
      this.client = new OpenAI({
        baseURL: endpoint,
        apiKey: config.apiKey,
        defaultHeaders: {
          "HTTP-Referer": config.httpReferer || "https://github.com/ato-compliance-agent",
          "X-Title": config.appTitle || "ATO Compliance Agent"
        }
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    // Check if we have an API key
    const apiKey = this.configuration.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return false;
    }
    
    try {
      // Test with a minimal request
      const requestParams: any = {
        model: this.configuration.model || DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10,
        temperature: 0.1
      };

      await this.client.chat.completions.create(requestParams);
      return true;
    } catch (error) {
      console.warn('OpenRouter provider not available:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async generateText(messages: LLMMessage[], options: LLMGenerationOptions = {}): Promise<LLMResponse> {
    try {
      const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const modelToUse = options.model || this.configuration.model || DEFAULT_MODEL;
      const requestParams: any = {
        model: modelToUse,
        messages: openaiMessages,
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.1,
      };

      // Add OpenRouter specific parameters
      if (options.stream) {
        requestParams.stream = true;
      }

      const response = await this.client.chat.completions.create(requestParams);

      const choice = response.choices[0];
      if (!choice.message.content) {
        throw new Error('OpenRouter returned empty content');
      }

      return {
        content: choice.message.content,
        model: response.model,
        provider: this.name,
        usage: {
          inputTokens: response.usage?.prompt_tokens,
          outputTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        },
        finishReason: choice.finish_reason || 'stop',
      };
    } catch (error) {
      console.error('OpenRouter generation failed:', error);
      throw new Error(`OpenRouter generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateJSON(messages: LLMMessage[], options: LLMGenerationOptions = {}): Promise<LLMResponse> {
    // For JSON generation, add response format if the model supports it
    const enhancedOptions = {
      ...options,
      // Add JSON format instruction to the last message
    };

    // Add JSON format instruction to messages
    const enhancedMessages = [...messages];
    const lastMessage = enhancedMessages[enhancedMessages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      lastMessage.content += '\n\nPlease respond with valid JSON only.';
    }

    return this.generateText(enhancedMessages, enhancedOptions);
  }

  getAvailableModels(): string[] {
    return [...this.availableModels];
  }

  getDefaultModel(): string {
    return this.configuration.model || DEFAULT_MODEL;
  }

  async generateEmbeddings(texts: string[], model?: string): Promise<number[][]> {
    try {
      // OpenRouter supports embedding models through specific providers
      const embeddingModel = model || 'openai/text-embedding-3-small';
      
      const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.configuration.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://atoc-bmad.com',
          'X-Title': 'ATO Compliance Agent'
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: texts,
          encoding_format: 'float'
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data.map((item: any) => item.embedding);
    } catch (error) {
      console.error('[OpenRouterAdapter] Embedding generation failed:', error);
      throw new Error(`OpenRouter embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get model categories for UI organization
   */
  getModelCategories(): Record<string, string[]> {
    return {
      'OpenAI': this.availableModels.filter(m => m.startsWith('openai/')),
      'Anthropic': this.availableModels.filter(m => m.startsWith('anthropic/')),
      'Meta/Llama': this.availableModels.filter(m => m.startsWith('meta-llama/')),
      'Google': this.availableModels.filter(m => m.startsWith('google/')),
      'Mistral': this.availableModels.filter(m => m.startsWith('mistralai/')),
      'Other': this.availableModels.filter(m => 
        !m.startsWith('openai/') && 
        !m.startsWith('anthropic/') && 
        !m.startsWith('meta-llama/') && 
        !m.startsWith('google/') && 
        !m.startsWith('mistralai/')
      )
    };
  }

  /**
   * Get pricing information for a model (if available)
   */
  getModelInfo(modelId: string): { name: string; provider: string; costPer1kTokens?: number } {
    const [provider, ...modelParts] = modelId.split('/');
    return {
      name: modelParts.join('/'),
      provider: provider,
      // Could add pricing info here if needed
    };
  }
  
  async chatCompletionStream(options: {
    messages: LLMMessage[];
    tools?: LLMTool[];
    onChunk: (chunk: any) => void;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }): Promise<void> {
    return this.streamingAdapter.chatCompletionStream({
      ...options,
      model: options.model || this.getDefaultModel(),
    });
  }
}
