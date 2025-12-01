import { LLMMessage, LLMTool } from '../types';

export class OpenRouterStreamingAdapter {
  private baseURL = 'https://openrouter.ai/api/v1';
  private apiKey: string;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
  }
  
  async chatCompletionStream(options: {
    messages: LLMMessage[];
    tools?: LLMTool[];
    onChunk: (chunk: any) => void;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }): Promise<void> {
    const { messages, tools, onChunk, temperature = 0.7, maxTokens = 4096, model = 'anthropic/claude-3-opus' } = options;
    
    const requestBody: any = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        tool_call_id: m.tool_call_id,
        tool_calls: m.tool_calls,
      })),
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };
    
    if (tools && tools.length > 0) {
      requestBody.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      }));
    }
    
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:5000',
        'X-Title': 'ATO Compliance Agent',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status} ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      throw new Error('No response body');
    }
    
    let currentToolCall: any = null;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            
            if (delta) {
              if (delta.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.index === 0) {
                    currentToolCall = {
                      id: toolCall.id,
                      type: 'function',
                      function: {
                        name: toolCall.function?.name || '',
                        arguments: toolCall.function?.arguments || '',
                      },
                    };
                  } else if (currentToolCall && toolCall.function?.arguments) {
                    currentToolCall.function.arguments += toolCall.function.arguments;
                  }
                }
                
                if (currentToolCall) {
                  onChunk({ tool_calls: [currentToolCall] });
                }
              }
              
              if (delta.content) {
                onChunk({ content: delta.content });
              }
            }
          } catch (e) {
            console.error('Failed to parse SSE chunk:', e);
          }
        }
      }
    }
  }
}
