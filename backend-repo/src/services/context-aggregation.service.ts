// Context Aggregation Service
// Aggregates evidence across documents for comprehensive control context

import { db } from '../db';
import { 
  evidenceAggregations, 
  evidenceItems, 
  evidenceRelationships, 
  contextVersions,
  documents,
  controls,
  controlMappings
} from "../schema";
import { eq, and, desc, sql, count, avg } from 'drizzle-orm';
import { EvidenceCollectionService } from './evidence-collection.service';
import { ContextEnrichmentService } from './context-enrichment.service';
import { EvidenceDeduplicationService } from './evidence-deduplication.service';
import { ContextPersistenceService } from './context-persistence.service';
import { 
  EvidenceAggregation, 
  InsertEvidenceAggregation, 
  EvidenceItem, 
  InsertEvidenceItem,
  EvidenceRelationship,
  InsertEvidenceRelationship,
  ContextVersion,
  InsertContextVersion
} from "../schema";

export interface AggregationRequest {
  controlId: string;
  controlFramework: string;
  systemId: string;
  includeRelationships?: boolean;
  minRelevanceScore?: number;
  maxEvidenceItems?: number;
}

export interface AggregationResult {
  aggregation: EvidenceAggregation;
  evidenceItems: EvidenceItem[];
  relationships: EvidenceRelationship[];
  gaps: string[];
  qualityScore: number;
  processingTime: number;
}

export interface ContextQuery {
  controlId: string;
  controlFramework: string;
  includeEvidence?: boolean;
  includeRelationships?: boolean;
  minQualityScore?: number;
}

export class ContextAggregationService {
  private evidenceCollection: EvidenceCollectionService;
  private contextEnrichment: ContextEnrichmentService;
  private deduplication: EvidenceDeduplicationService;
  private persistence: ContextPersistenceService;

  constructor() {
    this.evidenceCollection = new EvidenceCollectionService();
    this.contextEnrichment = new ContextEnrichmentService();
    this.deduplication = new EvidenceDeduplicationService();
    this.persistence = new ContextPersistenceService();
  }

  /**
   * Aggregate context for a specific control
   */
  async aggregateControlContext(request: AggregationRequest): Promise<AggregationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Starting context aggregation for control ${request.controlId} in framework ${request.controlFramework}`);

      // Step 1: Collect evidence from all relevant documents
      const evidenceItems = await this.evidenceCollection.collectEvidenceForControl(
        request.controlId,
        request.controlFramework,
        request.systemId,
        {
          minRelevanceScore: request.minRelevanceScore || 0.5,
          maxItems: request.maxEvidenceItems || 100
        }
      );

      console.log(`Collected ${evidenceItems.length} evidence items`);

      // Step 2: Deduplicate and consolidate evidence
      const deduplicatedEvidence = await this.deduplication.deduplicateEvidence(evidenceItems);
      console.log(`After deduplication: ${deduplicatedEvidence.length} evidence items`);

      // Step 3: Enrich context with supporting information
      const enrichedContext = await this.contextEnrichment.enrichContext(
        request.controlId,
        request.controlFramework,
        deduplicatedEvidence,
        {
          includeRelationships: request.includeRelationships || true,
          includeDependencies: true
        }
      );

      // Step 4: Identify gaps in evidence
      const gaps = await this.identifyEvidenceGaps(request.controlId, request.controlFramework, deduplicatedEvidence);

      // Step 5: Calculate quality score
      const qualityScore = await this.calculateQualityScore(deduplicatedEvidence, enrichedContext);

      // Step 6: Create aggregation record
      const aggregationData: InsertEvidenceAggregation = {
        controlId: request.controlId,
        controlFramework: request.controlFramework,
        aggregatedContext: enrichedContext,
        evidenceCount: deduplicatedEvidence.length,
        qualityScore: qualityScore,
        createdBy: 'system' // TODO: Get from request context
      };

      const aggregation = await this.persistence.saveAggregation(aggregationData);

      // Step 7: Save evidence relationships if requested
      let relationships: EvidenceRelationship[] = [];
      if (request.includeRelationships) {
        relationships = await this.createEvidenceRelationships(deduplicatedEvidence);
      }

      // Step 8: Create context version
      await this.createContextVersion(request.controlId, request.controlFramework, enrichedContext, 'Initial aggregation');

      const processingTime = Date.now() - startTime;
      console.log(`Context aggregation completed in ${processingTime}ms`);

      return {
        aggregation,
        evidenceItems: deduplicatedEvidence,
        relationships,
        gaps,
        qualityScore,
        processingTime
      };

    } catch (error) {
      console.error('Error aggregating control context:', error);
      throw new Error(`Failed to aggregate context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get aggregated context for a control
   */
  async getControlContext(query: ContextQuery): Promise<EvidenceAggregation | null> {
    try {
      const aggregation = await this.persistence.getAggregation(query.controlId, query.controlFramework);
      
      if (!aggregation) {
        return null;
      }

      // Apply quality filter if specified
      if (query.minQualityScore && aggregation.qualityScore < query.minQualityScore) {
        return null;
      }

      return aggregation;
    } catch (error) {
      console.error('Error getting control context:', error);
      throw new Error(`Failed to get control context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get evidence items for a control
   */
  async getControlEvidence(controlId: string, controlFramework: string): Promise<EvidenceItem[]> {
    try {
      return await this.persistence.getEvidenceItems(controlId, controlFramework);
    } catch (error) {
      console.error('Error getting control evidence:', error);
      throw new Error(`Failed to get control evidence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update aggregated context
   */
  async updateAggregatedContext(
    aggregationId: string, 
    updates: Partial<InsertEvidenceAggregation>,
    userId: string
  ): Promise<EvidenceAggregation> {
    try {
      const updatedAggregation = await this.persistence.updateAggregation(aggregationId, updates);
      
      // Create new context version
      await this.createContextVersion(
        updatedAggregation.controlId,
        updatedAggregation.controlFramework,
        updatedAggregation.aggregatedContext,
        'Context updated',
        userId
      );

      return updatedAggregation;
    } catch (error) {
      console.error('Error updating aggregated context:', error);
      throw new Error(`Failed to update context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get control gaps
   */
  async getControlGaps(controlId: string, controlFramework: string): Promise<string[]> {
    try {
      const evidenceItems = await this.getControlEvidence(controlId, controlFramework);
      return await this.identifyEvidenceGaps(controlId, controlFramework, evidenceItems);
    } catch (error) {
      console.error('Error getting control gaps:', error);
      throw new Error(`Failed to get control gaps: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate context completeness
   */
  async validateContextCompleteness(controlId: string, controlFramework: string): Promise<{
    isComplete: boolean;
    completenessScore: number;
    missingElements: string[];
    recommendations: string[];
  }> {
    try {
      const aggregation = await this.getControlContext({ controlId, controlFramework });
      
      if (!aggregation) {
        return {
          isComplete: false,
          completenessScore: 0,
          missingElements: ['No context aggregation found'],
          recommendations: ['Run context aggregation for this control']
        };
      }

      const evidenceItems = await this.getControlEvidence(controlId, controlFramework);
      const gaps = await this.identifyEvidenceGaps(controlId, controlFramework, evidenceItems);

      const completenessScore = Math.max(0, 100 - (gaps.length * 10));
      const isComplete = completenessScore >= 80;

      const recommendations = this.generateRecommendations(gaps, evidenceItems.length);

      return {
        isComplete,
        completenessScore,
        missingElements: gaps,
        recommendations
      };
    } catch (error) {
      console.error('Error validating context completeness:', error);
      throw new Error(`Failed to validate context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Identify evidence gaps for a control
   */
  private async identifyEvidenceGaps(
    controlId: string, 
    controlFramework: string, 
    evidenceItems: EvidenceItem[]
  ): Promise<string[]> {
    const gaps: string[] = [];

    // Get control definition to understand requirements
    const control = await (db.query as any).controls.findFirst({
      where: and(
        eq(controls.id, controlId),
        eq(controls.framework, controlFramework)
      )
    });

    if (!control) {
      gaps.push('Control definition not found');
      return gaps;
    }

    // Check for basic evidence types
    const evidenceTypes = new Set(evidenceItems.map(item => item.evidenceType));
    
    if (!evidenceTypes.has('policy')) {
      gaps.push('Policy documentation missing');
    }
    
    if (!evidenceTypes.has('procedure')) {
      gaps.push('Procedure documentation missing');
    }
    
    if (!evidenceTypes.has('implementation')) {
      gaps.push('Implementation evidence missing');
    }

    // Check for low-quality evidence
    const lowQualityEvidence = evidenceItems.filter(item => 
      item.qualityScore && item.qualityScore < 0.6
    );
    
    if (lowQualityEvidence.length > 0) {
      gaps.push(`${lowQualityEvidence.length} low-quality evidence items need review`);
    }

    // Check for insufficient evidence count
    if (evidenceItems.length < 3) {
      gaps.push('Insufficient evidence items (minimum 3 recommended)');
    }

    return gaps;
  }

  /**
   * Calculate quality score for aggregated context
   */
  private async calculateQualityScore(
    evidenceItems: EvidenceItem[], 
    enrichedContext: any
  ): Promise<number> {
    if (evidenceItems.length === 0) {
      return 0;
    }

    // Calculate average quality score of evidence items
    const avgEvidenceQuality = evidenceItems.reduce((sum, item) => 
      sum + (item.qualityScore || 0.5), 0
    ) / evidenceItems.length;

    // Factor in evidence count (more evidence = higher score, up to a point)
    const countScore = Math.min(1.0, evidenceItems.length / 10);

    // Factor in context richness
    const contextScore = this.calculateContextRichness(enrichedContext);

    // Weighted average
    const qualityScore = (avgEvidenceQuality * 0.5) + (countScore * 0.3) + (contextScore * 0.2);
    
    return Math.round(qualityScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate context richness score
   */
  private calculateContextRichness(context: any): number {
    let score = 0;

    // Check for key context elements
    if (context.summary) score += 0.2;
    if (context.implementationDetails) score += 0.2;
    if (context.relatedControls && context.relatedControls.length > 0) score += 0.2;
    if (context.evidenceSources && context.evidenceSources.length > 0) score += 0.2;
    if (context.gaps && context.gaps.length === 0) score += 0.2;

    return Math.min(1.0, score);
  }

  /**
   * Create evidence relationships
   */
  private async createEvidenceRelationships(evidenceItems: EvidenceItem[]): Promise<EvidenceRelationship[]> {
    const relationships: EvidenceRelationship[] = [];

    // Simple relationship detection based on similarity
    for (let i = 0; i < evidenceItems.length; i++) {
      for (let j = i + 1; j < evidenceItems.length; j++) {
        const item1 = evidenceItems[i];
        const item2 = evidenceItems[j];

        // Check for similarity
        const similarity = this.calculateTextSimilarity(item1.evidenceText, item2.evidenceText);
        
        if (similarity > 0.7) {
          const relationship: InsertEvidenceRelationship = {
            sourceEvidenceId: item1.id,
            targetEvidenceId: item2.id,
            relationshipType: 'similar',
            strength: similarity
          };

          const created = await this.persistence.saveEvidenceRelationship(relationship);
          relationships.push(created);
        }
      }
    }

    return relationships;
  }

  /**
   * Calculate text similarity (simple implementation)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Create context version
   */
  private async createContextVersion(
    controlId: string,
    controlFramework: string,
    contextData: any,
    changeSummary: string,
    userId?: string
  ): Promise<ContextVersion> {
    // Get next version number
    const latestVersion = await (db.query as any).contextVersions.findFirst({
      where: and(
        eq(contextVersions.controlId, controlId),
        eq(contextVersions.controlFramework, controlFramework)
      ),
      orderBy: desc(contextVersions.versionNumber)
    });

    const versionNumber = (latestVersion?.versionNumber || 0) + 1;

    const versionData: InsertContextVersion = {
      controlId,
      controlFramework,
      versionNumber,
      contextData,
      changeSummary,
      createdBy: userId || 'system'
    };

    return await this.persistence.saveContextVersion(versionData);
  }

  /**
   * Generate recommendations based on gaps and evidence
   */
  private generateRecommendations(gaps: string[], evidenceCount: number): string[] {
    const recommendations: string[] = [];

    if (gaps.includes('Policy documentation missing')) {
      recommendations.push('Upload policy documents that address this control');
    }

    if (gaps.includes('Procedure documentation missing')) {
      recommendations.push('Create or upload procedure documents for implementation steps');
    }

    if (gaps.includes('Implementation evidence missing')) {
      recommendations.push('Add implementation evidence such as configuration files or screenshots');
    }

    if (gaps.includes('Insufficient evidence items')) {
      recommendations.push('Upload additional supporting documents');
    }

    if (evidenceCount > 10) {
      recommendations.push('Consider consolidating similar evidence items');
    }

    return recommendations;
  }
}

export const contextAggregationService = new ContextAggregationService();
