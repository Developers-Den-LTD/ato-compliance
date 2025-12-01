// Context Persistence Service
// Handles database operations for context aggregation

import { db } from '../db';
import { 
  evidenceAggregations, 
  evidenceItems, 
  evidenceRelationships, 
  contextVersions
} from "../schema";
import { eq, and, desc, sql } from 'drizzle-orm';
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

export class ContextPersistenceService {
  /**
   * Save evidence aggregation
   */
  async saveAggregation(aggregation: InsertEvidenceAggregation): Promise<EvidenceAggregation> {
    try {
      const [saved] = await db.insert(evidenceAggregations)
        .values(aggregation)
        .returning();

      return saved;
    } catch (error) {
      console.error('Error saving evidence aggregation:', error);
      throw new Error(`Failed to save aggregation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get evidence aggregation by control
   */
  async getAggregation(controlId: string, controlFramework: string): Promise<EvidenceAggregation | null> {
    try {
      const aggregation = await db.query.evidenceAggregations.findFirst({
        where: and(
          eq(evidenceAggregations.controlId, controlId),
          eq(evidenceAggregations.controlFramework, controlFramework)
        ),
        orderBy: desc(evidenceAggregations.updatedAt)
      });

      return aggregation || null;
    } catch (error) {
      console.error('Error getting evidence aggregation:', error);
      throw new Error(`Failed to get aggregation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update evidence aggregation
   */
  async updateAggregation(
    aggregationId: string, 
    updates: Partial<InsertEvidenceAggregation>
  ): Promise<EvidenceAggregation> {
    try {
      const [updated] = await db.update(evidenceAggregations)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(evidenceAggregations.id, aggregationId))
        .returning();

      if (!updated) {
        throw new Error(`Aggregation ${aggregationId} not found`);
      }

      return updated;
    } catch (error) {
      console.error('Error updating evidence aggregation:', error);
      throw new Error(`Failed to update aggregation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete evidence aggregation
   */
  async deleteAggregation(aggregationId: string): Promise<void> {
    try {
      await db.delete(evidenceAggregations)
        .where(eq(evidenceAggregations.id, aggregationId));
    } catch (error) {
      console.error('Error deleting evidence aggregation:', error);
      throw new Error(`Failed to delete aggregation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save evidence item
   */
  async saveEvidenceItem(evidenceItem: InsertEvidenceItem): Promise<EvidenceItem> {
    try {
      const [saved] = await db.insert(evidenceItems)
        .values(evidenceItem)
        .returning();

      return saved;
    } catch (error) {
      console.error('Error saving evidence item:', error);
      throw new Error(`Failed to save evidence item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get evidence items by control
   */
  async getEvidenceItems(controlId: string, controlFramework?: string): Promise<EvidenceItem[]> {
    try {
      const whereConditions = [eq(evidenceItems.controlId, controlId)];
      
      if (controlFramework) {
        // This would require a join with evidenceAggregations or a different approach
        // For now, we'll just filter by controlId
      }

      return await db.query.evidenceItems.findMany({
        where: and(...whereConditions),
        orderBy: desc(evidenceItems.relevanceScore)
      });
    } catch (error) {
      console.error('Error getting evidence items:', error);
      throw new Error(`Failed to get evidence items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get evidence items by document
   */
  async getEvidenceItemsByDocument(documentId: string): Promise<EvidenceItem[]> {
    try {
      return await db.query.evidenceItems.findMany({
        where: eq(evidenceItems.documentId, documentId),
        orderBy: desc(evidenceItems.createdAt)
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
      const [updated] = await db.update(evidenceItems)
        .set(updates)
        .where(eq(evidenceItems.id, evidenceItemId))
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
      await db.delete(evidenceItems)
        .where(eq(evidenceItems.id, evidenceItemId));
    } catch (error) {
      console.error('Error deleting evidence item:', error);
      throw new Error(`Failed to delete evidence item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save evidence relationship
   */
  async saveEvidenceRelationship(relationship: InsertEvidenceRelationship): Promise<EvidenceRelationship> {
    try {
      const [saved] = await db.insert(evidenceRelationships)
        .values(relationship)
        .returning();

      return saved;
    } catch (error) {
      console.error('Error saving evidence relationship:', error);
      throw new Error(`Failed to save evidence relationship: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get evidence relationships
   */
  async getEvidenceRelationships(evidenceItemId: string): Promise<EvidenceRelationship[]> {
    try {
      return await db.query.evidenceRelationships.findMany({
        where: and(
          sql`(${evidenceRelationships.sourceEvidenceId} = ${evidenceItemId} OR ${evidenceRelationships.targetEvidenceId} = ${evidenceItemId})`
        ),
        orderBy: desc(evidenceRelationships.strength)
      });
    } catch (error) {
      console.error('Error getting evidence relationships:', error);
      throw new Error(`Failed to get evidence relationships: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete evidence relationship
   */
  async deleteEvidenceRelationship(relationshipId: string): Promise<void> {
    try {
      await db.delete(evidenceRelationships)
        .where(eq(evidenceRelationships.id, relationshipId));
    } catch (error) {
      console.error('Error deleting evidence relationship:', error);
      throw new Error(`Failed to delete evidence relationship: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save context version
   */
  async saveContextVersion(version: InsertContextVersion): Promise<ContextVersion> {
    try {
      const [saved] = await db.insert(contextVersions)
        .values(version)
        .returning();

      return saved;
    } catch (error) {
      console.error('Error saving context version:', error);
      throw new Error(`Failed to save context version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get context versions for a control
   */
  async getContextVersions(controlId: string, controlFramework: string): Promise<ContextVersion[]> {
    try {
      return await db.query.contextVersions.findMany({
        where: and(
          eq(contextVersions.controlId, controlId),
          eq(contextVersions.controlFramework, controlFramework)
        ),
        orderBy: desc(contextVersions.versionNumber)
      });
    } catch (error) {
      console.error('Error getting context versions:', error);
      throw new Error(`Failed to get context versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get latest context version for a control
   */
  async getLatestContextVersion(controlId: string, controlFramework: string): Promise<ContextVersion | null> {
    try {
      const version = await db.query.contextVersions.findFirst({
        where: and(
          eq(contextVersions.controlId, controlId),
          eq(contextVersions.controlFramework, controlFramework)
        ),
        orderBy: desc(contextVersions.versionNumber)
      });

      return version || null;
    } catch (error) {
      console.error('Error getting latest context version:', error);
      throw new Error(`Failed to get latest context version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get context version by ID
   */
  async getContextVersion(versionId: string): Promise<ContextVersion | null> {
    try {
      return await db.query.contextVersions.findFirst({
        where: eq(contextVersions.id, versionId)
      });
    } catch (error) {
      console.error('Error getting context version:', error);
      throw new Error(`Failed to get context version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete context version
   */
  async deleteContextVersion(versionId: string): Promise<void> {
    try {
      await db.delete(contextVersions)
        .where(eq(contextVersions.id, versionId));
    } catch (error) {
      console.error('Error deleting context version:', error);
      throw new Error(`Failed to delete context version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get aggregation statistics
   */
  async getAggregationStats(): Promise<{
    totalAggregations: number;
    totalEvidenceItems: number;
    totalRelationships: number;
    averageQualityScore: number;
  }> {
    try {
      const [aggregationStats] = await db
        .select({
          totalAggregations: sql<number>`count(*)`,
          averageQualityScore: sql<number>`avg(${evidenceAggregations.qualityScore})`
        })
        .from(evidenceAggregations);

      const [evidenceStats] = await db
        .select({
          totalEvidenceItems: sql<number>`count(*)`
        })
        .from(evidenceItems);

      const [relationshipStats] = await db
        .select({
          totalRelationships: sql<number>`count(*)`
        })
        .from(evidenceRelationships);

      return {
        totalAggregations: aggregationStats.totalAggregations || 0,
        totalEvidenceItems: evidenceStats.totalEvidenceItems || 0,
        totalRelationships: relationshipStats.totalRelationships || 0,
        averageQualityScore: aggregationStats.averageQualityScore || 0
      };
    } catch (error) {
      console.error('Error getting aggregation stats:', error);
      throw new Error(`Failed to get aggregation stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get evidence items by quality range
   */
  async getEvidenceItemsByQualityRange(
    minQuality: number, 
    maxQuality: number
  ): Promise<EvidenceItem[]> {
    try {
      return await db.query.evidenceItems.findMany({
        where: and(
          sql`${evidenceItems.qualityScore} >= ${minQuality}`,
          sql`${evidenceItems.qualityScore} <= ${maxQuality}`
        ),
        orderBy: desc(evidenceItems.qualityScore)
      });
    } catch (error) {
      console.error('Error getting evidence items by quality range:', error);
      throw new Error(`Failed to get evidence items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get evidence items by type
   */
  async getEvidenceItemsByType(evidenceType: string): Promise<EvidenceItem[]> {
    try {
      return await db.query.evidenceItems.findMany({
        where: eq(evidenceItems.evidenceType, evidenceType),
        orderBy: desc(evidenceItems.createdAt)
      });
    } catch (error) {
      console.error('Error getting evidence items by type:', error);
      throw new Error(`Failed to get evidence items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const contextPersistenceService = new ContextPersistenceService();
