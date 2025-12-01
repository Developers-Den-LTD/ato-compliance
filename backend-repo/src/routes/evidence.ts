// Evidence API Routes
// Handles evidence retrieval and management

import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';

const router = Router();

// Validation schemas
const getEvidenceSchema = z.object({
  systemId: z.string().uuid()
});

/**
 * Get evidence for a system
 */
router.get('/', async (req, res) => {
  try {
    const { systemId } = getEvidenceSchema.parse(req.query);

    // Get evidence for the system
    const evidence = await storage.getEvidenceBySystem(systemId);

    res.json({
      success: true,
      evidence,
      count: evidence.length
    });

  } catch (error) {
    console.error('Get evidence error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get evidence',
      details: error.message
    });
  }
});

/**
 * Get evidence for a specific artifact
 */
router.get('/artifact/:artifactId', async (req, res) => {
  try {
    const { artifactId } = req.params;

    if (!artifactId) {
      return res.status(400).json({
        success: false,
        error: 'Artifact ID is required'
      });
    }

    // Get evidence for the artifact
    const evidence = await storage.getEvidenceByArtifact(artifactId);

    res.json({
      success: true,
      evidence,
      count: evidence.length
    });

  } catch (error) {
    console.error('Get artifact evidence error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get artifact evidence',
      details: error.message
    });
  }
});

/**
 * Get evidence for a specific control
 */
router.get('/control/:controlId', async (req, res) => {
  try {
    const { controlId } = req.params;
    const { systemId } = req.query;

    if (!controlId) {
      return res.status(400).json({
        success: false,
        error: 'Control ID is required'
      });
    }

    // Get evidence for the control
    const evidence = await storage.getEvidenceByControl(controlId);

    res.json({
      success: true,
      evidence,
      count: evidence.length
    });

  } catch (error) {
    console.error('Get control evidence error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get control evidence',
      details: error.message
    });
  }
});

export default router;
