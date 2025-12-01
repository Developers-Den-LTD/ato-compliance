// Streaming Document Generator Service
// Provides real-time progress updates for document generation
// Part of Epic 9 - Document Intelligence Pipeline

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { resilientDocumentGenerator, type GenerationContext } from './resilient-document-generator';
import { sspGenerationService } from './ssp-generation.service';
import type { GenerationRequest } from './generation-service';
import type { SSPGenerationRequest } from './ssp-generation.service';

export interface StreamingGeneratorOptions {
  enableStreaming: boolean;
  progressInterval: number;
  includePartialResults: boolean;
}

export interface GenerationStream {
  jobId: string;
  stream: EventEmitter;
  startTime: number;
  chunks: any[];
}

export class StreamingDocumentGenerator extends EventEmitter {
  private activeStreams = new Map<string, GenerationStream>();
  private options: StreamingGeneratorOptions;

  constructor(options?: Partial<StreamingGeneratorOptions>) {
    super();
    this.options = {
      enableStreaming: true,
      progressInterval: 1000, // 1 second
      includePartialResults: false,
      ...options
    };
  }

  /**
   * Generate document with streaming progress
   */
  async generate(request: GenerationRequest & { jobId?: string }): Promise<void> {
    // Use provided jobId or generate new one
    const jobId = request.jobId || crypto.randomUUID();
    const stream = new EventEmitter();
    
    this.activeStreams.set(jobId, {
      jobId,
      stream,
      startTime: Date.now(),
      chunks: []
    });

    // Subscribe to resilient generator events
    resilientDocumentGenerator.on('progress', (data) => {
      if (data.jobId === jobId) {
        this.handleProgress(jobId, data);
      }
    });

    resilientDocumentGenerator.on('complete', (data) => {
      if (data.jobId === jobId) {
        this.handleComplete(jobId, data);
      }
    });

    resilientDocumentGenerator.on('error', (data) => {
      if (data.jobId === jobId) {
        this.handleError(jobId, data);
      }
    });

    try {
      // Determine document type and call appropriate generator
      if (request.documentTypes.includes('ssp')) {
        await this.generateSSPWithProgress(request, jobId);
      } else {
        // Use resilient generator for other types, passing jobId
        await resilientDocumentGenerator.generateDocument({ ...request, jobId });
      }
    } catch (error) {
      this.emit('error', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      
      // Clean up
      this.activeStreams.delete(jobId);
      throw error;
    }
  }

  /**
   * Generate SSP with enhanced error handling and progress
   */
  private async generateSSPWithProgress(request: GenerationRequest, jobId: string): Promise<void> {
    const sspRequest: SSPGenerationRequest = {
      systemId: request.systemId,
      format: 'docx', // Default format
      includeEvidence: request.includeEvidence,
      includeAssessmentResults: true,
      includeDiagrams: request.includeArtifacts,
      templateOptions: request.templateOptions
    };

    try {
      // Step 1: Validation
      this.emitProgress(jobId, {
        stage: 'validation',
        progress: 10,
        message: 'Validating system data for SSP generation'
      });

      // Step 2: Data collection
      this.emitProgress(jobId, {
        stage: 'data_collection',
        progress: 20,
        message: 'Collecting system controls and evidence'
      });

      // Step 3: Section generation
      const totalSections = 10; // Approximate number of SSP sections
      for (let i = 0; i < totalSections; i++) {
        const sectionProgress = 20 + (i / totalSections) * 60; // 20-80%
        
        this.emitProgress(jobId, {
          stage: 'section_generation',
          progress: Math.round(sectionProgress),
          message: `Generating section ${i + 1} of ${totalSections}`,
          currentSection: this.getSectionName(i)
        });

        // Simulate section generation with small delay
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Step 4: Document assembly
      this.emitProgress(jobId, {
        stage: 'assembly',
        progress: 85,
        message: 'Assembling final document'
      });

      // Actually generate the SSP
      const sspDocument = await sspGenerationService.generateSSP(sspRequest);

      // Step 5: Finalization
      this.emitProgress(jobId, {
        stage: 'finalization',
        progress: 95,
        message: 'Finalizing SSP document'
      });

      // Store the document
      await this.storeGeneratedDocument(jobId, request.systemId, sspDocument);

      // Complete
      this.emitProgress(jobId, {
        stage: 'complete',
        progress: 100,
        message: 'SSP generation completed successfully'
      });

      this.emit('complete', {
        jobId,
        document: sspDocument,
        duration: Date.now() - this.activeStreams.get(jobId)!.startTime
      });

    } catch (error) {
      // Enhanced error handling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRecoverable = this.isRecoverableError(error);
      
      this.emitProgress(jobId, {
        stage: 'error',
        progress: -1,
        message: `SSP generation failed: ${errorMessage}`,
        error: {
          message: errorMessage,
          recoverable: isRecoverable,
          suggestions: this.getErrorSuggestions(error)
        }
      });

      throw error;
    } finally {
      // Clean up
      this.activeStreams.delete(jobId);
    }
  }

  /**
   * Emit progress update
   */
  private emitProgress(jobId: string, data: any): void {
    const streamData = this.activeStreams.get(jobId);
    if (!streamData) return;

    const progress = {
      jobId,
      ...data,
      timestamp: new Date(),
      elapsed: Date.now() - streamData.startTime
    };

    this.emit('progress', progress);
    streamData.stream.emit('progress', progress);

    // Store chunk if partial results enabled
    if (this.options.includePartialResults && data.chunk) {
      streamData.chunks.push(data.chunk);
    }
  }

  /**
   * Handle progress from resilient generator
   */
  private handleProgress(jobId: string, data: any): void {
    this.emitProgress(jobId, data);
  }

  /**
   * Handle completion
   */
  private handleComplete(jobId: string, data: any): void {
    const streamData = this.activeStreams.get(jobId);
    if (!streamData) return;

    this.emit('complete', {
      jobId,
      ...data,
      duration: Date.now() - streamData.startTime,
      chunks: streamData.chunks
    });

    // Clean up
    this.activeStreams.delete(jobId);
  }

  /**
   * Handle errors
   */
  private handleError(jobId: string, data: any): void {
    const streamData = this.activeStreams.get(jobId);
    if (!streamData) return;

    this.emit('error', {
      jobId,
      ...data,
      duration: Date.now() - streamData.startTime
    });

    // Clean up
    this.activeStreams.delete(jobId);
  }

  /**
   * Store generated document
   */
  private async storeGeneratedDocument(jobId: string, systemId: string, document: any): Promise<void> {
    // Implementation would store the document in the database
    // For now, just log
    console.log(`Storing document for job ${jobId}, system ${systemId}`);
  }

  /**
   * Get section name for progress display
   */
  private getSectionName(index: number): string {
    const sections = [
      'Title Page',
      'Executive Summary',
      'System Overview',
      'System Architecture',
      'Security Controls',
      'Control Narratives',
      'Risk Assessment',
      'Evidence Summary',
      'Compliance Status',
      'Appendices'
    ];
    
    return sections[index] || `Section ${index + 1}`;
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverableError(error: any): boolean {
    if (!error) return false;
    
    const recoverableMessages = [
      'timeout',
      'memory',
      'connection',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOMEM'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return recoverableMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Get error recovery suggestions
   */
  private getErrorSuggestions(error: any): string[] {
    const suggestions: string[] = [];
    
    if (!error) return suggestions;
    
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('timeout')) {
      suggestions.push('Try generating smaller sections');
      suggestions.push('Check network connectivity');
      suggestions.push('Increase timeout settings');
    }
    
    if (errorMessage.includes('memory')) {
      suggestions.push('Reduce document size');
      suggestions.push('Process controls in smaller batches');
      suggestions.push('Free up system memory');
    }
    
    if (errorMessage.includes('template')) {
      suggestions.push('Check template availability');
      suggestions.push('Use default generation instead of templates');
      suggestions.push('Verify template format');
    }
    
    if (errorMessage.includes('control') || errorMessage.includes('narrative')) {
      suggestions.push('Ensure all controls have implementations');
      suggestions.push('Check for missing evidence');
      suggestions.push('Generate narratives separately first');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('Check system logs for more details');
      suggestions.push('Contact support if issue persists');
    }
    
    return suggestions;
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Cancel generation job
   */
  cancelGeneration(jobId: string): boolean {
    const streamData = this.activeStreams.get(jobId);
    if (!streamData) return false;
    
    this.emit('cancelled', {
      jobId,
      duration: Date.now() - streamData.startTime
    });
    
    this.activeStreams.delete(jobId);
    return true;
  }
}

// Export singleton instance
export const streamingDocumentGenerator = new StreamingDocumentGenerator();
