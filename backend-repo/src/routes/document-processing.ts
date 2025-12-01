// Document Processing API Routes
// Handles document upload, processing, and analysis

import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { enhancedDocumentProcessingService } from '../services/enhanced-document-processing.service';
import { documentExtractionService } from '../services/document-extraction.service';
import { nlpAnalysisService } from '../services/nlp-analysis.service';
import { semanticSearchService } from '../services/semantic-search.service';

const router = Router();

// Validation schemas
const processDocumentSchema = z.object({
  artifactId: z.string(), // Allow any string ID to handle seed artifacts
  systemId: z.string().uuid(),
  options: z.object({
    useAI: z.boolean().default(true),
    createEvidence: z.boolean().default(true),
    analyzeAllControls: z.boolean().default(true),
    controlIds: z.array(z.string()).optional(),
    systemContext: z.any().optional()
  }).optional()
});

const processDocumentsSchema = z.object({
  artifactIds: z.array(z.string()), // Allow any string ID to handle seed artifacts
  systemId: z.string().uuid(),
  options: z.object({
    useAI: z.boolean().default(true),
    createEvidence: z.boolean().default(true),
    analyzeAllControls: z.boolean().default(true),
    controlIds: z.array(z.string()).optional(),
    systemContext: z.any().optional()
  }).optional()
});

const reprocessDocumentSchema = z.object({
  artifactId: z.string(), // Allow any string ID to handle seed artifacts
  systemId: z.string().uuid(),
  options: z.object({
    useAI: z.boolean().default(true),
    createEvidence: z.boolean().default(true),
    analyzeAllControls: z.boolean().default(true),
    controlIds: z.array(z.string()).optional(),
    systemContext: z.any().optional()
  }).optional()
});

/**
 * Process a single document
 */
router.post('/process', async (req, res) => {
  try {
    const { artifactId, systemId, options = {} } = processDocumentSchema.parse(req.body);

    // Get the artifact
    const artifact = await storage.getArtifact(artifactId);
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: 'Artifact not found'
      });
    }

    // Process the document
    const result = await enhancedDocumentProcessingService.processDocument(
      artifact,
      systemId,
      {
        useAI: options.useAI ?? true,
        createEvidence: options.createEvidence ?? true,
        analyzeAllControls: options.analyzeAllControls ?? true,
        controlIds: options.controlIds,
        systemContext: options.systemContext
      }
    );

    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Process document error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process document',
      details: error.message
    });
  }
});

/**
 * Process multiple documents in batch
 */
router.post('/process-batch', async (req, res) => {
  try {
    const { artifactIds, systemId, options = {} } = processDocumentsSchema.parse(req.body);

    // Get the artifacts
    const artifacts = [];
    for (const artifactId of artifactIds) {
      const artifact = await storage.getArtifact(artifactId);
      if (artifact) {
        artifacts.push(artifact);
      }
    }

    if (artifacts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No valid artifacts found'
      });
    }

    // Process the documents
    const results = await enhancedDocumentProcessingService.processDocuments(
      artifacts,
      systemId,
      {
        useAI: options.useAI ?? true,
        createEvidence: options.createEvidence ?? true,
        analyzeAllControls: options.analyzeAllControls ?? true,
        controlIds: options.controlIds,
        systemContext: options.systemContext
      }
    );

    res.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });

  } catch (error) {
    console.error('Process documents batch error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process documents',
      details: error.message
    });
  }
});

/**
 * Reprocess a document with updated options
 */
router.post('/reprocess', async (req, res) => {
  try {
    const { artifactId, systemId, options = {} } = reprocessDocumentSchema.parse(req.body);

    // Reprocess the document
    const result = await enhancedDocumentProcessingService.reprocessDocument(
      artifactId,
      systemId,
      {
        useAI: options.useAI ?? true,
        createEvidence: options.createEvidence ?? true,
        analyzeAllControls: options.analyzeAllControls ?? true,
        controlIds: options.controlIds,
        systemContext: options.systemContext
      }
    );

    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Reprocess document error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to reprocess document',
      details: error.message
    });
  }
});

/**
 * Get processing status for an artifact
 */
router.get('/status/:artifactId', async (req, res) => {
  try {
    const { artifactId } = req.params;

    const status = await enhancedDocumentProcessingService.getProcessingStatus(artifactId);

    res.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('Get processing status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get processing status',
      details: error.message
    });
  }
});

/**
 * Extract content from a document (without full processing)
 */
router.post('/extract-content', async (req, res) => {
  try {
    const { artifactId } = req.body;

    if (!artifactId) {
      return res.status(400).json({
        success: false,
        error: 'Artifact ID is required'
      });
    }

    const artifact = await storage.getArtifact(artifactId);
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: 'Artifact not found'
      });
    }

    const extractedContent = await documentExtractionService.extractContent(artifact);

    res.json({
      success: true,
      extractedContent
    });

  } catch (error) {
    console.error('Extract content error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract content',
      details: error.message
    });
  }
});

/**
 * Analyze document content with NLP
 */
router.post('/analyze-nlp', async (req, res) => {
  try {
    const { artifactId, systemId, systemContext } = req.body;

    if (!artifactId || !systemId) {
      return res.status(400).json({
        success: false,
        error: 'Artifact ID and System ID are required'
      });
    }

    const artifact = await storage.getArtifact(artifactId);
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: 'Artifact not found'
      });
    }

    // Extract content first
    const extractedContent = await documentExtractionService.extractContent(artifact);

    // Get controls to analyze
    const systemControls = await storage.getSystemControls(systemId);
    const controls = [];
    for (const sc of systemControls) {
      const control = await storage.getControl(sc.controlId);
      if (control) controls.push(control);
    }

    // Perform NLP analysis
    const nlpAnalysis = await nlpAnalysisService.analyzeDocument(
      extractedContent,
      controls,
      systemContext
    );

    res.json({
      success: true,
      nlpAnalysis
    });

  } catch (error) {
    console.error('NLP analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze document',
      details: error.message
    });
  }
});

/**
 * Perform semantic search for a specific control
 */
router.post('/semantic-search', async (req, res) => {
  try {
    const { artifactId, controlId, systemId, systemContext } = req.body;

    if (!artifactId || !controlId || !systemId) {
      return res.status(400).json({
        success: false,
        error: 'Artifact ID, Control ID, and System ID are required'
      });
    }

    const artifact = await storage.getArtifact(artifactId);
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: 'Artifact not found'
      });
    }

    const control = await storage.getControl(controlId);
    if (!control) {
      return res.status(404).json({
        success: false,
        error: 'Control not found'
      });
    }

    // Extract content first
    const extractedContent = await documentExtractionService.extractContent(artifact);

    // Perform semantic search
    const searchQuery = {
      controlId: control.id,
      controlTitle: control.title,
      controlDescription: control.description,
      controlRequirements: control.requirements,
      systemContext
    };

    const searchResult = await semanticSearchService.findRelevantSections(
      extractedContent,
      searchQuery
    );

    res.json({
      success: true,
      searchResult
    });

  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform semantic search',
      details: error.message
    });
  }
});

export default router;

