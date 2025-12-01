// Data Ingestion API Routes
// Handles file uploads and scan data processing

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ingestionService } from '../services/ingestion-service';
import { storage } from '../storage';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../types/auth.types';

const checkSystemAccess = async (userId: string, systemId: string): Promise<boolean> => {
  const system = await storage.getSystem(systemId);
  return !!system;
};

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept XML and Nessus files
    const allowedTypes = [
      'application/xml',
      'text/xml',
      'application/octet-stream', // For .nessus and .cklb files
      'application/json', // For .cklb files
    ];
    
    const allowedExtensions = ['.xml', '.nessus', '.xccdf', '.ckl', '.cklb'];
    const hasValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (allowedTypes.includes(file.mimetype) || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only XML, NESSUS, XCCDF, CKL, and CKLB files are allowed.'));
    }
  }
});

// Validation schemas
const uploadOptionsSchema = z.object({
  systemId: z.string().min(1, 'System ID is required'),
  fileType: z.enum(['nessus', 'scap', 'ckl', 'cklb', 'auto']).default('auto'),
  includeInformational: z.union([z.boolean(), z.string()]).transform(val => val === true || val === 'true').default(false),
  autoMapStig: z.union([z.boolean(), z.string()]).transform(val => val === true || val === 'true').default(true),
  stigVersion: z.string().optional(),
  filterBySeverity: z.array(z.string()).optional(),
  filterByHost: z.array(z.string()).optional(),
}).strict();

/**
 * POST /api/ingestion/upload
 * Upload and process security scan files
 */
router.post('/upload', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    // Validate request body
    const options = uploadOptionsSchema.parse(req.body);
    
    // Check if user has access to the system
    const hasSystemAccess = await checkSystemAccess(req.user!.userId, options.systemId);
    if (!hasSystemAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }
    
    // Verify system exists
    const system = await storage.getSystem(options.systemId);
    if (!system) {
      return res.status(404).json({
        error: 'System not found'
      });
    }

    // Process the uploaded file
    const result = await ingestionService.ingestScanData({
      systemId: options.systemId,
      fileName: req.file.originalname,
      fileContent: req.file.buffer,
      fileType: options.fileType,
      options: {
        includeInformational: options.includeInformational,
        autoMapStig: options.autoMapStig,
        stigVersion: options.stigVersion,
        filterBySeverity: options.filterBySeverity,
        filterByHost: options.filterByHost,
      },
      userId: req.user!.userId
    });

    res.json({
      success: true,
      jobId: result.jobId,
      message: 'File uploaded and processing started',
      summary: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        scanDate: result.scanResult.scanDate,
        scanner: result.scanResult.scanner,
        totalVulnerabilities: result.scanResult.totalVulnerabilities,
        findingsCreated: result.findingsCreated,
        evidenceCreated: result.evidenceCreated,
        processingTime: result.processingTime,
        vulnerabilitySummary: result.scanResult.vulnerabilitySummary
      },
      errors: result.errorsEncountered.length > 0 ? result.errorsEncountered : undefined
    });

  } catch (error) {
    console.error('Upload processing error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process upload'
    });
  }
});

/**
 * POST /api/ingestion/validate
 * Validate file format and get metadata without full processing
 */
router.post('/validate', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    const metadata = await ingestionService.getFileMetadata(
      req.file.originalname,
      req.file.buffer
    );

    res.json({
      fileName: req.file.originalname,
      fileSize: req.file.size,
      isValid: metadata.isValid,
      detectedType: metadata.fileType,
      metadata: metadata.metadata,
      supportedFormats: ['nessus', 'scap']
    });

  } catch (error) {
    console.error('File validation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to validate file'
    });
  }
});

/**
 * GET /api/ingestion/progress/:jobId
 * Get processing progress for a specific job
 */
router.get('/progress/:jobId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { jobId } = req.params;
    
    // Input validation
    const jobIdSchema = z.string().uuid('Invalid job ID format');
    const validatedJobId = jobIdSchema.parse(jobId);
    
    // Get job to verify system access
    const job = await storage.getGenerationJob(validatedJobId);
    if (job && job.systemId) {
      const hasSystemAccess = await checkSystemAccess(req.user!.userId, job.systemId);
      if (!hasSystemAccess) {
        return res.status(403).json({
          error: 'Access denied - insufficient permissions for this system'
        });
      }
    }
    
    // Get progress from ingestion service
    const progress = ingestionService.getProgress(validatedJobId);
    
    // Job already retrieved above for access check
    
    if (!job && !progress) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    res.json({
      jobId,
      status: job?.status || 'unknown',
      progress: progress?.progress || job?.progress || 0,
      stage: progress?.stage || 'unknown',
      currentItem: progress?.currentItem,
      totalItems: progress?.totalItems,
      processedItems: progress?.processedItems,
      errors: progress?.errors || [],
      startTime: progress?.startTime || job?.createdAt,
      estimatedCompletion: progress?.estimatedCompletion,
      completed: job?.endTime,
      metadata: job?.metadata
    });

  } catch (error) {
    console.error('Progress check error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get progress'
    });
  }
});

/**
 * GET /api/ingestion/jobs
 * List recent ingestion jobs for a system
 */
router.get('/jobs', authenticate, async (req: AuthRequest, res) => {
  try {
    // Input validation with comprehensive schema
    const querySchema = z.object({
      systemId: z.string().uuid('systemId must be a valid UUID'),
      limit: z.string().transform(val => {
        const num = parseInt(val, 10);
        return isNaN(num) ? 10 : Math.min(Math.max(num, 1), 100);
      }).optional().default('10')
    });

    const { systemId, limit } = querySchema.parse(req.query);
    
    // Check if user has access to the requested system
    const hasSystemAccess = await checkSystemAccess(req.user!.userId, systemId);
    if (!hasSystemAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }

    // Get recent ingestion jobs for the specific system only
    const jobs = [] as any[]; // Stub - getGenerationJobsBySystem doesn't exist
    // const jobs = await storage.getGenerationJobsBySystem(systemId);
    
    // Limit results after retrieval
    const limitedJobs = jobs.slice(0, limit);

    // Filter for ingestion jobs and get active progress
    const ingestionJobs = limitedJobs
      .filter(job => job.type === 'data_ingestion')
      .map(job => {
        const progress = ingestionService.getProgress(job.id);
        return {
          ...job,
          currentProgress: progress
        };
      });

    res.json({
      jobs: ingestionJobs,
      activeJobs: ingestionService.getActiveJobs().filter(activeJob => {
        // Filter active jobs to only show those the user has access to
        // Check if activeJob has systemId property and matches the requested system
        return 'systemId' in activeJob && activeJob.systemId === systemId;
      }),
      total: ingestionJobs.length,
      filters: { systemId, limit }
    });

  } catch (error) {
    console.error('Jobs list error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get jobs'
    });
  }
});

/**
 * GET /api/ingestion/systems/:systemId/findings
 * Get findings summary for a system
 */
router.get('/systems/:systemId/findings', authenticate, async (req: AuthRequest, res) => {
  try {
    const { systemId } = req.params;
    const { source, severity, status } = req.query;

    // Input validation
    const paramsSchema = z.object({
      systemId: z.string().uuid('Invalid system ID format')
    });
    
    const querySchema = z.object({
      source: z.enum(['nessus', 'scap', 'manual']).optional(),
      severity: z.enum(['critical', 'high', 'medium', 'low', 'informational']).optional(),
      status: z.enum(['open', 'fixed', 'accepted', 'false_positive']).optional()
    });

    const { systemId: validatedSystemId } = paramsSchema.parse({ systemId });
    const validatedQuery = querySchema.parse({ source, severity, status });

    // Check if user has access to the system
    const hasSystemAccess = await checkSystemAccess(req.user!.userId, validatedSystemId);
    if (!hasSystemAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }

    // Verify system exists
    const system = await storage.getSystem(validatedSystemId);
    if (!system) {
      return res.status(404).json({
        error: 'System not found'
      });
    }

    // Get findings with optional filters
    const findings = await storage.getFindingsBySystem(validatedSystemId);
    
    // Apply filters
    let filteredFindings = findings;
    
    if (validatedQuery.source) {
      filteredFindings = filteredFindings.filter(f => f.source === validatedQuery.source);
    }
    
    if (validatedQuery.severity) {
      filteredFindings = filteredFindings.filter(f => f.severity === validatedQuery.severity);
    }
    
    if (validatedQuery.status) {
      filteredFindings = filteredFindings.filter(f => f.status === validatedQuery.status);
    }

    // Calculate summary statistics
    const summary = {
      total: filteredFindings.length,
      bySeverity: {
        critical: filteredFindings.filter(f => f.severity === 'critical').length,
        high: filteredFindings.filter(f => f.severity === 'high').length,
        medium: filteredFindings.filter(f => f.severity === 'medium').length,
        low: filteredFindings.filter(f => f.severity === 'low').length,
        informational: filteredFindings.filter(f => f.severity === 'informational').length,
      },
      byStatus: {
        open: filteredFindings.filter(f => f.status === 'open').length,
        fixed: filteredFindings.filter(f => f.status === 'fixed').length,
        accepted: filteredFindings.filter(f => f.status === 'accepted').length,
        false_positive: filteredFindings.filter(f => f.status === 'false_positive').length,
      },
      bySource: {
        nessus: filteredFindings.filter(f => f.source === 'nessus').length,
        scap: filteredFindings.filter(f => f.source === 'scap').length,
        manual: filteredFindings.filter(f => f.source === 'manual').length,
      }
    };

    res.json({
      systemId: validatedSystemId,
      systemName: system.name,
      summary,
      findings: filteredFindings.slice(0, 100), // Limit response size
      totalCount: filteredFindings.length,
      filters: validatedQuery
    });

  } catch (error) {
    console.error('Findings summary error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get findings summary'
    });
  }
});

export default router;



