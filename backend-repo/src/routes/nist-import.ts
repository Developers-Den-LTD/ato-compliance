/**
 * NIST Controls Import API routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { importFullNISTControls } from '../data/import-full-nist-controls';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * POST /api/nist/import
 * Import all NIST 800-53 Rev 5 controls
 */
router.post('/import', async (req, res) => {
  try {
    console.log('🚀 NIST Controls Import API called');
    
    // Check if controls already exist
    const { db } = await import('../db');
    const { controls } = await import('../schema');
    const existingControls = await db.select().from(controls).limit(1);
    
    if (existingControls.length > 0) {
      return res.json({
        success: true,
        message: 'NIST controls already imported',
        timestamp: new Date().toISOString()
      });
    }
    
    // Import controls
    await importFullNISTControls();
    
    res.json({
      success: true,
      message: 'NIST 800-53 Rev 5 controls imported successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error importing NIST controls:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import NIST controls'
    });
  }
});

export default router;


