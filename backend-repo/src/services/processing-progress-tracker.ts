// Processing Progress Tracker Service
// Real-time progress tracking for document processing jobs

import { EventEmitter } from 'events';

export interface ProcessingProgress {
  artifactId: string;
  jobId: string;
  status: 'pending' | 'extracting' | 'analyzing' | 'searching' | 'mapping' | 'creating_evidence' | 'completing' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  stepName: string;
  stepDescription: string;
  progress: number; // 0-100
  startTime: Date;
  estimatedCompletion?: Date;
  details?: {
    wordCount?: number;
    sectionsFound?: number;
    controlsAnalyzed?: number;
    evidenceCreated?: number;
    mappingsCreated?: number;
    processingTime?: number;
  };
  errors?: string[];
}

export interface ProcessingStep {
  name: string;
  description: string;
  weight: number; // Relative weight for progress calculation
}

export class ProcessingProgressTracker extends EventEmitter {
  private activeJobs = new Map<string, ProcessingProgress>();
  private jobHistory = new Map<string, ProcessingProgress>();
  private maxHistorySize = 100;

  private readonly processingSteps: ProcessingStep[] = [
    { name: 'Initializing', description: 'Preparing document for processing', weight: 5 },
    { name: 'Extracting Content', description: 'Extracting text and structure from document', weight: 20 },
    { name: 'NLP Analysis', description: 'Analyzing content with AI for security insights', weight: 25 },
    { name: 'Semantic Search', description: 'Finding relevant controls and requirements', weight: 20 },
    { name: 'Control Mapping', description: 'Mapping document to security controls', weight: 15 },
    { name: 'Creating Evidence', description: 'Generating evidence records', weight: 10 },
    { name: 'Finalizing', description: 'Saving results and cleaning up', weight: 5 }
  ];

  /**
   * Start tracking a new processing job
   */
  startTracking(artifactId: string, jobId?: string): string {
    const actualJobId = jobId || this.generateJobId();
    
    const progress: ProcessingProgress = {
      artifactId,
      jobId: actualJobId,
      status: 'pending',
      currentStep: 0,
      totalSteps: this.processingSteps.length,
      stepName: this.processingSteps[0].name,
      stepDescription: this.processingSteps[0].description,
      progress: 0,
      startTime: new Date(),
      details: {},
      errors: []
    };

    this.activeJobs.set(actualJobId, progress);
    this.emit('progress', progress);
    
    console.log(`Started tracking processing job ${actualJobId} for artifact ${artifactId}`);
    return actualJobId;
  }

  /**
   * Update progress for a processing step
   */
  updateStep(jobId: string, stepIndex: number, stepProgress: number = 100, details?: any): void {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      console.warn(`Job ${jobId} not found for progress update`);
      return;
    }

    if (stepIndex >= this.processingSteps.length) {
      console.warn(`Invalid step index ${stepIndex} for job ${jobId}`);
      return;
    }

    const step = this.processingSteps[stepIndex];
    job.currentStep = stepIndex;
    job.stepName = step.name;
    job.stepDescription = step.description;
    
    // Calculate overall progress based on step weights
    let totalWeight = 0;
    let completedWeight = 0;
    
    for (let i = 0; i < this.processingSteps.length; i++) {
      const stepWeight = this.processingSteps[i].weight;
      totalWeight += stepWeight;
      
      if (i < stepIndex) {
        completedWeight += stepWeight;
      } else if (i === stepIndex) {
        completedWeight += (stepWeight * stepProgress) / 100;
      }
    }
    
    job.progress = Math.round((completedWeight / totalWeight) * 100);
    
    // Update status based on step
    job.status = this.getStatusFromStep(stepIndex);
    
    // Update details
    if (details) {
      job.details = { ...job.details, ...details };
    }

    // Estimate completion time
    if (job.progress > 0) {
      const elapsed = Date.now() - job.startTime.getTime();
      const estimatedTotal = (elapsed / job.progress) * 100;
      job.estimatedCompletion = new Date(job.startTime.getTime() + estimatedTotal);
    }

    this.activeJobs.set(jobId, job);
    this.emit('progress', job);
    
    console.log(`Job ${jobId}: ${job.stepName} - ${job.progress}%`);
  }

  /**
   * Mark a job as completed
   */
  completeJob(jobId: string, details?: any): void {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      console.warn(`Job ${jobId} not found for completion`);
      return;
    }

    job.status = 'completed';
    job.progress = 100;
    job.currentStep = this.processingSteps.length - 1;
    job.stepName = 'Completed';
    job.stepDescription = 'Document processing completed successfully';
    
    if (details) {
      job.details = { ...job.details, ...details };
      if (details.processingTime) {
        job.details.processingTime = details.processingTime;
      }
    }

    // Move to history
    this.activeJobs.delete(jobId);
    this.addToHistory(job);
    
    this.emit('progress', job);
    this.emit('completed', job);
    
    console.log(`Job ${jobId} completed in ${job.details?.processingTime || 'unknown'}ms`);
  }

  /**
   * Mark a job as failed
   */
  failJob(jobId: string, error: string, details?: any): void {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      console.warn(`Job ${jobId} not found for failure`);
      return;
    }

    job.status = 'failed';
    job.stepDescription = `Failed: ${error}`;
    job.errors = job.errors || [];
    job.errors.push(error);
    
    if (details) {
      job.details = { ...job.details, ...details };
    }

    // Move to history
    this.activeJobs.delete(jobId);
    this.addToHistory(job);
    
    this.emit('progress', job);
    this.emit('failed', job);
    
    console.log(`Job ${jobId} failed: ${error}`);
  }

  /**
   * Get current progress for a job
   */
  getProgress(jobId: string): ProcessingProgress | null {
    return this.activeJobs.get(jobId) || this.jobHistory.get(jobId) || null;
  }

  /**
   * Get progress for all active jobs
   */
  getAllActiveProgress(): ProcessingProgress[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get progress for jobs by artifact ID
   */
  getProgressByArtifact(artifactId: string): ProcessingProgress | null {
    // Check active jobs first
    for (const job of this.activeJobs.values()) {
      if (job.artifactId === artifactId) {
        return job;
      }
    }
    
    // Check recent history
    for (const job of this.jobHistory.values()) {
      if (job.artifactId === artifactId) {
        return job;
      }
    }
    
    return null;
  }

  /**
   * Clear completed jobs older than specified time
   */
  cleanupHistory(olderThanHours: number = 24): void {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    for (const [jobId, job] of this.jobHistory.entries()) {
      if (job.startTime < cutoff) {
        this.jobHistory.delete(jobId);
      }
    }
    
    console.log(`Cleaned up processing history older than ${olderThanHours} hours`);
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getStatusFromStep(stepIndex: number): ProcessingProgress['status'] {
    const statusMap: ProcessingProgress['status'][] = [
      'pending',
      'extracting', 
      'analyzing',
      'searching',
      'mapping',
      'creating_evidence',
      'completing'
    ];
    
    return statusMap[stepIndex] || 'pending';
  }

  private addToHistory(job: ProcessingProgress): void {
    this.jobHistory.set(job.jobId, job);
    
    // Limit history size
    if (this.jobHistory.size > this.maxHistorySize) {
      const firstKey = this.jobHistory.keys().next().value;
      this.jobHistory.delete(firstKey);
    }
  }
}

// Singleton instance
export const processingProgressTracker = new ProcessingProgressTracker();

// Auto-cleanup every hour
setInterval(() => {
  processingProgressTracker.cleanupHistory(24);
}, 60 * 60 * 1000);
