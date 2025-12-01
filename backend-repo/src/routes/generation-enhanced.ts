// Enhanced Document Generation API Routes
// Implements streaming, robust error handling, and recovery
// Part of Epic 9 - Document Intelligence Pipeline

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { enhancedGenerationService } from '../services/enhanced-generation-service';
import { generationRecoveryService } from '../services/generation-recovery';
import { validateAuth, checkSystemAccess, type AuthenticatedRequest } from '../middleware/auth';
import { storage } from '../storage';

const router = Router();

// Enhanced request validation with additional options
const enhancedGenerationRequestSchema = z.object({
  systemId: z.string().uuid(),
  documentTypes: z.array(z.enum([
    'ssp',
    'stig_checklist',
    'jsig_checklist',
    'sar_package',
    'poam_report', 
    'control_narratives',
    'sar',
    'complete_ato_package'
  ])).min(1),
  includeEvidence: z.boolean().default(true),
  includeArtifacts: z.boolean().default(true),
  useTemplates: z.boolean().default(true), // Default to template-based generation for proper Word docs
  enableStreaming: z.boolean().default(true),
  chunkSize: z.number().min(1).max(50).default(10),
  templateOptions: z.object({
    classification: z.string().optional(),
    organization: z.string().optional(),
    authorizedOfficials: z.array(z.string()).optional(),
    customFields: z.record(z.any()).optional(),
    templateIds: z.record(z.string()).optional()
  }).optional()
}).strict();

/**
 * POST /api/generation/enhanced/start
 * Start enhanced generation with robust error handling
 */
router.post('/enhanced/start', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const request = enhancedGenerationRequestSchema.parse(req.body);
    
    // Access check
    const hasSystemAccess = await checkSystemAccess(req.user!.id, request.systemId, storage);
    if (!hasSystemAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }

    // Start enhanced generation
    const jobId = await enhancedGenerationService.startGeneration(request);

    res.status(202).json({
      success: true,
      jobId,
      message: 'Enhanced document generation started',
      features: {
        streaming: request.enableStreaming,
        errorRecovery: true,
        chunkedProcessing: true,
        validationPerformed: true
      },
      urls: {
        status: `/api/generation/enhanced/status/${jobId}`,
        stream: `/api/generation/enhanced/stream/${jobId}`,
        result: `/api/generation/enhanced/result/${jobId}`,
        cancel: `/api/generation/enhanced/cancel/${jobId}`
      }
    });

  } catch (error) {
    console.error('Enhanced generation start error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
        suggestions: [
          'Check documentTypes array is not empty',
          'Ensure systemId is a valid UUID',
          'Verify chunkSize is between 1 and 50'
        ]
      });
    }

    // Enhanced error response with suggestions
    const errorMessage = error instanceof Error ? error.message : 'Failed to start generation';
    const suggestions = getErrorSuggestions(errorMessage);

    res.status(500).json({
      error: errorMessage,
      recoverable: isRecoverableError(error),
      suggestions
    });
  }
});

/**
 * GET /api/generation/enhanced/stream/:jobId
 * Server-sent events for real-time progress
 */
router.get('/enhanced/stream/:jobId', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { jobId } = req.params;

  try {
    // Validate job ID
    const jobIdSchema = z.string().uuid();
    const validatedJobId = jobIdSchema.parse(jobId);

    // Check job exists and user has access
    const job = await storage.getGenerationJob(validatedJobId);
    if (!job) {
      return res.status(404).json({ error: 'Generation job not found' });
    }

    if (job.systemId) {
      const hasAccess = await checkSystemAccess(req.user!.id, job.systemId, storage);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable Nginx buffering
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ 
      type: 'connected', 
      jobId: validatedJobId,
      timestamp: new Date() 
    })}\n\n`);

    // Subscribe to generation events
    const progressHandler = (data: any) => {
      if (data.jobId === validatedJobId) {
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          ...data
        })}\n\n`);
      }
    };

    const completeHandler = (data: any) => {
      if (data.jobId === validatedJobId) {
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          ...data
        })}\n\n`);
        cleanup();
      }
    };

    const errorHandler = (data: any) => {
      if (data.jobId === validatedJobId) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          ...data,
          suggestions: getErrorSuggestions(data.error)
        })}\n\n`);
        cleanup();
      }
    };

    enhancedGenerationService.on('progress', progressHandler);
    enhancedGenerationService.on('complete', completeHandler);
    enhancedGenerationService.on('error', errorHandler);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date() })}\n\n`);
    }, 30000);

    // Cleanup on client disconnect
    const cleanup = () => {
      clearInterval(heartbeat);
      enhancedGenerationService.off('progress', progressHandler);
      enhancedGenerationService.off('complete', completeHandler);
      enhancedGenerationService.off('error', errorHandler);
      res.end();
    };

    req.on('close', cleanup);

  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).json({
      error: 'Failed to establish streaming connection'
    });
  }
});

/**
 * POST /api/generation/enhanced/recover/:jobId
 * Attempt to recover failed generation job
 */
router.post('/enhanced/recover/:jobId', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const jobIdSchema = z.string().uuid();
    const validatedJobId = jobIdSchema.parse(jobId);

    // Check job and access
    const job = await storage.getGenerationJob(validatedJobId);
    if (!job) {
      return res.status(404).json({ error: 'Generation job not found' });
    }

    if (job.systemId) {
      const hasAccess = await checkSystemAccess(req.user!.id, job.systemId, storage);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Attempt recovery
    const recoveryResult = await generationRecoveryService.recoverFromFailure(validatedJobId, {
      resumeFromCheckpoint: true,
      retryFailedSteps: true,
      skipFailedControls: false,
      maxRetryAttempts: 3
    });

    res.json({
      success: recoveryResult.success,
      recoveryResult,
      message: recoveryResult.success 
        ? `Generation recovered from ${recoveryResult.resumedFrom}`
        : 'Recovery failed',
      urls: {
        status: `/api/generation/enhanced/status/${validatedJobId}`,
        stream: `/api/generation/enhanced/stream/${validatedJobId}`
      }
    });

  } catch (error) {
    console.error('Recovery error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Recovery failed'
    });
  }
});

/**
 * DELETE /api/generation/enhanced/cancel/:jobId
 * Cancel running generation job
 */
router.delete('/enhanced/cancel/:jobId', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const validatedJobId = z.string().uuid().parse(jobId);

    // Check job and access
    const job = await storage.getGenerationJob(validatedJobId);
    if (!job) {
      return res.status(404).json({ error: 'Generation job not found' });
    }

    if (job.systemId) {
      const hasAccess = await checkSystemAccess(req.user!.id, job.systemId, storage);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Only running jobs can be cancelled
    if (job.status !== 'running' && job.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot cancel job in ${job.status} status`
      });
    }

    // Update job status
    await storage.updateGenerationJob(validatedJobId, {
      status: 'failed',
      error: 'Cancelled by user',
      endTime: new Date()
    });

    res.json({
      success: true,
      message: 'Generation job cancelled',
      jobId: validatedJobId
    });

  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to cancel job'
    });
  }
});

/**
 * GET /api/generation/enhanced/checkpoints/:jobId
 * Get recovery checkpoints for a job
 */
router.get('/enhanced/checkpoints/:jobId', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const validatedJobId = z.string().uuid().parse(jobId);

    // Check access
    const job = await storage.getGenerationJob(validatedJobId);
    if (!job) {
      return res.status(404).json({ error: 'Generation job not found' });
    }

    if (job.systemId) {
      const hasAccess = await checkSystemAccess(req.user!.id, job.systemId, storage);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const checkpoints = await generationRecoveryService.getCheckpoints(validatedJobId);

    res.json({
      success: true,
      jobId: validatedJobId,
      checkpoints: checkpoints.map(cp => ({
        id: cp.id,
        step: cp.step,
        timestamp: cp.timestamp,
        hasData: !!cp.data,
        metadata: cp.metadata
      })),
      canRecover: checkpoints.length > 0 && (job.status === 'failed' || job.status === 'running')
    });

  } catch (error) {
    console.error('Checkpoints error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get checkpoints'
    });
  }
});

// Helper functions

function getErrorSuggestions(errorMessage: string): string[] {
  const suggestions: string[] = [];
  
  if (errorMessage.toLowerCase().includes('timeout')) {
    suggestions.push('Try generating fewer documents at once');
    suggestions.push('Increase timeout settings in configuration');
    suggestions.push('Check network connectivity to LLM service');
  }
  
  if (errorMessage.toLowerCase().includes('memory')) {
    suggestions.push('Reduce chunk size for processing');
    suggestions.push('Generate documents sequentially instead of in parallel');
    suggestions.push('Check system memory availability');
  }
  
  if (errorMessage.toLowerCase().includes('validation')) {
    suggestions.push('Ensure all required system data is present');
    suggestions.push('Check that controls have implementation narratives');
    suggestions.push('Verify template availability if using template mode');
  }
  
  if (errorMessage.toLowerCase().includes('template')) {
    suggestions.push('Upload required templates before generation');
    suggestions.push('Use default generation mode instead of templates');
    suggestions.push('Check template format and compatibility');
  }

  if (suggestions.length === 0) {
    suggestions.push('Check system logs for detailed error information');
    suggestions.push('Try recovery endpoint if job partially completed');
    suggestions.push('Contact support if issue persists');
  }
  
  return suggestions;
}

function isRecoverableError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const recoverablePatterns = [
    'timeout',
    'memory',
    'connection',
    'network',
    'econnreset',
    'etimedout'
  ];
  
  return recoverablePatterns.some(pattern => errorMessage.includes(pattern));
}

export default router;
