// Template Management Service
// Handles template file upload, storage, versioning, and management

import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import { createHash } from 'crypto';
import { storage } from '../storage';
import type { 
  InsertTemplate, 
  InsertTemplateVersion, 
  InsertTemplateMapping,
  Template,
  TemplateVersion,
  TemplateMapping
} from '../schema';

export interface TemplateUploadRequest {
  name: string;
  description?: string;
  type: 'ssp' | 'sar' | 'poam' | 'checklist' | 'ato_package' | 'sctm_excel' | 'rar' | 'pps_worksheet';
  organizationId?: string;
  createdBy: string;
  file: {
    originalName: string;
    buffer: Buffer;
    mimeType: string;
    size: number;
  };
  tags?: string[];
  isPublic?: boolean;
  metadata?: Record<string, any>;
}

export interface TemplateInfo {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  organizationId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
  tags?: string[];
  isPublic: boolean;
  sizeBytes: number;
  checksum?: string;
  activeVersion?: TemplateVersion;
  versions: TemplateVersion[];
}

export interface TemplateVersionInfo {
  id: string;
  templateId: string;
  version: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  changeLog?: string;
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
}

// Configuration constants
const MAX_TEMPLATE_SIZE = 100 * 1024 * 1024; // 100MB per template
const MAX_ORGANIZATION_STORAGE = 100 * 1024 * 1024; // 100MB per organization
const TEMPLATE_STORAGE_PATH = process.env.TEMPLATE_STORAGE_PATH || '/tmp/templates';
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/pdf',
  'text/plain',
  'text/html',
  'application/json',
  'text/markdown'
];

export class TemplateService {
  private storagePath: string;

  constructor() {
    this.storagePath = TEMPLATE_STORAGE_PATH;
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      console.error('Failed to create template storage directory:', error);
      throw new Error('Template storage initialization failed');
    }
  }

  /**
   * Upload and create a new template with version control
   */
  async uploadTemplate(request: TemplateUploadRequest): Promise<TemplateInfo> {
    // Validate file
    this.validateTemplateFile(request.file);

    // Check organization storage limits
    if (request.organizationId) {
      await this.checkOrganizationStorageLimit(request.organizationId, request.file.size);
    }

    // Generate file checksum
    const checksum = this.generateChecksum(request.file.buffer);

    // Create storage directory for this template
    const templateDir = join(this.storagePath, `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(templateDir, { recursive: true });

    // Save file
    const fileName = this.sanitizeFileName(request.file.originalName);
    const filePath = join(templateDir, fileName);
    await fs.writeFile(filePath, request.file.buffer);

    try {
      // Create template record
      const templateData: InsertTemplate = {
        name: request.name,
        type: request.type,
        status: 'active',
        organizationId: request.organizationId,
        createdBy: request.createdBy,
        metadata: request.metadata,
        tags: request.tags,
        isPublic: request.isPublic || false,
        sizeBytes: request.file.size,
        checksum
      };

      const template = await storage.createTemplate(templateData);

      // Create initial version
      const versionData: InsertTemplateVersion = {
        templateId: template.id,
        version: 1,
        filePath,
        fileName,
        mimeType: request.file.mimeType,
        sizeBytes: request.file.size,
        checksum,
        createdBy: request.createdBy,
        isActive: true
      };

      const version = await storage.createTemplateVersion(versionData);

      // Return template info with version
      return await this.getTemplateInfo(template.id);
    } catch (error) {
      // Cleanup on failure
      await this.cleanupTemplateFiles(templateDir);
      throw error;
    }
  }

  /**
   * Add a new version to an existing template
   */
  async addTemplateVersion(
    templateId: string, 
    file: TemplateUploadRequest['file'], 
    changeLog: string,
    createdBy: string
  ): Promise<TemplateVersionInfo> {
    // Validate file
    this.validateTemplateFile(file);

    // Get existing template
    const template = await storage.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Check organization storage limits
    if (template.organizationId) {
      await this.checkOrganizationStorageLimit(template.organizationId, file.size);
    }

    // Generate file checksum
    const checksum = this.generateChecksum(file.buffer);

    // Get next version number
    const existingVersions = await storage.getTemplateVersions(templateId);
    const nextVersion = Math.max(...existingVersions.map(v => v.version), 0) + 1;

    // Create storage directory for this version
    const templateDir = join(this.storagePath, `template_${templateId}_v${nextVersion}`);
    await fs.mkdir(templateDir, { recursive: true });

    // Save file
    const fileName = this.sanitizeFileName(file.originalName);
    const filePath = join(templateDir, fileName);
    await fs.writeFile(filePath, file.buffer);

    try {
      // Create version record
      const versionData: InsertTemplateVersion = {
        templateId,
        version: nextVersion,
        filePath,
        fileName,
        mimeType: file.mimeType,
        sizeBytes: file.size,
        checksum,
        createdBy,
        isActive: false // New versions are not active by default
      };

      const version = await storage.createTemplateVersion(versionData);

      // Update template metadata
      await storage.updateTemplate(templateId, {
        sizeBytes: file.size,
        checksum,
        updatedAt: new Date()
      });

      return {
        id: version.id,
        templateId: version.templateId,
        version: version.version,
        fileName: version.fileName,
        mimeType: version.mimeType,
        sizeBytes: version.sizeBytes,
        checksum: version.checksum,
        changeLog: version.changeLog,
        createdBy: version.createdBy,
        createdAt: version.createdAt,
        isActive: version.isActive
      };
    } catch (error) {
      // Cleanup on failure
      await this.cleanupTemplateFiles(templateDir);
      throw error;
    }
  }

  /**
   * Activate a specific template version
   */
  async activateTemplateVersion(templateId: string, versionId: string): Promise<boolean> {
    return await storage.activateTemplateVersion(templateId, versionId);
  }

  /**
   * Get default template for document type
   */
  async getDefaultTemplate(documentType: string, systemId?: string): Promise<Template | undefined> {
    return await storage.getDefaultTemplateForType(documentType, systemId);
  }

  /**
   * Get template information with versions
   */
  async getTemplateInfo(templateId: string): Promise<TemplateInfo | undefined> {
    const template = await storage.getTemplate(templateId);
    if (!template) {
      return undefined;
    }

    const versions = await storage.getTemplateVersions(templateId);
    const activeVersion = versions.find(v => v.isActive);

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
      tags: (template.tags as string[]) || [],
      isPublic: template.isPublic,
      sizeBytes: template.sizeBytes,
      checksum: template.checksum,
      activeVersion,
      versions
    };
  }

  /**
   * Get template file content
   */
  async getTemplateFile(templateId: string, versionId?: string): Promise<Buffer> {
    let version: TemplateVersion | undefined;

    if (versionId) {
      version = await storage.getTemplateVersion(versionId);
    } else {
      version = await storage.getActiveTemplateVersion(templateId);
    }

    if (!version) {
      throw new Error('Template version not found');
    }

    try {
      return await fs.readFile(version.filePath);
    } catch (error) {
      throw new Error('Failed to read template file');
    }
  }

  /**
   * Create template mapping for document generation
   */
  async createTemplateMapping(
    templateId: string,
    documentType: string,
    createdBy: string,
    systemId?: string,
    isDefault: boolean = false,
    priority: number = 0,
    conditions?: Record<string, any>
  ): Promise<TemplateMapping> {
    const mappingData: InsertTemplateMapping = {
      templateId,
      documentType,
      createdBy,
      systemId,
      isDefault,
      priority,
      conditions
    };

    return await storage.createTemplateMapping(mappingData);
  }

  /**
   * Delete template and all its files
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    const template = await storage.getTemplate(templateId);
    if (!template) {
      return false;
    }

    // Get all versions to clean up files
    const versions = await storage.getTemplateVersions(templateId);
    
    // Delete template from database (cascades to versions and mappings)
    const deleted = await storage.deleteTemplate(templateId);
    
    if (deleted) {
      // Clean up template files
      for (const version of versions) {
        try {
          const templateDir = join(version.filePath, '..');
          await this.cleanupTemplateFiles(templateDir);
        } catch (error) {
          console.warn(`Failed to cleanup files for template ${templateId}:`, error);
        }
      }
    }

    return deleted;
  }

  /**
   * Validate template file
   */
  private validateTemplateFile(file: TemplateUploadRequest['file']): void {
    // Check file size
    if (file.size > MAX_TEMPLATE_SIZE) {
      throw new Error(`Template file too large. Maximum size is ${MAX_TEMPLATE_SIZE / (1024 * 1024)}MB`);
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
      throw new Error(`Unsupported file type: ${file.mimeType}`);
    }

    // Basic virus scanning (placeholder - would integrate with actual virus scanner)
    this.performBasicVirusScan(file.buffer);
  }

  /**
   * Perform basic virus scanning (placeholder implementation)
   */
  private performBasicVirusScan(buffer: Buffer): void {
    // This is a placeholder - in production, integrate with actual virus scanning service
    // For now, just check for obviously malicious patterns
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
    
    const suspiciousPatterns = [
      /<script[^>]*>.*<\/script>/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        throw new Error('File contains potentially malicious content');
      }
    }
  }

  /**
   * Check organization storage limits
   */
  private async checkOrganizationStorageLimit(organizationId: string, additionalSize: number): Promise<void> {
    const templates = await storage.getTemplatesByOrganization(organizationId);
    const currentUsage = templates.reduce((total, template) => total + template.sizeBytes, 0);
    
    if (currentUsage + additionalSize > MAX_ORGANIZATION_STORAGE) {
      throw new Error(`Organization storage limit exceeded. Current: ${currentUsage / (1024 * 1024)}MB, Limit: ${MAX_ORGANIZATION_STORAGE / (1024 * 1024)}MB`);
    }
  }

  /**
   * Generate file checksum
   */
  private generateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Sanitize file name
   */
  private sanitizeFileName(fileName: string): string {
    return basename(fileName).replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  /**
   * Clean up template files
   */
  private async cleanupTemplateFiles(templateDir: string): Promise<void> {
    try {
      await fs.rm(templateDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup template directory ${templateDir}:`, error);
    }
  }

  /**
   * Delete template version
   */
  async deleteTemplateVersion(versionId: string): Promise<boolean> {
    return await storage.deleteTemplateVersion(versionId);
  }

  /**
   * Delete template mapping
   */
  async deleteTemplateMapping(mappingId: string): Promise<boolean> {
    return await storage.deleteTemplateMapping(mappingId);
  }
}

export const templateService = new TemplateService();
