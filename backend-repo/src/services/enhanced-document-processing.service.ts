// Enhanced Document Processing Service
// Orchestrates the complete document processing pipeline

import { storage } from '../storage';
import { documentExtractionService, ExtractedContent } from './document-extraction.service';
import { nlpAnalysisService, NLPAnalysisResult } from './nlp-analysis.service';
import { semanticSearchService, SemanticSearchResult } from './semantic-search.service';
import { ControlMappingService, ControlMapping, ControlRelationship } from './control-mapping.service';
import { processingProgressTracker } from './processing-progress-tracker';
import { stigEvaluationService, STIGEvaluationResult } from './stig-evaluation.service';
import type { StructuredSection } from './document-structure-extractor';
import type { InsertDocumentSection } from "../schema";
import crypto from 'crypto';
import { Artifact, Control, Evidence, System } from "../schema";

export interface DocumentProcessingResult {
  artifactId: string;
  jobId?: string;
  extractedContent: ExtractedContent;
  nlpAnalysis: NLPAnalysisResult;
  controlRelevance: SemanticSearchResult[];
  evidenceCreated: Evidence[];
  controlMappings?: {
    mappings: ControlMapping[];
    relationships: ControlRelationship[];
    totalProcessed: number;
    processingTime: number;
  };
  stigEvaluation?: STIGEvaluationResult;
  processingTime: number;
  success: boolean;
  errors: string[];
}

export interface ProcessingOptions {
  useAI: boolean;
  createEvidence: boolean;
  analyzeAllControls: boolean;
  mapToControls?: boolean;
  evaluateSTIG?: boolean;
  controlIds?: string[];
  systemContext?: any;
}

export class EnhancedDocumentProcessingService {
  private async persistDocumentSections(artifactId: string, sections: StructuredSection[]): Promise<void> {
    if (!sections || sections.length === 0) {
      return;
    }
    await storage.deleteDocumentSectionsByArtifact(artifactId);
    const stack: Array<{ parentId?: string; node: StructuredSection; index: number }> = [];
    sections.forEach((section, index) => stack.push({ parentId: undefined, node: section, index }));
    const records: InsertDocumentSection[] = [];

    while (stack.length > 0) {
      const { parentId, node, index } = stack.pop()!;
      const id = crypto.randomUUID();
      records.push({
        id,
        artifactId,
        parentSectionId: parentId,
        sectionIndex: index,
        sectionLevel: node.level,
        sectionType: node.type,
        title: node.title,
        content: node.content,
        metadata: node.metadata ?? {}
      });

      if (node.children && node.children.length > 0) {
        node.children.forEach((child, childIndex) => {
          stack.push({ parentId: id, node: child, index: childIndex });
        });
      }
    }

    await storage.createDocumentSections(records);
  }

  /**
   * Process a document through the complete pipeline
   */
  async processDocument(
    artifact: Artifact,
    systemId: string,
    options: ProcessingOptions = {
      useAI: true,
      createEvidence: true,
      analyzeAllControls: true,
      mapToControls: true
    }
  ): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let extractedContent: ExtractedContent | null = null;
    let nlpAnalysis: NLPAnalysisResult | null = null;
    let controlRelevance: SemanticSearchResult[] = [];
    let evidenceCreated: Evidence[] = [];

    // Start progress tracking
    const jobId = processingProgressTracker.startTracking(artifact.id);

    try {
      console.log(`Processing document: ${artifact.name} (${artifact.type}) - Job: ${jobId}`);
      
      // Step 1: Extract document content
      processingProgressTracker.updateStep(jobId, 1, 0, { 
        stepDetails: 'Analyzing document structure and extracting text content'
      });
      console.log('Step 1: Extracting document content...');
      extractedContent = await documentExtractionService.extractContent(artifact);
      processingProgressTracker.updateStep(jobId, 1, 100, { 
        wordCount: extractedContent.metadata.wordCount,
        sectionsFound: extractedContent.metadata.sections?.length || 0
      });
      console.log(`Extracted ${extractedContent.metadata.wordCount} words from ${extractedContent.metadata.sections?.length || 0} sections`);

      // Step 2: Get controls to analyze
      const controls = await this.getControlsToAnalyze(systemId, options);
      console.log(`Analyzing against ${controls.length} controls`);

      // Step 3: NLP Analysis
      if (options.useAI) {
        processingProgressTracker.updateStep(jobId, 2, 0, { 
          controlsAnalyzed: controls.length,
          stepDetails: 'Analyzing document content with AI for security insights'
        });
        console.log('Step 2: Performing NLP analysis...');
        nlpAnalysis = await nlpAnalysisService.analyzeDocument(
          extractedContent,
          controls,
          options.systemContext
        );
        processingProgressTracker.updateStep(jobId, 2, 100, { 
          securityControlsFound: nlpAnalysis.securityControls.length,
          keyTopicsFound: nlpAnalysis.keyTopics.length
        });
        console.log(`NLP analysis completed. Found ${nlpAnalysis.securityControls.length} security controls and ${nlpAnalysis.keyTopics.length} key topics`);
      }

      // Step 4: Semantic search for each control
      processingProgressTracker.updateStep(jobId, 3, 0, { 
        stepDetails: 'Finding relevant controls and requirements using semantic search'
      });
      console.log('Step 3: Performing semantic search...');
      controlRelevance = await this.performSemanticSearch(
        extractedContent,
        controls,
        options.systemContext
      );
      processingProgressTracker.updateStep(jobId, 3, 100, { 
        controlsSearched: controlRelevance.length
      });
      console.log(`Semantic search completed for ${controlRelevance.length} controls`);

      // Step 5: Create evidence records
      if (options.createEvidence) {
        processingProgressTracker.updateStep(jobId, 5, 0, { 
          stepDetails: 'Creating evidence records from analysis results'
        });
        console.log('Step 4: Creating evidence records...');
        evidenceCreated = await this.createEvidenceRecords(
          artifact,
          systemId,
          controlRelevance,
          nlpAnalysis
        );
        processingProgressTracker.updateStep(jobId, 5, 100, { 
          evidenceCreated: evidenceCreated.length
        });
        console.log(`Created ${evidenceCreated.length} evidence records`);
      }

      // Step 6: Map document to controls (if enabled)
      let controlMappings: {
        mappings: ControlMapping[];
        relationships: ControlRelationship[];
        totalProcessed: number;
        processingTime: number;
      } | null = null;
      
      if (options.mapToControls !== false) {
        processingProgressTracker.updateStep(jobId, 4, 0, { 
          stepDetails: 'Mapping document content to security controls'
        });
        console.log('Step 5: Mapping document to controls...');
        try {
          const controlMappingService = new ControlMappingService();
          const mappingResult = await controlMappingService.mapDocumentToControls({
            documentId: artifact.id,
            framework: 'NIST-800-53',
            minConfidence: 70,
            includeRelationships: true
          });
          
          controlMappings = {
            mappings: mappingResult.mappings,
            relationships: mappingResult.relationships,
            totalProcessed: mappingResult.totalProcessed,
            processingTime: mappingResult.processingTime
          };
          
          processingProgressTracker.updateStep(jobId, 4, 100, { 
            mappingsCreated: mappingResult.mappings.length,
            relationshipsFound: mappingResult.relationships.length
          });
          console.log(`Control mapping completed: ${mappingResult.mappings.length} mappings created in ${mappingResult.processingTime}ms`);
        } catch (mappingError) {
          console.error('Error during control mapping:', mappingError);
          const errorMessage = mappingError instanceof Error ? mappingError.message : 'Unknown error during control mapping';
          errors.push(`Control mapping failed: ${errorMessage}`);
        }
      }

      // Step 7: STIG Evaluation (if applicable)
      let stigEvaluation: STIGEvaluationResult | null = null;
      if (options.evaluateSTIG !== false) {
        try {
          // Get system details
          const system = await storage.getSystem(systemId);
          if (system && system.stigProfiles && system.stigProfiles.length > 0) {
            console.log('Step 6: Evaluating STIG compliance...');
            stigEvaluation = await stigEvaluationService.evaluateArtifact(
              artifact,
              system as System,
              {
                includeNotApplicable: false,
                extractTechnicalData: true,
                generateNarratives: true,
                jobId
              }
            );
            
            if (stigEvaluation) {
              console.log(`STIG evaluation completed: ${stigEvaluation.complianceScore}% compliant`);
              
              // Create STIG evidence records if evaluation found issues
              if (options.createEvidence && stigEvaluation.categorizedResults.failed > 0) {
                const stigEvidence = await stigEvaluationService.createSTIGEvidence(
                  stigEvaluation,
                  systemId
                );
                evidenceCreated.push(...stigEvidence);
                console.log(`Created ${stigEvidence.length} STIG evidence records`);
              }
            }
          }
        } catch (stigError) {
          console.error('Error during STIG evaluation:', stigError);
          const errorMessage = stigError instanceof Error ? stigError.message : 'Unknown error during STIG evaluation';
          errors.push(`STIG evaluation failed: ${errorMessage}`);
        }
      }
      
      // Step 8: Update artifact with processing results
      processingProgressTracker.updateStep(jobId, 6, 0, { 
        stepDetails: 'Saving processing results to database'
      });
      await this.updateArtifactWithResults(artifact, extractedContent, nlpAnalysis, stigEvaluation);

      const processingTime = Date.now() - startTime;
      processingProgressTracker.completeJob(jobId, { 
        processingTime,
        totalWordCount: extractedContent.metadata.wordCount,
        totalEvidence: evidenceCreated.length,
        totalMappings: controlMappings?.mappings.length || 0
      });
      console.log(`Document processing completed in ${processingTime}ms`);

      return {
        artifactId: artifact.id,
        jobId,
        extractedContent,
        nlpAnalysis: nlpAnalysis!,
        controlRelevance,
        evidenceCreated,
        controlMappings,
        stigEvaluation: stigEvaluation || undefined,
        processingTime,
        success: true,
        errors
      };

    } catch (error) {
      console.error('Error processing document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during document processing';
      errors.push(errorMessage);
      
      processingProgressTracker.failJob(jobId, errorMessage, { 
        processingTime: Date.now() - startTime
      });
      
      return {
        artifactId: artifact.id,
        jobId,
        extractedContent: extractedContent!,
        nlpAnalysis: nlpAnalysis!,
        controlRelevance,
        evidenceCreated,
        controlMappings: null,
        stigEvaluation: undefined,
        processingTime: Date.now() - startTime,
        success: false,
        errors
      };
    }
  }

  /**
   * Process multiple documents in batch
   */
  async processDocuments(
    artifacts: Artifact[],
    systemId: string,
    options: ProcessingOptions = {
      useAI: true,
      createEvidence: true,
      analyzeAllControls: true
    }
  ): Promise<DocumentProcessingResult[]> {
    console.log(`Processing ${artifacts.length} documents in batch`);

    const results: DocumentProcessingResult[] = [];
    
    for (const artifact of artifacts) {
      try {
        const result = await this.processDocument(artifact, systemId, options);
        results.push(result);
      } catch (error) {
        console.error(`Error processing artifact ${artifact.id}:`, error);
        results.push({
          artifactId: artifact.id,
          extractedContent: {} as ExtractedContent,
          nlpAnalysis: {} as NLPAnalysisResult,
          controlRelevance: [],
          evidenceCreated: [],
          processingTime: 0,
          success: false,
          errors: [error.message]
        });
      }
    }

    return results;
  }

  /**
   * Get controls to analyze based on options
   */
  private async getControlsToAnalyze(systemId: string, options: ProcessingOptions): Promise<Control[]> {
    if (options.controlIds && options.controlIds.length > 0) {
      // Analyze specific controls
      const controls = [];
      for (const controlId of options.controlIds) {
        const control = await storage.getControl(controlId);
        if (control) controls.push(control);
      }
      return controls;
    } else if (options.analyzeAllControls) {
      // Analyze all controls assigned to the system
      const systemControls = await storage.getSystemControls(systemId);
      const controls = [];
      for (const sc of systemControls) {
        const control = await storage.getControl(sc.controlId);
        if (control) controls.push(control);
      }
      return controls;
    } else {
      // Analyze a subset of controls (first 10)
      const systemControls = await storage.getSystemControls(systemId);
      const controls = [];
      for (const sc of systemControls.slice(0, 10)) {
        const control = await storage.getControl(sc.controlId);
        if (control) controls.push(control);
      }
      return controls;
    }
  }

  /**
   * Perform semantic search for each control
   */
  private async performSemanticSearch(
    content: ExtractedContent,
    controls: Control[],
    systemContext?: any
  ): Promise<SemanticSearchResult[]> {
    const results: SemanticSearchResult[] = [];

    for (const control of controls) {
      try {
        const searchQuery = {
          controlId: control.id,
          controlTitle: control.title,
          controlDescription: control.description,
          controlRequirements: control.requirements,
          systemContext
        };

        const result = await semanticSearchService.findRelevantSections(
          content,
          searchQuery
        );

        results.push(result);
      } catch (error) {
        console.error(`Error performing semantic search for control ${control.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Create evidence records from analysis results
   */
  private async createEvidenceRecords(
    artifact: Artifact,
    systemId: string,
    controlRelevance: SemanticSearchResult[],
    nlpAnalysis?: NLPAnalysisResult
  ): Promise<Evidence[]> {
    const evidenceRecords: Evidence[] = [];

    for (const result of controlRelevance) {
      // Only create evidence for controls with reasonable relevance
      if (result.overallRelevance > 30) {
        try {
          const evidence: Omit<Evidence, 'id' | 'createdAt' | 'updatedAt'> = {
            systemId,
            controlId: result.controlId,
            artifactId: artifact.id,
            type: 'document',
            title: `Evidence for ${result.controlId}`,
            description: `Evidence from ${artifact.name} for control ${result.controlId}`,
            implementation: result.implementationSummary,
            assessorNotes: `Relevance Score: ${result.overallRelevance}%. Found ${result.relevantSections.length} relevant sections.`,
            status: result.overallRelevance > 70 ? 'satisfies' : 
                   result.overallRelevance > 40 ? 'partially_satisfies' : 'does_not_satisfy',
            metadata: { relevanceScore: result.overallRelevance },
            findingId: null
          };

          const createdEvidence = await storage.createEvidence(evidence);
          evidenceRecords.push(createdEvidence);
        } catch (error) {
          console.error(`Error creating evidence for control ${result.controlId}:`, error);
        }
      }
    }

    return evidenceRecords;
  }

  /**
   * Update artifact with processing results
   */
  private async updateArtifactWithResults(
    artifact: Artifact,
    extractedContent: ExtractedContent,
    nlpAnalysis?: NLPAnalysisResult,
    stigEvaluation?: STIGEvaluationResult | null
  ): Promise<void> {
    try {
      const updatedMetadata = {
        ...(typeof artifact.metadata === 'object' && artifact.metadata !== null ? artifact.metadata : {}),
        processingResults: {
          extractedContent: {
            wordCount: extractedContent.metadata.wordCount,
            sectionCount: extractedContent.metadata.sections?.length || 0,
            language: extractedContent.metadata.language,
            entities: extractedContent.metadata.entities,
            keywords: extractedContent.metadata.keywords
          },
          nlpAnalysis: nlpAnalysis ? {
            summary: nlpAnalysis.summary,
            keyTopics: nlpAnalysis.keyTopics,
            securityControls: nlpAnalysis.securityControls,
            confidence: nlpAnalysis.confidence
          } : null,
          stigEvaluation: stigEvaluation ? {
            profile: stigEvaluation.stigProfile,
            complianceScore: stigEvaluation.complianceScore,
            rulesEvaluated: stigEvaluation.evaluatedRules.length,
            rulesPassed: stigEvaluation.categorizedResults.passed,
            rulesFailed: stigEvaluation.categorizedResults.failed,
            evaluatedAt: stigEvaluation.evaluatedAt.toISOString(),
            categorizedResults: stigEvaluation.categorizedResults
          } : null,
          processedAt: new Date().toISOString()
        }
      };

      await storage.updateArtifact(artifact.id, {
        processingStatus: 'completed',
        processedAt: new Date(),
        metadata: updatedMetadata
      });
    } catch (error) {
      console.error('Error updating artifact with processing results:', error);
    }
  }

  /**
   * Get processing status for an artifact
   */
  async getProcessingStatus(artifactId: string): Promise<{
    processed: boolean;
    lastProcessed?: string;
    wordCount?: number;
    sectionCount?: number;
    evidenceCount?: number;
    currentProgress?: any;
  }> {
    try {
      // Check for active or recent processing job
      const currentProgress = processingProgressTracker.getProgressByArtifact(artifactId);
      
      const artifact = await storage.getArtifact(artifactId);
      if (!artifact) {
        return { 
          processed: false,
          currentProgress: currentProgress || null
        };
      }

      const processingResults = (artifact.metadata as any)?.processingResults;
      if (!processingResults && !currentProgress) {
        return { 
          processed: false,
          currentProgress: null
        };
      }

      // Get evidence count for this artifact if processed
      let evidenceCount = 0;
      if (processingResults) {
        const evidence = await storage.getEvidenceByArtifact(artifactId);
        evidenceCount = evidence.length;
      }
      
      return {
        processed: !!processingResults,
        lastProcessed: processingResults?.processedAt,
        wordCount: processingResults?.extractedContent?.wordCount,
        sectionCount: processingResults?.extractedContent?.sectionCount,
        evidenceCount,
        currentProgress
      };
    } catch (error) {
      console.error('Error getting processing status:', error);
      return { processed: false };
    }
  }

  /**
   * Reprocess an artifact with updated options
   */
  async reprocessDocument(
    artifactId: string,
    systemId: string,
    options: ProcessingOptions
  ): Promise<DocumentProcessingResult> {
    const artifact = await storage.getArtifact(artifactId);
    if (!artifact) {
      throw new Error('Artifact not found');
    }

    // Clear existing evidence for this artifact
    if (options.createEvidence) {
      const existingEvidence = await storage.getEvidenceByArtifact(artifactId);
      for (const evidence of existingEvidence) {
        await storage.deleteEvidence(evidence.id);
      }
    }

    return this.processDocument(artifact, systemId, options);
  }
}

// Export singleton instance
export const enhancedDocumentProcessingService = new EnhancedDocumentProcessingService();

