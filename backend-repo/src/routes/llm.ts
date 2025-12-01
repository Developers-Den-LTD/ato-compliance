// LLM Provider Management API Routes
// Handles LLM provider configuration, testing, and model management for ATO document generation

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateAuth, type AuthenticatedRequest } from '../middleware/auth';
import { storage } from '../storage';
import { modelRouter } from '../llm/model-router';
import { insertProviderSettingsSchema } from "../schema";

const router = Router();

// Request validation schemas
const providerConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  priority: z.number().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  configuration: z.object({
    // OpenRouter configuration
    apiKey: z.string().optional(),
    endpoint: z.string().url().optional(), // Custom endpoint URL
    baseUrl: z.string().url().optional(), // Alias for endpoint
    model: z.string().optional(),
    httpReferer: z.string().optional(), // For OpenRouter attribution
    appTitle: z.string().optional(), // Application title for OpenRouter
    
    // Ollama configuration (for air-gapped environments)
    modelName: z.string().optional(),
    pullOnStartup: z.boolean().optional(),
    
    // Common settings
    maxTokens: z.number().min(1).max(100000).optional(),
    temperature: z.number().min(0).max(2).optional(),
    timeoutMs: z.number().min(1000).max(300000).optional(),
  }).optional()
}).strict();

const testProvidersSchema = z.object({
  providers: z.array(z.enum(['openrouter', 'ollama'])).optional(),
  timeout: z.number().min(1000).max(60000).default(30000)
}).strict();

/**
 * GET /api/llm/providers
 * Get all available providers with their current settings, available models, and connectivity status
 */
router.get('/providers', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Fetching LLM provider configurations and status');
    
    // Get all provider settings from database
    const allProviderSettings = await storage.getProviderSettings();
    
    // Get available providers from ModelRouter
    const availableProviders = await modelRouter.getAvailableProviders();
    
    // Test connectivity for all providers
    const connectivityResults = await modelRouter.testProviders();
    
    // Get available models for each provider
    const availableModels = await modelRouter.getAllAvailableModels();
    
    // Build comprehensive provider information
    const supportedProviders = ['openrouter', 'ollama'];
    const providerData = await Promise.all(
      supportedProviders.map(async (providerName) => {
        // Find settings for this provider
        const settings = allProviderSettings.find(s => s.provider === providerName);
        
        // Get provider instance from ModelRouter
        const providerInstance = await modelRouter.getProvider(providerName);
        
        return {
          name: providerName,
          displayName: providerName.charAt(0).toUpperCase() + providerName.slice(1),
          isEnabled: settings?.isEnabled ?? false,
          priority: settings?.priority ?? 999,
          isDefault: settings?.isDefault ?? false,
          isConnected: connectivityResults[providerName] ?? false,
          isAvailable: availableProviders.some(p => p.name === providerName),
          configuration: settings?.configuration || {},
          availableModels: availableModels[providerName] || [],
          defaultModel: providerInstance && typeof providerInstance.getDefaultModel === 'function' ? providerInstance.getDefaultModel() : null,
          settings: settings ? {
            id: settings.id,
            userId: settings.userId,
            createdAt: settings.createdAt,
            updatedAt: settings.updatedAt
          } : null,
          capabilities: {
            textGeneration: true,
            jsonGeneration: true,
            streaming: providerName !== 'ollama', // Ollama typically doesn't support streaming in basic setups
            airGapped: providerName === 'ollama'
          }
        };
      })
    );
    
    // Sort by priority (lower number = higher priority)
    providerData.sort((a, b) => a.priority - b.priority);
    
    const response = {
      success: true,
      providers: providerData,
      summary: {
        totalProviders: providerData.length,
        enabledProviders: providerData.filter(p => p.isEnabled).length,
        connectedProviders: providerData.filter(p => p.isConnected).length,
        defaultProvider: providerData.find(p => p.isDefault)?.name || null,
        totalModels: Object.values(availableModels).flat().length
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error fetching LLM providers:', error);
    res.status(500).json({
      error: 'Failed to fetch LLM provider information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/llm/providers/:provider
 * Update a specific provider's configuration (enabled status, priority, custom endpoint, model settings)
 */
router.put('/providers/:provider', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate provider parameter
    const providerSchema = z.enum(['openrouter', 'ollama']);
    const provider = providerSchema.parse(req.params.provider);
    
    // Validate request body
    const config = providerConfigSchema.parse(req.body);
    
    console.log(`Updating configuration for provider: ${provider}`);
    
    // Get existing provider settings
    const existingSettings = await storage.getProviderSettingsByProvider(provider);
    
    // If updating isDefault to true, first set all others to false
    if (config.isDefault === true) {
      const allSettings = await storage.getProviderSettings();
      for (const settings of allSettings) {
        if (settings.isDefault && settings.provider !== provider) {
          await storage.updateProviderSettings(settings.id, { isDefault: false });
        }
      }
    }
    
    let updatedSettings;
    
    if (existingSettings) {
      // Update existing settings
      const updates: Partial<{
        isEnabled: boolean | null;
        priority: number | null;
        isDefault: boolean | null;
        configuration: any;
      }> = {};
      
      if (config.isEnabled !== undefined) updates.isEnabled = config.isEnabled;
      if (config.priority !== undefined) updates.priority = config.priority;
      if (config.isDefault !== undefined) updates.isDefault = config.isDefault;
      if (config.configuration !== undefined) {
        // Merge with existing configuration
        updates.configuration = {
          ...(existingSettings.configuration as Record<string, any> || {}),
          ...config.configuration
        };
      }
      
      updatedSettings = await storage.updateProviderSettings(existingSettings.id, updates);
    } else {
      // Create new settings
      const newSettings = {
        provider: provider as any,
        isEnabled: config.isEnabled ?? true,
        priority: config.priority ?? 1,
        isDefault: config.isDefault ?? false,
        configuration: config.configuration || {},
        userId: null // Set to null to avoid foreign key constraint
      };
      
      updatedSettings = await storage.createProviderSettings(newSettings);
    }
    
    if (!updatedSettings) {
      return res.status(500).json({
        error: 'Failed to update provider settings',
        provider
      });
    }
    
    // Update ModelRouter configuration
    try {
      await modelRouter.updateProviderConfiguration({
        provider,
        isEnabled: updatedSettings.isEnabled ?? true,
        priority: updatedSettings.priority ?? 1,
        isDefault: updatedSettings.isDefault ?? false,
        configuration: updatedSettings.configuration as Record<string, any> || {}
      });
    } catch (routerError) {
      console.warn('Failed to update ModelRouter configuration:', routerError);
      // Continue execution - database was updated successfully
    }
    
    // Test connectivity with new configuration
    const connectivityTest = await modelRouter.testProviders();
    const isConnected = connectivityTest[provider] ?? false;
    
    // Get updated provider instance and models
    const providerInstance = await modelRouter.getProvider(provider);
    const availableModels = isConnected ? (providerInstance?.getAvailableModels() || []) : [];
    
    const response = {
      success: true,
      message: `Successfully updated ${provider} provider configuration`,
      provider: {
        name: provider,
        isEnabled: updatedSettings.isEnabled,
        priority: updatedSettings.priority,
        isDefault: updatedSettings.isDefault,
        isConnected,
        configuration: updatedSettings.configuration,
        availableModels,
        defaultModel: providerInstance && typeof providerInstance.getDefaultModel === 'function' ? providerInstance.getDefaultModel() : null,
        updatedAt: updatedSettings.updatedAt
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error updating LLM provider configuration:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Failed to update provider configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/llm/providers/test
 * Test connectivity to all enabled providers and return status
 */
router.post('/providers/test', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const testConfig = testProvidersSchema.parse(req.body);
    
    console.log('Testing LLM provider connectivity', testConfig);
    
    // Get enabled providers to test
    const enabledSettings = await storage.getProviderSettings();
    const enabledProviders = enabledSettings
      .filter(s => s.isEnabled)
      .map(s => s.provider);
    
    // Filter by requested providers if specified
    const providersToTest = testConfig.providers 
      ? testConfig.providers.filter(p => enabledProviders.includes(p))
      : enabledProviders;
    
    if (providersToTest.length === 0) {
      return res.status(400).json({
        error: 'No enabled providers to test',
        enabledProviders,
        requestedProviders: testConfig.providers
      });
    }
    
    // Test each provider with timeout
    const testResults = await Promise.allSettled(
      providersToTest.map(async (providerName) => {
        const startTime = Date.now();
        
        try {
          const provider = await modelRouter.getProvider(providerName);
          if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
          }
          
          // Test with timeout
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Test timeout')), testConfig.timeout);
          });
          
          const testPromise = provider.isAvailable();
          const isAvailable = await Promise.race([testPromise, timeoutPromise]);
          
          const responseTime = Date.now() - startTime;
          
          return {
            provider: providerName,
            status: 'connected',
            isAvailable,
            responseTime,
            models: isAvailable ? provider.getAvailableModels() : [],
            defaultModel: provider && typeof provider.getDefaultModel === 'function' ? provider.getDefaultModel() : null,
            error: null
          };
          
        } catch (error) {
          const responseTime = Date.now() - startTime;
          
          return {
            provider: providerName,
            status: 'failed',
            isAvailable: false,
            responseTime,
            models: [],
            defaultModel: null,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );
    
    // Process results
    const results = testResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          provider: providersToTest[index],
          status: 'error',
          isAvailable: false,
          responseTime: testConfig.timeout,
          models: [],
          defaultModel: null,
          error: result.reason instanceof Error ? result.reason.message : 'Test failed'
        };
      }
    });
    
    // Calculate summary statistics
    const connectedCount = results.filter(r => r.status === 'connected').length;
    const averageResponseTime = results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)
      : 0;
    
    const response = {
      success: true,
      message: `Tested ${results.length} provider(s)`,
      results,
      summary: {
        totalTested: results.length,
        connected: connectedCount,
        failed: results.length - connectedCount,
        averageResponseTime,
        testTimeout: testConfig.timeout,
        timestamp: new Date().toISOString()
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error testing LLM providers:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid test parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Failed to test providers',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/llm/models
 * Get available models from all enabled providers
 */
router.get('/models', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Fetching available models from all providers');
    
    // Get enabled provider settings
    const enabledSettings = await storage.getProviderSettings();
    const enabledProviders = enabledSettings
      .filter(s => s.isEnabled)
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));
    
    // Get available models from each enabled provider
    const modelData = await Promise.allSettled(
      enabledProviders.map(async (settings) => {
        try {
          const provider = await modelRouter.getProvider(settings.provider);
          if (!provider) {
            throw new Error(`Provider ${settings.provider} not found`);
          }
          
          const isAvailable = await provider.isAvailable();
          if (!isAvailable) {
            throw new Error(`Provider ${settings.provider} is not available`);
          }
          
          const models = provider.getAvailableModels();
          const defaultModel = provider && typeof provider.getDefaultModel === 'function' ? provider.getDefaultModel() : null;
          
          return {
            provider: settings.provider,
            displayName: settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1),
            priority: settings.priority || 999,
            isDefault: settings.isDefault || false,
            isConnected: true,
            models: models.map(modelId => ({
              id: modelId,
              name: modelId,
              provider: settings.provider,
              isDefault: modelId === defaultModel,
              capabilities: {
                textGeneration: true,
                jsonGeneration: true,
                maxTokens: getModelMaxTokens(settings.provider, modelId)
              }
            })),
            defaultModel,
            configuration: settings.configuration || {}
          };
          
        } catch (error) {
          return {
            provider: settings.provider,
            displayName: settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1),
            priority: settings.priority || 999,
            isDefault: settings.isDefault || false,
            isConnected: false,
            models: [],
            defaultModel: null,
            error: error instanceof Error ? error.message : 'Unknown error',
            configuration: settings.configuration || {}
          };
        }
      })
    );
    
    // Process results
    const providerResults = modelData.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const settings = enabledProviders[index];
        return {
          provider: settings.provider,
          displayName: settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1),
          priority: settings.priority || 999,
          isDefault: settings.isDefault || false,
          isConnected: false,
          models: [],
          defaultModel: null,
          error: result.reason instanceof Error ? result.reason.message : 'Failed to fetch models',
          configuration: settings.configuration || {}
        };
      }
    });
    
    // Flatten all models with provider info
    const allModels = providerResults.flatMap(provider => 
      provider.models.map(model => ({
        ...model,
        providerDisplayName: provider.displayName,
        providerPriority: provider.priority,
        isProviderDefault: provider.isDefault,
        isProviderConnected: provider.isConnected
      }))
    );
    
    // Calculate summary
    const connectedProviders = providerResults.filter(p => p.isConnected);
    const totalModels = allModels.length;
    
    const response = {
      success: true,
      providers: providerResults,
      models: allModels,
      summary: {
        totalProviders: providerResults.length,
        connectedProviders: connectedProviders.length,
        totalModels,
        defaultProvider: providerResults.find(p => p.isDefault)?.provider || null,
        availableProviders: connectedProviders.map(p => p.provider)
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error fetching available models:', error);
    res.status(500).json({
      error: 'Failed to fetch available models',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Helper function to get model max tokens (simplified implementation)
 */
function getModelMaxTokens(provider: string, modelId: string): number {
  // This is a simplified implementation - in a real system you'd have a comprehensive model database
  const modelLimits: Record<string, Record<string, number>> = {
    anthropic: {
      'claude-3-haiku-20240307': 200000,
      'claude-3-sonnet-20240229': 200000,
      'claude-3-opus-20240229': 200000,
      'claude-3.5-sonnet-20241022': 200000,
    },
    openai: {
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4o': 128000,
      'gpt-3.5-turbo': 16385,
    },
    ollama: {
      // Default for Ollama models - varies by model
      default: 4096
    }
  };
  
  return modelLimits[provider]?.[modelId] || modelLimits[provider]?.default || 4096;
}

/**
 * POST /api/llm/generate
 * Generate text using the best available provider
 */
router.post('/generate', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messages, maxTokens, temperature, model } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'Invalid request: messages array is required'
      });
    }

    console.log('Generating text with LLM provider');
    
    const response = await modelRouter.generateText(messages, {
      maxTokens: maxTokens || 4000,
      temperature: temperature || 0.1,
      model: model
    });
    
    res.json({
      success: true,
      response: response.content,
      model: response.model,
      provider: response.provider,
      usage: response.usage,
      metadata: response.metadata
    });
    
  } catch (error) {
    console.error('Error generating text:', error);
    res.status(500).json({
      error: 'Failed to generate text',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
