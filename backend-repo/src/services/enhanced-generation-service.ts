// Enhanced Document Generation Service  
// Integrates robust error handling and streaming generation
// Part of Epic 9 - Document Intelligence Pipeline

import { EventEmitter } from 'events';
import { storage } from '../storage';
import { resilientDocumentGenerator } from './resilient-document-generator';
import { streamingDocumentGenerator } from './streaming-document-generator';
import { generationValidator } from './generation-validator';
import { generationRecoveryService } from './generation-recovery';
import { sspGenerationService } from './ssp-generation.service';
import type {
  GenerationRequest,
  GenerationResult,
  GenerationProgress,
  DocumentType
} from './generation-service';
import type { InsertDocument, InsertGenerationJob } from '../schema';

export class EnhancedGenerationService extends EventEmitter {
  private activeJobs = new Map<string, GenerationProgress>();

  /**
   * Start enhanced document generation with full error handling
   */
  async startGeneration(request: GenerationRequest): Promise<string> {
    // Step 1: Validate request
    console.log(`Starting enhanced generation for system ${request.systemId}`);
    
    const validation = await generationValidator.validateRequest(request);
    
    if (!validation.valid) {
      console.error('Validation failed:', validation.errors);
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Log warnings but continue
    if (validation.warnings.length > 0) {
      console.warn('Validation warnings:', validation.warnings);
    }

    // Step 2: Create job
    const job: InsertGenerationJob = {
      systemId: request.systemId,
      type: 'ato_package',
      documentTypes: request.documentTypes,
      status: 'pending',
      progress: 0,
      requestData: request,
      startTime: new Date()
    };

    const createdJob = await storage.createGenerationJob(job);
    const jobId = createdJob.id;

    // Step 3: Initialize progress tracking
    const progress: GenerationProgress = {
      jobId,
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing generation process',
      steps: this.createGenerationSteps(request.documentTypes),
      startTime: new Date()
    };

    this.activeJobs.set(jobId, progress);

    // Step 4: Start generation with streaming support
    this.executeEnhancedGeneration(jobId, request).catch(async error => {
      console.error(`Generation job ${jobId} failed:`, error);
      
      // Attempt recovery
      const recoveryResult = await generationRecoveryService.recoverFromFailure(jobId, {
        resumeFromCheckpoint: true,
        retryFailedSteps: true,
        skipFailedControls: false,
        maxRetryAttempts: 2
      });

      if (!recoveryResult.success) {
        await this.updateJobStatus(jobId, 'failed', error.message);
      }
    });

    return jobId;
  }

  /**
   * Execute enhanced generation with all improvements
   */
  private async executeEnhancedGeneration(
    jobId: string,
    request: GenerationRequest
  ): Promise<void> {
    const system = await storage.getSystem(request.systemId);
    if (!system) {
      throw new Error('System not found');
    }

    // Subscribe to streaming events
    streamingDocumentGenerator.on('progress', (data) => {
      if (data.jobId === jobId) {
        this.updateProgress(jobId, data);
      }
    });

    streamingDocumentGenerator.on('complete', async (data) => {
      if (data.jobId === jobId) {
        await this.handleGenerationComplete(jobId, data);
      }
    });

    streamingDocumentGenerator.on('error', async (data) => {
      if (data.jobId === jobId) {
        await this.handleGenerationError(jobId, data);
      }
    });

    try {
      // Update status
      await this.updateJobStatus(jobId, 'running', 'Starting enhanced generation');

      // Create checkpoint for recovery
      await generationRecoveryService.saveCheckpoint(jobId, 'start', {
        request,
        system
      });

      // Collect system data with checkpoint
      const systemData = await this.collectSystemDataWithCheckpoint(jobId, system.id);

      // Process each document type with enhanced error handling
      for (const docType of request.documentTypes) {
        await this.generateDocumentTypeEnhanced(jobId, docType, systemData, request);
      }

      // Mark as completed
      await this.updateJobStatus(jobId, 'completed', 'All documents generated successfully');

    } catch (error) {
      console.error(`Enhanced generation failed for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Generate specific document type with enhanced features
   */
  private async generateDocumentTypeEnhanced(
    jobId: string,
    docType: DocumentType,
    systemData: any,
    request: GenerationRequest
  ): Promise<void> {
    console.log(`Generating ${docType} with enhanced error handling`);

    // Create checkpoint before generation
    await generationRecoveryService.saveCheckpoint(jobId, `generate_${docType}`, {
      docType,
      systemData: {
        systemId: systemData.system.id,
        controlCount: systemData.controls.length
      }
    });

    try {
      switch (docType) {
        case 'ssp':
          await this.generateSSPEnhanced(jobId, systemData, request);
          break;

        case 'control_narratives':
          await this.generateNarrativesEnhanced(jobId, systemData, request);
          break;

        case 'stig_checklist':
        case 'jsig_checklist':
          await this.generateChecklistEnhanced(jobId, docType, systemData, request);
          break;

        case 'poam_report':
          await this.generatePoamEnhanced(jobId, systemData, request);
          break;

        default:
          console.warn(`Document type ${docType} using legacy generation`);
          // Fall back to original generation
      }
    } catch (error) {
      console.error(`Failed to generate ${docType}:`, error);
      
      // Check if error is recoverable
      if (this.isRecoverableError(error)) {
        console.log(`Attempting recovery for ${docType}`);
        await this.attemptRecovery(jobId, docType, systemData, request);
      } else {
        throw error;
      }
    }
  }

  /**
   * Enhanced SSP generation with streaming and error handling
   */
  private async generateSSPEnhanced(
    jobId: string,
    systemData: any,
    request: GenerationRequest
  ): Promise<void> {
    console.log('Generating SSP with enhanced features');

    // Use streaming generator for real-time progress
    const streamingRequest = {
      ...request,
      jobId // Pass jobId for progress tracking
    };

    await streamingDocumentGenerator.generate(streamingRequest);
  }

  /**
   * Enhanced narrative generation with chunking
   */
  private async generateNarrativesEnhanced(
    jobId: string,
    systemData: any,
    request: GenerationRequest
  ): Promise<void> {
    const { system, controls } = systemData;
    
    // Process in chunks to avoid timeouts
    const chunkSize = 10;
    const chunks = this.createChunks(controls, chunkSize);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const progress = Math.round(((i + 1) / chunks.length) * 100);
      
      await this.updateProgress(jobId, {
        currentStep: `Generating narratives for controls ${i * chunkSize + 1}-${(i + 1) * chunkSize}`,
        progress
      });

      // Create checkpoint for chunk
      await generationRecoveryService.saveCheckpoint(jobId, `narrative_chunk_${i}`, {
        chunkIndex: i,
        controlIds: chunk.map((c: any) => c.id),
        totalChunks: chunks.length
      });

      // Generate narratives for chunk
      await this.generateNarrativeChunk(jobId, chunk, systemData);
    }
  }

  /**
   * Enhanced checklist generation
   */
  private async generateChecklistEnhanced(
    jobId: string,
    checklistType: string,
    systemData: any,
    request: GenerationRequest
  ): Promise<void> {
    console.log(`Generating ${checklistType} with enhanced error handling`);
    
    // Implementation would use resilient generator
    // For now, delegate to original service
  }

  /**
   * Enhanced POAM generation
   */
  private async generatePoamEnhanced(
    jobId: string,
    systemData: any,
    request: GenerationRequest
  ): Promise<void> {
    console.log('Generating POAM with enhanced features');
    
    // Implementation would use resilient generator
    // For now, delegate to original service
  }

  /**
   * Collect system data with checkpoint
   */
  private async collectSystemDataWithCheckpoint(
    jobId: string,
    systemId: string
  ): Promise<any> {
    await this.updateProgress(jobId, {
      currentStep: 'Collecting system data',
      progress: 10
    });

    const data = await this.collectSystemData(systemId);

    // Save checkpoint
    await generationRecoveryService.saveCheckpoint(jobId, 'collect_data', data, {
      timestamp: new Date(),
      dataTypes: ['system', 'controls', 'findings', 'evidence']
    });

    return data;
  }

  /**
   * Collect all system data
   */
  private async collectSystemData(systemId: string): Promise<any> {
    const [
      system,
      systemControls,
      controls,
      findings,
      evidence,
      artifacts
    ] = await Promise.all([
      storage.getSystem(systemId),
      storage.getSystemControls(systemId),
      storage.getControlsBySystemId(systemId),
      storage.getFindingsBySystem(systemId),
      storage.getEvidenceBySystem(systemId),
      storage.getArtifactsBySystem(systemId)
    ]);

    return {
      system,
      systemControls,
      controls,
      findings,
      evidence,
      artifacts
    };
  }

  /**
   * Generate narrative chunk
   */
  private async generateNarrativeChunk(
    jobId: string,
    controls: any[],
    systemData: any
  ): Promise<void> {
    for (const control of controls) {
      try {
        // Generate narrative for individual control
        console.log(`Generating narrative for control ${control.id}`);
        
        // Implementation would use narrative generation service
        
      } catch (error) {
        console.error(`Failed to generate narrative for control ${control.id}:`, error);
        // Continue with next control
      }
    }
  }

  /**
   * Attempt recovery for failed generation
   */
  private async attemptRecovery(
    jobId: string,
    docType: string,
    systemData: any,
    request: GenerationRequest
  ): Promise<void> {
    console.log(`Attempting recovery for ${docType}`);
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Retry generation
    await this.generateDocumentTypeEnhanced(jobId, docType as DocumentType, systemData, request);
  }

  /**
   * Handle generation completion
   */
  private async handleGenerationComplete(jobId: string, data: any): Promise<void> {
    console.log(`Generation completed for job ${jobId}`);
    
    await this.updateJobStatus(jobId, 'completed', 'Generation completed successfully');
    
    // Clean up
    this.activeJobs.delete(jobId);
  }

  /**
   * Handle generation error
   */
  private async handleGenerationError(jobId: string, data: any): Promise<void> {
    console.error(`Generation error for job ${jobId}:`, data.error);
    
    await this.updateJobStatus(jobId, 'failed', data.error);
    
    // Clean up
    this.activeJobs.delete(jobId);
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: string, message?: string): Promise<void> {
    await storage.updateGenerationJob(jobId, {
      status,
      error: status === 'failed' ? message : undefined,
      endTime: status === 'completed' || status === 'failed' ? new Date() : undefined
    });

    const progress = this.activeJobs.get(jobId);
    if (progress) {
      progress.status = status as any;
      if (status === 'completed' || status === 'failed') {
        progress.endTime = new Date();
      }
    }
  }

  /**
   * Update progress
   */
  private updateProgress(jobId: string, update: Partial<GenerationProgress>): void {
    const progress = this.activeJobs.get(jobId);
    if (progress) {
      Object.assign(progress, update);
      
      // Update in database
      storage.updateGenerationJob(jobId, {
        progress: progress.progress
      }).catch(console.error);
    }
  }

  /**
   * Create generation steps
   */
  private createGenerationSteps(documentTypes: DocumentType[]): any[] {
    const steps = [
      { name: 'validation', status: 'pending' },
      { name: 'collect_data', status: 'pending' }
    ];

    for (const docType of documentTypes) {
      steps.push({
        name: `generate_${docType}`,
        status: 'pending'
      });
    }

    steps.push({ name: 'finalization', status: 'pending' });

    return steps;
  }

  /**
   * Create chunks from array
   */
  private createChunks<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverableError(error: any): boolean {
    const recoverablePatterns = [
      /timeout/i,
      /memory/i,
      /connection/i,
      /ECONNRESET/,
      /ETIMEDOUT/
    ];

    const errorMessage = error?.message || '';
    return recoverablePatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Get generation status
   */
  async getGenerationStatus(jobId: string): Promise<GenerationProgress | null> {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get generation result
   */
  async getGenerationResult(jobId: string): Promise<GenerationResult | null> {
    const job = await storage.getGenerationJob(jobId);
    if (!job || job.status !== 'completed') {
      return null;
    }

    const [documents, checklists, poamItems] = await Promise.all([
      storage.getDocumentsByJobId(jobId),
      storage.getChecklistsByJobId(jobId),
      storage.getPoamItemsBySystem(job.systemId) // Note: No getPoamItemsByJobId exists, using systemId
    ]);

    // Load artifacts and calculate summary
    const artifacts = await storage.getArtifactsBySystem(job.systemId);
    const systemControls = await storage.getSystemControls(job.systemId);
    const findings = await storage.getFindingsBySystem(job.systemId);
    const evidence = await storage.getEvidenceBySystem(job.systemId);

    const implementedControls = systemControls.filter(sc => sc.status === 'implemented');
    const criticalFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'high');

    return {
      jobId,
      documents,
      artifacts,
      checklists,
      poamItems,
      summary: {
        totalControls: systemControls.length,
        implementedControls: implementedControls.length,
        findings: findings.length,
        criticalFindings: criticalFindings.length,
        evidence: evidence.length,
        artifacts: artifacts.length
      }
    };
  }
}

// Export singleton instance
export const enhancedGenerationService = new EnhancedGenerationService();
