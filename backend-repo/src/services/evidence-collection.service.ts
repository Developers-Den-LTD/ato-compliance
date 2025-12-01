// Evidence Collection Service
// Collects evidence from documents for control context aggregation

import { db } from '../db';
import { 
  evidenceItems as evidenceItemsTable, 
  documents, 
  controlMappings,
  semanticChunks,
  evidence
} from "../schema";
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { EvidenceItem, InsertEvidenceItem } from "../schema";

export interface CollectionOptions {
  minRelevanceScore?: number;
  maxItems?: number;
  evidenceTypes?: string[];
  includeLowQuality?: boolean;
}

export interface EvidenceSource {
  documentId: string;
  documentTitle: string;
  chunkId?: string;
  pageNumber?: number;
  sectionTitle?: string;
}

export class EvidenceCollectionService {
  /**
   * Collect evidence for a specific control from all relevant documents
   */
  async collectEvidenceForControl(
    controlId: string,
    controlFramework: string,
    systemId: string,
    options: CollectionOptions = {}
  ): Promise<EvidenceItem[]> {
    try {
      console.log(`Collecting evidence for control ${controlId} in framework ${controlFramework}`);

      // Get all documents that have mappings to this control
      const mappings = await (db.query as any).controlMappings.findMany({
        where: and(
          eq(controlMappings.controlId, controlId),
          eq(controlMappings.controlFramework, controlFramework),
          gte(controlMappings.confidenceScore, options.minRelevanceScore || 0.5)
        ),
        orderBy: desc(controlMappings.confidenceScore)
      });

      if (mappings.length === 0) {
        console.log(`No mappings found for control ${controlId}`);
        return [];
      }

      const documentIds = [...new Set(mappings.map(m => m.documentId))];
      console.log(`Found ${documentIds.length} documents with mappings to control ${controlId}`);

      // Collect evidence from each document
      const allEvidenceItems: EvidenceItem[] = [];

      for (const documentId of documentIds) {
        const documentEvidence = await this.collectEvidenceFromDocument(
          String(documentId),
          controlId,
          controlFramework,
          options
        );
        allEvidenceItems.push(...documentEvidence);
      }

      // Sort by relevance score and limit results
      const sortedEvidence = allEvidenceItems
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, options.maxItems || 100);

      console.log(`Collected ${sortedEvidence.length} evidence items for control ${controlId}`);
      return sortedEvidence;

    } catch (error) {
      console.error('Error collecting evidence for control:', error);
      throw new Error(`Failed to collect evidence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Collect evidence from a specific document
   */
  private async collectEvidenceFromDocument(
    documentId: string,
    controlId: string,
    controlFramework: string,
    options: CollectionOptions
  ): Promise<EvidenceItem[]> {
    try {
      // Get document details
      const document = await (db.query as any).documents.findFirst({
        where: eq(documents.id, documentId)
      });

      if (!document) {
        console.warn(`Document ${documentId} not found`);
        return [];
      }

      // Get semantic chunks for this document
      const chunks = await (db.query as any).semanticChunks.findMany({
        where: eq(semanticChunks.artifactId, documentId),
        orderBy: desc(semanticChunks.createdAt)
      });

      if (chunks.length === 0) {
        console.warn(`No semantic chunks found for document ${documentId}`);
        return [];
      }

      // Get existing evidence items for this document and control
      const existingEvidence = await (db.query as any).evidenceItems.findMany({
        where: and(
          eq((evidenceItemsTable as any).documentId, documentId),
          eq((evidenceItemsTable as any).controlId, controlId)
        )
      });

      // If evidence already exists, return it
      if (existingEvidence.length > 0) {
        return existingEvidence;
      }

      // Extract evidence from chunks
      const evidenceItems: EvidenceItem[] = [];

      for (const chunk of chunks) {
        const evidenceText = this.extractEvidenceFromChunk(chunk.content, controlId);
        
        if (evidenceText) {
          const evidenceItem: InsertEvidenceItem = {
            documentId: documentId,
            controlId: controlId,
            evidenceText: evidenceText,
            evidenceType: this.determineEvidenceType(document.type, chunk.chunkType),
            relevanceScore: this.calculateRelevanceScore(evidenceText, controlId),
            qualityScore: this.calculateQualityScore(evidenceText, chunk.metadata),
            sourceLocation: {
              chunkId: chunk.id,
              chunkType: chunk.chunkType,
              sectionTitle: chunk.metadata?.sectionTitle || null,
              pageNumber: chunk.metadata?.pageNumber || null
            }
          };

          const created = await this.saveEvidenceItem(evidenceItem);
          evidenceItems.push(created);
        }
      }

      return evidenceItems;

    } catch (error) {
      console.error(`Error collecting evidence from document ${documentId}:`, error);
      return [];
    }
  }

  /**
   * Extract evidence text from a semantic chunk
   */
  private extractEvidenceFromChunk(chunkContent: string, controlId: string): string | null {
    // Simple evidence extraction - look for control references and relevant content
    const controlPattern = new RegExp(`\\b${controlId}\\b`, 'i');
    const hasControlReference = controlPattern.test(chunkContent);

    // Look for evidence keywords
    const evidenceKeywords = [
      'implemented', 'configured', 'enabled', 'disabled', 'policy', 'procedure',
      'access control', 'authentication', 'authorization', 'audit', 'logging',
      'encryption', 'backup', 'recovery', 'monitoring', 'compliance'
    ];

    const hasEvidenceKeywords = evidenceKeywords.some(keyword => 
      chunkContent.toLowerCase().includes(keyword.toLowerCase())
    );

    // Return content if it contains control reference or evidence keywords
    if (hasControlReference || hasEvidenceKeywords) {
      return chunkContent.trim();
    }

    return null;
  }

  /**
   * Determine evidence type based on document type and chunk type
   */
  private determineEvidenceType(documentType: string, chunkType: string): string {
    const typeMapping: Record<string, string> = {
      'policy_document': 'policy',
      'procedure_document': 'procedure',
      'system_documentation': 'implementation',
      'architecture_diagram': 'architecture',
      'scan_results': 'technical',
      'assessment_report': 'assessment'
    };

    return typeMapping[documentType] || 'general';
  }

  /**
   * Calculate relevance score for evidence text
   */
  private calculateRelevanceScore(evidenceText: string, controlId: string): number {
    let score = 0;

    // Direct control reference
    const controlPattern = new RegExp(`\\b${controlId}\\b`, 'i');
    if (controlPattern.test(evidenceText)) {
      score += 0.4;
    }

    // Evidence keywords
    const evidenceKeywords = [
      'implemented', 'configured', 'enabled', 'policy', 'procedure',
      'access control', 'authentication', 'authorization', 'audit'
    ];

    const keywordMatches = evidenceKeywords.filter(keyword => 
      evidenceText.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    score += (keywordMatches / evidenceKeywords.length) * 0.3;

    // Text length factor (longer text might be more detailed)
    const lengthFactor = Math.min(1.0, evidenceText.length / 500);
    score += lengthFactor * 0.2;

    // Specific implementation details
    const implementationKeywords = ['configured', 'enabled', 'implemented', 'setup'];
    const hasImplementationDetails = implementationKeywords.some(keyword => 
      evidenceText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasImplementationDetails) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate quality score for evidence
   */
  private calculateQualityScore(evidenceText: string, metadata: any): number {
    let score = 0.5; // Base score

    // Length factor (too short or too long reduces quality)
    const length = evidenceText.length;
    if (length >= 50 && length <= 1000) {
      score += 0.2;
    } else if (length < 50) {
      score -= 0.2;
    }

    // Metadata quality
    if (metadata?.sectionTitle) {
      score += 0.1;
    }

    if (metadata?.pageNumber) {
      score += 0.1;
    }

    // Specificity (more specific terms = higher quality)
    const specificTerms = ['configured', 'enabled', 'disabled', 'policy', 'procedure'];
    const specificCount = specificTerms.filter(term => 
      evidenceText.toLowerCase().includes(term.toLowerCase())
    ).length;

    score += (specificCount / specificTerms.length) * 0.2;

    return Math.max(0, Math.min(1.0, score));
  }

  /**
   * Save evidence item to database
   */
  private async saveEvidenceItem(evidenceItem: InsertEvidenceItem): Promise<EvidenceItem> {
    try {
      const [created] = await db.insert(evidenceItemsTable)
        .values(evidenceItem)
        .returning();

      return created;
    } catch (error) {
      console.error('Error saving evidence item:', error);
      throw new Error(`Failed to save evidence item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get evidence items by control
   */
  async getEvidenceItemsByControl(controlId: string, controlFramework: string): Promise<EvidenceItem[]> {
    try {
      return await (db.query as any).evidenceItems.findMany({
        where: and(
          eq((evidenceItemsTable as any).controlId, controlId)
        ),
        orderBy: desc((evidenceItemsTable as any).relevanceScore)
      });
    } catch (error) {
      console.error('Error getting evidence items by control:', error);
      throw new Error(`Failed to get evidence items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get evidence items by document
   */
  async getEvidenceItemsByDocument(documentId: string): Promise<EvidenceItem[]> {
    try {
      return await (db.query as any).evidenceItems.findMany({
        where: eq((evidenceItemsTable as any).documentId, documentId),
        orderBy: desc((evidenceItemsTable as any).createdAt)
      });
    } catch (error) {
      console.error('Error getting evidence items by document:', error);
      throw new Error(`Failed to get evidence items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update evidence item
   */
  async updateEvidenceItem(
    evidenceItemId: string, 
    updates: Partial<InsertEvidenceItem>
  ): Promise<EvidenceItem> {
    try {
      const [updated] = await db.update(evidenceItemsTable)
        .set(updates)
        .where(eq(evidenceItemsTable.id, evidenceItemId))
        .returning();

      if (!updated) {
        throw new Error(`Evidence item ${evidenceItemId} not found`);
      }

      return updated;
    } catch (error) {
      console.error('Error updating evidence item:', error);
      throw new Error(`Failed to update evidence item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete evidence item
   */
  async deleteEvidenceItem(evidenceItemId: string): Promise<void> {
    try {
      await db.delete(evidenceItemsTable)
        .where(eq(evidenceItemsTable.id, evidenceItemId));
    } catch (error) {
      console.error('Error deleting evidence item:', error);
      throw new Error(`Failed to delete evidence item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const evidenceCollectionService = new EvidenceCollectionService();
