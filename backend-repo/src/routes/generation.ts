// Document Generation API Routes
// Handles ATO document generation requests and job management

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generationService, type GenerationRequest } from '../services/generation-service';
import { narrativeGenerationService } from '../services/narrative-generation.service';
import { validateAuth, checkSystemAccess, type AuthenticatedRequest } from '../middleware/auth';
import { storage } from '../storage';

const router = Router();

// Request validation schemas
const generationRequestSchema = z.object({
  systemId: z.string().uuid(),
  documentTypes: z.array(z.enum([
    'ssp',
    'stig_checklist',
    'jsig_checklist',
    'sar_package',
    'poam_report', 
    'control_narratives',
    'sar', // Using sar for evidence summary
    'complete_ato_package',
    'sctm_excel',
    'rar',
    'pps_worksheet'
  ])),
  includeEvidence: z.boolean().default(true),
  includeArtifacts: z.boolean().default(true),
  useTemplates: z.boolean().default(true), // Default to template-based generation for proper Word docs
  templateOptions: z.object({
    classification: z.string().optional(),
    organization: z.string().optional(),
    authorizedOfficials: z.array(z.string()).optional(),
    customFields: z.record(z.any()).optional(),
    ruleType: z.enum(['stig', 'jsig']).optional(), // Add support for specifying rule type
    serviceEnvironment: z.string().optional(), // For JSIG: joint service environment description
    jointServiceContext: z.string().optional(), // For JSIG: multi-service context details
    applicableServices: z.array(z.string()).optional() // For JSIG: list of applicable service branches
  }).optional()
}).strict();

/**
 * POST /api/generation/start
 * Start a new document generation job
 */
router.post('/start', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const request = generationRequestSchema.parse(req.body);
    
    // Check if user has access to the system
    const hasSystemAccess = await checkSystemAccess(req.user!.id, request.systemId, storage);
    if (!hasSystemAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system',
        systemId: request.systemId
      });
    }

    const jobId = await generationService.startGeneration(request);

    res.status(202).json({
      success: true,
      jobId,
      message: 'Document generation started',
      statusUrl: `/api/generation/status/${jobId}`,
      resultUrl: `/api/generation/result/${jobId}`
    });

  } catch (error) {
    console.error('Generation start error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start generation'
    });
  }
});

/**
 * GET /api/generation/jobs/:jobId
 * Get generation job status and progress (alias for /status/:jobId)
 */
router.get('/jobs/:jobId', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;

    const jobIdSchema = z.string().uuid('Invalid job ID format');
    const validatedJobId = jobIdSchema.parse(jobId);

    const status = await generationService.getGenerationStatus(validatedJobId);
    if (!status) {
      return res.status(404).json({
        error: 'Generation job not found'
      });
    }

    const job = await storage.getGenerationJob(validatedJobId);
    if (job && job.systemId) {
      const hasSystemAccess = await checkSystemAccess(req.user!.id, job.systemId, storage);
      if (!hasSystemAccess) {
        return res.status(403).json({
          error: 'Access denied - insufficient permissions for this system'
        });
      }
    }

    let result = null;
    if (status.status === 'completed') {
      result = await generationService.getGenerationResult(validatedJobId);
    }

    res.json({
      success: true,
      status,
      result
    });

  } catch (error) {
    console.error('Get generation job error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid job ID format',
        details: error.errors
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get generation job'
    });
  }
});

/**
 * GET /api/generation/status/:jobId
 * Get generation job status and progress
 */
router.get('/status/:jobId', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;

    // Input validation
    const jobIdSchema = z.string().uuid('Invalid job ID format');
    const validatedJobId = jobIdSchema.parse(jobId);

    const status = await generationService.getGenerationStatus(validatedJobId);
    if (!status) {
      return res.status(404).json({
        error: 'Generation job not found'
      });
    }

    // Get job to verify system access
    const job = await storage.getGenerationJob(validatedJobId);
    if (job && job.systemId) {
      const hasSystemAccess = await checkSystemAccess(req.user!.id, job.systemId, storage);
      if (!hasSystemAccess) {
        return res.status(403).json({
          error: 'Access denied - insufficient permissions for this system'
        });
      }
    }

    // If job is completed, include the result data
    let result = null;
    if (status.status === 'completed') {
      result = await generationService.getGenerationResult(validatedJobId);
    }

    res.json({
      success: true,
      status,
      result
    });

  } catch (error) {
    console.error('Get generation status error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid job ID format',
        details: error.errors
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get generation status'
    });
  }
});

/**
 * GET /api/generation/result/:jobId
 * Get completed generation results
 */
router.get('/result/:jobId', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;

    // Input validation
    const jobIdSchema = z.string().uuid('Invalid job ID format');
    const validatedJobId = jobIdSchema.parse(jobId);

    // Get job to verify system access before fetching results
    const job = await storage.getGenerationJob(validatedJobId);
    if (!job) {
      return res.status(404).json({
        error: 'Generation job not found'
      });
    }

    if (job.systemId) {
      const hasSystemAccess = await checkSystemAccess(req.user!.id, job.systemId, storage);
      if (!hasSystemAccess) {
        return res.status(403).json({
          error: 'Access denied - insufficient permissions for this system'
        });
      }
    }

    const result = await generationService.getGenerationResult(validatedJobId);
    if (!result) {
      return res.status(404).json({
        error: 'Generation result not found or job not completed'
      });
    }

    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Get generation result error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid job ID format',
        details: error.errors
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get generation result'
    });
  }
});

/**
 * GET /api/generation/templates
 * Get available document templates and options
 */
router.get('/templates', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Templates are accessible to all authenticated users
    // No system-specific authorization needed for general template information
    const templates = [
      {
        type: 'stig_checklist',
        name: 'STIG Checklists',
        description: 'Generate automated STIG compliance checklists',
        estimatedTime: '5-10 minutes',
        category: 'compliance',
        ruleType: 'stig'
      },
      {
        type: 'jsig_checklist',
        name: 'JSIG Checklists',
        description: 'Generate automated JSIG (Java STIG) compliance checklists for Java applications',
        estimatedTime: '5-10 minutes',
        category: 'compliance',
        ruleType: 'jsig'
      },
      {
        type: 'sar_package',
        name: 'Security Assessment Report',
        description: 'Comprehensive security assessment documentation',
        estimatedTime: '10-15 minutes',
        category: 'assessment'
      },
      {
        type: 'poam_report',
        name: 'Plan of Action & Milestones',
        description: 'POA&M report for identified findings and remediation',
        estimatedTime: '5-8 minutes',
        category: 'remediation'
      },
      {
        type: 'control_narratives',
        name: 'Control Implementation Narratives',
        description: 'Detailed implementation narratives for security controls',
        estimatedTime: '8-12 minutes',
        category: 'controls'
      },
      {
        type: 'evidence_summary',
        name: 'Evidence Summary',
        description: 'Compilation and summary of collected evidence',
        estimatedTime: '3-5 minutes',
        category: 'evidence'
      },
      {
        type: 'complete_ato_package',
        name: 'Complete ATO Package',
        description: 'Full ATO documentation package with all components',
        estimatedTime: '20-30 minutes',
        category: 'package'
      },
      {
        type: 'sctm_excel',
        name: 'Security Control Traceability Matrix',
        description: 'Excel-based control traceability matrix with STIG mappings',
        estimatedTime: '10-15 minutes',
        category: 'compliance',
        templateSupported: true
      },
      {
        type: 'rar',
        name: 'Risk Assessment Report',
        description: 'Comprehensive risk assessment documentation',
        estimatedTime: '15-20 minutes',
        category: 'risk',
        templateSupported: true
      },
      {
        type: 'pps_worksheet',
        name: 'Privacy Impact Assessment Worksheet',
        description: 'Excel-based privacy impact assessment worksheet',
        estimatedTime: '12-18 minutes',
        category: 'privacy',
        templateSupported: true
      }
    ];

    res.json({
      templates,
      total: templates.length
    });

  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      error: 'Failed to get templates'
    });
  }
});

/**
 * GET /api/generation/jobs
 * List generation jobs for the authenticated user
 */
router.get('/jobs', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Input validation for query parameters
    const querySchema = z.object({
      systemId: z.string().uuid().optional(),
      status: z.enum(['pending', 'running', 'processing', 'completed', 'completed_with_errors', 'failed']).optional(),
      limit: z.string().transform(val => {
        const num = parseInt(val, 10);
        return isNaN(num) ? 50 : Math.min(Math.max(num, 1), 200);
      }).optional().default('50')
    });

    const { systemId, status, limit } = querySchema.parse(req.query);

    // Get all jobs first
    let jobs = await storage.getGenerationJobs();

    // Server-side filtering by user's accessible systems only
    const accessibleJobs = [];
    for (const job of jobs) {
      if (job.systemId) {
        const hasSystemAccess = await checkSystemAccess(req.user!.id, job.systemId, storage);
        if (hasSystemAccess) {
          accessibleJobs.push(job);
        }
      }
    }

    // Apply additional filters
    let filteredJobs = accessibleJobs;
    
    if (systemId) {
      // Verify user has access to the requested system
      const hasSystemAccess = await checkSystemAccess(req.user!.id, systemId, storage);
      if (!hasSystemAccess) {
        return res.status(403).json({
          error: 'Access denied - insufficient permissions for this system'
        });
      }
      filteredJobs = filteredJobs.filter(job => job.systemId === systemId);
    }

    if (status) {
      filteredJobs = filteredJobs.filter(job => job.status === status);
    }

    // Apply limit and sort by creation date (most recent first)
    filteredJobs.sort((a, b) => {
      const aTime = new Date(a.startTime || a.createdAt || 0).getTime();
      const bTime = new Date(b.startTime || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    
    const limitedJobs = filteredJobs.slice(0, limit);

    res.json({
      success: true,
      jobs: limitedJobs.map(job => ({
        id: job.id,
        systemId: job.systemId,
        documentTypes: job.documentTypes,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        startTime: job.startTime,
        endTime: job.endTime,
        error: job.error
      })),
      total: limitedJobs.length,
      filters: { systemId, status, limit }
    });

  } catch (error) {
    console.error('List generation jobs error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list generation jobs'
    });
  }
});

/**
 * DELETE /api/generation/jobs/:jobId
 * Cancel or delete a generation job
 */
router.delete('/jobs/:jobId', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;

    // Get job to check permissions
    const job = await storage.getGenerationJob(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Generation job not found'
      });
    }

    // Check if user has access to the system
    const hasSystemAccess = await checkSystemAccess(req.user!.id, job.systemId!, storage);
    if (!hasSystemAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }

    // For now, just mark as cancelled (implement proper cancellation logic later)
    await storage.updateGenerationJob(jobId, {
      status: 'failed',
      error: 'Cancelled by user',
      endTime: new Date()
    });

    res.json({
      success: true,
      message: 'Generation job cancelled'
    });

  } catch (error) {
    console.error('Cancel generation job error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to cancel generation job'
    });
  }
});

/**
 * POST /api/generation/narratives/regenerate
 * Regenerate control narrative with updated evidence
 */
router.post('/narratives/regenerate', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const regenerateSchema = z.object({
      systemId: z.string().uuid(),
      controlId: z.string()
    });
    
    const { systemId, controlId } = regenerateSchema.parse(req.body);
    
    // Check if user has access to the system
    const hasSystemAccess = await checkSystemAccess(req.user!.id, systemId, storage);
    if (!hasSystemAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }
    
    // Regenerate narrative with updated evidence
    const narrative = await narrativeGenerationService.regenerateControlNarrative(systemId, controlId);
    
    res.json({
      success: true,
      narrative: {
        controlId: narrative.controlId,
        content: narrative.narrative,
        confidence: narrative.confidence,
        sources: narrative.sources,
        extractedDetails: narrative.extractedDetails
      }
    });
    
  } catch (error) {
    console.error('Regenerate narrative error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to regenerate narrative'
    });
  }
});

/**
 * POST /api/generation/narratives/bulk
 * Generate narratives for all controls in a system
 */
router.post('/narratives/bulk', validateAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const bulkSchema = z.object({
      systemId: z.string().uuid()
    });
    
    const { systemId } = bulkSchema.parse(req.body);
    
    // Check if user has access to the system
    const hasSystemAccess = await checkSystemAccess(req.user!.id, systemId, storage);
    if (!hasSystemAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }
    
    // Generate narratives for all controls
    const narratives = await narrativeGenerationService.generateSystemNarratives(systemId);
    
    res.json({
      success: true,
      totalGenerated: narratives.length,
      narratives: narratives.map(n => ({
        controlId: n.controlId,
        confidence: n.confidence
      }))
    });
    
  } catch (error) {
    console.error('Bulk narrative generation error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate narratives'
    });
  }
});

export default router;
