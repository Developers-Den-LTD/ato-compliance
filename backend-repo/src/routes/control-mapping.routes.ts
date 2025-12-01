import { Router } from 'express';
import { z } from 'zod';
import { ControlMappingService } from '../services/control-mapping.service';
import { ConfidenceScoringService } from '../services/confidence-scoring.service';
import { ControlRelationshipService } from '../services/control-relationship.service';
import { MappingPersistenceService } from '../services/mapping-persistence.service';

const router = Router();
const controlMappingService = new ControlMappingService();
const confidenceScoringService = new ConfidenceScoringService();
const relationshipService = new ControlRelationshipService();
const persistenceService = new MappingPersistenceService();

// Validation schemas
const mapDocumentSchema = z.object({
  documentId: z.string().uuid(),
  controlIds: z.array(z.string()).optional(),
  framework: z.string().optional(),
  minConfidence: z.number().min(0).max(100).optional(),
  includeRelationships: z.boolean().optional()
});

const updateConfidenceSchema = z.object({
  newConfidence: z.number().min(0).max(100),
  reason: z.string().min(1)
});

const queryMappingsSchema = z.object({
  documentId: z.string().uuid().optional(),
  controlId: z.string().optional(),
  framework: z.string().optional(),
  minConfidence: z.number().min(0).max(100).optional(),
  maxConfidence: z.number().min(0).max(100).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
});

/**
 * POST /api/v1/control-mapping/map-document
 * Map a document to relevant controls
 */
router.post('/map-document', async (req, res) => {
  try {
    const validation = mapDocumentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.errors
      });
    }

    const result = await controlMappingService.mapDocumentToControls(validation.data as any);
    
    res.json({
      success: true,
      data: result,
      message: `Successfully mapped document to ${result.mappings.length} controls`
    });
    } catch (error) {
      console.error('Error mapping document:', error);
      res.status(500).json({
        error: 'Failed to map document',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
});

/**
 * GET /api/v1/control-mapping/document/:id/mappings
 * Get mappings for a specific document
 */
router.get('/document/:id/mappings', async (req, res) => {
  try {
    const { id } = req.params;
    const { minConfidence } = req.query;

    const mappings = await controlMappingService.getDocumentMappings(
      id,
      minConfidence ? parseFloat(minConfidence as string) : undefined
    );

    res.json({
      success: true,
      data: mappings,
      count: mappings.length
    });
    } catch (error) {
      console.error('Error getting document mappings:', error);
      res.status(500).json({
        error: 'Failed to get document mappings',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
});

/**
 * GET /api/v1/control-mapping/control/:id/documents
 * Get documents mapped to a specific control
 */
router.get('/control/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    const { framework, minConfidence } = req.query;

    const mappings = await controlMappingService.getControlDocuments(
      id,
      framework as string,
      minConfidence ? parseFloat(minConfidence as string) : undefined
    );

    res.json({
      success: true,
      data: mappings,
      count: mappings.length
    });
    } catch (error) {
      console.error('Error getting control documents:', error);
      res.status(500).json({
        error: 'Failed to get control documents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
});

/**
 * PUT /api/v1/control-mapping/mapping/:id
 * Update mapping confidence score
 */
router.put('/mapping/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validation = updateConfidenceSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.errors
      });
    }

    const { newConfidence, reason } = validation.data;
    const userId = (req as any).user?.id; // Assuming user is attached to request

    await controlMappingService.updateMappingConfidence(id, newConfidence, reason, userId);

    res.json({
      success: true,
      message: 'Mapping confidence updated successfully'
    });
  } catch (error) {
    console.error('Error updating mapping confidence:', error);
    res.status(500).json({
      error: 'Failed to update mapping confidence',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/v1/control-mapping/mapping/:id
 * Remove a mapping
 */
router.delete('/mapping/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id; // Assuming user is attached to request

    await controlMappingService.removeMapping(id, userId);

    res.json({
      success: true,
      message: 'Mapping removed successfully'
    });
  } catch (error) {
    console.error('Error removing mapping:', error);
    res.status(500).json({
      error: 'Failed to remove mapping',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/control-mapping/relationships/:controlId
 * Get control relationships
 */
router.get('/relationships/:controlId', async (req, res) => {
  try {
    const { controlId } = req.params;
    const { framework, relationshipType, minStrength } = req.query;

    const relationships = await relationshipService.getControlRelationships(
      [controlId],
      framework as string,
      relationshipType as string,
      minStrength ? parseFloat(minStrength as string) : undefined
    );

    res.json({
      success: true,
      data: relationships,
      count: relationships.length
    });
  } catch (error) {
    console.error('Error getting control relationships:', error);
    res.status(500).json({
      error: 'Failed to get control relationships',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/control-mapping/coverage/:documentId
 * Get control coverage report for a document
 */
router.get('/coverage/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    const coverage = await controlMappingService.getControlCoverageReport(documentId);

    res.json({
      success: true,
      data: coverage
    });
  } catch (error) {
    console.error('Error getting coverage report:', error);
    res.status(500).json({
      error: 'Failed to get coverage report',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/control-mapping/mappings
 * Query mappings with filters
 */
router.get('/mappings', async (req, res) => {
  try {
    const validation = queryMappingsSchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.errors
      });
    }

    const result = await persistenceService.getMappings(validation.data);

    res.json({
      success: true,
      data: result.mappings,
      pagination: {
        total: result.total,
        hasMore: result.hasMore,
        limit: validation.data.limit,
        offset: validation.data.offset
      }
    });
  } catch (error) {
    console.error('Error querying mappings:', error);
    res.status(500).json({
      error: 'Failed to query mappings',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/control-mapping/mapping/:id
 * Get specific mapping by ID
 */
router.get('/mapping/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const mapping = await persistenceService.getMappingById(id);
    
    if (!mapping) {
      return res.status(404).json({
        error: 'Mapping not found'
      });
    }

    res.json({
      success: true,
      data: mapping
    });
  } catch (error) {
    console.error('Error getting mapping:', error);
    res.status(500).json({
      error: 'Failed to get mapping',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/control-mapping/mapping/:id/history
 * Get mapping history
 */
router.get('/mapping/:id/history', async (req, res) => {
  try {
    const { id } = req.params;

    const history = await persistenceService.getMappingHistory(id);

    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error getting mapping history:', error);
    res.status(500).json({
      error: 'Failed to get mapping history',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/control-mapping/statistics
 * Get mapping statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const validation = queryMappingsSchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.errors
      });
    }

    const statistics = await persistenceService.getMappingStatistics(validation.data);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/control-mapping/confidence/breakdown
 * Get confidence breakdown for mapping factors
 */
router.post('/confidence/breakdown', async (req, res) => {
  try {
    const { factors } = req.body;

    if (!factors || typeof factors !== 'object') {
      return res.status(400).json({
        error: 'Invalid factors data'
      });
    }

    const breakdown = await confidenceScoringService.getConfidenceBreakdown(factors);

    res.json({
      success: true,
      data: breakdown
    });
  } catch (error) {
    console.error('Error getting confidence breakdown:', error);
    res.status(500).json({
      error: 'Failed to get confidence breakdown',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/v1/control-mapping/confidence/weights
 * Update confidence scoring weights
 */
router.put('/confidence/weights', async (req, res) => {
  try {
    const { weights } = req.body;

    if (!weights || typeof weights !== 'object') {
      return res.status(400).json({
        error: 'Invalid weights data'
      });
    }

    const validation = confidenceScoringService.validateWeights(weights);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid weights',
        details: validation.errors
      });
    }

    await confidenceScoringService.updateConfidenceWeights(weights);

    res.json({
      success: true,
      message: 'Confidence weights updated successfully'
    });
  } catch (error) {
    console.error('Error updating confidence weights:', error);
    res.status(500).json({
      error: 'Failed to update confidence weights',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/control-mapping/confidence/thresholds
 * Get confidence thresholds
 */
router.get('/confidence/thresholds', async (req, res) => {
  try {
    const thresholds = confidenceScoringService.getConfidenceThresholds();

    res.json({
      success: true,
      data: thresholds
    });
  } catch (error) {
    console.error('Error getting confidence thresholds:', error);
    res.status(500).json({
      error: 'Failed to get confidence thresholds',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
