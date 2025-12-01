// Context Aggregation API Routes
// RESTful endpoints for context aggregation operations

import { Router } from 'express';
import { z } from 'zod';
import { contextAggregationService } from '../services/context-aggregation.service';
import { evidenceCollectionService } from '../services/evidence-collection.service';
import { contextPersistenceService } from '../services/context-persistence.service';

const router = Router();

// Validation schemas
const AggregationRequestSchema = z.object({
  controlId: z.string().min(1),
  controlFramework: z.string().min(1),
  systemId: z.string().min(1),
  includeRelationships: z.boolean().optional(),
  minRelevanceScore: z.number().min(0).max(1).optional(),
  maxEvidenceItems: z.number().min(1).max(1000).optional()
});

const ContextQuerySchema = z.object({
  controlId: z.string().min(1),
  controlFramework: z.string().min(1),
  includeEvidence: z.boolean().optional(),
  includeRelationships: z.boolean().optional(),
  minQualityScore: z.number().min(0).max(100).optional()
});

const UpdateAggregationSchema = z.object({
  aggregatedContext: z.any().optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  evidenceCount: z.number().min(0).optional()
});

// POST /api/v1/context/aggregate-control
// Aggregate context for a specific control
router.post('/aggregate-control', async (req, res) => {
  try {
    const validation = AggregationRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors
      });
    }

    const request = validation.data as any; // Type cast to bypass validation
    const result = await contextAggregationService.aggregateControlContext(request);

    res.json({
      success: true,
      data: result,
      message: `Context aggregation completed for control ${request.controlId}`
    });

  } catch (error) {
    console.error('Error in aggregate-control endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to aggregate control context',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/v1/context/control/:id/aggregated
// Get aggregated context for a control
router.get('/control/:id/aggregated', async (req, res) => {
  try {
    const { id: controlId } = req.params;
    const { framework, includeEvidence, includeRelationships, minQualityScore } = req.query;

    if (!framework || typeof framework !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Control framework is required'
      });
    }

    const query = {
      controlId,
      controlFramework: framework,
      includeEvidence: includeEvidence === 'true',
      includeRelationships: includeRelationships === 'true',
      minQualityScore: minQualityScore ? Number(minQualityScore) : undefined
    };

    const validation = ContextQuerySchema.safeParse(query);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors
      });
    }

    const context = await contextAggregationService.getControlContext(validation.data as any);

    if (!context) {
      return res.status(404).json({
        success: false,
        error: 'No aggregated context found for this control'
      });
    }

    let responseData: any = { context };

    // Include evidence items if requested
    if (validation.data.includeEvidence) {
      const evidenceItems = await contextAggregationService.getControlEvidence(controlId, framework);
      responseData.evidenceItems = evidenceItems;
    }

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error in get aggregated context endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get aggregated context',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/v1/context/control/:id/evidence
// Get evidence items for a control
router.get('/control/:id/evidence', async (req, res) => {
  try {
    const { id: controlId } = req.params;
    const { framework } = req.query;

    if (!framework || typeof framework !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Control framework is required'
      });
    }

    const evidenceItems = await contextAggregationService.getControlEvidence(controlId, framework);

    res.json({
      success: true,
      data: {
        controlId,
        controlFramework: framework,
        evidenceItems,
        count: evidenceItems.length
      }
    });

  } catch (error) {
    console.error('Error in get control evidence endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get control evidence',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/v1/context/aggregation/:id
// Update aggregated context
router.put('/aggregation/:id', async (req, res) => {
  try {
    const { id: aggregationId } = req.params;
    const { userId } = req.body;

    const validation = UpdateAggregationSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid update data',
        details: validation.error.errors
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required for updates'
      });
    }

    const updatedAggregation = await contextAggregationService.updateAggregatedContext(
      aggregationId,
      validation.data,
      userId
    );

    res.json({
      success: true,
      data: updatedAggregation,
      message: 'Aggregated context updated successfully'
    });

  } catch (error) {
    console.error('Error in update aggregation endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update aggregated context',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/v1/context/gaps/:controlId
// Get control gaps
router.get('/gaps/:controlId', async (req, res) => {
  try {
    const { controlId } = req.params;
    const { framework } = req.query;

    if (!framework || typeof framework !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Control framework is required'
      });
    }

    const gaps = await contextAggregationService.getControlGaps(controlId, framework);

    res.json({
      success: true,
      data: {
        controlId,
        controlFramework: framework,
        gaps,
        gapCount: gaps.length
      }
    });

  } catch (error) {
    console.error('Error in get control gaps endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get control gaps',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/v1/context/validate
// Validate context completeness
router.post('/validate', async (req, res) => {
  try {
    const { controlId, controlFramework } = req.body;

    if (!controlId || !controlFramework) {
      return res.status(400).json({
        success: false,
        error: 'Control ID and framework are required'
      });
    }

    const validation = await contextAggregationService.validateContextCompleteness(
      controlId,
      controlFramework
    );

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    console.error('Error in validate context endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate context completeness',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/v1/context/evidence-items
// Get evidence items with filtering
router.get('/evidence-items', async (req, res) => {
  try {
    const { 
      controlId, 
      documentId, 
      evidenceType, 
      minQuality, 
      maxQuality,
      limit = '100',
      offset = '0'
    } = req.query;

    let evidenceItems;

    if (controlId && typeof controlId === 'string') {
      evidenceItems = await evidenceCollectionService.getEvidenceItemsByControl(controlId, 'NIST-800-53');
    } else if (documentId && typeof documentId === 'string') {
      evidenceItems = await evidenceCollectionService.getEvidenceItemsByDocument(documentId);
    } else if (evidenceType && typeof evidenceType === 'string') {
      evidenceItems = await contextPersistenceService.getEvidenceItemsByType(evidenceType);
    } else if (minQuality || maxQuality) {
      const min = minQuality ? Number(minQuality) : 0;
      const max = maxQuality ? Number(maxQuality) : 1;
      evidenceItems = await contextPersistenceService.getEvidenceItemsByQualityRange(min, max);
    } else {
      return res.status(400).json({
        success: false,
        error: 'At least one filter parameter is required'
      });
    }

    // Apply pagination
    const limitNum = Number(limit);
    const offsetNum = Number(offset);
    const paginatedItems = evidenceItems.slice(offsetNum, offsetNum + limitNum);

    res.json({
      success: true,
      data: {
        evidenceItems: paginatedItems,
        total: evidenceItems.length,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < evidenceItems.length
      }
    });

  } catch (error) {
    console.error('Error in get evidence items endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get evidence items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/v1/context/stats
// Get aggregation statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await contextPersistenceService.getAggregationStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error in get stats endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get aggregation statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/v1/context/versions/:controlId
// Get context versions for a control
router.get('/versions/:controlId', async (req, res) => {
  try {
    const { controlId } = req.params;
    const { framework } = req.query;

    if (!framework || typeof framework !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Control framework is required'
      });
    }

    const versions = await contextPersistenceService.getContextVersions(controlId, framework);

    res.json({
      success: true,
      data: {
        controlId,
        controlFramework: framework,
        versions,
        count: versions.length
      }
    });

  } catch (error) {
    console.error('Error in get context versions endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get context versions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/v1/context/aggregation/:id
// Delete aggregated context
router.delete('/aggregation/:id', async (req, res) => {
  try {
    const { id: aggregationId } = req.params;

    await contextPersistenceService.deleteAggregation(aggregationId);

    res.json({
      success: true,
      message: 'Aggregated context deleted successfully'
    });

  } catch (error) {
    console.error('Error in delete aggregation endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete aggregated context',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
