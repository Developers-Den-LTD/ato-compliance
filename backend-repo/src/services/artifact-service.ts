// Artifact Management Service
// Handles architecture diagrams, system documentation, and evidence files

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { storage } from '../storage';
import { storagePaths } from '../config/storage-paths';
import type { InsertArtifact } from '../schema';

export interface ArtifactSummary {
  totalCount: number;
  totalSize: number;
  byType: Record<string, { count: number; size: number }>;
  byMimeType: Record<string, number>;
  publicCount: number;
  privateCount: number;
}

export interface UploadedFile {
  originalName: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}

export interface ArtifactUploadRequest {
  systemId: string;
  type: 'architecture_diagram' | 'system_documentation' | 'evidence_file' | 'policy_document' | 'procedure_document' | 'assessment_report' | 'scan_results' | 'source_code' | 'infrastructure_code' | 'other';
  title: string;
  description?: string;
  file: UploadedFile;
  tags?: string[];
  isPublic?: boolean;
  metadata?: Record<string, any>;
}

export interface ArtifactInfo {
  id: string;
  systemId: string;
  title: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  path: string;
  url: string;
  isPublic: boolean;
  uploadDate: Date;
  checksum: string;
  tags?: string[];
  metadata?: Record<string, any>;
  processingStatus?: string;
  processingError?: string | null;
  processedAt?: Date | null;
}

export class ArtifactService {
  private readonly publicDir: string;
  private readonly privateDir: string;

  constructor() {
    // Use centralized storage paths configuration
    // This supports both Docker and local development environments
    this.publicDir = storagePaths.public;
    this.privateDir = storagePaths.private;
  }

  /**
   * Upload an artifact file and create database record
   */
  async uploadArtifact(request: ArtifactUploadRequest): Promise<ArtifactInfo> {
    try {
      // Generate unique filename with original extension
      const fileExtension = this.getFileExtension(request.file.originalName);
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const uniqueFileName = `${timestamp}_${randomSuffix}${fileExtension}`;
      
      // Calculate file checksum
      const checksum = this.calculateChecksum(request.file.buffer);
      
      // Determine storage location based on type and public setting
      const isPublic = request.isPublic || this.isPublicArtifactType(request.type);
      const storageDir = isPublic ? this.publicDir : this.privateDir;
      const filePath = join(storageDir, uniqueFileName);
      
      // Ensure directory exists
      await this.ensureDirectoryExists(storageDir);
      
      // Write file to storage
      await fs.writeFile(filePath, request.file.buffer);
      
      // Create database record
      const artifact: InsertArtifact = {
        systemId: request.systemId,
        type: request.type,
        name: request.file.originalName, // Original filename
        title: request.title,
        description: request.description,
        filePath,
        size: request.file.size,
        mimeType: request.file.mimeType,
        checksum,
        isPublic,
        tags: request.tags,
        metadata: {
          ...request.metadata,
          uploadedFileName: uniqueFileName,
          originalFileName: request.file.originalName,
          uploadTimestamp: new Date().toISOString()
        }
      };
      
      const createdArtifact = await storage.createArtifact(artifact);
      
      // Generate access URL
      const url = this.generateArtifactUrl(createdArtifact.id, uniqueFileName, isPublic);
      
      return {
        id: createdArtifact.id,
        systemId: createdArtifact.systemId || '',
        title: createdArtifact.title || createdArtifact.name,
        type: createdArtifact.type,
        fileName: createdArtifact.name,
        fileSize: createdArtifact.size || 0,
        mimeType: createdArtifact.mimeType || 'application/octet-stream',
        path: filePath,
        url,
        isPublic: createdArtifact.isPublic || false,
        uploadDate: createdArtifact.createdAt || new Date(),
        checksum: createdArtifact.checksum || checksum,
        tags: createdArtifact.tags || undefined,
        metadata: createdArtifact.metadata as Record<string, any> | undefined
      };
      
    } catch (error) {
      throw new Error(`Failed to upload artifact: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get artifact by ID with access URL
   */
  async getArtifact(artifactId: string): Promise<ArtifactInfo | null> {
    const artifact = await storage.getArtifact(artifactId);
    if (!artifact) {
      return null;
    }

    const uniqueFileName = (artifact.metadata as any)?.uploadedFileName as string || artifact.name;
    const url = this.generateArtifactUrl(artifact.id, uniqueFileName, artifact.isPublic || false);

    return {
      id: artifact.id,
      systemId: artifact.systemId || '',
      title: artifact.title || artifact.name,
      type: artifact.type,
      fileName: artifact.name,
      fileSize: artifact.size || 0,
      mimeType: artifact.mimeType || 'application/octet-stream',
      path: artifact.filePath || '',
      url,
      isPublic: artifact.isPublic || false,
      uploadDate: artifact.createdAt || new Date(),
      checksum: artifact.checksum || '',
      tags: artifact.tags || undefined,
      metadata: artifact.metadata as Record<string, any> | undefined
    };
  }

  /**
   * List artifacts by system with filtering
   */
  async getSystemArtifacts(
    systemId: string, 
    filters?: {
      type?: string;
      isPublic?: boolean;
      tags?: string[];
    }
  ): Promise<ArtifactInfo[]> {
    const artifacts = await storage.getArtifactsBySystem(systemId);
    
    let filteredArtifacts = artifacts;
    
    if (filters?.type) {
      filteredArtifacts = filteredArtifacts.filter(a => a.type === filters.type);
    }
    
    if (filters?.isPublic !== undefined) {
      filteredArtifacts = filteredArtifacts.filter(a => a.isPublic === filters.isPublic);
    }
    
    if (filters?.tags && filters.tags.length > 0) {
      filteredArtifacts = filteredArtifacts.filter(a => 
        a.tags && filters.tags!.some(tag => a.tags!.includes(tag))
      );
    }

    return filteredArtifacts.map(artifact => {
      const uniqueFileName = (artifact.metadata as any)?.uploadedFileName as string || artifact.name;
      const url = this.generateArtifactUrl(artifact.id, uniqueFileName, artifact.isPublic || false);

      return {
        id: artifact.id,
        systemId: artifact.systemId || '',
        title: artifact.title || artifact.name,
        type: artifact.type,
        fileName: artifact.name,
        fileSize: artifact.size || 0,
        mimeType: artifact.mimeType || 'application/octet-stream',
        path: artifact.filePath || '',
        url,
        isPublic: artifact.isPublic || false,
        uploadDate: artifact.createdAt || new Date(),
        checksum: artifact.checksum || '',
        tags: artifact.tags || undefined,
        metadata: artifact.metadata as Record<string, any> | undefined,
        processingStatus: artifact.processingStatus,
        processingError: artifact.processingError,
        processedAt: artifact.processedAt
      };
    });
  }

  /**
   * Download artifact file content
   */
  async downloadArtifact(artifactId: string): Promise<{
    content: Buffer;
    mimeType: string;
    fileName: string;
  } | null> {
    const artifact = await storage.getArtifact(artifactId);
    if (!artifact) {
      return null;
    }

    try {
      const content = await fs.readFile(artifact.filePath || '');
      return {
        content,
        mimeType: artifact.mimeType || 'application/octet-stream',
        fileName: artifact.name
      };
    } catch (error) {
      throw new Error(`Failed to read artifact file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete artifact and its file
   */
  async deleteArtifact(artifactId: string): Promise<boolean> {
    const artifact = await storage.getArtifact(artifactId);
    if (!artifact) {
      return false;
    }

    try {
      // Delete physical file
      if (artifact.filePath) {
        await fs.unlink(artifact.filePath);
      }
    } catch (error) {
      console.warn(`Failed to delete artifact file ${artifact.filePath}:`, error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete database record
    return await storage.deleteArtifact(artifactId);
  }

  /**
   * Update artifact metadata (not the file)
   */
  async updateArtifactMetadata(
    artifactId: string, 
    updates: {
      title?: string;
      description?: string;
      tags?: string[];
      metadata?: Record<string, any>;
      processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
      processingError?: string | null;
      processedAt?: Date | null;
    }
  ): Promise<ArtifactInfo | null> {
    const updated = await storage.updateArtifact(artifactId, updates);
    if (!updated) {
      return null;
    }

    return this.getArtifact(artifactId);
  }

  /**
   * Get artifact types and their counts for a system
   */
  async getArtifactSummary(systemId: string): Promise<{
    totalCount: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
    byMimeType: Record<string, number>;
    publicCount: number;
    privateCount: number;
  }> {
    const artifacts = await storage.getArtifactsBySystem(systemId);
    
    const summary = {
      totalCount: artifacts.length,
      totalSize: artifacts.reduce((sum, a) => sum + (a.size || 0), 0),
      byType: {} as Record<string, { count: number; size: number }>,
      byMimeType: {} as Record<string, number>,
      publicCount: artifacts.filter(a => a.isPublic || false).length,
      privateCount: artifacts.filter(a => !(a.isPublic || false)).length
    };

    artifacts.forEach(artifact => {
      // By type
      if (!summary.byType[artifact.type]) {
        summary.byType[artifact.type] = { count: 0, size: 0 };
      }
      summary.byType[artifact.type].count++;
      summary.byType[artifact.type].size += (artifact.size || 0);

      // By MIME type
      const mimeType = artifact.mimeType || 'unknown';
      summary.byMimeType[mimeType] = (summary.byMimeType[mimeType] || 0) + 1;
    });

    return summary;
  }

  /**
   * Validate file type and size for artifact uploads
   */
  validateUpload(file: UploadedFile, type: string): { valid: boolean; error?: string } {
    // File size limits (in bytes) - increased for scan files
    const maxSizes = {
      architecture_diagram: 50 * 1024 * 1024, // 50MB for diagrams
      system_documentation: 100 * 1024 * 1024, // 100MB for documents
      evidence_file: 500 * 1024 * 1024, // 500MB for evidence (including large scan files)
      policy_document: 50 * 1024 * 1024, // 50MB for policies
      procedure_document: 50 * 1024 * 1024, // 50MB for procedures
      assessment_report: 200 * 1024 * 1024, // 200MB for reports (can include embedded scan data)
      scan_results: 500 * 1024 * 1024, // 500MB for scan results
      source_code: 50 * 1024 * 1024, // 50MB for source code
      infrastructure_code: 50 * 1024 * 1024, // 50MB for IAC files
      other: 500 * 1024 * 1024 // 500MB for other files (to support any scan type)
    };

    const maxSize = maxSizes[type as keyof typeof maxSizes] || maxSizes.other;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(maxSize)}) for ${type}`
      };
    }

    // Get file extension to help with MIME type detection
    const extension = this.getFileExtension(file.originalName).toLowerCase();
    const effectiveMimeType = this.getEffectiveMimeType(file.mimeType, extension);

    // Allowed file types with enhanced MIME type support
    const allowedTypes = {
      architecture_diagram: [
        'image/png', 'image/jpeg', 'image/svg+xml', 'image/gif',
        'application/pdf', 'application/vnd.visio', 'image/vnd.microsoft.icon'
      ],
      system_documentation: [
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'text/markdown', 'text/x-markdown', 'text/html', 'text/csv',
        'application/json', 'application/xml', 'text/xml',
        'text/yaml', 'text/x-yaml', 'application/x-yaml',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', // Allow images in documentation
        'application/octet-stream' // Fallback for files with unclear MIME types
      ],
      evidence_file: [
        // Images
        'image/png', 'image/jpeg', 'image/gif',
        // Documents
        'application/pdf', 'text/plain', 'text/csv',
        'application/json', 'application/xml', 'text/xml',
        'text/markdown', 'text/html',
        // Scan files and network captures
        'application/vnd.tcpdump.pcap', 'application/x-pcap', 'application/x-pcapng',
        'application/x-nessus', 'application/x-nmap',
        // Archives (for bundled scan results)
        'application/zip', 'application/x-zip-compressed', 'application/x-tar',
        'application/gzip', 'application/x-gzip', 'application/x-bzip2',
        'application/x-7z-compressed', 'application/x-rar-compressed',
        // Log files
        'text/log', 'application/x-log',
        // Generic binary (for various scan tools)
        'application/octet-stream'
      ],
      policy_document: [
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'text/markdown', 'text/x-markdown', 'text/html',
        'application/xml', 'text/xml', 'application/json', 'text/csv',
        'text/yaml', 'text/x-yaml', 'application/x-yaml',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ],
      procedure_document: [
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'text/markdown', 'text/x-markdown', 'text/html',
        'application/xml', 'text/xml', 'application/json', 'text/csv',
        'text/yaml', 'text/x-yaml', 'application/x-yaml',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ],
      assessment_report: [
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv',
        // Scan reports often bundled with assessments
        'application/xml', 'text/xml', 'application/json',
        'application/x-nessus', 'application/x-nmap',
        // Archives
        'application/zip', 'application/x-zip-compressed', 'application/x-tar',
        'application/gzip', 'application/x-gzip',
        // Generic binary
        'application/octet-stream'
      ],
      scan_results: [
        // Common scan formats
        'application/xml', 'text/xml', 'application/json',
        'text/plain', 'text/csv', 'application/pdf',
        // Network capture files
        'application/vnd.tcpdump.pcap', 'application/x-pcap', 'application/x-pcapng',
        // Tool-specific formats
        'application/x-nessus', 'application/x-nmap', 'application/x-burp',
        // Archives (for bundled scan results)
        'application/zip', 'application/x-zip-compressed', 'application/x-tar',
        'application/gzip', 'application/x-gzip', 'application/x-bzip2',
        'application/x-7z-compressed', 'application/x-rar-compressed',
        // Log files
        'text/log', 'application/x-log',
        // Generic binary (for various scan tools)
        'application/octet-stream'
      ],
      source_code: [
        'text/plain', 'text/javascript', 'text/typescript',
        'text/python', 'text/java', 'text/go', 'text/cpp',
        'text/html', 'text/css', 'application/json',
        'text/yaml', 'text/x-yaml', 'application/x-yaml'
      ],
      infrastructure_code: [
        'text/plain', 'text/yaml', 'text/x-yaml', 'application/x-yaml',
        'application/json', 'text/hcl', 'text/terraform',
        'application/x-powershell', 'text/dockerfile'
      ],
      other: [
        // Images
        'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml',
        // Documents and text
        'application/pdf', 'text/plain', 'application/json',
        'text/markdown', 'text/yaml', 'text/x-yaml',
        'application/xml', 'text/xml', 'text/csv',
        // Scan files and captures
        'application/vnd.tcpdump.pcap', 'application/x-pcap', 'application/x-pcapng',
        'application/x-nessus', 'application/x-nmap', 'application/x-burp',
        // Archives
        'application/zip', 'application/x-zip-compressed', 'application/x-tar',
        'application/gzip', 'application/x-gzip', 'application/x-bzip2',
        'application/x-7z-compressed', 'application/x-rar-compressed',
        // Logs
        'text/log', 'application/x-log',
        // Generic binary - catch-all for any scan tool
        'application/octet-stream'
      ]
    };

    const allowed = allowedTypes[type as keyof typeof allowedTypes] || allowedTypes.other;
    if (!allowed.includes(effectiveMimeType)) {
      return {
        valid: false,
        error: `File type ${file.mimeType} (detected as ${effectiveMimeType}) is not allowed for ${type}. Allowed types: ${allowed.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Get effective MIME type by considering both detected MIME type and file extension
   */
  private getEffectiveMimeType(mimeType: string, extension: string): string {
    // If we have a specific MIME type that's not application/octet-stream, use it
    if (mimeType && mimeType !== 'application/octet-stream') {
      return mimeType;
    }

    // Map extensions to MIME types for common file types that get misidentified
    const extensionMimeMap: Record<string, string> = {
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.py': 'text/python',
      '.java': 'text/java',
      '.go': 'text/go',
      '.cpp': 'text/cpp',
      '.c': 'text/cpp',
      '.h': 'text/cpp',
      '.cs': 'text/csharp',
      '.php': 'text/php',
      '.rb': 'text/ruby',
      '.sh': 'text/plain',
      '.tf': 'text/terraform',
      '.hcl': 'text/hcl',
      '.bicep': 'text/bicep',
      '.ps1': 'application/x-powershell',
      '.dockerfile': 'text/dockerfile',
      '.rs': 'text/rust'
    };

    return extensionMimeMap[extension] || mimeType;
  }

  private isPublicArtifactType(type: string): boolean {
    // Architecture diagrams are typically public, evidence files are private
    const publicTypes = ['architecture_diagram', 'system_documentation', 'policy_document'];
    return publicTypes.includes(type);
  }

  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.substring(lastDot) : '';
  }

  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private generateArtifactUrl(artifactId: string, fileName: string, isPublic: boolean): string {
    // Use BACKEND_URL from environment, fallback to localhost
    const port = process.env.PORT || '3000';
    const baseUrl = process.env.REPLIT_DOMAIN 
      ? `https://${process.env.REPLIT_DOMAIN}` 
      : `http://localhost:${port}`;
    const prefix = isPublic ? 'public' : 'private';
    return `${baseUrl}/api/artifacts/${prefix}/${artifactId}/${fileName}`;
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

// Singleton instance
export const artifactService = new ArtifactService();
