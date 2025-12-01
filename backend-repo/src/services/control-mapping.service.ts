import { db } from '../db';
import { controlMappings, controlRelationships, mappingCriteria } from '../schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { storage } from '../storage';
import { ConfidenceScoringService } from './confidence-scoring.service';
import { ControlRelationshipService } from './control-relationship.service';
import { MappingPersistenceService } from './mapping-persistence.service';
import { DocumentExtractionService } from './document-extraction.service';
import { SemanticSearchEngine } from './semantic-search';

export interface ControlMapping {
  id: string;
  documentId: string;
  controlId: string;
  controlFramework: string;
  confidenceScore: number;
  mappingCriteria: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface MappingRequest {
  documentId: string;
  controlIds?: string[];
  framework?: string;
  minConfidence?: number;
  includeRelationships?: boolean;
}

export interface MappingResult {
  mappings: ControlMapping[];
  relationships: ControlRelationship[];
  totalProcessed: number;
  processingTime: number;
}

export interface ControlRelationship {
  id: string;
  sourceControlId: string;
  targetControlId: string;
  relationshipType: string;
  framework: string;
  strength: number;
}

export class ControlMappingService {
  private confidenceScoring: ConfidenceScoringService;
  private relationshipService: ControlRelationshipService;
  private persistenceService: MappingPersistenceService;
  private documentService: DocumentExtractionService;
  private semanticSearch: SemanticSearchEngine;

  constructor() {
    this.confidenceScoring = new ConfidenceScoringService();
    this.relationshipService = new ControlRelationshipService();
    this.persistenceService = new MappingPersistenceService();
    this.documentService = new DocumentExtractionService();
    this.semanticSearch = new SemanticSearchEngine();
  }

  /**
   * Map a document to relevant controls using semantic similarity
   */
  async mapDocumentToControls(request: MappingRequest): Promise<MappingResult> {
    const startTime = Date.now();
    
    try {
      // Get document chunks and metadata
      const document = await this.documentService.getDocumentById(request.documentId);
      if (!document) {
        throw new Error(`Document ${request.documentId} not found`);
      }

      // Get document chunks for semantic analysis
      const chunks = await this.documentService.getDocumentChunks(request.documentId);
      if (!chunks || chunks.length === 0) {
        throw new Error(`No chunks found for document ${request.documentId}`);
      }

      // Get target controls (if not specified, get all active controls)
      const targetControls = request.controlIds 
        ? await this.getControlsByIds(request.controlIds, request.framework)
        : await this.getAllActiveControls(request.framework);

      // Perform semantic mapping
      const mappings = await this.performSemanticMapping(
        chunks,
        targetControls,
        request.documentId,
        request.minConfidence || 70
      );

      // Get control relationships if requested
      let relationships: ControlRelationship[] = [];
      if (request.includeRelationships) {
        relationships = await this.relationshipService.getControlRelationships(
          mappings.map(m => m.controlId),
          request.framework
        );
      }

      // Store mappings in database
      await this.persistenceService.saveMappings(mappings);

      const processingTime = Date.now() - startTime;

      return {
        mappings,
        relationships,
        totalProcessed: targetControls.length,
        processingTime
      };

    } catch (error) {
      console.error('Error mapping document to controls:', error);
      throw new Error(`Failed to map document: ${error.message}`);
    }
  }

  /**
   * Get mappings for a specific document
   */
  async getDocumentMappings(documentId: string, minConfidence?: number): Promise<ControlMapping[]> {
    try {
      const conditions = [eq(controlMappings.documentId, documentId)];
      
      if (minConfidence) {
        conditions.push(gte(controlMappings.confidenceScore, minConfidence));
      }

      const results = await db.select()
        .from(controlMappings)
        .where(and(...conditions))
        .orderBy(desc(controlMappings.confidenceScore));
      
      return results.map(this.mapDbRowToControlMapping);
    } catch (error) {
      console.error('Error getting document mappings:', error);
      throw new Error(`Failed to get document mappings: ${error.message}`);
    }
  }

  /**
   * Get documents mapped to a specific control
   */
  async getControlDocuments(controlId: string, framework?: string, minConfidence?: number): Promise<ControlMapping[]> {
    try {
      let conditions = [eq(controlMappings.controlId, controlId)];
      
      if (framework) {
        conditions.push(eq(controlMappings.controlFramework, framework));
      }
      
      if (minConfidence) {
        conditions.push(gte(controlMappings.confidenceScore, minConfidence));
      }

      const results = await db.select()
        .from(controlMappings)
        .where(and(...conditions))
        .orderBy(desc(controlMappings.confidenceScore));

      return results.map(this.mapDbRowToControlMapping);
    } catch (error) {
      console.error('Error getting control documents:', error);
      throw new Error(`Failed to get control documents: ${error.message}`);
    }
  }

  /**
   * Update mapping confidence score
   */
  async updateMappingConfidence(
    mappingId: string, 
    newConfidence: number, 
    reason: string, 
    userId?: string
  ): Promise<void> {
    try {
      await this.persistenceService.updateMappingConfidence(
        mappingId, 
        newConfidence, 
        reason, 
        userId
      );
    } catch (error) {
      console.error('Error updating mapping confidence:', error);
      throw new Error(`Failed to update mapping confidence: ${error.message}`);
    }
  }

  /**
   * Remove a mapping
   */
  async removeMapping(mappingId: string, userId?: string): Promise<void> {
    try {
      await this.persistenceService.removeMapping(mappingId, userId);
    } catch (error) {
      console.error('Error removing mapping:', error);
      throw new Error(`Failed to remove mapping: ${error.message}`);
    }
  }

  /**
   * Get control coverage report
   */
  async getControlCoverageReport(documentId: string): Promise<{
    totalControls: number;
    mappedControls: number;
    coveragePercentage: number;
    highConfidenceMappings: number;
    mediumConfidenceMappings: number;
    lowConfidenceMappings: number;
  }> {
    try {
      const mappings = await this.getDocumentMappings(documentId);
      const allControls = await this.getAllActiveControls();
      
      const highConfidence = mappings.filter(m => m.confidenceScore >= 80).length;
      const mediumConfidence = mappings.filter(m => m.confidenceScore >= 60 && m.confidenceScore < 80).length;
      const lowConfidence = mappings.filter(m => m.confidenceScore < 60).length;

      return {
        totalControls: allControls.length,
        mappedControls: mappings.length,
        coveragePercentage: (mappings.length / allControls.length) * 100,
        highConfidenceMappings: highConfidence,
        mediumConfidenceMappings: mediumConfidence,
        lowConfidenceMappings: lowConfidence
      };
    } catch (error) {
      console.error('Error generating coverage report:', error);
      throw new Error(`Failed to generate coverage report: ${error.message}`);
    }
  }

  /**
   * Perform semantic mapping between document chunks and controls
   */
  private async performSemanticMapping(
    chunks: any[],
    controls: any[],
    documentId: string,
    minConfidence: number
  ): Promise<ControlMapping[]> {
    const mappings: ControlMapping[] = [];

    for (const control of controls) {
      try {
        // Get control embedding for similarity comparison - use storage directly
        const controlEmbeddingData = await storage.getControlEmbedding(control.id);
        if (!controlEmbeddingData) continue;
        const controlEmbedding = controlEmbeddingData.combinedEmbedding || [];
        if (!controlEmbedding || controlEmbedding.length === 0) continue;

        let bestMatch = { score: 0, criteria: {} };
        
        // Compare with each document chunk
        for (const chunk of chunks) {
          const chunkEmbedding = await this.semanticSearch.getChunkEmbedding(chunk.id);
          if (!chunkEmbedding) continue;

          // Calculate semantic similarity
          const similarity = this.calculateCosineSimilarity(controlEmbedding, chunkEmbedding);
          
          // Calculate confidence score using multiple criteria
          const confidence = await this.confidenceScoring.calculateConfidence({
            semanticSimilarity: similarity,
            keywordMatch: this.calculateKeywordMatch(control.description, chunk.content),
            contextRelevance: this.calculateContextRelevance(control, chunk),
            documentType: this.calculateDocumentTypeRelevance(control, chunk)
          });

          if (confidence > bestMatch.score) {
            bestMatch = {
              score: confidence,
              criteria: {
                semanticSimilarity: similarity,
                keywordMatch: this.calculateKeywordMatch(control.description, chunk.content),
                contextRelevance: this.calculateContextRelevance(control, chunk),
                documentType: this.calculateDocumentTypeRelevance(control, chunk)
              }
            };
          }
        }

        // Only include mappings above minimum confidence threshold
        if (bestMatch.score >= minConfidence) {
          mappings.push({
            id: '', // Will be generated by database
            documentId,
            controlId: control.id,
            controlFramework: control.framework,
            confidenceScore: bestMatch.score,
            mappingCriteria: bestMatch.criteria,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } catch (error) {
        console.warn(`Error processing control ${control.id}:`, error);
        continue;
      }
    }

    return mappings;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate keyword match score
   */
  private calculateKeywordMatch(controlText: string, chunkText: string): number {
    const controlWords = new Set(controlText.toLowerCase().split(/\s+/));
    const chunkWords = chunkText.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const word of chunkWords) {
      if (controlWords.has(word)) matches++;
    }

    return chunkWords.length > 0 ? matches / chunkWords.length : 0;
  }

  /**
   * Calculate context relevance score
   */
  private calculateContextRelevance(control: any, chunk: any): number {
    // This would be more sophisticated in a real implementation
    // For now, return a base score based on chunk position and type
    let score = 0.5; // Base score
    
    if (chunk.sectionType === 'policy' || chunk.sectionType === 'procedure') {
      score += 0.3;
    }
    
    if (chunk.position < 0.2) { // Early in document
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate document type relevance score
   */
  private calculateDocumentTypeRelevance(control: any, chunk: any): number {
    // Map document types to control relevance
    const typeRelevance: Record<string, number> = {
      'policy': 0.9,
      'procedure': 0.8,
      'standard': 0.7,
      'guideline': 0.6,
      'other': 0.5
    };

    return typeRelevance[chunk.documentType] || 0.5;
  }

  /**
   * Get controls by IDs
   */
  private async getControlsByIds(controlIds: string[], framework?: string): Promise<any[]> {
    // This would query your control management system
    // For now, return mock data
    return controlIds.map(id => ({
      id,
      framework: framework || 'NIST-800-53',
      description: `Control ${id} description`
    }));
  }

  /**
   * Get all active controls
   */
  private async getAllActiveControls(framework?: string): Promise<any[]> {
    // This would query your control management system
    // For now, return mock data for common NIST controls
    const controls = [
      'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8', 'AC-9', 'AC-10',
      'AU-1', 'AU-2', 'AU-3', 'AU-4', 'AU-5', 'AU-6', 'AU-7', 'AU-8', 'AU-9', 'AU-10',
      'CA-1', 'CA-2', 'CA-3', 'CA-4', 'CA-5', 'CA-6', 'CA-7', 'CA-8', 'CA-9', 'CA-10'
    ];

    return controls.map(id => ({
      id,
      framework: framework || 'NIST-800-53',
      description: `Control ${id} description`
    }));
  }

  /**
   * Map database row to ControlMapping object
   */
  private mapDbRowToControlMapping(row: any): ControlMapping {
    return {
      id: row.id,
      documentId: row.documentId,
      controlId: row.controlId,
      controlFramework: row.controlFramework,
      confidenceScore: parseFloat(row.confidenceScore),
      mappingCriteria: row.mappingCriteria || {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy
    };
  }
}
