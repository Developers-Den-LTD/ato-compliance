// Template Management API Routes
// Handles CRUD operations for document templates

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { templateService } from '../services/template-service';
import { templateParser } from '../parsers/template-parser';
import { storage } from '../storage';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../types/auth.types';
import { TemplateType, TemplateStatus } from '../schema';

const checkSystemAccess = async (userId: string, systemId: string): Promise<boolean> => {
  const system = await storage.getSystem(systemId);
  return !!system;
};

const getValidCredentials = () => {
  return { apiKey: process.env.API_KEY || '' };
};

const router = Router();

// Configure multer for template uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB maximum for templates
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.oasis.opendocument.text', // .odt
      'application/rtf', // .rtf
      'text/html', // .html
      'text/markdown', // .md
      'text/plain', // .txt
      'application/octet-stream' // Fallback for files with incorrect MIME detection
    ];
    
    // Allowed file extensions as fallback
    const allowedExtensions = ['.docx', '.doc', '.odt', '.rtf', '.html', '.htm', '.md', '.txt'];
    const fileExtension = file.originalname.toLowerCase().match(/\.[^/.]+$/)?.[0];
    
    // Accept if MIME type is allowed OR if extension is allowed
    if (allowedMimeTypes.includes(file.mimetype) || 
        (fileExtension && allowedExtensions.includes(fileExtension))) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype} with extension ${fileExtension}`));
    }
  }
});

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['ssp', 'sar', 'poam', 'checklist', 'ato_package']),
  organizationId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional().default(false),
  metadata: z.record(z.any()).optional()
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'deprecated']).optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});

const createMappingSchema = z.object({
  documentType: z.enum(['ssp', 'sar', 'poam', 'checklist', 'ato_package']),
  systemId: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
  priority: z.number().int().min(0).max(100).optional().default(0),
  conditions: z.record(z.any()).optional()
});

// POST /api/templates - Upload and create new template
router.post('/', authenticate, upload.single('template'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Template file is required' });
    }

    // Process FormData - convert strings to expected types
    const processedBody = {
      ...req.body,
      tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
      isPublic: req.body.isPublic ? req.body.isPublic === 'true' : false,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined
    };

    // Validate request body
    const validation = createTemplateSchema.safeParse(processedBody);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const templateData = validation.data;
    const credentials = getValidCredentials();

    // Create template
    const template = await templateService.uploadTemplate({
      name: templateData.name,
      description: templateData.description,
      type: templateData.type,
      organizationId: templateData.organizationId,
      createdBy: req.user!.userId,
      file: {
        originalName: req.file.originalname,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        size: req.file.size
      },
      tags: templateData.tags,
      isPublic: templateData.isPublic,
      metadata: templateData.metadata
    });

    res.status(201).json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        status: template.status,
        organizationId: template.organizationId,
        createdBy: template.createdBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        metadata: template.metadata,
        tags: template.tags,
        isPublic: template.isPublic,
        sizeBytes: template.sizeBytes,
        checksum: template.checksum,
        activeVersion: template.activeVersion ? {
          id: template.activeVersion.id,
          version: template.activeVersion.version,
          fileName: template.activeVersion.fileName,
          mimeType: template.activeVersion.mimeType,
          sizeBytes: template.activeVersion.sizeBytes,
          createdAt: template.activeVersion.createdAt
        } : null
      }
    });

  } catch (error) {
    console.error('Template creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create template',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/templates - List available templates
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      type, 
      organizationId, 
      isPublic, 
      status = 'active',
      limit = 50,
      offset = 0 
    } = req.query;

    const credentials = getValidCredentials();
    
    let templates;
    
    if (type) {
      templates = await storage.getTemplatesByType(type as string);
    } else if (organizationId) {
      templates = await storage.getTemplatesByOrganization(organizationId as string);
    } else if (isPublic === 'true') {
      templates = []; // Stub - getPublicTemplates doesn't exist
    } else {
      // Get user's templates
      templates = []; // Stub - getTemplatesByUser doesn't exist
    }

    // Filter by status
    templates = templates.filter(t => t.status === status);

    // Apply pagination
    const paginatedTemplates = templates.slice(
      Number(offset), 
      Number(offset) + Number(limit)
    );

    // Get template info with versions
    const templateInfos = await Promise.all(
      paginatedTemplates.map(async (template) => {
        const info = await templateService.getTemplateInfo(template.id);
        return {
          id: template.id,
          name: template.name,
          description: template.description,
          type: template.type,
          status: template.status,
          organizationId: template.organizationId,
          createdBy: template.createdBy,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          metadata: template.metadata,
          tags: template.tags,
          isPublic: template.isPublic,
          sizeBytes: template.sizeBytes,
          checksum: template.checksum,
          versionCount: info?.versions.length || 0,
          activeVersion: info?.activeVersion ? {
            id: info.activeVersion.id,
            version: info.activeVersion.version,
            fileName: info.activeVersion.fileName,
            mimeType: info.activeVersion.mimeType,
            sizeBytes: info.activeVersion.sizeBytes,
            createdAt: info.activeVersion.createdAt
          } : null
        };
      })
    );

    res.json({
      success: true,
      templates: templateInfos,
      pagination: {
        total: templates.length,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < templates.length
      }
    });

  } catch (error) {
    console.error('Template listing error:', error);
    res.status(500).json({ 
      error: 'Failed to list templates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/templates/:id - Get specific template
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const credentials = getValidCredentials();

    const templateInfo = await templateService.getTemplateInfo(id);
    if (!templateInfo) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check access permissions
    if (!templateInfo.isPublic && templateInfo.createdBy !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      template: {
        id: templateInfo.id,
        name: templateInfo.name,
        description: templateInfo.description,
        type: templateInfo.type,
        status: templateInfo.status,
        organizationId: templateInfo.organizationId,
        createdBy: templateInfo.createdBy,
        createdAt: templateInfo.createdAt,
        updatedAt: templateInfo.updatedAt,
        metadata: templateInfo.metadata,
        tags: templateInfo.tags,
        isPublic: templateInfo.isPublic,
        sizeBytes: templateInfo.sizeBytes,
        checksum: templateInfo.checksum,
        versions: templateInfo.versions.map(v => ({
          id: v.id,
          version: v.version,
          fileName: v.fileName,
          mimeType: v.mimeType,
          sizeBytes: v.sizeBytes,
          checksum: v.checksum,
          changeLog: v.changeLog,
          createdBy: v.createdBy,
          createdAt: v.createdAt,
          isActive: v.isActive
        })),
        activeVersion: templateInfo.activeVersion ? {
          id: templateInfo.activeVersion.id,
          version: templateInfo.activeVersion.version,
          fileName: templateInfo.activeVersion.fileName,
          mimeType: templateInfo.activeVersion.mimeType,
          sizeBytes: templateInfo.activeVersion.sizeBytes,
          createdAt: templateInfo.activeVersion.createdAt
        } : null
      }
    });

  } catch (error) {
    console.error('Template retrieval error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve template',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/templates/:id - Update template metadata
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const credentials = getValidCredentials();

    // Validate request body
    const validation = updateTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const updateData = validation.data;

    // Check if template exists and user has permission
    const template = await storage.getTemplate(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.createdBy !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update template
    const updatedTemplate = await storage.updateTemplate(id, {
      ...updateData,
      updatedAt: new Date()
    });

    if (!updatedTemplate) {
      return res.status(500).json({ error: 'Failed to update template' });
    }

    res.json({
      success: true,
      template: {
        id: updatedTemplate.id,
        name: updatedTemplate.name,
        description: updatedTemplate.description,
        type: updatedTemplate.type,
        status: updatedTemplate.status,
        organizationId: updatedTemplate.organizationId,
        createdBy: updatedTemplate.createdBy,
        createdAt: updatedTemplate.createdAt,
        updatedAt: updatedTemplate.updatedAt,
        metadata: updatedTemplate.metadata,
        tags: updatedTemplate.tags,
        isPublic: updatedTemplate.isPublic,
        sizeBytes: updatedTemplate.sizeBytes,
        checksum: updatedTemplate.checksum
      }
    });

  } catch (error) {
    console.error('Template update error:', error);
    res.status(500).json({ 
      error: 'Failed to update template',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/templates/:id - Soft delete template
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const credentials = getValidCredentials();

    // Check if template exists and user has permission
    const template = await storage.getTemplate(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.createdBy !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Soft delete by setting status to inactive
    const deletedTemplate = await storage.updateTemplate(id, {
      status: 'inactive',
      updatedAt: new Date()
    });

    if (!deletedTemplate) {
      return res.status(500).json({ error: 'Failed to delete template' });
    }

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    console.error('Template deletion error:', error);
    res.status(500).json({ 
      error: 'Failed to delete template',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/templates/:id/versions - Add new template version
router.post('/:id/versions', authenticate, upload.single('template'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { changeLog } = req.body;
    const credentials = getValidCredentials();

    if (!req.file) {
      return res.status(400).json({ error: 'Template file is required' });
    }

    // Check if template exists and user has permission
    const template = await storage.getTemplate(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.createdBy !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Add new version
    const newVersion = await templateService.addTemplateVersion(
      id,
      {
        originalName: req.file.originalname,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        size: req.file.size
      },
      changeLog || 'Updated template',
      req.user!.userId
    );

    res.status(201).json({
      success: true,
      version: {
        id: newVersion.id,
        templateId: newVersion.templateId,
        version: newVersion.version,
        fileName: newVersion.fileName,
        mimeType: newVersion.mimeType,
        sizeBytes: newVersion.sizeBytes,
        checksum: newVersion.checksum,
        changeLog: newVersion.changeLog,
        createdBy: newVersion.createdBy,
        createdAt: newVersion.createdAt,
        isActive: newVersion.isActive
      }
    });

  } catch (error) {
    console.error('Template version creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create template version',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/templates/:id/versions/:versionId/activate - Activate template version
router.put('/:id/versions/:versionId/activate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id, versionId } = req.params;
    const credentials = getValidCredentials();

    // Check if template exists and user has permission
    const template = await storage.getTemplate(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.createdBy !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Activate version
    const success = await templateService.activateTemplateVersion(id, versionId);
    if (!success) {
      return res.status(400).json({ error: 'Failed to activate version' });
    }

    res.json({
      success: true,
      message: 'Template version activated successfully'
    });

  } catch (error) {
    console.error('Template version activation error:', error);
    res.status(500).json({ 
      error: 'Failed to activate template version',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/templates/:id/parse - Parse template and extract variables
router.get('/:id/parse', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const credentials = getValidCredentials();

    // Get template info
    const templateInfo = await templateService.getTemplateInfo(id);
    if (!templateInfo) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check access permissions
    if (!templateInfo.isPublic && templateInfo.createdBy !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get active version
    const activeVersion = templateInfo.activeVersion;
    if (!activeVersion) {
      return res.status(400).json({ error: 'No active version found' });
    }

    // Parse template
    const parseResult = await templateParser.parseTemplate(activeVersion, {
      extractVariables: true,
      validateCompliance: true,
      analyzeStructure: true
    });

    res.json({
      success: true,
      parseResult: {
        success: parseResult.success,
        variables: parseResult.variables,
        structure: parseResult.structure,
        errors: parseResult.errors,
        metadata: parseResult.metadata
      }
    });

  } catch (error) {
    console.error('Template parsing error:', error);
    res.status(500).json({ 
      error: 'Failed to parse template',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/templates/:id/mappings - Create template mapping
router.post('/:id/mappings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const credentials = getValidCredentials();

    // Validate request body
    const validation = createMappingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const mappingData = validation.data;

    // Check if template exists and user has permission
    const template = await storage.getTemplate(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.createdBy !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create mapping
    const mapping = await templateService.createTemplateMapping(
      id,
      mappingData.documentType,
      req.user!.userId,
      mappingData.systemId,
      mappingData.isDefault,
      mappingData.priority,
      mappingData.conditions
    );

    res.status(201).json({
      success: true,
      mapping: {
        id: mapping.id,
        templateId: mapping.templateId,
        systemId: mapping.systemId,
        documentType: mapping.documentType,
        isDefault: mapping.isDefault,
        priority: mapping.priority,
        conditions: mapping.conditions,
        createdAt: mapping.createdAt,
        createdBy: mapping.createdBy
      }
    });

  } catch (error) {
    console.error('Template mapping creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create template mapping',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/templates/default/:documentType - Get default template for document type
router.get('/default/:documentType', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { documentType } = req.params;
    const { systemId } = req.query;
    const credentials = getValidCredentials();

    // Validate document type
    if (!['ssp', 'sar', 'poam', 'checklist', 'ato_package'].includes(documentType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // Get default template
    const defaultTemplate = await templateService.getDefaultTemplate(
      documentType,
      systemId as string
    );

    if (!defaultTemplate) {
      return res.status(404).json({ error: 'No default template found' });
    }

    res.json({
      success: true,
      template: {
        id: defaultTemplate.id,
        name: defaultTemplate.name,
        description: defaultTemplate.description,
        type: defaultTemplate.type,
        status: defaultTemplate.status,
        organizationId: defaultTemplate.organizationId,
        createdBy: defaultTemplate.createdBy,
        createdAt: defaultTemplate.createdAt,
        updatedAt: defaultTemplate.updatedAt,
        metadata: defaultTemplate.metadata,
        tags: defaultTemplate.tags,
        isPublic: defaultTemplate.isPublic,
        sizeBytes: defaultTemplate.sizeBytes,
        checksum: defaultTemplate.checksum
      }
    });

  } catch (error) {
    console.error('Default template retrieval error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve default template',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

