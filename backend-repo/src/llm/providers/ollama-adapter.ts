// Ollama LLM Provider Adapter - Simplified version using native fetch
// Interfaces with local Ollama instance for on-premise LLM capabilities

import { LLMProvider, LLMMessage, LLMResponse, LLMGenerationOptions } from '../types';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaAdapter implements LLMProvider {
  name = 'ollama' as const;
  
  private baseUrl: string;
  private defaultModel: string;
  private availableModels: string[] = [];
  
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
    this.defaultModel = process.env.OLLAMA_DEFAULT_MODEL || 'llama2:7b';
    console.log(`[OllamaAdapter] Initialized with baseUrl: ${this.baseUrl}`);
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      console.log(`[OllamaAdapter] Checking availability at ${this.baseUrl}/api/tags`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`[OllamaAdapter] API returned status ${response.status}`);
        return false;
      }

      const data = await response.json();
      this.availableModels = data.models?.map((model: any) => model.name) || [];
      console.log(`[OllamaAdapter] Available models: ${this.availableModels.join(', ')}`);
      
      return this.availableModels.length > 0;
    } catch (error) {
      console.warn('[OllamaAdapter] Availability check failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private formatMessages(messages: LLMMessage[]): { prompt: string; system?: string } {
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    let prompt = '';
    for (const message of conversationMessages) {
      if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    if (!prompt.endsWith('Assistant: ')) {
      prompt += 'Assistant: ';
    }

    return {
      prompt: prompt.trim(),
      system: systemMessage?.content
    };
  }

  async generateText(messages: LLMMessage[], options: LLMGenerationOptions = {}): Promise<LLMResponse> {
    console.log('[OllamaAdapter] Generating text...');
    
    const { prompt, system } = this.formatMessages(messages);
    const model = options.model || this.defaultModel;

    const requestBody: OllamaGenerateRequest = {
      model,
      prompt,
      system,
      stream: false,
      options: {
        temperature: options.temperature || 0.1,
        num_predict: options.maxTokens || 4000,
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minute timeout for document generation
      
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data: OllamaResponse = await response.json();

      return {
        content: data.response.trim(),
        model: data.model,
        provider: this.name,
        usage: {
          inputTokens: data.prompt_eval_count,
          outputTokens: data.eval_count,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        metadata: {
          totalDuration: data.total_duration,
          loadDuration: data.load_duration,
          promptEvalDuration: data.prompt_eval_duration,
          evalDuration: data.eval_duration,
        }
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Ollama request timed out after 2 minutes');
      }
      throw error;
    }
  }

  async generateChat(messages: LLMMessage[], options: LLMGenerationOptions = {}): Promise<LLMResponse> {
    return this.generateText(messages, options);
  }

  getCapabilities() {
    return {
      streaming: false,
      functionCalling: false,
      contextWindow: 4096,
      maxOutputTokens: 4000,
    };
  }

  updateConfiguration(config: any): void {
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
    if (config.endpoint) {
      this.baseUrl = config.endpoint;
    }
    if (config.defaultModel) {
      this.defaultModel = config.defaultModel;
    }
    if (config.modelName) {
      this.defaultModel = config.modelName;
    }
    console.log(`[OllamaAdapter] Configuration updated - baseUrl: ${this.baseUrl}, defaultModel: ${this.defaultModel}`);
  }

  getAvailableModels(): string[] {
    return [...this.availableModels];
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Generate embeddings using Ollama
   * Uses nomic-embed-text model by default (768 dimensions)
   */
  async generateEmbeddings(texts: string[], model?: string): Promise<number[][]> {
    const embeddingModel = model || process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
    console.log(`[OllamaAdapter] Generating embeddings for ${texts.length} texts using ${embeddingModel}`);

    const embeddings: number[][] = [];

    try {
      // Process each text individually (Ollama doesn't support batch embeddings)
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout per embedding

        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: embeddingModel,
            prompt: text
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Ollama embeddings API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.embedding || !Array.isArray(data.embedding)) {
          throw new Error('Invalid embedding response from Ollama');
        }

        embeddings.push(data.embedding);

        // Log progress for large batches
        if (texts.length > 10 && (i + 1) % 10 === 0) {
          console.log(`[OllamaAdapter] Generated ${i + 1}/${texts.length} embeddings`);
        }
      }

      console.log(`[OllamaAdapter] Successfully generated ${embeddings.length} embeddings`);
      return embeddings;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Ollama embedding request timed out');
      }
      console.error('[OllamaAdapter] Embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate JSON response using Ollama
   */
  async generateJSON<T = any>(messages: LLMMessage[], options: LLMGenerationOptions = {}): Promise<T> {
    console.log('[OllamaAdapter] Generating JSON...');
    
    // Add JSON format instruction to messages
    const enhancedMessages = [...messages];
    const lastMessage = enhancedMessages[enhancedMessages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      lastMessage.content += '\n\nPlease respond with valid JSON only, without any markdown formatting or explanations.';
    }

    const response = await this.generateText(enhancedMessages, options);
    
    // Parse the JSON from the response
    try {
      return JSON.parse(response.content) as T;
    } catch (error) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.content.match(/```(?:json)?\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]) as T;
      }
      
      // Try to find JSON object or array in the response
      const jsonObjectMatch = response.content.match(/\{[\s\S]*\}/);
      const jsonArrayMatch = response.content.match(/\[[\s\S]*\]/);
      
      if (jsonObjectMatch) {
        return JSON.parse(jsonObjectMatch[0]) as T;
      }
      if (jsonArrayMatch) {
        return JSON.parse(jsonArrayMatch[0]) as T;
      }
      
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
