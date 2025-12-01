// Data Ingestion Service
// Orchestrates security scan data parsing and storage

import { storage } from '../storage';
import { NessusParser } from '../parsers/nessus-parser';
import { ScapParser } from '../parsers/scap-parser';
import { CKLParser } from '../parsers/ckl-parser';
import { CKLBParser } from '../parsers/cklb-parser';
import type {
  VulnerabilityParser,
  ParsedScanResult,
  ParsedVulnerability,
  ParserOptions,
  ParsingProgress
} from '../parsers/types';
import type { 
  InsertFinding, 
  InsertEvidence, 
  InsertGenerationJob 
} from '../schema';

export interface IngestionRequest {
  systemId: string;
  fileName: string;
  fileContent: string | Buffer;
  fileType: 'nessus' | 'scap' | 'ckl' | 'cklb' | 'auto';
  options?: ParserOptions;
  userId?: string;
}

export interface IngestionResult {
  jobId: string;
  scanResult: ParsedScanResult;
  findingsCreated: number;
  evidenceCreated: number;
  errorsEncountered: string[];
  processingTime: number;
}

export class IngestionService {
  private parsers: Map<string, VulnerabilityParser> = new Map();
  private activeJobs: Map<string, ParsingProgress> = new Map();

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers(): void {
    this.parsers.set('nessus', new NessusParser());
    this.parsers.set('scap', new ScapParser());
    this.parsers.set('ckl', new CKLParser());
    this.parsers.set('cklb', new CKLBParser());
  }

  /**
   * Detect file type from content and filename
   */
  async detectFileType(fileName: string, content: string | Buffer): Promise<string | null> {
    const lowercaseFileName = fileName.toLowerCase();
    
    // Try filename-based detection first
    if (lowercaseFileName.endsWith('.nessus')) {
      const parser = this.parsers.get('nessus');
      if (parser && await parser.validate(content)) {
        return 'nessus';
      }
    }
    
    if (lowercaseFileName.endsWith('.ckl')) {
      const parser = this.parsers.get('ckl');
      if (parser && await parser.validate(content)) {
        return 'ckl';
      }
    }
    
    if (lowercaseFileName.endsWith('.cklb')) {
      const parser = this.parsers.get('cklb');
      if (parser && await parser.validate(content)) {
        return 'cklb';
      }
    }
    
    if (lowercaseFileName.endsWith('.xml') || lowercaseFileName.endsWith('.xccdf')) {
      // Try SCAP first for XML files
      const scapParser = this.parsers.get('scap');
      if (scapParser && await scapParser.validate(content)) {
        return 'scap';
      }
      
      // Try CKL for XML files (CKL files are also XML)
      const cklParser = this.parsers.get('ckl');
      if (cklParser && await cklParser.validate(content)) {
        return 'ckl';
      }
      
      // Fallback to Nessus for XML files
      const nessusParser = this.parsers.get('nessus');
      if (nessusParser && await nessusParser.validate(content)) {
        return 'nessus';
      }
    }
    
    // Content-based detection for unclear filenames
    for (const [type, parser] of Array.from(this.parsers.entries())) {
      if (await parser.validate(content)) {
        return type;
      }
    }
    
    return null;
  }

  /**
   * Get parsing progress for a job
   */
  getProgress(jobId: string): ParsingProgress | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Main ingestion method
   */
  async ingestScanData(request: IngestionRequest): Promise<IngestionResult> {
    const startTime = Date.now();
    
    // Create generation job for tracking
    const job = await storage.createGenerationJob({
      systemId: request.systemId,
      type: 'data_ingestion',
      status: 'processing',
      progress: 0,
      metadata: {
        fileName: request.fileName,
        fileType: request.fileType,
        startTime: new Date().toISOString()
      }
    });

    const jobId = job.id;
    
    // Initialize progress tracking
    const progress: ParsingProgress = {
      stage: 'parsing',
      progress: 0,
      errors: [],
      startTime: new Date()
    };
    this.activeJobs.set(jobId, progress);

    try {
      // Step 1: Detect file type if auto
      let fileType = request.fileType;
      if (fileType === 'auto') {
        fileType = await this.detectFileType(request.fileName, request.fileContent) as 'nessus' | 'scap' | 'ckl' | 'cklb';
        if (!fileType) {
          throw new Error('Unable to detect scan file format. Supported formats: Nessus (.nessus), SCAP XCCDF (.xml), CKL (.ckl), CKLB (.cklb)');
        }
      }

      progress.progress = 10;
      this.activeJobs.set(jobId, progress);

      // Step 2: Parse scan data
      const parser = this.parsers.get(fileType);
      if (!parser) {
        throw new Error(`No parser available for file type: ${fileType}`);
      }

      progress.stage = 'parsing';
      progress.progress = 20;
      this.activeJobs.set(jobId, progress);

      const scanResult = await parser.parse(request.fileContent, request.options);
      
      progress.progress = 50;
      progress.currentItem = `Parsed ${scanResult.totalVulnerabilities} vulnerabilities`;
      this.activeJobs.set(jobId, progress);

      // Step 3: Store scan data
      progress.stage = 'storing';
      progress.progress = 60;
      this.activeJobs.set(jobId, progress);

      const { findingsCreated, evidenceCreated, errors } = await this.storeScanResults(
        request.systemId, 
        scanResult, 
        jobId, 
        progress
      );

      // Step 4: Complete processing
      progress.stage = 'complete';
      progress.progress = 100;
      this.activeJobs.set(jobId, progress);

      const processingTime = Date.now() - startTime;

      // Update job status
      await storage.updateGenerationJob(jobId, {
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        progress: 100,
        endTime: new Date(),
        metadata: {
          processingTime,
          findingsCreated,
          evidenceCreated,
          errorsEncountered: errors.length,
          endTime: new Date().toISOString()
        }
      });

      // Clean up progress tracking after a delay
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 30000); // Keep for 30 seconds for final status checks

      return {
        jobId,
        scanResult,
        findingsCreated,
        evidenceCreated,
        errorsEncountered: errors,
        processingTime
      };

    } catch (error) {
      // Update job with error status
      await storage.updateGenerationJob(jobId, {
        status: 'failed',
        progress: 0,
        endTime: new Date(),
        error: error instanceof Error ? error.message : String(error)
      });

      // Clean up progress tracking
      this.activeJobs.delete(jobId);
      
      throw error;
    }
  }

  private async storeScanResults(
    systemId: string, 
    scanResult: ParsedScanResult, 
    jobId: string, 
    progress: ParsingProgress
  ): Promise<{ findingsCreated: number; evidenceCreated: number; errors: string[] }> {
    let findingsCreated = 0;
    let evidenceCreated = 0;
    const errors: string[] = [];

    const totalVulnerabilities = scanResult.totalVulnerabilities;
    let processedVulnerabilities = 0;

    // Process each host's vulnerabilities
    for (const host of scanResult.hosts) {
      for (const vuln of host.vulnerabilities) {
        try {
          // Create finding record
          const finding = await this.createFinding(systemId, vuln, scanResult);
          findingsCreated++;

          // Create evidence record
          const evidence = await this.createEvidence(systemId, finding.id, vuln, scanResult);
          evidenceCreated++;

          processedVulnerabilities++;
          
          // Update progress
          const storeProgress = 60 + (processedVulnerabilities / totalVulnerabilities) * 30;
          progress.progress = Math.round(storeProgress);
          progress.processedItems = processedVulnerabilities;
          progress.totalItems = totalVulnerabilities;
          progress.currentItem = `Processing ${vuln.title}`;
          this.activeJobs.set(jobId, progress);

        } catch (error) {
          const errorMsg = `Failed to store vulnerability ${vuln.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          progress.errors.push({
            type: 'error',
            message: errorMsg
          });
          this.activeJobs.set(jobId, progress);
        }
      }
    }

    return { findingsCreated, evidenceCreated, errors };
  }

  private async createFinding(
    systemId: string, 
    vuln: ParsedVulnerability, 
    scanResult: ParsedScanResult
  ): Promise<any> {
    // Map 'info' severity to 'informational' to match schema
    const severity = vuln.severity === 'info' ? 'informational' : vuln.severity;
    
    // Find or create a default STIG rule for mapping
    const stigRuleId = vuln.stigId || 'default-stig-rule';
    
    const finding: InsertFinding = {
      systemId,
      stigRuleId, // Required field - using parsed STIG ID or default
      findingId: vuln.id, // Scanner-specific ID
      title: vuln.title,
      description: vuln.description,
      severity: severity as any, // Type assertion needed due to enum mismatch
      status: 'open',
      source: scanResult.scanner,
      evidence: vuln.evidence || vuln.output,
      remediation: vuln.solution,
    };

    return await storage.createFinding(finding);
  }

  private async createEvidence(
    systemId: string, 
    findingId: string, 
    vuln: ParsedVulnerability, 
    scanResult: ParsedScanResult
  ): Promise<any> {
    // For evidence, we need a controlId - use a default for now
    const defaultControlId = 'AU-2'; // Default audit control
    
    const evidence: InsertEvidence = {
      systemId,
      controlId: defaultControlId, // Required field
      findingId,
      type: 'scan_result',
      description: vuln.evidence || vuln.output || vuln.description,
      implementation: `${scanResult.scanner.toUpperCase()} scan result for ${vuln.title}`,
      status: 'does_not_satisfy', // Findings typically indicate non-compliance
    };

    return await storage.createEvidence(evidence);
  }

  /**
   * Get file metadata without full parsing
   */
  async getFileMetadata(fileName: string, content: string | Buffer): Promise<{
    fileType: string | null;
    metadata: any;
    isValid: boolean;
  }> {
    const fileType = await this.detectFileType(fileName, content);
    
    if (!fileType) {
      return {
        fileType: null,
        metadata: null,
        isValid: false
      };
    }

    const parser = this.parsers.get(fileType);
    if (!parser) {
      return {
        fileType,
        metadata: null,
        isValid: false
      };
    }

    try {
      const metadata = await parser.getMetadata(content);
      return {
        fileType,
        metadata,
        isValid: true
      };
    } catch (error) {
      return {
        fileType,
        metadata: null,
        isValid: false
      };
    }
  }

  /**
   * List all active ingestion jobs
   */
  getActiveJobs(): Array<{ jobId: string; progress: ParsingProgress }> {
    return Array.from(this.activeJobs.entries()).map(([jobId, progress]) => ({
      jobId,
      progress
    }));
  }
}

// Singleton instance
export const ingestionService = new IngestionService();
