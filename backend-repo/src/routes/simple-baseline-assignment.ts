/**
 * Simple baseline assignment API routes
 */

import { Router } from 'express';
import { simpleBaselineAssignmentService } from '../services/simple-baseline-assignment.service';
import { validateAuth } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(validateAuth);

/**
 * POST /api/simple-baseline-assignment/assign
 * Assign baseline controls based on impact level
 */
router.post('/assign', async (req, res) => {
  try {
    const { systemId, impactLevel } = req.body;
    
    // Validate required fields
    if (!systemId || !impactLevel) {
      return res.status(400).json({
        success: false,
        error: 'systemId and impactLevel are required'
      });
    }
    
    // Validate impact level
    if (!['Low', 'Moderate', 'High'].includes(impactLevel)) {
      return res.status(400).json({
        success: false,
        error: 'impactLevel must be Low, Moderate, or High'
      });
    }
    
    // Assign baseline controls
    const result = await simpleBaselineAssignmentService.assignBaselineControls({
      systemId,
      impactLevel
    });
    
    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.errors?.join(', ') || 'Failed to assign controls'
      });
    }
  } catch (error) {
    console.error('Error in baseline assignment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign controls'
    });
  }
});

/**
 * GET /api/simple-baseline-assignment/baseline/:impactLevel
 * Get baseline controls for a specific impact level
 */
router.get('/baseline/:impactLevel', async (req, res) => {
  try {
    const { impactLevel } = req.params;
    
    // Validate impact level
    if (!['Low', 'Moderate', 'High'].includes(impactLevel)) {
      return res.status(400).json({
        success: false,
        error: 'impactLevel must be Low, Moderate, or High'
      });
    }
    
    const controls = simpleBaselineAssignmentService.getBaselineControls(impactLevel as 'Low' | 'Moderate' | 'High');
    
    res.json({
      success: true,
      data: {
        impactLevel,
        controls,
        count: controls.length
      }
    });
  } catch (error) {
    console.error('Error getting baseline controls:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get baseline controls'
    });
  }
});

export default router;
