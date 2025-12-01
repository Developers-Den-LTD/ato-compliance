// File Processing Service
// Orchestrates parsing of uploaded security scan files into compliance findings and evidence

import { promises as fs } from 'fs';
import { storage } from '../storage';
import { NessusParser } from '../parsers/nessus-parser';
import { ScapParser } from '../parsers/scap-parser';
import { CKLParser } from '../parsers/ckl-parser';
import { CKLBParser } from '../parsers/cklb-parser';
import { artifactService } from './artifact-service';
import type {
  VulnerabilityParser,
  ParsedScanResult,
  ParsedVulnerability,
  ParserOptions,
  ParsingProgress,
  ParsingError
} from '../parsers/types';
import type { 
  InsertFinding, 
  InsertEvidence, 
  InsertGenerationJob,
  Finding,
  Evidence,
  StigRule,
  Control,
  InsertStigRule,
  InsertControl
} from '../schema';

export interface FileProcessingRequest {
  artifactId: string;
  systemId: string;
  options?: {
    includeInformational?: boolean;
    autoMapStig?: boolean;
    stigVersion?: string;
    filterBySeverity?: string[];
    filterByHost?: string[];
    createStigRules?: boolean;
    createControls?: boolean;
  };
  userId?: string;
}

export interface ProcessingResult {
  jobId: string;
  artifactId: string;
  scanResult: ParsedScanResult;
  findingsCreated: number;
  evidenceCreated: number;
  stigRulesCreated: number;
  controlsCreated: number;
  errorsEncountered: ProcessingError[];
  processingTime: number;
  summary: {
    totalVulnerabilities: number;
    severityBreakdown: Record<string, number>;
    hostsScanned: number;
    scanDate: Date;
    scanner: string;
  };
}

export interface ProcessingError {
  type: 'warning' | 'error' | 'fatal';
  message: string;
  code?: string;
  context?: any;
}

export class FileProcessingService {
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
   * Main entry point: Process an uploaded artifact file
   */
  async processArtifactFile(request: FileProcessingRequest): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    // Get artifact details
    const artifact = await artifactService.getArtifact(request.artifactId);
    if (!artifact) {
      throw new Error(`Artifact not found: ${request.artifactId}`);
    }

    // Create generation job for tracking
    const job = await storage.createGenerationJob({
      systemId: request.systemId,
      type: 'data_ingestion',
      status: 'processing',
      progress: 0,
      metadata: {
        artifactId: request.artifactId,
        fileName: artifact.fileName,
        fileSize: artifact.fileSize,
        startTime: new Date().toISOString(),
        options: request.options
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
      // Step 1: Load file content
      progress.stage = 'parsing';
      progress.progress = 5;
      progress.currentItem = 'Loading file content';
      this.activeJobs.set(jobId, progress);

      const fileContent = await this.loadArtifactContent(artifact);

      // Step 2: Detect file type and parse
      progress.progress = 10;
      progress.currentItem = 'Detecting file format';
      this.activeJobs.set(jobId, progress);

      const fileType = await this.detectFileType(artifact.fileName, fileContent);
      if (!fileType) {
        throw new Error(`Unsupported file format: ${artifact.fileName}. Supported formats: Nessus (.nessus), SCAP XCCDF (.xml), STIG CKL (.ckl), STIG CKLB (.cklb)`);
      }

      // Step 3: Parse scan data
      progress.progress = 20;
      progress.currentItem = `Parsing ${fileType.toUpperCase()} data`;
      this.activeJobs.set(jobId, progress);

      const parser = this.parsers.get(fileType);
      if (!parser) {
        throw new Error(`No parser available for file type: ${fileType}`);
      }

      const parserOptions: ParserOptions = {
        includeInformational: request.options?.includeInformational || false,
        autoMapStig: request.options?.autoMapStig !== false, // Default true
        stigVersion: request.options?.stigVersion,
        filterBySeverity: request.options?.filterBySeverity,
        filterByHost: request.options?.filterByHost
      };

      const scanResult = await parser.parse(fileContent, parserOptions);
      
      progress.progress = 50;
      progress.currentItem = `Parsed ${scanResult.totalVulnerabilities} vulnerabilities from ${scanResult.hosts.length} hosts`;
      this.activeJobs.set(jobId, progress);

      // Step 4: Process scan results into findings and evidence
      progress.stage = 'storing';
      progress.progress = 60;
      this.activeJobs.set(jobId, progress);

      const processingResults = await this.processScanResults(
        request.systemId,
        scanResult,
        artifact,
        jobId,
        progress,
        request.options || {}
      );

      // Step 5: Complete processing
      progress.stage = 'complete';
      progress.progress = 100;
      progress.currentItem = 'Processing complete';
      this.activeJobs.set(jobId, progress);

      const processingTime = Date.now() - startTime;

      // Update job status
      await storage.updateGenerationJob(jobId, {
        status: processingResults.errors.length > 0 ? 'completed_with_errors' : 'completed',
        progress: 100,
        endTime: new Date(),
        metadata: {
          ...(job.metadata as object || {}),
          processingTime,
          findingsCreated: processingResults.findingsCreated,
          evidenceCreated: processingResults.evidenceCreated,
          stigRulesCreated: processingResults.stigRulesCreated,
          controlsCreated: processingResults.controlsCreated,
          errorsEncountered: processingResults.errors.length,
          endTime: new Date().toISOString()
        }
      });

      // Clean up progress tracking after delay
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 60000); // Keep for 1 minute

      return {
        jobId,
        artifactId: request.artifactId,
        scanResult,
        findingsCreated: processingResults.findingsCreated,
        evidenceCreated: processingResults.evidenceCreated,
        stigRulesCreated: processingResults.stigRulesCreated,
        controlsCreated: processingResults.controlsCreated,
        errorsEncountered: processingResults.errors,
        processingTime,
        summary: {
          totalVulnerabilities: scanResult.totalVulnerabilities,
          severityBreakdown: scanResult.vulnerabilitySummary,
          hostsScanned: scanResult.hosts.length,
          scanDate: scanResult.scanDate,
          scanner: scanResult.scanner
        }
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

  /**
   * Process scan results into findings and evidence records
   */
  private async processScanResults(
    systemId: string,
    scanResult: ParsedScanResult,
    artifact: any,
    jobId: string,
    progress: ParsingProgress,
    options: any
  ): Promise<{
    findingsCreated: number;
    evidenceCreated: number;
    stigRulesCreated: number;
    controlsCreated: number;
    errors: ProcessingError[];
  }> {
    let findingsCreated = 0;
    let evidenceCreated = 0;
    let stigRulesCreated = 0;
    let controlsCreated = 0;
    const errors: ProcessingError[] = [];

    const totalVulnerabilities = scanResult.totalVulnerabilities;
    let processedVulnerabilities = 0;

    // Process each host's vulnerabilities
    for (const host of scanResult.hosts) {
      for (const vuln of host.vulnerabilities) {
        try {
          // Step 1: Ensure STIG rule exists if needed
          let stigRuleId = vuln.stigId;
          if (options.createStigRules && vuln.stigId) {
            const createdRule = await this.ensureStigRule(vuln, scanResult);
            if (createdRule) {
              stigRuleId = createdRule.id;
              stigRulesCreated++;
            }
          }

          // Step 2: Ensure controls exist if needed
          if (options.createControls && vuln.cci) {
            const controlsCreatedCount = await this.ensureControls(vuln.cci);
            controlsCreated += controlsCreatedCount;
          }

          // Step 3: Create finding record
          const finding = await this.createFindingFromVulnerability(
            systemId,
            vuln,
            scanResult,
            stigRuleId
          );
          findingsCreated++;

          // Step 4: Create evidence record linking to artifact
          const evidence = await this.createEvidenceFromVulnerability(
            systemId,
            finding.id,
            vuln,
            scanResult,
            artifact
          );
          evidenceCreated++;

          processedVulnerabilities++;
          
          // Update progress
          const storeProgress = 60 + (processedVulnerabilities / totalVulnerabilities) * 35;
          progress.progress = Math.round(storeProgress);
          progress.processedItems = processedVulnerabilities;
          progress.totalItems = totalVulnerabilities;
          progress.currentItem = `Processing ${vuln.title}`;
          this.activeJobs.set(jobId, progress);

        } catch (error) {
          const errorMsg = `Failed to process vulnerability ${vuln.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push({
            type: 'error',
            message: errorMsg,
            code: 'PROCESSING_ERROR',
            context: { vulnerabilityId: vuln.id, host: vuln.host }
          });
          progress.errors.push({
            type: 'error',
            message: errorMsg
          });
          this.activeJobs.set(jobId, progress);
        }
      }
    }

    return { findingsCreated, evidenceCreated, stigRulesCreated, controlsCreated, errors };
  }

  /**
   * Create a Finding record from parsed vulnerability data
   */
  private async createFindingFromVulnerability(
    systemId: string,
    vuln: ParsedVulnerability,
    scanResult: ParsedScanResult,
    stigRuleId?: string
  ): Promise<Finding> {
    // Map 'info' severity to 'informational' to match schema
    const severity = vuln.severity === 'info' ? 'informational' : vuln.severity;
    
    // Generate a deterministic finding ID for deduplication
    const findingId = this.generateFindingId(vuln, scanResult);
    
    // Check if finding already exists
    const existingFindings = await storage.getFindingsBySystem(systemId);
    const existingFinding = existingFindings.find(f => f.findingId === findingId);
    
    if (existingFinding) {
      // Update existing finding with latest data
      const updated = await storage.updateFinding(existingFinding.id, {
        title: vuln.title,
        description: vuln.description,
        severity: severity as any,
        evidence: vuln.evidence || vuln.output,
        remediation: vuln.solution
      });
      return updated!;
    }

    const finding: InsertFinding = {
      systemId,
      stigRuleId: stigRuleId || this.getDefaultStigRuleId(vuln),
      findingId,
      title: vuln.title,
      description: vuln.description,
      severity: severity as any,
      status: 'open',
      source: scanResult.scanner,
      evidence: vuln.evidence || vuln.output,
      remediation: vuln.solution
    };

    return await storage.createFinding(finding);
  }

  /**
   * Create Evidence record linking vulnerability to source artifact
   */
  private async createEvidenceFromVulnerability(
    systemId: string,
    findingId: string,
    vuln: ParsedVulnerability,
    scanResult: ParsedScanResult,
    artifact: any
  ): Promise<Evidence> {
    // Map vulnerability to appropriate control
    const controlId = this.mapVulnerabilityToControl(vuln);
    
    const evidence: InsertEvidence = {
      systemId,
      controlId,
      findingId,
      type: 'scan_result',
      description: this.formatEvidenceDescription(vuln, scanResult, artifact),
      implementation: `Automated security scan findings from ${scanResult.scanner} scanner`,
      status: 'does_not_satisfy', // Vulnerabilities indicate non-compliance
      artifactId: artifact.id
    };

    return await storage.createEvidence(evidence);
  }

  /**
   * Ensure STIG rule exists in database
   */
  private async ensureStigRule(vuln: ParsedVulnerability, scanResult: ParsedScanResult): Promise<StigRule | null> {
    if (!vuln.stigId) return null;

    // Check if STIG rule already exists
    const existing = await storage.getStigRule(vuln.stigId);
    if (existing) return existing;

    // Create new STIG rule
    const stigRule: InsertStigRule = {
      id: vuln.stigId,
      stigId: this.extractStigId(vuln.stigId),
      title: vuln.title,
      description: vuln.description,
      severity: vuln.severity === 'info' ? 'low' : vuln.severity,
      checkText: `Automated check via ${scanResult.scanner} scanner`,
      fixText: vuln.solution || 'See vulnerability details for remediation guidance'
    };

    try {
      return await storage.createStigRule(stigRule);
    } catch (error) {
      // Rule might have been created concurrently
      return await storage.getStigRule(vuln.stigId) || null;
    }
  }

  /**
   * Ensure controls exist for CCI mappings
   */
  private async ensureControls(ccis: string[]): Promise<number> {
    let created = 0;
    
    for (const cci of ccis) {
      // Map CCI to NIST control (simplified mapping)
      const controlId = this.mapCciToControl(cci);
      if (!controlId) continue;

      // Check if control exists
      const existing = await storage.getControl(controlId);
      if (existing) continue;

      // Create basic control record
      const control: InsertControl = {
        id: controlId,
        family: this.getControlFamily(controlId),
        title: `Control ${controlId}`,
        description: `Automated control mapping from CCI ${cci}`,
        baseline: ['Low', 'Moderate', 'High']
      };

      try {
        await storage.createControl(control);
        created++;
      } catch (error) {
        // Control might have been created concurrently
      }
    }

    return created;
  }

  /**
   * Load file content from artifact
   */
  private async loadArtifactContent(artifact: any): Promise<Buffer> {
    try {
      const downloadResult = await artifactService.downloadArtifact(artifact.id);
      if (!downloadResult) {
        throw new Error(`Could not download artifact content: ${artifact.id}`);
      }
      return downloadResult.content;
    } catch (error) {
      throw new Error(`Failed to load artifact content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect file type from filename and content
   */
  private async detectFileType(fileName: string, content: Buffer): Promise<string | null> {
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
   * Generate deterministic finding ID for deduplication
   */
  private generateFindingId(vuln: ParsedVulnerability, scanResult: ParsedScanResult): string {
    const components = [
      scanResult.scanner,
      vuln.pluginId || vuln.stigId || vuln.title.replace(/\s+/g, '-').toLowerCase(),
      vuln.host,
      vuln.port || 'noport'
    ];
    return components.join('-');
  }

  /**
   * Get default STIG rule ID for vulnerabilities without explicit mapping
   */
  private getDefaultStigRuleId(vuln: ParsedVulnerability): string {
    return vuln.stigId || 'GEN-DEFAULT-001';
  }

  /**
   * Map vulnerability to appropriate NIST control
   */
  private mapVulnerabilityToControl(vuln: ParsedVulnerability): string {
    // Simple mapping based on common patterns
    if (vuln.cci && vuln.cci.length > 0) {
      const controlId = this.mapCciToControl(vuln.cci[0]);
      if (controlId) return controlId;
    }

    // Fallback mapping based on vulnerability type
    const title = vuln.title.toLowerCase();
    if (title.includes('authentication') || title.includes('password')) return 'IA-2';
    if (title.includes('access') || title.includes('permission')) return 'AC-3';
    if (title.includes('audit') || title.includes('logging')) return 'AU-2';
    if (title.includes('encryption') || title.includes('crypto')) return 'SC-13';
    if (title.includes('configuration') || title.includes('hardening')) return 'CM-6';
    
    return 'SI-2'; // Default to vulnerability management control
  }

  /**
   * Format evidence description with vulnerability details
   */
  private formatEvidenceDescription(vuln: ParsedVulnerability, scanResult: ParsedScanResult, artifact: any): string {
    const parts = [
      `Vulnerability detected by ${scanResult.scanner} scanner on ${scanResult.scanDate.toISOString()}`,
      `Host: ${vuln.host}${vuln.port ? `:${vuln.port}` : ''}`,
      `Severity: ${vuln.severity.toUpperCase()}`,
      vuln.cvssScore ? `CVSS Score: ${vuln.cvssScore}` : null,
      vuln.cve ? `CVE: ${vuln.cve.join(', ')}` : null,
      `Source: ${artifact.fileName}`,
      '',
      vuln.description,
      vuln.output ? `\nScan Output:\n${vuln.output}` : null
    ].filter(Boolean);

    return parts.join('\n');
  }

  /**
   * Extract STIG ID from STIG rule identifier
   */
  private extractStigId(stigRuleId: string): string {
    // Extract base STIG identifier (e.g., "RHEL-8-STIG" from "RHEL-8-010010")
    const match = stigRuleId.match(/^([A-Z]+-\d+)/);
    return match ? `${match[1]}-STIG` : 'UNKNOWN-STIG';
  }

  /**
   * Map CCI to NIST control (simplified mapping)
   */
  private mapCciToControl(cci: string): string | null {
    // This would ideally use a comprehensive CCI-to-Control mapping database
    // For now, using basic patterns
    const cciNum = cci.replace('CCI-', '');
    const num = parseInt(cciNum);
    
    if (num >= 1 && num <= 99) return 'AC-1';
    if (num >= 100 && num <= 199) return 'AC-2';
    if (num >= 200 && num <= 299) return 'AU-2';
    if (num >= 300 && num <= 399) return 'IA-2';
    if (num >= 1400 && num <= 1499) return 'SC-7';
    
    return 'CM-6'; // Default to configuration management
  }

  /**
   * Get control family from control ID
   */
  private getControlFamily(controlId: string): string {
    const prefix = controlId.split('-')[0];
    const familyMap: Record<string, string> = {
      'AC': 'Access Control',
      'AU': 'Audit and Accountability',
      'AT': 'Awareness and Training',
      'CM': 'Configuration Management',
      'CP': 'Contingency Planning',
      'IA': 'Identification and Authentication',
      'IR': 'Incident Response',
      'MA': 'Maintenance',
      'MP': 'Media Protection',
      'PE': 'Physical and Environmental Protection',
      'PL': 'Planning',
      'PS': 'Personnel Security',
      'RA': 'Risk Assessment',
      'CA': 'Security Assessment and Authorization',
      'SC': 'System and Communications Protection',
      'SI': 'System and Information Integrity',
      'SA': 'System and Services Acquisition'
    };
    
    return familyMap[prefix] || 'Unknown';
  }

  /**
   * Get processing progress for a job
   */
  getProgress(jobId: string): ParsingProgress | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * List all active processing jobs
   */
  getActiveJobs(): Array<{ jobId: string; progress: ParsingProgress }> {
    return Array.from(this.activeJobs.entries()).map(([jobId, progress]) => ({
      jobId,
      progress
    }));
  }
}

// Singleton instance
export const fileProcessingService = new FileProcessingService();
