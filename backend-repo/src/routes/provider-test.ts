// Test endpoint for provider settings
import { Router } from 'express';
import { db } from '../db';
import { providerSettings } from "../schema";
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/provider-test/check
 * Check provider settings without authentication
 */
router.get('/check', async (req, res) => {
  try {
    // Get all provider settings
    const settings = await db.select().from(providerSettings);
    
    res.json({
      success: true,
      count: settings.length,
      settings: settings.map(s => ({
        id: s.id,
        provider: s.provider,
        isEnabled: s.isEnabled,
        priority: s.priority,
        isDefault: s.isDefault,
        hasUserId: !!s.userId,
        userId: s.userId,
        hasConfig: !!s.configuration,
        configKeys: s.configuration ? Object.keys(s.configuration) : []
      }))
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/provider-test/clean-userid
 * Remove userId from all provider settings
 */
router.post('/clean-userid', async (req, res) => {
  try {
    // Update all provider settings to remove userId
    const result = await db
      .update(providerSettings)
      .set({ userId: null })
      .returning();
    
    res.json({
      success: true,
      message: `Cleaned userId from ${result.length} provider settings`,
      cleaned: result.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clean userId',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/provider-test/create-clean
 * Create a clean provider setting without userId
 */
router.post('/create-clean/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { isEnabled, priority, configuration } = req.body;
    
    // Direct database insert without userId
    const result = await db
      .insert(providerSettings)
      .values({
        provider: provider as any,
        isEnabled: isEnabled ?? true,
        priority: priority ?? 1,
        isDefault: false,
        configuration: configuration || {}
        // Note: NOT including userId
      })
      .returning();
    
    res.json({
      success: true,
      created: result[0]
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create clean setting',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
