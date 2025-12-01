// Utility to check and fix LLM provider settings
// This resolves narrative generation failures

import { storage } from '../storage';
import { InsertProviderSettings } from '../schema';

export async function checkAndFixProviderSettings(): Promise<{
  success: boolean;
  message: string;
  workingProviders: number;
}> {
  try {
    console.log('Checking LLM provider settings...');
    
    // Get existing settings
    const existingSettings = await storage.getProviderSettings();
    
    if (existingSettings.length === 0) {
      console.log('No provider settings found, creating defaults...');
      
      // Create default settings
      const defaultProviders: InsertProviderSettings[] = [
        {
          provider: 'anthropic',
          isEnabled: !!process.env.ANTHROPIC_API_KEY,
          priority: 1,
          isDefault: true,
          configuration: {
            apiKey: process.env.ANTHROPIC_API_KEY || '',
            model: 'claude-3-sonnet-20240229',
            maxTokens: 4096
          }
        },
        {
          provider: 'openai',
          isEnabled: !!process.env.OPENAI_API_KEY,
          priority: 2,
          isDefault: false,
          configuration: {
            apiKey: process.env.OPENAI_API_KEY || '',
            model: 'gpt-4-turbo-preview',
            maxTokens: 4096
          }
        },
        {
          provider: 'ollama',
          isEnabled: true, // Always enable for air-gap support
          priority: 3,
          isDefault: false,
          configuration: {
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            model: 'llama2',
            maxTokens: 4096
          }
        }
      ];
      
      for (const provider of defaultProviders) {
        try {
          await storage.createProviderSettings(provider);
          console.log(`Created settings for ${provider.provider}`);
        } catch (error) {
          console.error(`Failed to create settings for ${provider.provider}:`, error);
        }
      }
    }
    
    // Check enabled providers
    const finalSettings = await storage.getProviderSettings();
    const enabledProviders = finalSettings.filter(s => s.isEnabled);
    
    if (enabledProviders.length === 0 && finalSettings.length > 0) {
      // Enable Ollama as fallback
      const ollamaSettings = finalSettings.find(s => s.provider === 'ollama');
      if (ollamaSettings) {
        await storage.updateProviderSettings(ollamaSettings.id, { isEnabled: true });
        console.log('Enabled Ollama as fallback provider');
      }
    }
    
    // Count working providers
    const workingProviders = finalSettings.filter(s => {
      if (!s.isEnabled) return false;
      
      // Check for API key in configuration or environment
      const config = s.configuration as Record<string, any> || {};
      
      if (s.provider === 'anthropic') {
        return !!(config.apiKey || process.env.ANTHROPIC_API_KEY);
      }
      if (s.provider === 'openai') {
        return !!(config.apiKey || process.env.OPENAI_API_KEY);
      }
      if (s.provider === 'ollama') {
        // Ollama doesn't require API key for local instances
        return true;
      }
      return false;
    }).length;
    
    return {
      success: workingProviders > 0,
      message: workingProviders > 0 
        ? `${workingProviders} working provider(s) available`
        : 'No working LLM providers configured',
      workingProviders
    };
    
  } catch (error) {
    console.error('Error checking provider settings:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      workingProviders: 0
    };
  }
}

// Export for manual use only - avoid auto-execution to prevent circular dependencies
