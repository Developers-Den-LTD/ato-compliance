// LLM Provider Types for ATO Document Generation
// Based on Replit integrations: javascript_anthropic and javascript_openai

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: LLMToolCall[];
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
}

export interface LLMGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  model?: string;
}

export interface LLMProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  generateText(messages: LLMMessage[], options?: LLMGenerationOptions): Promise<LLMResponse>;
  generateJSON<T = any>(messages: LLMMessage[], options?: LLMGenerationOptions): Promise<T>;
  generateEmbeddings?(texts: string[], model?: string): Promise<number[][]>;
  getAvailableModels(): string[];
  getDefaultModel(): string;
}

export interface ProviderConfiguration {
  provider: string;
  isEnabled: boolean;
  priority: number;
  isDefault: boolean;
  configuration: Record<string, any>;
}

export interface ModelRouterOptions {
  maxRetries?: number;
  fallbackOnError?: boolean;
  timeoutMs?: number;
}

export interface LLMTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMStreamOptions {
  onChunk: (chunk: any) => void;
  signal?: AbortSignal;
}

// ATO-specific generation types
export interface ATOGenerationRequest {
  type: 'stig_checklist' | 'sar_section' | 'poam_item' | 'control_narrative';
  systemId: string;
  controlIds?: string[];
  stigRuleIds?: string[];
  evidence?: any[];
  context?: Record<string, any>;
}

export interface ATOGenerationResponse {
  content: string;
  type: string;
  metadata: {
    controlsProcessed: string[];
    stigRulesProcessed: string[];
    generatedAt: string;
    provider: string;
    model: string;
  };
}
