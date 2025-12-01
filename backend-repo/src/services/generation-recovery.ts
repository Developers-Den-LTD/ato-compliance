// Generation Recovery Service
// Handles recovery from failed generation jobs
// Part of Epic 9 - Document Intelligence Pipeline

import { storage } from '../storage';
import type { GenerationJob } from '../schema';
import type { GenerationRequest } from './generation-service';

export interface RecoveryCheckpoint {
  id: string;
  jobId: string;
  step: string;
  data: any;
  timestamp: Date;
  metadata?: {
    controlsProcessed?: number;
    sectionsCompleted?: string[];
    partialResults?: any;
  };
}

export interface RecoveryOptions {
  resumeFromCheckpoint: boolean;
  retryFailedSteps: boolean;
  skipFailedControls: boolean;
  maxRetryAttempts: number;
}

export interface RecoveryResult {
  success: boolean;
  resumedFrom: string;
  skippedSteps: string[];
  completedSteps: string[];
  errors: string[];
}

export class GenerationRecoveryService {
  private checkpoints = new Map<string, RecoveryCheckpoint[]>();
  
  /**
   * Save checkpoint for recovery
   */
  async saveCheckpoint(
    jobId: string,
    step: string,
    data: any,
    metadata?: any
  ): Promise<void> {
    const checkpoint: RecoveryCheckpoint = {
      id: crypto.randomUUID(),
      jobId,
      step,
      data,
      timestamp: new Date(),
      metadata
    };

    // Store in memory cache
    if (!this.checkpoints.has(jobId)) {
      this.checkpoints.set(jobId, []);
    }
    this.checkpoints.get(jobId)!.push(checkpoint);

    // Also persist to database
    await this.persistCheckpoint(checkpoint);
  }

  /**
   * Get latest checkpoint for a job
   */
  async getLatestCheckpoint(jobId: string): Promise<RecoveryCheckpoint | null> {
    // Try memory cache first
    const cached = this.checkpoints.get(jobId);
    if (cached && cached.length > 0) {
      return cached[cached.length - 1];
    }

    // Load from database
    return await this.loadLatestCheckpoint(jobId);
  }

  /**
   * Get all checkpoints for a job
   */
  async getCheckpoints(jobId: string): Promise<RecoveryCheckpoint[]> {
    // Try memory cache first
    const cached = this.checkpoints.get(jobId);
    if (cached) {
      return cached;
    }

    // Load from database
    return await this.loadCheckpoints(jobId);
  }

  /**
   * Recover failed generation job
   */
  async recoverFromFailure(
    jobId: string,
    options: RecoveryOptions = {
      resumeFromCheckpoint: true,
      retryFailedSteps: true,
      skipFailedControls: false,
      maxRetryAttempts: 3
    }
  ): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      success: false,
      resumedFrom: '',
      skippedSteps: [],
      completedSteps: [],
      errors: []
    };

    try {
      // Get job details
      const job = await this.getJob(jobId);
      if (!job) {
        result.errors.push('Job not found');
        return result;
      }

      // Check if job can be recovered
      if (job.status === 'completed') {
        result.errors.push('Job already completed');
        return result;
      }

      if (job.status !== 'failed' && job.status !== 'running') {
        result.errors.push(`Cannot recover job in ${job.status} status`);
        return result;
      }

      // Get checkpoints
      const checkpoints = await this.getCheckpoints(jobId);
      if (checkpoints.length === 0) {
        result.errors.push('No checkpoints available for recovery');
        return result;
      }

      // Determine recovery point
      const recoveryPoint = this.determineRecoveryPoint(checkpoints, job);
      if (!recoveryPoint) {
        result.errors.push('Could not determine recovery point');
        return result;
      }

      result.resumedFrom = recoveryPoint.step;

      // Resume generation
      await this.resumeGeneration(job, recoveryPoint, options);

      result.success = true;
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Determine best recovery point
   */
  private determineRecoveryPoint(
    checkpoints: RecoveryCheckpoint[],
    job: GenerationJob
  ): RecoveryCheckpoint | null {
    // Sort by timestamp, newest first
    const sorted = checkpoints.sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );

    // Find last successful checkpoint
    for (const checkpoint of sorted) {
      if (this.isValidRecoveryPoint(checkpoint, job)) {
        return checkpoint;
      }
    }

    return null;
  }

  /**
   * Check if checkpoint is valid for recovery
   */
  private isValidRecoveryPoint(
    checkpoint: RecoveryCheckpoint,
    job: GenerationJob
  ): boolean {
    // Check if checkpoint data is intact
    if (!checkpoint.data || Object.keys(checkpoint.data).length === 0) {
      return false;
    }

    // Check if checkpoint is not too old (e.g., within 24 hours)
    const ageHours = (Date.now() - checkpoint.timestamp.getTime()) / (1000 * 60 * 60);
    if (ageHours > 24) {
      return false;
    }

    // Validate checkpoint data structure
    switch (checkpoint.step) {
      case 'collect_data':
        return this.validateDataCollectionCheckpoint(checkpoint.data);
      
      case 'generate_narratives':
        return this.validateNarrativeCheckpoint(checkpoint.data);
      
      case 'generate_ssp':
        return this.validateSSPCheckpoint(checkpoint.data);
      
      default:
        return true; // Accept other checkpoints
    }
  }

  /**
   * Resume generation from checkpoint
   */
  private async resumeGeneration(
    job: GenerationJob,
    checkpoint: RecoveryCheckpoint,
    options: RecoveryOptions
  ): Promise<void> {
    const request = job.requestData as GenerationRequest;
    
    // Update job status
    await this.updateJobStatus(job.id, 'running', 'Resuming from checkpoint');

    // Import generation service
    const { generationService } = await import('./generation-service');

    // Create recovery context
    const recoveryContext = {
      jobId: job.id,
      checkpoint,
      skippedSteps: this.getSkippedSteps(checkpoint.step),
      remainingSteps: this.getRemainingSteps(checkpoint.step)
    };

    // Resume based on checkpoint step
    switch (checkpoint.step) {
      case 'collect_data':
        await this.resumeFromDataCollection(recoveryContext, request);
        break;
      
      case 'generate_narratives':
        await this.resumeFromNarratives(recoveryContext, request);
        break;
      
      case 'generate_ssp':
        await this.resumeFromSSP(recoveryContext, request);
        break;
      
      default:
        throw new Error(`Unknown checkpoint step: ${checkpoint.step}`);
    }
  }

  /**
   * Resume from data collection checkpoint
   */
  private async resumeFromDataCollection(
    context: any,
    request: GenerationRequest
  ): Promise<void> {
    // Data is already collected, move to next steps
    const systemData = context.checkpoint.data;
    
    // Continue with document generation based on types
    for (const docType of request.documentTypes) {
      if (context.skippedSteps.includes(docType)) {
        continue;
      }

      await this.generateDocumentType(docType, systemData, request, context);
    }
  }

  /**
   * Resume from narrative generation checkpoint  
   */
  private async resumeFromNarratives(
    context: any,
    request: GenerationRequest
  ): Promise<void> {
    const { processedControls, remainingControls } = context.checkpoint.metadata || {};
    
    if (remainingControls && remainingControls.length > 0) {
      // Continue narrative generation for remaining controls
      await this.generateRemainingNarratives(
        remainingControls,
        context.checkpoint.data,
        request,
        context
      );
    }
    
    // Continue with next document types
    await this.continueWithRemainingDocTypes(context, request);
  }

  /**
   * Resume from SSP generation checkpoint
   */
  private async resumeFromSSP(
    context: any,
    request: GenerationRequest
  ): Promise<void> {
    const { sectionsCompleted } = context.checkpoint.metadata || {};
    
    if (sectionsCompleted) {
      // Continue SSP generation from last completed section
      await this.continueSSPGeneration(
        sectionsCompleted,
        context.checkpoint.data,
        request,
        context
      );
    }
  }

  /**
   * Clean up old checkpoints
   */
  async cleanupCheckpoints(olderThanHours: number = 48): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleaned = 0;

    // Clean memory cache
    for (const [jobId, checkpoints] of this.checkpoints.entries()) {
      const filtered = checkpoints.filter(cp => cp.timestamp > cutoff);
      if (filtered.length < checkpoints.length) {
        cleaned += checkpoints.length - filtered.length;
        this.checkpoints.set(jobId, filtered);
      }
      if (filtered.length === 0) {
        this.checkpoints.delete(jobId);
      }
    }

    // Clean database
    const dbCleaned = await storage.cleanupOldCheckpoints(cutoff);
    cleaned += dbCleaned;

    return cleaned;
  }

  // Helper methods
  
  private async getJob(jobId: string): Promise<GenerationJob | null> {
    return await storage.getGenerationJob(jobId);
  }

  private async updateJobStatus(jobId: string, status: string, message: string): Promise<void> {
    await storage.updateGenerationJob(jobId, { status });
  }

  private async persistCheckpoint(checkpoint: RecoveryCheckpoint): Promise<void> {
    await storage.createCheckpoint({
      jobId: checkpoint.jobId,
      step: checkpoint.step,
      data: checkpoint.data,
      metadata: checkpoint.metadata
    });
  }

  private async loadLatestCheckpoint(jobId: string): Promise<RecoveryCheckpoint | null> {
    const latest = await storage.getLatestCheckpoint(jobId);
    if (!latest) return null;
    
    return {
      id: latest.id,
      jobId: latest.jobId,
      step: latest.step,
      data: latest.data,
      timestamp: new Date(latest.createdAt),
      metadata: latest.metadata
    };
  }

  private async loadCheckpoints(jobId: string): Promise<RecoveryCheckpoint[]> {
    const checkpoints = await storage.getCheckpoints(jobId);
    
    return checkpoints.map(cp => ({
      id: cp.id,
      jobId: cp.jobId,
      step: cp.step,
      data: cp.data,
      timestamp: new Date(cp.createdAt),
      metadata: cp.metadata
    }));
  }

  private validateDataCollectionCheckpoint(data: any): boolean {
    return !!(data.system && data.controls && data.systemControls);
  }

  private validateNarrativeCheckpoint(data: any): boolean {
    return !!(data.narratives && Array.isArray(data.narratives));
  }

  private validateSSPCheckpoint(data: any): boolean {
    return !!(data.sections && data.systemInfo);
  }

  private getSkippedSteps(fromStep: string): string[] {
    const allSteps = [
      'collect_data',
      'generate_narratives',
      'generate_ssp',
      'generate_checklists',
      'generate_poam',
      'generate_sar'
    ];
    
    const stepIndex = allSteps.indexOf(fromStep);
    return stepIndex >= 0 ? allSteps.slice(0, stepIndex) : [];
  }

  private getRemainingSteps(fromStep: string): string[] {
    const allSteps = [
      'collect_data',
      'generate_narratives', 
      'generate_ssp',
      'generate_checklists',
      'generate_poam',
      'generate_sar'
    ];
    
    const stepIndex = allSteps.indexOf(fromStep);
    return stepIndex >= 0 ? allSteps.slice(stepIndex + 1) : allSteps;
  }

  private async generateDocumentType(
    docType: string,
    systemData: any,
    request: GenerationRequest,
    context: any
  ): Promise<void> {
    // Implementation would call appropriate generator
    console.log(`Generating document type: ${docType}`);
  }

  private async generateRemainingNarratives(
    remainingControls: any[],
    data: any,
    request: GenerationRequest,
    context: any
  ): Promise<void> {
    // Implementation would continue narrative generation
    console.log(`Generating narratives for ${remainingControls.length} remaining controls`);
  }

  private async continueWithRemainingDocTypes(
    context: any,
    request: GenerationRequest
  ): Promise<void> {
    // Implementation would continue with next document types
    console.log('Continuing with remaining document types');
  }

  private async continueSSPGeneration(
    sectionsCompleted: string[],
    data: any,
    request: GenerationRequest,
    context: any
  ): Promise<void> {
    // Implementation would continue SSP generation
    console.log(`Continuing SSP generation from section ${sectionsCompleted.length}`);
  }
}

// Export singleton instance
export const generationRecoveryService = new GenerationRecoveryService();
