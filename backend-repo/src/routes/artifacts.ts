// Artifact Management API Routes
// Handles file uploads for architecture diagrams, documentation, and evidence

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { artifactService } from '../services/artifact-service';
import { fileProcessingService } from '../services/file-processing-service';
import { storage } from '../storage';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../types/auth.types';
import { ArtifactType } from '../schema';

// Helper functions for authentication and authorization
const checkSystemAccess = async (userId: string, systemId: string, storage: any): Promise<boolean> => {
  // Check if user has access to the system
  const system = await storage.getSystem(systemId);
  if (!system) return false;
  
  // For now, allow access if system exists
  // TODO: Implement proper role-based access control
  return true;
};

const getValidCredentials = () => {
  // Return valid credentials for API key/token authentication
  // TODO: Implement proper credential management
  return {
    tokens: process.env.VALID_TOKENS?.split(',') || [],
    apiKeys: process.env.VALID_API_KEYS?.split(',') || []
  };
};

const router = Router();

// Configure multer for artifact uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB maximum - increased for large scan files
  },
  fileFilter: (req, file, cb) => {
    // Permissive file filter - detailed validation happens in artifact service
    // This allows for better error messages and handles MIME type detection issues
    const allowedMimeTypes = [
      // Images
      'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/vnd.microsoft.icon',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.visio',
      // Text and Code
      'text/plain', 'text/markdown', 'text/x-markdown', 'text/html', 'text/csv',
      'text/yaml', 'text/x-yaml', 'application/x-yaml',
      // Data
      'application/json', 'application/xml', 'text/xml',
      // Network capture files
      'application/vnd.tcpdump.pcap', 'application/x-pcap', 'application/x-pcapng',
      // Archives (for bundled scan results)
      'application/zip', 'application/x-zip-compressed', 'application/x-tar',
      'application/gzip', 'application/x-gzip', 'application/x-bzip2',
      'application/x-7z-compressed', 'application/x-rar-compressed',
      // Log files
      'text/log', 'application/x-log',
      // Binary scan files
      'application/x-nessus', 'application/x-nmap',
      // Fallback - allows files with ambiguous MIME detection
      'application/octet-stream'
    ];
    
    // Check file extension as fallback for MIME type issues
    const ext = file.originalname.toLowerCase().split('.').pop();
    const allowedExtensions = [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'svg',
      'txt', 'md', 'json', 'xml', 'yaml', 'yml', 'csv', 'html', 'htm',
      'js', 'ts', 'py', 'java', 'go', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 
      'sh', 'tf', 'hcl', 'bicep', 'ps1', 'dockerfile', 'rs',
      // Security scan file extensions
      'nessus', 'xccdf', 'pcap', 'pcapng', 'cap', 'dmp', 'log', 
      'evtx', 'tar', 'gz', 'zip', 'bz2', '7z', 'rar',
      // Additional scan and report formats
      'nmap', 'masscan', 'zap', 'burp', 'nikto', 'openvas',
      'qualys', 'rapid7', 'tenable', 'acas', 'scap', 'oval',
      'cve', 'cvss', 'cpe', 'cwe', 'sarif', 'spdx', 'sbom'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext || '')) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} (${file.originalname}) is not allowed. Supported formats include: PDF, Word, Excel, Markdown (.md), plain text, images (PNG, JPEG, SVG), JSON, XML, YAML, HTML, source code files, configuration files, security scan files (Nessus, PCAP), and compressed archives. Common extensions: ${allowedExtensions.slice(0, 20).join(', ')}, and more.`));
    }
  }
});

// Validation schemas
const uploadArtifactSchema = z.object({
  systemId: z.string().min(1, 'System ID is required'),
  type: ArtifactType,
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  tags: z.string().optional(), // Will be parsed as comma-separated
  isPublic: z.string().optional(), // Will be converted to boolean
  metadata: z.string().optional(), // Will be parsed as JSON
  autoProcess: z.string().optional(), // Will be converted to boolean for scan files
  processingOptions: z.string().optional() // Will be parsed as JSON for processing options
}).strict();

const updateArtifactSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
}).strict();

/**
 * POST /api/artifacts/upload
 * Upload an artifact file (requires authentication)
 */
router.post('/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    // Validate request body
    const body = uploadArtifactSchema.parse(req.body);
    
    // Verify system exists and user has access
    const system = await storage.getSystem(body.systemId);
    if (!system) {
      return res.status(404).json({
        error: 'System not found'
      });
    }
    
    // Check if user has permission to upload to this system
    const hasSystemAccess = await checkSystemAccess(req.user!.userId, body.systemId, storage);
    if (!hasSystemAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system',
        systemId: body.systemId
      });
    }

    // Parse optional fields
    const tags = body.tags ? body.tags.split(',').map(t => t.trim()).filter(t => t) : undefined;
    const isPublic = body.isPublic ? body.isPublic.toLowerCase() === 'true' : undefined;
    
    // Check if this is a scan file for auto-processing
    const isScanFile = isSecurityScanFile(req.file.originalname, req.file.mimetype);
    
    // Auto-process scan files by default, unless explicitly disabled
    const autoProcess = body.autoProcess !== undefined
      ? body.autoProcess.toLowerCase() === 'true' 
      : isScanFile; // Default to true for scan files, false for others
    
    console.log(`[UPLOAD] File type check:`, {
      fileName: req.file.originalname,
      isScanFile,
      autoProcess,
      explicitAutoProcess: body.autoProcess
    });
    
    let metadata: Record<string, any> | undefined;
    let processingOptions: any = {};
    
    if (body.metadata) {
      try {
        metadata = JSON.parse(body.metadata);
      } catch {
        return res.status(400).json({
          error: 'Invalid metadata JSON format'
        });
      }
    }

    if (body.processingOptions) {
      try {
        processingOptions = JSON.parse(body.processingOptions);
      } catch {
        return res.status(400).json({
          error: 'Invalid processing options JSON format'
        });
      }
    }

    // Validate file for the specified artifact type
    const uploadedFile = {
      originalName: req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      size: req.file.size
    };

    const validation = artifactService.validateUpload(uploadedFile, body.type);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error
      });
    }

    // Upload artifact
    console.log(`[UPLOAD] Uploading artifact:`, {
      systemId: body.systemId,
      type: body.type,
      title: body.title,
      fileName: uploadedFile.originalName,
      size: uploadedFile.size,
      isPublic
    });
    
    const artifact = await artifactService.uploadArtifact({
      systemId: body.systemId,
      type: body.type,
      title: body.title,
      description: body.description,
      file: uploadedFile,
      tags,
      isPublic,
      metadata
    });
    
    console.log(`[UPLOAD] Artifact uploaded successfully:`, {
      id: artifact.id,
      systemId: artifact.systemId,
      title: artifact.title,
      fileName: artifact.fileName,
      isPublic: artifact.isPublic
    });

    let processingResult = null;

    // Auto-process based on file type (isScanFile already declared above)
    if (autoProcess) {
      try {
        if (isScanFile) {
          // Process security scan files
          processingResult = await fileProcessingService.processArtifactFile({
            artifactId: artifact.id,
            systemId: body.systemId,
            options: {
              includeInformational: processingOptions.includeInformational || false,
              autoMapStig: processingOptions.autoMapStig !== false,
              stigVersion: processingOptions.stigVersion,
              filterBySeverity: processingOptions.filterBySeverity,
              filterByHost: processingOptions.filterByHost,
              createStigRules: processingOptions.createStigRules !== false,
              createControls: processingOptions.createControls !== false
            }
          });
          
          // Update artifact metadata with processing status
          await artifactService.updateArtifactMetadata(artifact.id, {
            processingStatus: 'completed',
            processedAt: new Date(),
            metadata: {
              ...artifact.metadata,
              processingStatus: 'completed',
              processedAt: new Date().toISOString(),
              scanResults: {
                findingsCreated: processingResult.findingsCreated,
                evidenceCreated: processingResult.evidenceCreated,
                stigRulesCreated: processingResult.stigRulesCreated,
                controlsCreated: processingResult.controlsCreated,
                processingTime: processingResult.processingTime,
                summary: processingResult.summary
              }
            }
          });
        } else if (body.type === 'evidence_file' || body.type === 'policy_document' || 
                   body.type === 'procedure_document' || body.type === 'system_documentation' || 
                   body.type === 'architecture_diagram' || 
                   // Auto-process all document types that can be analyzed
                   (artifact.mimeType && (
                     artifact.mimeType.includes('pdf') ||
                     artifact.mimeType.includes('word') ||
                     artifact.mimeType.includes('text') ||
                     artifact.mimeType.includes('document')
                   ))) {
          // Process document files for evidence extraction
          const { enhancedDocumentProcessingService } = require('../services/enhanced-document-processing.service');
          
          processingResult = await enhancedDocumentProcessingService.processDocument(
            artifact,
            body.systemId,
            {
              useAI: processingOptions.useAI !== false,
              createEvidence: processingOptions.createEvidence !== false,
              analyzeAllControls: processingOptions.analyzeAllControls !== false,
              mapToControls: processingOptions.mapToControls !== false,
              controlIds: processingOptions.controlIds,
              systemContext: processingOptions.systemContext
            }
          );
          
          // Update artifact metadata with processing status
          await artifactService.updateArtifactMetadata(artifact.id, {
            processingStatus: 'completed',
            processedAt: new Date(),
            metadata: {
              ...artifact.metadata,
              processingStatus: 'completed',
              processedAt: new Date().toISOString(),
              extractedContent: processingResult.extractedContent ? 'available' : 'none',
              controlMappings: processingResult.controlMappings ? {
                mappingsCount: processingResult.controlMappings.mappings.length,
                relationshipsCount: processingResult.controlMappings.relationships.length,
                processingTime: processingResult.controlMappings.processingTime
              } : null
            }
          });
        }
      } catch (processingError) {
        console.error('Auto-processing failed:', processingError);
        // Update artifact metadata with error status
        const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
        await artifactService.updateArtifactMetadata(artifact.id, {
          processingStatus: 'failed',
          processingError: errorMessage,
          processedAt: new Date(),
          metadata: {
            ...artifact.metadata,
            processingStatus: 'failed',
            processingError: errorMessage,
            processedAt: new Date().toISOString()
          }
        });
        // Don't throw - allow upload to succeed even if processing fails
      }
    }

    res.status(201).json({
      success: true,
      artifact,
      processing: processingResult ? {
        jobId: processingResult.jobId,
        status: 'completed',
        findingsCreated: processingResult.findingsCreated,
        evidenceCreated: processingResult.evidenceCreated,
        stigRulesCreated: processingResult.stigRulesCreated,
        controlsCreated: processingResult.controlsCreated,
        processingTime: processingResult.processingTime,
        summary: processingResult.summary,
        errors: processingResult.errorsEncountered.length > 0 ? processingResult.errorsEncountered : undefined
      } : null,
      message: processingResult ? 
        'Artifact uploaded and processed successfully' : 
        'Artifact uploaded successfully'
    });

  } catch (error) {
    console.error('Artifact upload error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to upload artifact'
    });
  }
});

/**
 * GET /api/artifacts/by-id/:artifactId
 * Get artifact information (authentication required for private artifacts)
 */
router.get('/by-id/:artifactId', async (req: Request, res: Response) => {
  try {
    const { artifactId } = req.params;
    
    const artifact = await artifactService.getArtifact(artifactId);
    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found'
      });
    }

    // Check if authentication is disabled
    const authDisabled = process.env.DISABLE_AUTH === 'true' || process.env.NODE_ENV === 'development';
    
    // If artifact is private, require authentication and system access (unless auth is disabled)
    if (!artifact.isPublic && !authDisabled) {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'] as string;
      let isAuthenticated = false;
      let userId: string | undefined;
      
      try {
        const credentials = getValidCredentials();
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          if (credentials.tokens.includes(token)) {
            isAuthenticated = true;
            // Use only the first 8 characters to match auth middleware
            userId = `token-user-${token.substring(0, 8)}`;
          }
        }
        
        if (!isAuthenticated && apiKey && credentials.apiKeys.includes(apiKey)) {
          isAuthenticated = true;
          // Use only the first 8 characters to match auth middleware
          userId = `api-user-${apiKey.substring(0, 8)}`;
        }
      } catch (error) {
        console.error('Authentication check error:', error);
        return res.status(503).json({
          error: 'Authentication service unavailable'
        });
      }
      
      if (!isAuthenticated) {
        return res.status(401).json({
          error: 'Authentication required for private artifacts',
          details: 'Provide Authorization header or X-API-Key header'
        });
      }
      
      // Check system access for private artifacts
      if (artifact.systemId) {
        const hasSystemAccess = await checkSystemAccess(userId!, artifact.systemId, storage);
        if (!hasSystemAccess) {
          return res.status(403).json({
            error: 'Access denied - insufficient permissions for this system',
            systemId: artifact.systemId
          });
        }
      }
    }

    res.json(artifact);

  } catch (error) {
    console.error('Get artifact error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get artifact'
    });
  }
});

/**
 * GET /api/artifacts/systems/:systemId
 * List artifacts for a system (authentication required for private artifacts)
 */
router.get('/systems/:systemId', async (req: Request, res: Response) => {
  try {
    const { systemId } = req.params;
    const { type, isPublic, tags } = req.query;
    
    // Verify system exists
    const system = await storage.getSystem(systemId);
    if (!system) {
      return res.status(404).json({
        error: 'System not found'
      });
    }

    // Parse filters
    const filters: any = {};
    if (type && typeof type === 'string') {
      filters.type = type;
    }
    if (isPublic !== undefined) {
      filters.isPublic = isPublic === 'true';
    }
    if (tags && typeof tags === 'string') {
      filters.tags = tags.split(',').map(t => t.trim()).filter(t => t);
    }

    // Check if authentication is disabled
    const authDisabled = process.env.DISABLE_AUTH === 'true' || process.env.NODE_ENV === 'development';
    
    // Check authentication for private artifacts
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;
    let isAuthenticated = authDisabled; // Auto-authenticate if auth is disabled
    let userId: string | undefined;
    
    if (authDisabled) {
      // In development or when auth is disabled, grant full access
      userId = 'dev-user';
      console.log(`[ARTIFACTS] Auth disabled - granting full access`);
    } else {
      try {
        const credentials = getValidCredentials();
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          if (credentials.tokens.includes(token)) {
            isAuthenticated = true;
            // Use only the first 8 characters to match auth middleware
            userId = `token-user-${token.substring(0, 8)}`;
          }
        }
        
        if (!isAuthenticated && apiKey && credentials.apiKeys.includes(apiKey)) {
          isAuthenticated = true;
          // Use only the first 8 characters to match auth middleware
          userId = `api-user-${apiKey.substring(0, 8)}`;
        }
      } catch (error) {
        console.error('Authentication check error:', error);
      }
    }
    
    // Check system access if authenticated
    let hasSystemAccess = authDisabled; // Auto-grant access if auth is disabled
    if (isAuthenticated && userId && !authDisabled) {
      console.log(`[DEBUG] Checking system access for userId: ${userId}, systemId: ${systemId}`);
      hasSystemAccess = await checkSystemAccess(userId, systemId, storage);
      console.log(`[DEBUG] System access result: ${hasSystemAccess}`);
    } else if (authDisabled) {
      console.log(`[ARTIFACTS] Auth disabled - granting system access`);
    }
    
    // Get artifacts based on permissions
    console.log(`[ARTIFACTS] Getting artifacts from service for system ${systemId}...`);
    let artifacts = await artifactService.getSystemArtifacts(systemId, filters);
    console.log(`[ARTIFACTS] Service returned ${artifacts.length} artifacts`);
    
    // Log each artifact for debugging
    artifacts.forEach((artifact, index) => {
      console.log(`[ARTIFACTS] Artifact ${index + 1}:`, {
        id: artifact.id,
        title: artifact.title,
        fileName: artifact.fileName,
        type: artifact.type,
        isPublic: artifact.isPublic,
        uploadDate: artifact.uploadDate
      });
    });
    
    // Filter to public-only if not authenticated or no system access
    if (!isAuthenticated || !hasSystemAccess) {
      console.log(`[ARTIFACTS] Filtering to public artifacts only (authenticated: ${isAuthenticated}, hasAccess: ${hasSystemAccess})`);
      const originalCount = artifacts.length;
      artifacts = artifacts.filter(artifact => artifact.isPublic);
      console.log(`[ARTIFACTS] After filtering: ${artifacts.length} public artifacts (was ${originalCount})`);
    }
    
    console.log(`[ARTIFACTS] Getting summary...`);
    const summary = await artifactService.getArtifactSummary(systemId);
    console.log(`[ARTIFACTS] Summary:`, summary);

    console.log(`[ARTIFACTS] Sending response with ${artifacts.length} artifacts`);
    res.json({
      systemId,
      systemName: system.name,
      artifacts,
      summary: hasSystemAccess ? summary : {
        // Limited summary for unauthenticated users
        totalCount: artifacts.length,
        publicCount: artifacts.length,
        privateCount: 0,
        byType: {},
        byMimeType: {},
        totalSize: artifacts.reduce((sum, a) => sum + a.fileSize, 0)
      },
      totalCount: artifacts.length,
      accessLevel: hasSystemAccess ? 'full' : 'public_only'
    });

  } catch (error) {
    console.error('List artifacts error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list artifacts'
    });
  }
});

/**
 * GET /api/artifacts/public/:artifactId/:fileName
 * Download public artifact file
 */
router.get('/public/:artifactId/:fileName', async (req: Request, res: Response) => {
  try {
    const { artifactId } = req.params;
    
    const artifact = await artifactService.getArtifact(artifactId);
    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found'
      });
    }

    if (!artifact.isPublic) {
      return res.status(403).json({
        error: 'Artifact is not publicly accessible'
      });
    }

    const fileData = await artifactService.downloadArtifact(artifactId);
    if (!fileData) {
      return res.status(404).json({
        error: 'Artifact file not found'
      });
    }

    res.set({
      'Content-Type': fileData.mimeType,
      'Content-Disposition': `attachment; filename="${fileData.fileName}"`,
      'Content-Length': fileData.content.length.toString(),
      'Cache-Control': 'public, max-age=86400' // Cache for 1 day
    });

    res.send(fileData.content);

  } catch (error) {
    console.error('Download public artifact error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to download artifact'
    });
  }
});

/**
 * GET /api/artifacts/private/:artifactId/:fileName
 * Download private artifact file (requires authentication)
 */
router.get('/private/:artifactId/:fileName', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { artifactId } = req.params;
    
    // Authentication is handled by authenticate middleware
    const userId = req.user?.userId;
    
    const artifact = await artifactService.getArtifact(artifactId);
    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found'
      });
    }

    // Authorization check - verify system access
    if (!artifact.systemId) {
      return res.status(403).json({ 
        error: 'Access denied - artifact not associated with system' 
      });
    }
    
    // Verify user has access to the system this artifact belongs to
    const hasSystemAccess = await checkSystemAccess(userId!, artifact.systemId, storage);
    if (!hasSystemAccess) {
      return res.status(403).json({ 
        error: 'Access denied - insufficient permissions for this system',
        systemId: artifact.systemId
      });
    }

    const fileData = await artifactService.downloadArtifact(artifactId);
    if (!fileData) {
      return res.status(404).json({
        error: 'Artifact file not found'
      });
    }

    res.set({
      'Content-Type': fileData.mimeType,
      'Content-Disposition': `attachment; filename="${fileData.fileName}"`,
      'Content-Length': fileData.content.length.toString(),
      'Cache-Control': 'private, no-cache' // No caching for private files
    });

    res.send(fileData.content);

  } catch (error) {
    console.error('Download private artifact error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to download artifact'
    });
  }
});

/**
 * PUT /api/artifacts/by-id/:artifactId
 * Update artifact metadata (requires authentication)
 */
router.put('/by-id/:artifactId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { artifactId } = req.params;
    
    // Get artifact to check system permissions
    const currentArtifact = await artifactService.getArtifact(artifactId);
    if (!currentArtifact) {
      return res.status(404).json({
        error: 'Artifact not found'
      });
    }
    
    // Check if user has permission to modify this artifact's system
    if (currentArtifact.systemId) {
      const hasSystemAccess = await checkSystemAccess(req.user!.userId, currentArtifact.systemId, storage);
      if (!hasSystemAccess) {
        return res.status(403).json({
          error: 'Access denied - insufficient permissions for this system',
          systemId: currentArtifact.systemId
        });
      }
    }
    
    // Validate request body
    const updates = updateArtifactSchema.parse(req.body);
    
    const artifact = await artifactService.updateArtifactMetadata(artifactId, updates);
    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found'
      });
    }

    res.json({
      success: true,
      artifact,
      message: 'Artifact updated successfully'
    });

  } catch (error) {
    console.error('Update artifact error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update artifact'
    });
  }
});

/**
 * DELETE /api/artifacts/by-id/:artifactId
 * Delete artifact and its file (requires authentication)
 */
router.delete('/by-id/:artifactId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { artifactId } = req.params;
    
    // Get artifact to check system permissions
    const currentArtifact = await artifactService.getArtifact(artifactId);
    if (!currentArtifact) {
      return res.status(404).json({
        error: 'Artifact not found'
      });
    }
    
    // Check if user has permission to delete this artifact's system
    if (currentArtifact.systemId) {
      const hasSystemAccess = await checkSystemAccess(req.user!.userId, currentArtifact.systemId, storage);
      if (!hasSystemAccess) {
        return res.status(403).json({
          error: 'Access denied - insufficient permissions for this system',
          systemId: currentArtifact.systemId
        });
      }
    }
    
    const success = await artifactService.deleteArtifact(artifactId);
    if (!success) {
      return res.status(404).json({
        error: 'Artifact not found'
      });
    }

    res.json({
      success: true,
      message: 'Artifact deleted successfully'
    });

  } catch (error) {
    console.error('Delete artifact error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to delete artifact'
    });
  }
});

/**
 * GET /api/artifacts/types
 * Get available artifact types and their descriptions
 */
router.get('/types', async (req: Request, res: Response) => {
  try {
    const types = {
      architecture_diagram: {
        name: 'Architecture Diagram',
        description: 'System architecture diagrams, network diagrams, data flow diagrams',
        allowedFormats: ['PNG', 'JPEG', 'SVG', 'PDF', 'Visio'],
        maxSize: '10MB',
        isPublicByDefault: true
      },
      system_documentation: {
        name: 'System Documentation',
        description: 'System manuals, technical documentation, configuration guides',
        allowedFormats: ['PDF', 'Word', 'Markdown', 'Text', 'HTML'],
        maxSize: '50MB',
        isPublicByDefault: true
      },
      evidence_file: {
        name: 'Evidence File',
        description: 'Screenshots, logs, scan results, compliance evidence',
        allowedFormats: ['PNG', 'JPEG', 'PDF', 'Text', 'CSV', 'JSON', 'XML'],
        maxSize: '25MB',
        isPublicByDefault: false
      },
      policy_document: {
        name: 'Policy Document',
        description: 'Security policies, compliance documents, governance documents',
        allowedFormats: ['PDF', 'Word', 'Markdown', 'Text'],
        maxSize: '20MB',
        isPublicByDefault: true
      },
      procedure_document: {
        name: 'Procedure Document',
        description: 'Standard operating procedures, implementation guides, runbooks',
        allowedFormats: ['PDF', 'Word', 'Markdown', 'Text'],
        maxSize: '20MB',
        isPublicByDefault: true
      },
      assessment_report: {
        name: 'Assessment Report',
        description: 'Security assessments, audit reports, compliance evaluations',
        allowedFormats: ['PDF', 'Word', 'Excel'],
        maxSize: '30MB',
        isPublicByDefault: false
      },
      other: {
        name: 'Other',
        description: 'Other supporting files and documents',
        allowedFormats: ['PNG', 'JPEG', 'PDF', 'Text', 'JSON'],
        maxSize: '15MB',
        isPublicByDefault: false
      }
    };

    res.json({ types });

  } catch (error) {
    console.error('Get artifact types error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get artifact types'
    });
  }
});

/**
 * POST /api/artifacts/by-id/:artifactId/process
 * Process an uploaded artifact for security findings (requires authentication)
 */
router.post('/by-id/:artifactId/process', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { artifactId } = req.params;
    
    // Validate request body
    const processArtifactSchema = z.object({
      systemId: z.string().min(1, 'System ID is required'),
      options: z.object({
        includeInformational: z.boolean().default(false),
        autoMapStig: z.boolean().default(true),
        stigVersion: z.string().optional(),
        filterBySeverity: z.array(z.string()).optional(),
        filterByHost: z.array(z.string()).optional(),
        createStigRules: z.boolean().default(true),
        createControls: z.boolean().default(true),
      }).optional()
    }).strict();
    
    const { systemId, options } = processArtifactSchema.parse(req.body);
    
    // Verify artifact exists
    const artifact = await artifactService.getArtifact(artifactId);
    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found'
      });
    }

    // Verify system exists and user has access
    const system = await storage.getSystem(systemId);
    if (!system) {
      return res.status(404).json({
        error: 'System not found'
      });
    }
    
    const hasSystemAccess = await checkSystemAccess(req.user!.userId, systemId, storage);
    if (!hasSystemAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system',
        systemId
      });
    }

    // Check if artifact is a processable security scan file
    if (!isSecurityScanFile(artifact.fileName, artifact.mimeType)) {
      return res.status(400).json({
        error: 'Artifact does not appear to be a processable security scan file',
        supportedFormats: ['Nessus (.nessus)', 'SCAP XCCDF (.xml)', 'STIG CKL (.ckl)', 'STIG CKLB (.cklb)'],
        fileName: artifact.fileName,
        mimeType: artifact.mimeType
      });
    }

    // Start processing
    const result = await fileProcessingService.processArtifactFile({
      artifactId,
      systemId,
      options: options || {},
      userId: req.user!.userId
    });

    res.json({
      success: true,
      jobId: result.jobId,
      message: 'File processing completed',
      results: {
        findingsCreated: result.findingsCreated,
        evidenceCreated: result.evidenceCreated,
        stigRulesCreated: result.stigRulesCreated,
        controlsCreated: result.controlsCreated,
        processingTime: result.processingTime,
        summary: result.summary
      },
      errors: result.errorsEncountered.length > 0 ? result.errorsEncountered : undefined
    });

  } catch (error) {
    console.error('Artifact processing error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process artifact'
    });
  }
});

/**
 * GET /api/artifacts/by-id/:artifactId/processing-status
 * Get processing status for an artifact (requires authentication)
 */
router.get('/by-id/:artifactId/processing-status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { artifactId } = req.params;
    
    // Verify artifact exists and user has access
    const artifact = await artifactService.getArtifact(artifactId);
    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found'
      });
    }
    
    if (artifact.systemId) {
      const hasSystemAccess = await checkSystemAccess(req.user!.userId, artifact.systemId, storage);
      if (!hasSystemAccess) {
        return res.status(403).json({
          error: 'Access denied - insufficient permissions for this system',
          systemId: artifact.systemId
        });
      }
    }
    
    // Get active processing jobs for this artifact
    const activeJobs = fileProcessingService.getActiveJobs();
    const artifactJobs = activeJobs.filter(job => 
      job.progress && job.progress.stage && 
      job.jobId.includes(artifactId) // Simple check, could be improved
    );

    if (artifactJobs.length === 0) {
      // No active processing jobs found
      return res.json({
        status: 'no_active_processing',
        message: 'No active processing jobs for this artifact'
      });
    }

    // Return active processing status
    const latestJob = artifactJobs[0];
    res.json({
      status: 'processing',
      jobId: latestJob.jobId,
      progress: latestJob.progress.progress,
      stage: latestJob.progress.stage,
      currentItem: latestJob.progress.currentItem,
      processedItems: latestJob.progress.processedItems,
      totalItems: latestJob.progress.totalItems,
      errors: latestJob.progress.errors,
      startTime: latestJob.progress.startTime,
      estimatedCompletion: latestJob.progress.estimatedCompletion
    });

  } catch (error) {
    console.error('Processing status error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get processing status'
    });
  }
});

/**
 * Helper function to determine if a file is a security scan file
 */
function isSecurityScanFile(fileName: string, mimeType: string): boolean {
  const lowercaseFileName = fileName.toLowerCase();
  
  // Check file extensions
  if (lowercaseFileName.endsWith('.nessus') || 
      lowercaseFileName.endsWith('.xccdf') ||
      lowercaseFileName.endsWith('.ckl') ||
      lowercaseFileName.endsWith('.cklb') ||
      (lowercaseFileName.endsWith('.xml') && 
       (lowercaseFileName.includes('nessus') || 
        lowercaseFileName.includes('scap') || 
        lowercaseFileName.includes('xccdf') ||
        lowercaseFileName.includes('ckl') ||
        lowercaseFileName.includes('stig')))) {
    return true;
  }

  // Check MIME types for XML-based scan files
  if ((mimeType === 'application/xml' || mimeType === 'text/xml') && 
      (lowercaseFileName.includes('scan') || 
       lowercaseFileName.includes('vuln') ||
       lowercaseFileName.includes('stig'))) {
    return true;
  }

  return false;
}

/**
 * POST /api/artifacts/:id/repair-path
 * Admin endpoint to repair artifact file paths (requires authentication)
 * This helps fix artifacts with broken paths after container restarts
 */
router.post('/:id/repair-path', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get the artifact
    const artifact = await storage.getArtifact(id);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Check if artifact has uploadedFileName in metadata
    const uploadedFileName = (artifact.metadata as any)?.uploadedFileName;
    if (!uploadedFileName) {
      return res.status(400).json({ 
        error: 'Cannot repair: artifact missing uploadedFileName in metadata',
        suggestion: 'This artifact may need to be re-uploaded'
      });
    }

    // Determine new path based on public/private status
    const storageDir = artifact.isPublic ? '/app/server/storage/public' : '/app/server/storage/private';
    const newPath = path.join(storageDir, uploadedFileName);

    // Update the artifact path
    const updated = await storage.updateArtifact(id, {
      filePath: newPath,
      metadata: {
        ...(artifact.metadata as any || {}),
        pathRepaired: true,
        repairDate: new Date().toISOString()
      }
    });

    if (!updated) {
      return res.status(500).json({ error: 'Failed to update artifact' });
    }

    res.json({
      success: true,
      message: 'Artifact path repaired successfully',
      oldPath: artifact.filePath,
      newPath: newPath,
      artifactId: id
    });

  } catch (error) {
    console.error('Repair artifact path error:', error);
    res.status(500).json({ 
      error: 'Failed to repair artifact path',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;


