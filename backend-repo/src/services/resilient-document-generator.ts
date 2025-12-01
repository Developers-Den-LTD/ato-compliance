// Resilient Document Generation Service
// Implements robust error handling, retry logic, and chunked processing
// Part of Epic 9 - Document Intelligence Pipeline

import { EventEmitter } from 'events';
import os from 'os';
import crypto from 'crypto';
import { storage } from '../storage';
import { modelRouter } from '../llm/model-router';
import { generationRecoveryService } from './generation-recovery';
import type { 
  GenerationRequest, 
  DocumentType,
  GenerationProgress,
  GenerationStep 
} from './generation-service';
import type { System, Control, SystemControl, Document } from '../schema';

export interface GenerationContext {
  jobId: string;
  systemId: string;
  system: System;
  controls: Control[];
  systemControls: SystemControl[];
  checkpoints: Map<string, any>;
  startTime: number;
}

export interface GenerationConfig {
  maxRetries: number;
  timeout: number;
  chunkSize: number;
  progressInterval: number;
  memoryThreshold: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ChunkResult {
  chunkIndex: number;
  success: boolean;
  data?: any;
  error?: string;
  retryCount: number;
}

export class GenerationError extends Error {
  constructor(
    message: string,
    public cause?: any,
    public recoverable: boolean = false,
    public suggestedActions?: string[]
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

export class ResilientDocumentGenerator extends EventEmitter {
  private readonly config: GenerationConfig = {
    maxRetries: 3,
    timeout: 300000, // 5 minutes
    chunkSize: 10,   // Process 10 controls at a time
    progressInterval: 5000, // Update every 5 seconds
    memoryThreshold: 500 * 1024 * 1024 // 500MB
  };

  constructor(config?: Partial<GenerationConfig>) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Generate document with comprehensive error handling
   */
  async generateDocument(request: GenerationRequest & { jobId?: string }): Promise<Document> {
    const context = await this.createGenerationContext(request);
    const startTime = Date.now();
    
    try {
      // Step 1: Pre-validation
      this.emit('progress', {
        jobId: context.jobId,
        stage: 'validation',
        message: 'Validating request and system data'
      });
      
      const validation = await this.validateRequest(request, context);
      if (!validation.valid) {
        throw new GenerationError(
          'Validation failed',
          validation.errors,
          false,
          ['Check system configuration', 'Verify all required data exists']
        );
      }

      // Step 2: Check resources
      this.emit('progress', {
        jobId: context.jobId,
        stage: 'resource_check',
        message: 'Checking system resources'
      });
      
      const resourceCheck = await this.validateResources();
      if (!resourceCheck.valid) {
        throw new GenerationError(
          'Insufficient resources',
          resourceCheck.errors,
          true,
          ['Free up memory', 'Reduce chunk size', 'Try again later']
        );
      }

      // Step 3: Process in chunks
      this.emit('progress', {
        jobId: context.jobId,
        stage: 'processing',
        message: 'Processing document in chunks'
      });
      
      const result = await this.processInChunks(request, context);
      
      // Step 4: Validate output
      this.emit('progress', {
        jobId: context.jobId,
        stage: 'finalization',
        message: 'Validating and finalizing document'
      });
      
      const document = await this.finalizeDocument(result, context);
      
      const duration = Date.now() - startTime;
      this.emit('complete', {
        jobId: context.jobId,
        duration,
        document
      });
      
      return document;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.handleError(error, request, context);
      
      this.emit('error', {
        jobId: context.jobId,
        duration,
        error: error instanceof GenerationError ? error : new GenerationError(
          'Document generation failed',
          error,
          this.isRecoverable(error)
        )
      });
      
      throw error;
    }
  }

  /**
   * Create generation context with all necessary data
   */
  private async createGenerationContext(request: GenerationRequest & { jobId?: string }): Promise<GenerationContext> {
    const system = await storage.getSystem(request.systemId);
    if (!system) {
      throw new GenerationError('System not found', null, false);
    }

    const [systemControls, controls] = await Promise.all([
      storage.getSystemControls(request.systemId),
      storage.getControlsBySystemId(request.systemId)
    ]);

    return {
      jobId: request.jobId || crypto.randomUUID(), // Use provided jobId or generate new one
      systemId: request.systemId,
      system,
      controls,
      systemControls,
      checkpoints: new Map(),
      startTime: Date.now()
    };
  }

  /**
   * Validate generation request and system data
   */
  private async validateRequest(
    request: GenerationRequest,
    context: GenerationContext
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check system data
    if (!context.system) {
      errors.push('System not found');
    }

    if (context.controls.length === 0) {
      errors.push('No controls found for system');
    }

    if (context.systemControls.length === 0) {
      warnings.push('No control implementations found');
    }

    // Check document types
    if (!request.documentTypes || request.documentTypes.length === 0) {
      errors.push('No document types specified');
    }

    // Validate templates if using template-based generation
    if (request.useTemplates) {
      try {
        // TODO: Validate template availability
        // For now, just check if template service is available
        const templateService = await import('./template-service');
        if (!templateService) {
          warnings.push('Template service not available, will use default generation');
        }
      } catch (error) {
        warnings.push('Template validation skipped: ' + error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate system resources
   */
  private async validateResources(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check memory
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

    if (freeMemory < this.config.memoryThreshold) {
      errors.push(`Insufficient memory: ${Math.round(freeMemory / 1024 / 1024)}MB available, need ${Math.round(this.config.memoryThreshold / 1024 / 1024)}MB`);
    } else if (memoryUsagePercent > 80) {
      warnings.push(`High memory usage: ${Math.round(memoryUsagePercent)}%`);
    }

    // Check CPU load
    const loadAvg = os.loadavg()[0]; // 1 minute average
    const cpuCount = os.cpus().length;
    const loadPerCpu = loadAvg / cpuCount;

    if (loadPerCpu > 0.9) {
      warnings.push(`High CPU load: ${Math.round(loadPerCpu * 100)}% per CPU`);
    }

    // Check database connectivity
    try {
      await storage.getSystem('00000000-0000-0000-0000-000000000000'); // Dummy query
    } catch (error) {
      errors.push('Database connection error');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Process document generation in chunks
   */
  private async processInChunks(
    request: GenerationRequest,
    context: GenerationContext
  ): Promise<any> {
    const chunks = this.createChunks(context.controls, this.config.chunkSize);
    const results: ChunkResult[] = [];
    
    for (const [index, chunk] of chunks.entries()) {
      const progress = ((index + 1) / chunks.length) * 100;
      
      this.emit('progress', {
        jobId: context.jobId,
        stage: 'processing',
        message: `Processing chunk ${index + 1} of ${chunks.length}`,
        progress
      });

      try {
        // Create checkpoint before processing
        await this.createCheckpoint(context, `chunk_${index}`, { 
          chunkIndex: index,
          controlIds: chunk.map(c => c.id)
        });

        const result = await this.processChunkWithRetry(
          chunk, 
          context, 
          request,
          index
        );
        
        results.push({
          chunkIndex: index,
          success: true,
          data: result,
          retryCount: 0
        });
        
      } catch (error) {
        if (this.isRecoverable(error) && await this.canResumeFromCheckpoint(context, index)) {
          // Try to recover from checkpoint
          const recovered = await this.recoverFromCheckpoint(context, index, request);
          if (recovered) {
            results.push(recovered);
            continue;
          }
        }
        
        throw new GenerationError(
          `Failed on chunk ${index + 1} of ${chunks.length}`,
          error,
          false,
          [`Review controls: ${chunk.map(c => c.id).join(', ')}`]
        );
      }
    }
    
    return this.assembleChunkResults(results, context);
  }

  /**
   * Process a single chunk with retry logic
   */
  private async processChunkWithRetry(
    chunk: Control[],
    context: GenerationContext,
    request: GenerationRequest,
    chunkIndex: number
  ): Promise<any> {
    let lastError: any;
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Add timeout wrapper
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Processing timeout')), this.config.timeout);
        });

        const processPromise = this.processControlChunk(chunk, context, request);
        
        const result = await Promise.race([processPromise, timeoutPromise]);
        return result;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < this.config.maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff
          
          this.emit('progress', {
            jobId: context.jobId,
            stage: 'retry',
            message: `Retrying chunk ${chunkIndex + 1} (attempt ${attempt + 2}/${this.config.maxRetries})`,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Process a chunk of controls
   */
  private async processControlChunk(
    controls: Control[],
    context: GenerationContext,
    request: GenerationRequest
  ): Promise<any> {
    // This is where the actual processing happens
    // For now, return placeholder data
    // In real implementation, this would generate narratives, evaluate compliance, etc.
    
    const chunkData = {
      controls: controls.map(control => ({
        id: control.id,
        title: control.title,
        status: context.systemControls.find(sc => sc.controlId === control.id)?.status || 'not_implemented',
        narrative: `Implementation pending for ${control.id}` // Placeholder
      })),
      timestamp: new Date()
    };
    
    return chunkData;
  }

  /**
   * Create chunks from controls array
   */
  private createChunks<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Create a checkpoint for recovery
   */
  private async createCheckpoint(
    context: GenerationContext,
    checkpointId: string,
    data: any
  ): Promise<void> {
    // Save to memory for fast access
    context.checkpoints.set(checkpointId, {
      timestamp: new Date(),
      data
    });
    
    // Also persist to database for recovery
    await generationRecoveryService.saveCheckpoint(
      context.jobId,
      checkpointId,
      data,
      { timestamp: new Date() }
    );
  }

  /**
   * Check if can resume from checkpoint
   */
  private async canResumeFromCheckpoint(context: GenerationContext, chunkIndex: number): Promise<boolean> {
    // Check memory first
    if (context.checkpoints.has(`chunk_${chunkIndex}`)) {
      return true;
    }
    
    // Check database
    const checkpoint = await storage.getCheckpoint(context.jobId, `chunk_${chunkIndex}`);
    return checkpoint !== undefined;
  }

  /**
   * Recover from checkpoint
   */
  private async recoverFromCheckpoint(
    context: GenerationContext,
    chunkIndex: number,
    request: GenerationRequest
  ): Promise<ChunkResult | null> {
    // Try memory first
    let checkpoint = context.checkpoints.get(`chunk_${chunkIndex}`);
    
    // If not in memory, try database
    if (!checkpoint) {
      const dbCheckpoint = await storage.getCheckpoint(context.jobId, `chunk_${chunkIndex}`);
      if (!dbCheckpoint) {
        return null;
      }
      checkpoint = {
        timestamp: new Date(dbCheckpoint.createdAt),
        data: dbCheckpoint.data
      };
    }
    
    // Don't just return checkpoint data - need to actually reprocess!
    // The checkpoint just tells us what to reprocess
    const controlIds = checkpoint.data.controlIds;
    const controlsToReprocess = context.controls.filter(c => controlIds.includes(c.id));
    
    if (controlsToReprocess.length === 0) {
      return null;
    }
    
    // Actually reprocess the chunk
    try {
      const result = await this.processControlChunk(controlsToReprocess, context, request);
      
      return {
        chunkIndex,
        success: true,
        data: result,
        retryCount: 1 // Indicate this was recovered
      };
    } catch (error) {
      // Recovery failed - return null to throw the error
      return null;
    }
  }

  /**
   * Assemble results from all chunks
   */
  private assembleChunkResults(results: ChunkResult[], context: GenerationContext): any {
    const allControls: any[] = [];
    
    for (const result of results) {
      if (result.success && result.data) {
        allControls.push(...result.data.controls);
      }
    }
    
    return {
      systemId: context.systemId,
      systemName: context.system.name,
      controls: allControls,
      totalControls: context.controls.length,
      processedControls: allControls.length,
      generatedAt: new Date()
    };
  }

  /**
   * Finalize document after processing
   */
  private async finalizeDocument(processedData: any, context: GenerationContext): Promise<Document> {
    // This would create the actual document structure
    // For now, return a placeholder
    return {
      id: context.jobId,
      jobId: context.jobId,
      systemId: context.systemId,
      type: 'ssp',
      title: `System Security Plan - ${context.system.name}`,
      version: '1.0',
      filePath: '',
      content: processedData,
      status: 'draft',
      generatedBy: 'ai_generated',
      metadata: {},
      templateId: null,
      template: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Handle errors with detailed logging
   */
  private async handleError(error: any, request: GenerationRequest, context: GenerationContext): Promise<void> {
    const errorDetails = {
      jobId: context.jobId,
      systemId: context.systemId,
      systemName: context.system?.name,
      documentTypes: request.documentTypes,
      error: {
        message: error.message || 'Unknown error',
        stack: error.stack,
        name: error.name,
        recoverable: this.isRecoverable(error)
      },
      context: {
        controlsTotal: context.controls?.length,
        checkpointsCreated: context.checkpoints.size,
        duration: Date.now() - context.startTime
      }
    };
    
    console.error('Document generation error:', JSON.stringify(errorDetails, null, 2));
    
    // In production, log to monitoring service
    // For now, just console log
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(error: any): boolean {
    if (error instanceof GenerationError) {
      return error.recoverable;
    }
    
    // Network errors are often recoverable
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Database connection errors might be recoverable
    if (error.message?.includes('database') || error.message?.includes('connection')) {
      return true;
    }
    
    // Memory errors are sometimes recoverable
    if (error.message?.includes('memory') || error.code === 'ENOMEM') {
      return true;
    }
    
    return false;
  }

  /**
   * Update progress tracking
   */
  updateProgress(jobId: string, update: Partial<GenerationProgress>): void {
    this.emit('progress', {
      jobId,
      ...update,
      timestamp: new Date()
    });
  }
}

// Export singleton instance
export const resilientDocumentGenerator = new ResilientDocumentGenerator();
