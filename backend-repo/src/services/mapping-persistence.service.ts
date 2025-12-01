import { db } from '../db';
import { controlMappings, controlMappingHistory } from '../schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { ControlMapping } from './control-mapping.service';

export interface MappingUpdate {
  confidenceScore?: number;
  mappingCriteria?: Record<string, any>;
  updatedBy?: string;
}

export interface MappingQuery {
  documentId?: string;
  controlId?: string;
  framework?: string;
  minConfidence?: number;
  maxConfidence?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface MappingHistoryEntry {
  id: string;
  mappingId: string;
  action: string;
  oldConfidenceScore?: number;
  newConfidenceScore?: number;
  changeReason?: string;
  changedBy?: string;
  changedAt: Date;
}

export class MappingPersistenceService {
  /**
   * Save control mappings to database
   */
  async saveMappings(mappings: Omit<ControlMapping, 'id'>[]): Promise<ControlMapping[]> {
    try {
      const savedMappings: ControlMapping[] = [];

      for (const mapping of mappings) {
        const result = await db.insert(controlMappings).values({
          documentId: mapping.documentId,
          controlId: mapping.controlId,
          controlFramework: mapping.controlFramework,
          confidenceScore: mapping.confidenceScore,
          mappingCriteria: mapping.mappingCriteria,
          createdBy: mapping.createdBy
        }).returning();

        const savedMapping = this.mapDbRowToControlMapping(result[0]);
        savedMappings.push(savedMapping);
      }

      return savedMappings;
    } catch (error) {
      console.error('Error saving mappings:', error);
      throw new Error(`Failed to save mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get mappings based on query criteria
   */
  async getMappings(query: MappingQuery): Promise<{
    mappings: ControlMapping[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const conditions = this.buildQueryConditions(query);
      
      // Get total count
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(controlMappings)
        .where(and(...conditions));
      
      const total = countResult[0]?.count || 0;

      // Get mappings with pagination
      let queryBuilder = db.select()
        .from(controlMappings)
        .where(and(...conditions))
        .orderBy(desc(controlMappings.confidenceScore));

      if (query.limit) {
        queryBuilder = queryBuilder.limit(query.limit);
      }

      if (query.offset) {
        queryBuilder = queryBuilder.offset(query.offset);
      }

      const results = await queryBuilder;
      const mappings = results.map(this.mapDbRowToControlMapping);

      return {
        mappings,
        total,
        hasMore: query.offset ? (query.offset + mappings.length) < total : false
      };
    } catch (error) {
      console.error('Error getting mappings:', error);
      throw new Error(`Failed to get mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get mapping by ID
   */
  async getMappingById(mappingId: string): Promise<ControlMapping | null> {
    try {
      const result = await db.select()
        .from(controlMappings)
        .where(eq(controlMappings.id, mappingId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapDbRowToControlMapping(result[0]);
    } catch (error) {
      console.error('Error getting mapping by ID:', error);
      throw new Error(`Failed to get mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update mapping
   */
  async updateMapping(mappingId: string, update: MappingUpdate): Promise<ControlMapping> {
    try {
      // Get current mapping for history
      const currentMapping = await this.getMappingById(mappingId);
      if (!currentMapping) {
        throw new Error(`Mapping ${mappingId} not found`);
      }

      // Update mapping
      const result = await db.update(controlMappings)
        .set({
          confidenceScore: update.confidenceScore,
          mappingCriteria: update.mappingCriteria,
          updatedAt: new Date()
        })
        .where(eq(controlMappings.id, mappingId))
        .returning();

      const updatedMapping = this.mapDbRowToControlMapping(result[0]);

      // Record history if confidence score changed
      if (update.confidenceScore !== undefined && 
          update.confidenceScore !== currentMapping.confidenceScore) {
        await this.recordMappingHistory({
          mappingId,
          action: 'updated',
          oldConfidenceScore: currentMapping.confidenceScore,
          newConfidenceScore: update.confidenceScore,
          changeReason: 'Manual update',
          changedBy: update.updatedBy
        });
      }

      return updatedMapping;
    } catch (error) {
      console.error('Error updating mapping:', error);
      throw new Error(`Failed to update mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const currentMapping = await this.getMappingById(mappingId);
      if (!currentMapping) {
        throw new Error(`Mapping ${mappingId} not found`);
      }

      await this.updateMapping(mappingId, {
        confidenceScore: newConfidence,
        updatedBy: userId
      });

      await this.recordMappingHistory({
        mappingId,
        action: 'confidence_adjusted',
        oldConfidenceScore: currentMapping.confidenceScore,
        newConfidenceScore: newConfidence,
        changeReason: reason,
        changedBy: userId
      });
    } catch (error) {
      console.error('Error updating mapping confidence:', error);
      throw new Error(`Failed to update mapping confidence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove mapping
   */
  async removeMapping(mappingId: string, userId?: string): Promise<void> {
    try {
      const currentMapping = await this.getMappingById(mappingId);
      if (!currentMapping) {
        throw new Error(`Mapping ${mappingId} not found`);
      }

      // Record deletion in history
      await this.recordMappingHistory({
        mappingId,
        action: 'deleted',
        oldConfidenceScore: currentMapping.confidenceScore,
        changeReason: 'Mapping removed',
        changedBy: userId
      });

      // Delete mapping
      await db.delete(controlMappings)
        .where(eq(controlMappings.id, mappingId));
    } catch (error) {
      console.error('Error removing mapping:', error);
      throw new Error(`Failed to remove mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get mapping history
   */
  async getMappingHistory(mappingId: string): Promise<MappingHistoryEntry[]> {
    try {
      const results = await db.select()
        .from(controlMappingHistory)
        .where(eq(controlMappingHistory.mappingId, mappingId))
        .orderBy(desc(controlMappingHistory.changedAt));

      return results.map(this.mapDbRowToHistoryEntry);
    } catch (error) {
      console.error('Error getting mapping history:', error);
      throw new Error(`Failed to get mapping history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get mapping statistics
   */
  async getMappingStatistics(query: MappingQuery): Promise<{
    totalMappings: number;
    averageConfidence: number;
    highConfidenceCount: number;
    mediumConfidenceCount: number;
    lowConfidenceCount: number;
    frameworks: Record<string, number>;
    topControls: Array<{ controlId: string; count: number }>;
  }> {
    try {
      const conditions = this.buildQueryConditions(query);
      
      // Get basic statistics
      const statsResult = await db.select({
        totalMappings: sql<number>`count(*)`,
        averageConfidence: sql<number>`avg(confidence_score)`,
        highConfidence: sql<number>`count(case when confidence_score >= 80 then 1 end)`,
        mediumConfidence: sql<number>`count(case when confidence_score >= 60 and confidence_score < 80 then 1 end)`,
        lowConfidence: sql<number>`count(case when confidence_score < 60 then 1 end)`
      })
      .from(controlMappings)
      .where(and(...conditions));

      const stats = statsResult[0];

      // Get framework distribution
      const frameworkResult = await db.select({
        framework: controlMappings.controlFramework,
        count: sql<number>`count(*)`
      })
      .from(controlMappings)
      .where(and(...conditions))
      .groupBy(controlMappings.controlFramework);

      const frameworks = frameworkResult.reduce((acc, row) => {
        acc[row.framework] = row.count;
        return acc;
      }, {} as Record<string, number>);

      // Get top controls
      const topControlsResult = await db.select({
        controlId: controlMappings.controlId,
        count: sql<number>`count(*)`
      })
      .from(controlMappings)
      .where(and(...conditions))
      .groupBy(controlMappings.controlId)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);

      const topControls = topControlsResult.map(row => ({
        controlId: row.controlId,
        count: row.count
      }));

      return {
        totalMappings: stats.totalMappings,
        averageConfidence: parseFloat(stats.averageConfidence?.toFixed(2) || '0'),
        highConfidenceCount: stats.highConfidence,
        mediumConfidenceCount: stats.mediumConfidence,
        lowConfidenceCount: stats.lowConfidence,
        frameworks,
        topControls
      };
    } catch (error) {
      console.error('Error getting mapping statistics:', error);
      throw new Error(`Failed to get mapping statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk update mappings
   */
  async bulkUpdateMappings(updates: Array<{ id: string; update: MappingUpdate }>): Promise<void> {
    try {
      for (const { id, update } of updates) {
        await this.updateMapping(id, update);
      }
    } catch (error) {
      console.error('Error bulk updating mappings:', error);
      throw new Error(`Failed to bulk update mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up old mappings (for maintenance)
   */
  async cleanupOldMappings(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await db.delete(controlMappings)
        .where(lte(controlMappings.createdAt, cutoffDate))
        .returning({ id: controlMappings.id });

      return result.length;
    } catch (error) {
      console.error('Error cleaning up old mappings:', error);
      throw new Error(`Failed to cleanup old mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build query conditions from MappingQuery
   */
  private buildQueryConditions(query: MappingQuery): any[] {
    const conditions: any[] = [];

    if (query.documentId) {
      conditions.push(eq(controlMappings.documentId, query.documentId));
    }

    if (query.controlId) {
      conditions.push(eq(controlMappings.controlId, query.controlId));
    }

    if (query.framework) {
      conditions.push(eq(controlMappings.controlFramework, query.framework));
    }

    if (query.minConfidence !== undefined) {
      conditions.push(gte(controlMappings.confidenceScore, query.minConfidence));
    }

    if (query.maxConfidence !== undefined) {
      conditions.push(lte(controlMappings.confidenceScore, query.maxConfidence));
    }

    if (query.createdAfter) {
      conditions.push(gte(controlMappings.createdAt, query.createdAfter));
    }

    if (query.createdBefore) {
      conditions.push(lte(controlMappings.createdAt, query.createdBefore));
    }

    return conditions;
  }

  /**
   * Record mapping history entry
   */
  private async recordMappingHistory(entry: Omit<MappingHistoryEntry, 'id' | 'changedAt'>): Promise<void> {
    try {
      await db.insert(controlMappingHistory).values({
        mappingId: entry.mappingId,
        action: entry.action,
        oldConfidenceScore: entry.oldConfidenceScore,
        newConfidenceScore: entry.newConfidenceScore,
        changeReason: entry.changeReason,
        changedBy: entry.changedBy
      });
    } catch (error) {
      console.error('Error recording mapping history:', error);
      // Don't throw here as it's not critical
    }
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
      confidenceScore: parseFloat(row.confidenceScore.toString()),
      mappingCriteria: row.mappingCriteria || {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy
    };
  }

  /**
   * Map database row to MappingHistoryEntry object
   */
  private mapDbRowToHistoryEntry(row: any): MappingHistoryEntry {
    return {
      id: row.id,
      mappingId: row.mappingId,
      action: row.action,
      oldConfidenceScore: row.oldConfidenceScore ? parseFloat(row.oldConfidenceScore.toString()) : undefined,
      newConfidenceScore: row.newConfidenceScore ? parseFloat(row.newConfidenceScore.toString()) : undefined,
      changeReason: row.changeReason,
      changedBy: row.changedBy,
      changedAt: row.changedAt
    };
  }
}
