import { db } from '../db';
import { controlRelationships } from '../schema';
import { eq, and, or, inArray } from 'drizzle-orm';

export interface ControlRelationship {
  id: string;
  sourceControlId: string;
  targetControlId: string;
  relationshipType: string;
  framework: string;
  strength: number;
  createdAt: Date;
}

export interface RelationshipQuery {
  controlIds?: string[];
  relationshipType?: string;
  framework?: string;
  minStrength?: number;
}

export interface ControlDependency {
  controlId: string;
  dependencies: ControlRelationship[];
  dependents: ControlRelationship[];
  depth: number;
}

export class ControlRelationshipService {
  /**
   * Get control relationships based on query criteria
   */
  async getControlRelationships(
    controlIds: string[],
    framework?: string,
    relationshipType?: string,
    minStrength?: number
  ): Promise<ControlRelationship[]> {
    try {
      let conditions = [
        or(
          inArray(controlRelationships.sourceControlId, controlIds),
          inArray(controlRelationships.targetControlId, controlIds)
        )
      ];

      if (framework) {
        conditions.push(eq(controlRelationships.framework, framework));
      }

      if (relationshipType) {
        conditions.push(eq(controlRelationships.relationshipType, relationshipType));
      }

      if (minStrength) {
        conditions.push(eq(controlRelationships.strength, minStrength));
      }

      const results = await db.select()
        .from(controlRelationships)
        .where(and(...conditions));

      return results.map(this.mapDbRowToRelationship);
    } catch (error) {
      console.error('Error getting control relationships:', error);
      throw new Error(`Failed to get control relationships: ${error.message}`);
    }
  }

  /**
   * Get control dependencies (controls that this control depends on)
   */
  async getControlDependencies(controlId: string, framework?: string): Promise<ControlRelationship[]> {
    try {
      let conditions = [eq(controlRelationships.targetControlId, controlId)];
      
      if (framework) {
        conditions.push(eq(controlRelationships.framework, framework));
      }

      const results = await db.select()
        .from(controlRelationships)
        .where(and(...conditions));

      return results.map(this.mapDbRowToRelationship);
    } catch (error) {
      console.error('Error getting control dependencies:', error);
      throw new Error(`Failed to get control dependencies: ${error.message}`);
    }
  }

  /**
   * Get control dependents (controls that depend on this control)
   */
  async getControlDependents(controlId: string, framework?: string): Promise<ControlRelationship[]> {
    try {
      let conditions = [eq(controlRelationships.sourceControlId, controlId)];
      
      if (framework) {
        conditions.push(eq(controlRelationships.framework, framework));
      }

      const results = await db.select()
        .from(controlRelationships)
        .where(and(...conditions));

      return results.map(this.mapDbRowToRelationship);
    } catch (error) {
      console.error('Error getting control dependents:', error);
      throw new Error(`Failed to get control dependents: ${error.message}`);
    }
  }

  /**
   * Get control dependency tree with depth analysis
   */
  async getControlDependencyTree(controlId: string, framework?: string, maxDepth: number = 5): Promise<ControlDependency> {
    try {
      const visited = new Set<string>();
      const dependencies: ControlRelationship[] = [];
      const dependents: ControlRelationship[] = [];

      await this.buildDependencyTree(
        controlId,
        framework,
        maxDepth,
        0,
        visited,
        dependencies,
        dependents
      );

      return {
        controlId,
        dependencies: this.removeDuplicates(dependencies),
        dependents: this.removeDuplicates(dependents),
        depth: this.calculateMaxDepth(dependencies)
      };
    } catch (error) {
      console.error('Error building dependency tree:', error);
      throw new Error(`Failed to build dependency tree: ${error.message}`);
    }
  }

  /**
   * Detect control gaps based on relationships
   */
  async detectControlGaps(mappedControlIds: string[], framework?: string): Promise<{
    missingDependencies: ControlRelationship[];
    missingDependents: ControlRelationship[];
    gapScore: number;
  }> {
    try {
      const allDependencies: ControlRelationship[] = [];
      const allDependents: ControlRelationship[] = [];

      // Get all dependencies and dependents for mapped controls
      for (const controlId of mappedControlIds) {
        const dependencies = await this.getControlDependencies(controlId, framework);
        const dependents = await this.getControlDependents(controlId, framework);
        
        allDependencies.push(...dependencies);
        allDependents.push(...dependents);
      }

      // Find missing dependencies (controls that should be mapped but aren't)
      const missingDependencies = allDependencies.filter(
        dep => !mappedControlIds.includes(dep.sourceControlId)
      );

      // Find missing dependents (controls that depend on mapped controls but aren't mapped)
      const missingDependents = allDependents.filter(
        dep => !mappedControlIds.includes(dep.targetControlId)
      );

      // Calculate gap score (percentage of missing relationships)
      const totalRelationships = allDependencies.length + allDependents.length;
      const missingRelationships = missingDependencies.length + missingDependents.length;
      const gapScore = totalRelationships > 0 ? (missingRelationships / totalRelationships) * 100 : 0;

      return {
        missingDependencies: this.removeDuplicates(missingDependencies),
        missingDependents: this.removeDuplicates(missingDependents),
        gapScore
      };
    } catch (error) {
      console.error('Error detecting control gaps:', error);
      throw new Error(`Failed to detect control gaps: ${error.message}`);
    }
  }

  /**
   * Generate control coverage report
   */
  async generateCoverageReport(mappedControlIds: string[], framework?: string): Promise<{
    totalControls: number;
    mappedControls: number;
    coveragePercentage: number;
    dependencyCoverage: number;
    relationshipStrength: number;
    recommendations: string[];
  }> {
    try {
      // Get all controls in framework (this would query your control management system)
      const allControls = await this.getAllControlsInFramework(framework);
      const totalControls = allControls.length;

      // Get all relationships for mapped controls
      const relationships = await this.getControlRelationships(mappedControlIds, framework);
      
      // Calculate dependency coverage
      const dependencyCoverage = this.calculateDependencyCoverage(mappedControlIds, relationships);
      
      // Calculate average relationship strength
      const relationshipStrength = relationships.length > 0 
        ? relationships.reduce((sum, rel) => sum + rel.strength, 0) / relationships.length
        : 0;

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        mappedControlIds,
        relationships,
        dependencyCoverage,
        relationshipStrength
      );

      return {
        totalControls,
        mappedControls: mappedControlIds.length,
        coveragePercentage: (mappedControlIds.length / totalControls) * 100,
        dependencyCoverage,
        relationshipStrength,
        recommendations
      };
    } catch (error) {
      console.error('Error generating coverage report:', error);
      throw new Error(`Failed to generate coverage report: ${error.message}`);
    }
  }

  /**
   * Add a new control relationship
   */
  async addControlRelationship(relationship: Omit<ControlRelationship, 'id' | 'createdAt'>): Promise<string> {
    try {
      const result = await db.insert(controlRelationships).values({
        sourceControlId: relationship.sourceControlId,
        targetControlId: relationship.targetControlId,
        relationshipType: relationship.relationshipType,
        framework: relationship.framework,
        strength: relationship.strength
      }).returning({ id: controlRelationships.id });

      return result[0].id;
    } catch (error) {
      console.error('Error adding control relationship:', error);
      throw new Error(`Failed to add control relationship: ${error.message}`);
    }
  }

  /**
   * Update control relationship strength
   */
  async updateRelationshipStrength(relationshipId: string, newStrength: number): Promise<void> {
    try {
      await db.update(controlRelationships)
        .set({ strength: newStrength })
        .where(eq(controlRelationships.id, relationshipId));
    } catch (error) {
      console.error('Error updating relationship strength:', error);
      throw new Error(`Failed to update relationship strength: ${error.message}`);
    }
  }

  /**
   * Remove control relationship
   */
  async removeControlRelationship(relationshipId: string): Promise<void> {
    try {
      await db.delete(controlRelationships)
        .where(eq(controlRelationships.id, relationshipId));
    } catch (error) {
      console.error('Error removing control relationship:', error);
      throw new Error(`Failed to remove control relationship: ${error.message}`);
    }
  }

  /**
   * Build dependency tree recursively
   */
  private async buildDependencyTree(
    controlId: string,
    framework: string | undefined,
    maxDepth: number,
    currentDepth: number,
    visited: Set<string>,
    dependencies: ControlRelationship[],
    dependents: ControlRelationship[]
  ): Promise<void> {
    if (currentDepth >= maxDepth || visited.has(controlId)) {
      return;
    }

    visited.add(controlId);

    // Get dependencies and dependents
    const deps = await this.getControlDependencies(controlId, framework);
    const deps2 = await this.getControlDependents(controlId, framework);

    dependencies.push(...deps);
    dependents.push(...deps2);

    // Recursively build tree for dependencies
    for (const dep of deps) {
      await this.buildDependencyTree(
        dep.sourceControlId,
        framework,
        maxDepth,
        currentDepth + 1,
        visited,
        dependencies,
        dependents
      );
    }

    // Recursively build tree for dependents
    for (const dep of deps2) {
      await this.buildDependencyTree(
        dep.targetControlId,
        framework,
        maxDepth,
        currentDepth + 1,
        visited,
        dependencies,
        dependents
      );
    }
  }

  /**
   * Calculate dependency coverage percentage
   */
  private calculateDependencyCoverage(mappedControlIds: string[], relationships: ControlRelationship[]): number {
    const allRelatedControls = new Set<string>();
    
    for (const rel of relationships) {
      allRelatedControls.add(rel.sourceControlId);
      allRelatedControls.add(rel.targetControlId);
    }

    const mappedRelatedControls = Array.from(allRelatedControls).filter(
      controlId => mappedControlIds.includes(controlId)
    );

    return allRelatedControls.size > 0 
      ? (mappedRelatedControls.length / allRelatedControls.size) * 100 
      : 100;
  }

  /**
   * Generate recommendations based on coverage analysis
   */
  private generateRecommendations(
    mappedControlIds: string[],
    relationships: ControlRelationship[],
    dependencyCoverage: number,
    relationshipStrength: number
  ): string[] {
    const recommendations: string[] = [];

    if (dependencyCoverage < 80) {
      recommendations.push('Consider mapping additional controls to improve dependency coverage');
    }

    if (relationshipStrength < 0.7) {
      recommendations.push('Review control mappings for stronger relationship indicators');
    }

    if (mappedControlIds.length < 10) {
      recommendations.push('Consider mapping more controls for comprehensive coverage');
    }

    const strongRelationships = relationships.filter(rel => rel.strength > 0.8);
    if (strongRelationships.length < relationships.length * 0.5) {
      recommendations.push('Focus on controls with stronger relationship indicators');
    }

    return recommendations;
  }

  /**
   * Get all controls in framework (mock implementation)
   */
  private async getAllControlsInFramework(framework?: string): Promise<string[]> {
    // This would query your control management system
    // For now, return mock data
    const controls = [
      'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8', 'AC-9', 'AC-10',
      'AU-1', 'AU-2', 'AU-3', 'AU-4', 'AU-5', 'AU-6', 'AU-7', 'AU-8', 'AU-9', 'AU-10',
      'CA-1', 'CA-2', 'CA-3', 'CA-4', 'CA-5', 'CA-6', 'CA-7', 'CA-8', 'CA-9', 'CA-10'
    ];

    return controls;
  }

  /**
   * Remove duplicate relationships
   */
  private removeDuplicates(relationships: ControlRelationship[]): ControlRelationship[] {
    const seen = new Set<string>();
    return relationships.filter(rel => {
      const key = `${rel.sourceControlId}-${rel.targetControlId}-${rel.relationshipType}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Calculate maximum depth in dependency tree
   */
  private calculateMaxDepth(relationships: ControlRelationship[]): number {
    // This is a simplified calculation
    // In a real implementation, you'd build the actual tree structure
    return Math.min(relationships.length, 5);
  }

  /**
   * Map database row to ControlRelationship object
   */
  private mapDbRowToRelationship(row: any): ControlRelationship {
    return {
      id: row.id,
      sourceControlId: row.sourceControlId,
      targetControlId: row.targetControlId,
      relationshipType: row.relationshipType,
      framework: row.framework,
      strength: parseFloat(row.strength.toString()),
      createdAt: row.createdAt
    };
  }
}
