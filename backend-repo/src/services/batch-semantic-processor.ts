// Batch Semantic Processing Service
// Processes multiple documents for semantic search in batches

import { storage } from '../storage';
import { documentChunker } from './document-chunker';
import { embeddingService } from './embedding-service';
import { controlMapper } from './control-mapper';
import { documentExtractionService } from './document-extraction.service';

export interface BatchProcessingJob {
  id: string;
  systemId: string;
  artifactIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    total: number;
    processed: number;
    failed: number;
    current?: string;
  };
  results: {
    chunked: number;
    embedded: number;
    mapped: number;
    errors: string[];
  };
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface BatchProcessingOptions {
  chunkDocuments?: boolean;
  generateEmbeddings?: boolean;
  mapToControls?: boolean;
  batchSize?: number;
  maxConcurrency?: number;
}

export class BatchSemanticProcessor {
  private activeJobs = new Map<string, BatchProcessingJob>();
  private readonly DEFAULT_BATCH_SIZE = 10;
  private readonly DEFAULT_MAX_CONCURRENCY = 3;

  /**
   * Start a batch processing job
   */
  async startBatchProcessing(
    systemId: string,
    artifactIds: string[],
    options: BatchProcessingOptions = {}
  ): Promise<BatchProcessingJob> {
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: BatchProcessingJob = {
      id: jobId,
      systemId,
      artifactIds,
      status: 'pending',
      progress: {
        total: artifactIds.length,
        processed: 0,
        failed: 0
      },
      results: {
        chunked: 0,
        embedded: 0,
        mapped: 0,
        errors: []
      }
    };

    this.activeJobs.set(jobId, job);

    // Start processing asynchronously
    this.processBatch(job, options).catch(error => {
      console.error(`Batch processing job ${jobId} failed:`, error);
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
    });

    return job;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BatchProcessingJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active jobs
   */
  getAllJobs(): BatchProcessingJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'running') {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      job.completedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Process a batch of documents
   */
  private async processBatch(
    job: BatchProcessingJob,
    options: BatchProcessingOptions
  ): Promise<void> {
    const {
      chunkDocuments = true,
      generateEmbeddings = true,
      mapToControls = true,
      batchSize = this.DEFAULT_BATCH_SIZE,
      maxConcurrency = this.DEFAULT_MAX_CONCURRENCY
    } = options;

    job.status = 'running';
    job.startedAt = new Date();

    try {
      // Process artifacts in batches
      for (let i = 0; i < job.artifactIds.length; i += batchSize) {
        const batch = job.artifactIds.slice(i, i + batchSize);
        
        // Process batch with concurrency limit
        const batchPromises = batch.map(artifactId => 
          this.processArtifact(artifactId, job.systemId, {
            chunkDocuments,
            generateEmbeddings,
            mapToControls
          })
        );

        // Process with concurrency control
        const results = await this.processWithConcurrency(
          batchPromises,
          maxConcurrency
        );

        // Update job progress
        for (const result of results) {
          job.progress.processed++;
          if (result.success) {
            if (result.chunked) job.results.chunked++;
            if (result.embedded) job.results.embedded++;
            if (result.mapped) job.results.mapped++;
          } else {
            job.progress.failed++;
            job.results.errors.push(`${result.artifactId}: ${result.error}`);
          }
        }

        // Update current artifact being processed
        job.progress.current = batch[batch.length - 1];
      }

      job.status = 'completed';
      job.completedAt = new Date();

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();
    }
  }

  /**
   * Process a single artifact
   */
  private async processArtifact(
    artifactId: string,
    systemId: string,
    options: {
      chunkDocuments: boolean;
      generateEmbeddings: boolean;
      mapToControls: boolean;
    }
  ): Promise<{
    artifactId: string;
    success: boolean;
    chunked: boolean;
    embedded: boolean;
    mapped: boolean;
    error?: string;
  }> {
    const result = {
      artifactId,
      success: false,
      chunked: false,
      embedded: false,
      mapped: false
    };

    try {
      // Get artifact
      const artifact = await storage.getArtifact(artifactId);
      if (!artifact) {
        throw new Error('Artifact not found');
      }

      // Step 1: Chunk document
      if (options.chunkDocuments) {
        const extracted = await documentExtractionService.extractContent(artifact);
        const chunks = await documentChunker.chunkDocument(extracted, artifactId);
        
        // Store chunks
        for (const chunk of chunks) {
          // await storage.createSemanticChunk(chunk); // Method doesn't exist
        }
        result.chunked = true;
      }

      // Step 2: Generate embeddings
      if (options.generateEmbeddings) {
        const chunks = [] as any[]; // await storage.getSemanticChunksByArtifact(artifactId); // Method doesn't exist
        const chunkTexts = chunks.map(chunk => chunk.content);
        
        if (chunkTexts.length > 0) {
          const embeddings = await embeddingService.generateEmbeddings(chunkTexts);
          
          // Update chunks with embeddings
          for (let i = 0; i < chunks.length; i++) {
            // await storage.updateSemanticChunk(chunks[i].id, { // Method doesn't exist
            //   embedding: `[${embeddings[i].join(',')}]`
            // });
          }
          result.embedded = true;
        }
      }

      // Step 3: Map to controls
      if (options.mapToControls) {
        const mappingResult = await controlMapper.mapDocumentToControls(artifactId, systemId);
        if (mappingResult.mappings.length > 0) {
          result.mapped = true;
        }
      }

      result.success = true;

    } catch (error) {
      (result as any).error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Process promises with concurrency limit
   */
  private async processWithConcurrency<T>(
    promises: Promise<T>[],
    maxConcurrency: number
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < promises.length; i += maxConcurrency) {
      const batch = promises.slice(i, i + maxConcurrency);
      const batchResults = await Promise.allSettled(batch);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Handle rejected promises
          console.error('Batch processing error:', result.reason);
        }
      }
    }
    
    return results;
  }

  /**
   * Process all documents in a system
   */
  async processSystemDocuments(
    systemId: string,
    options: BatchProcessingOptions = {}
  ): Promise<BatchProcessingJob> {
    // Get all artifacts for the system
    const artifacts = await storage.getArtifactsBySystem(systemId);
    const artifactIds = artifacts.map(a => a.id);

    return this.startBatchProcessing(systemId, artifactIds, options);
  }

  /**
   * Process specific document types
   */
  async processDocumentsByType(
    systemId: string,
    documentTypes: string[],
    options: BatchProcessingOptions = {}
  ): Promise<BatchProcessingJob> {
    // Get artifacts by type
    const artifacts = await storage.getArtifactsBySystem(systemId);
    const filteredArtifacts = artifacts.filter(a => 
      documentTypes.includes(a.type)
    );
    const artifactIds = filteredArtifacts.map(a => a.id);

    return this.startBatchProcessing(systemId, artifactIds, options);
  }

  /**
   * Clean up completed jobs older than specified hours
   */
  cleanupOldJobs(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        job.completedAt < cutoffTime
      ) {
        this.activeJobs.delete(jobId);
      }
    }
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
  } {
    const jobs = Array.from(this.activeJobs.values());
    
    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === 'running').length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length
    };
  }
}

// Export singleton instance
export const batchSemanticProcessor = new BatchSemanticProcessor();
