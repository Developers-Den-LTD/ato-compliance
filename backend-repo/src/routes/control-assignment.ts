/**
 * API routes for intelligent control assignment
 */

import { Router } from 'express';
import { ControlAssignmentService } from '../services/control-assignment.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const controlAssignmentService = new ControlAssignmentService();

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /api/control-assignment/options/:systemId
 * Get available control assignment options for a system
 */
router.get('/options/:systemId', async (req, res) => {
  try {
    const { systemId } = req.params;
    
    const options = await controlAssignmentService.getAssignmentOptions(systemId);
    
    res.json({
      success: true,
      data: options
    });
  } catch (error) {
    console.error('Error getting assignment options:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get assignment options'
    });
  }
});

/**
 * POST /api/control-assignment/assign
 * Assign controls to a system using the selected strategy
 */
router.post('/assign', async (req, res) => {
  try {
    console.log('Assignment route called with body:', req.body);
    
    const {
      systemId,
      assignmentType,
      templateId,
      controlIds,
      impactLevel,
      category
    } = req.body;
    
    console.log('Extracted values:', { systemId, assignmentType, templateId, controlIds, impactLevel, category });
    
    // Validate required fields
    if (!systemId || !assignmentType) {
      return res.status(400).json({
        success: false,
        error: 'systemId and assignmentType are required'
      });
    }
    
    // Use the final assignment service
    const result = await controlAssignmentService.assignControls({
      systemId,
      assignmentType,
      templateId,
      controlIds,
      impactLevel,
      category
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
    console.error('Error assigning controls:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign controls'
    });
  }
});

/**
 * GET /api/control-assignment/recommendations/:systemId
 * Get smart recommendations for a system
 */
router.get('/recommendations/:systemId', async (req, res) => {
  try {
    const { systemId } = req.params;
    
    const recommendations = await controlAssignmentService.getRecommendations(systemId);
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recommendations'
    });
  }
});

/**
 * POST /api/control-assignment/simple-test
 * Test simple assignment without complex templates
 */
router.post('/simple-test', async (req, res) => {
  try {
    const { systemId, controlId } = req.body;
    
    if (!systemId || !controlId) {
      return res.status(400).json({
        success: false,
        error: 'systemId and controlId are required'
      });
    }
    
    const result = await controlAssignmentService.assignControls({ systemId, controlIds: [controlId] } as any);
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('Error in simple test:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test assignment'
    });
  }
});

/**
 * GET /api/control-assignment/templates
 * Get all available control templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { getControlAssignmentOptions } = await import('../data/control-templates');
    
    // Get templates for different combinations
    const templates = {
      low: getControlAssignmentOptions('Major Application', 'Low'),
      moderate: getControlAssignmentOptions('Major Application', 'Moderate'),
      high: getControlAssignmentOptions('Major Application', 'High'),
      webApp: getControlAssignmentOptions('Major Application', 'Moderate'),
      database: getControlAssignmentOptions('Major Application', 'High'),
      network: getControlAssignmentOptions('General Support System', 'Moderate'),
      mobile: getControlAssignmentOptions('Major Application', 'Moderate')
    };
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get templates'
    });
  }
});

export default router;
