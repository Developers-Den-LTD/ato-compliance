// Admin API Routes
// Administrative endpoints for system configuration and maintenance

import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../types/auth.types';
import { checkAndFixProviderSettings } from '../utils/fix-provider-settings';
import { storage } from '../storage';

const router = Router();

/**
 * POST /api/admin/fix-providers
 * Initialize or fix LLM provider settings
 */
router.post('/fix-providers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    console.log('Admin: Fixing provider settings...');
    
    const result = await checkAndFixProviderSettings();
    
    // Get detailed status
    const providers = await storage.getProviderSettings();
    const providerStatus = providers.map(p => ({
      provider: p.provider,
      enabled: p.isEnabled,
      priority: p.priority,
      isDefault: p.isDefault,
      hasApiKey: p.provider === 'ollama' || !!(p.configuration as any)?.apiKey
    }));
    
    res.json({
      success: result.success,
      message: result.message,
      workingProviders: result.workingProviders,
      providers: providerStatus,
      recommendation: result.workingProviders === 0 
        ? 'Please set ANTHROPIC_API_KEY or OPENAI_API_KEY in your environment variables, or ensure Ollama is running locally.'
        : 'Provider settings are properly configured.'
    });
    
  } catch (error) {
    console.error('Fix providers error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fix provider settings'
    });
  }
});

/**
 * GET /api/admin/provider-status
 * Get current LLM provider status
 */
router.get('/provider-status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const providers = await storage.getProviderSettings();
    
    const status = await Promise.all(providers.map(async (p) => {
      const hasApiKey = p.provider === 'ollama' || !!(p.configuration as any)?.apiKey;
      const envKeySet = p.provider === 'anthropic' ? !!process.env.ANTHROPIC_API_KEY :
                       p.provider === 'openai' ? !!process.env.OPENAI_API_KEY :
                       true; // Ollama doesn't need API key
      
      return {
        provider: p.provider,
        enabled: p.isEnabled,
        priority: p.priority,
        isDefault: p.isDefault,
        hasApiKey,
        envKeySet,
        isWorking: p.isEnabled && hasApiKey && envKeySet,
        configuration: {
          model: (p.configuration as any)?.model || 'default',
          maxTokens: (p.configuration as any)?.maxTokens || 4096,
          baseUrl: p.provider === 'ollama' ? (p.configuration as any)?.baseUrl : undefined
        }
      };
    }));
    
    const workingCount = status.filter(s => s.isWorking).length;
    
    res.json({
      success: true,
      totalProviders: status.length,
      workingProviders: workingCount,
      providers: status,
      ready: workingCount > 0,
      message: workingCount > 0 
        ? `${workingCount} provider(s) ready for document generation`
        : 'No working providers configured - narrative generation will fail'
    });
    
  } catch (error) {
    console.error('Provider status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get provider status'
    });
  }
});

export default router;
