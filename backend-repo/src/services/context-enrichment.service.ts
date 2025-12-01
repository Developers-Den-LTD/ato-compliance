// Context Enrichment Service
// Enriches control context with supporting evidence and relationships

import { db } from '../db';
import { 
  controls, 
  controlRelationships,
  evidenceItems,
  documents
} from "../schema";
import { eq, and, sql } from 'drizzle-orm';
import { EvidenceItem } from "../schema";

export interface EnrichmentOptions {
  includeRelationships?: boolean;
  includeDependencies?: boolean;
  includeSupportingControls?: boolean;
  maxRelatedControls?: number;
}

export interface EnrichedContext {
  summary: string;
  implementationDetails: string[];
  relatedControls: Array<{
    controlId: string;
    relationshipType: string;
    strength: number;
  }>;
  evidenceSources: Array<{
    documentId: string;
    documentTitle: string;
    evidenceCount: number;
    averageQuality: number;
  }>;
  gaps: string[];
  qualityIndicators: {
    evidenceCount: number;
    averageQuality: number;
    coverageScore: number;
    completenessScore: number;
  };
}

export class ContextEnrichmentService {
  /**
   * Enrich context for a control with supporting information
   */
  async enrichContext(
    controlId: string,
    controlFramework: string,
    evidenceItems: EvidenceItem[],
    options: EnrichmentOptions = {}
  ): Promise<EnrichedContext> {
    try {
      console.log(`Enriching context for control ${controlId}`);

      // Get control definition
      const control = await (db.query as any).controls.findFirst({
        where: and(
          eq(controls.id, controlId),
          eq(controls.framework, controlFramework)
        )
      });

      if (!control) {
        throw new Error(`Control ${controlId} not found in framework ${controlFramework}`);
      }

      // Generate summary
      const summary = await this.generateSummary(control, evidenceItems);

      // Extract implementation details
      const implementationDetails = this.extractImplementationDetails(evidenceItems);

      // Get related controls
      const relatedControls = options.includeRelationships 
        ? await this.getRelatedControls(controlId, controlFramework, options.maxRelatedControls || 10)
        : [];

      // Get evidence sources
      const evidenceSources = await this.getEvidenceSources(evidenceItems);

      // Identify gaps
      const gaps = await this.identifyContextGaps(control, evidenceItems);

      // Calculate quality indicators
      const qualityIndicators = this.calculateQualityIndicators(evidenceItems);

      const enrichedContext: EnrichedContext = {
        summary,
        implementationDetails,
        relatedControls,
        evidenceSources,
        gaps,
        qualityIndicators
      };

      console.log(`Context enrichment completed for control ${controlId}`);
      return enrichedContext;

    } catch (error) {
      console.error('Error enriching context:', error);
      throw new Error(`Failed to enrich context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a comprehensive summary for the control
   */
  private async generateSummary(control: any, evidenceItems: EvidenceItem[]): Promise<string> {
    const evidenceTypes = new Set(evidenceItems.map(item => item.evidenceType));
    const evidenceCount = evidenceItems.length;
    const avgQuality = evidenceItems.reduce((sum, item) => sum + (item.qualityScore || 0.5), 0) / evidenceCount;

    let summary = `Control ${control.id}: ${control.title}\n\n`;
    summary += `Description: ${control.description || 'No description available'}\n\n`;

    if (evidenceCount > 0) {
      summary += `Evidence Summary:\n`;
      summary += `- ${evidenceCount} evidence items found\n`;
      summary += `- Average quality score: ${(avgQuality * 100).toFixed(1)}%\n`;
      summary += `- Evidence types: ${Array.from(evidenceTypes).join(', ')}\n\n`;

      // Add implementation status based on evidence
      if (evidenceTypes.has('implementation') || evidenceTypes.has('technical')) {
        summary += `Implementation Status: Implemented with technical evidence\n`;
      } else if (evidenceTypes.has('policy') && evidenceTypes.has('procedure')) {
        summary += `Implementation Status: Documented with policies and procedures\n`;
      } else if (evidenceTypes.has('policy')) {
        summary += `Implementation Status: Policy documented, implementation details needed\n`;
      } else {
        summary += `Implementation Status: Limited evidence available\n`;
      }
    } else {
      summary += `No evidence found for this control. Consider adding supporting documentation.\n`;
    }

    return summary;
  }

  /**
   * Extract implementation details from evidence items
   */
  private extractImplementationDetails(evidenceItems: EvidenceItem[]): string[] {
    const details: string[] = [];

    for (const item of evidenceItems) {
      if (item.evidenceType === 'implementation' || item.evidenceType === 'technical') {
        // Extract key implementation details
        const text = item.evidenceText.toLowerCase();
        
        if (text.includes('configured') || text.includes('enabled')) {
          details.push(`Configuration: ${item.evidenceText.substring(0, 200)}...`);
        } else if (text.includes('policy') || text.includes('procedure')) {
          details.push(`Documentation: ${item.evidenceText.substring(0, 200)}...`);
        } else if (text.includes('audit') || text.includes('monitoring')) {
          details.push(`Monitoring: ${item.evidenceText.substring(0, 200)}...`);
        } else {
          details.push(`Implementation: ${item.evidenceText.substring(0, 200)}...`);
        }
      }
    }

    return details.slice(0, 10); // Limit to 10 details
  }

  /**
   * Get related controls
   */
  private async getRelatedControls(
    controlId: string, 
    controlFramework: string, 
    maxControls: number
  ): Promise<Array<{ controlId: string; relationshipType: string; strength: number }>> {
    try {
      const relationships = await (db.query as any).controlRelationships.findMany({
        where: and(
          eq(controlRelationships.framework, controlFramework),
          sql`(${controlRelationships.sourceControlId} = ${controlId} OR ${controlRelationships.targetControlId} = ${controlId})`
        ),
        limit: maxControls
      });

      return relationships.map(rel => ({
        controlId: rel.sourceControlId === controlId ? rel.targetControlId : rel.sourceControlId,
        relationshipType: rel.relationshipType,
        strength: rel.strength || 1.0
      }));
    } catch (error) {
      console.error('Error getting related controls:', error);
      return [];
    }
  }

  /**
   * Get evidence sources with metadata
   */
  private async getEvidenceSources(evidenceItems: EvidenceItem[]): Promise<Array<{
    documentId: string;
    documentTitle: string;
    evidenceCount: number;
    averageQuality: number;
  }>> {
    const sourceMap = new Map<string, {
      documentId: string;
      documentTitle: string;
      evidenceCount: number;
      totalQuality: number;
    }>();

    // Group evidence by document
    for (const item of evidenceItems) {
      const existing = sourceMap.get(item.documentId);
      if (existing) {
        existing.evidenceCount++;
        existing.totalQuality += item.qualityScore || 0.5;
      } else {
        sourceMap.set(item.documentId, {
          documentId: item.documentId,
          documentTitle: 'Unknown Document', // Will be updated below
          evidenceCount: 1,
          totalQuality: item.qualityScore || 0.5
        });
      }
    }

    // Get document titles
    for (const [documentId, source] of sourceMap) {
      try {
        const document = await (db.query as any).documents.findFirst({
          where: eq(documents.id, documentId)
        });
        if (document) {
          source.documentTitle = document.title || document.name;
        }
      } catch (error) {
        console.warn(`Could not get document title for ${documentId}:`, error);
      }
    }

    // Convert to array and calculate averages
    return Array.from(sourceMap.values()).map(source => ({
      documentId: source.documentId,
      documentTitle: source.documentTitle,
      evidenceCount: source.evidenceCount,
      averageQuality: source.totalQuality / source.evidenceCount
    }));
  }

  /**
   * Identify context gaps
   */
  private async identifyContextGaps(control: any, evidenceItems: EvidenceItem[]): Promise<string[]> {
    const gaps: string[] = [];

    const evidenceTypes = new Set(evidenceItems.map(item => item.evidenceType));

    // Check for missing evidence types
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
    const lowQualityCount = evidenceItems.filter(item => 
      item.qualityScore && item.qualityScore < 0.6
    ).length;

    if (lowQualityCount > 0) {
      gaps.push(`${lowQualityCount} low-quality evidence items need review`);
    }

    // Check for insufficient evidence
    if (evidenceItems.length < 3) {
      gaps.push('Insufficient evidence items (minimum 3 recommended)');
    }

    // Check for control-specific gaps based on control family
    if (control.family === 'AC' && !evidenceTypes.has('technical')) {
      gaps.push('Technical implementation details needed for access control');
    }

    if (control.family === 'AU' && !evidenceTypes.has('implementation')) {
      gaps.push('Audit logging implementation evidence needed');
    }

    return gaps;
  }

  /**
   * Calculate quality indicators
   */
  private calculateQualityIndicators(evidenceItems: EvidenceItem[]): {
    evidenceCount: number;
    averageQuality: number;
    coverageScore: number;
    completenessScore: number;
  } {
    const evidenceCount = evidenceItems.length;
    
    if (evidenceCount === 0) {
      return {
        evidenceCount: 0,
        averageQuality: 0,
        coverageScore: 0,
        completenessScore: 0
      };
    }

    const averageQuality = evidenceItems.reduce((sum, item) => 
      sum + (item.qualityScore || 0.5), 0
    ) / evidenceCount;

    // Coverage score based on evidence types
    const evidenceTypes = new Set(evidenceItems.map(item => item.evidenceType));
    const expectedTypes = ['policy', 'procedure', 'implementation'];
    const coverageScore = expectedTypes.filter(type => evidenceTypes.has(type)).length / expectedTypes.length;

    // Completeness score based on evidence count and quality
    const completenessScore = Math.min(1.0, (evidenceCount / 5) * 0.5 + averageQuality * 0.5);

    return {
      evidenceCount,
      averageQuality: Math.round(averageQuality * 100) / 100,
      coverageScore: Math.round(coverageScore * 100) / 100,
      completenessScore: Math.round(completenessScore * 100) / 100
    };
  }
}

export const contextEnrichmentService = new ContextEnrichmentService();
