// SystemService - Comprehensive system management service
import { db } from '../db';
import { systems, users, controls, systemControls, ComplianceStatus } from "../schema";
import { eq, and, like, desc, asc, sql, inArray } from 'drizzle-orm';
import { artifactService, type ArtifactSummary } from '../services/artifact-service';
import { storage } from '../storage';
import { z } from 'zod';

// Validation schemas
const CreateSystemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  category: z.enum(['General Support System', 'Major Application', 'Minor Application', 'Enclave']),
  impactLevel: z.enum(['Low', 'Moderate', 'High']),
  complianceStatus: ComplianceStatus,
  owner: z.string().uuid(),
  systemType: z.string().optional(),
  operatingSystem: z.string().optional(),
  stigProfiles: z.array(z.string()).optional(),
  autoStigUpdates: z.boolean().optional(),
});

const UpdateSystemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(1000).optional(),
  category: z.enum(['General Support System', 'Major Application', 'Minor Application', 'Enclave']).optional(),
  impactLevel: z.enum(['Low', 'Moderate', 'High']).optional(),
  complianceStatus: ComplianceStatus.optional(),
  systemType: z.string().optional(),
  operatingSystem: z.string().optional(),
  stigProfiles: z.array(z.string()).optional(),
  autoStigUpdates: z.boolean().optional(),
});

const SystemQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  impactLevel: z.string().optional(),
  complianceStatus: z.string().optional(),
  owner: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'complianceStatus']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateSystemData = z.infer<typeof CreateSystemSchema>;
export type UpdateSystemData = z.infer<typeof UpdateSystemSchema>;
export type SystemQuery = z.infer<typeof SystemQuerySchema>;

export class SystemService {
  private async buildSystemWithConfidence(systemId: string) {
    const [system, summary, documents] = await Promise.all([
      this.getSystemById(systemId),
      artifactService.getArtifactSummary(systemId),
      storage.getDocumentsBySystem(systemId)
    ]);

    if (!system) return null;

    const confidenceScore = calculateConfidence(summary, documents.length);

    return {
      ...system,
      evidenceSummary: summary,
      documentCount: documents.length,
      confidenceScore,
    };
  }
  /**
   * Create a new system
   */
  async createSystem(systemData: CreateSystemData) {
    // Validate input
    const validatedData = CreateSystemSchema.parse(systemData);

    // Verify owner exists (skip if auth disabled or in development)
    if (process.env.NODE_ENV === 'production' && process.env.DISABLE_AUTH !== 'true') {
      const owner = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, validatedData.owner))
        .limit(1);

      if (owner.length === 0) {
        throw new Error('Owner not found');
      }
    }

    // Check for duplicate system name
    const existingSystem = await this.getSystemByName(validatedData.name);
    if (existingSystem) {
      throw new Error('System name already exists');
    }

    // Create system
    const [system] = await db
      .insert(systems)
      .values(validatedData as any)
      .returning();

    // Auto-assign baseline controls based on impact level
    // Run in background to avoid blocking response
    this.assignBaselineControls(system.id, validatedData.impactLevel)
      .then(() => console.log(`✅ Baseline controls assigned to system ${system.id}`))
      .catch(error => console.error('Failed to assign baseline controls to system:', error));

    // If STIG profiles are provided, assign them and map controls
    // Run in background to avoid blocking response
    if (validatedData.stigProfiles && validatedData.stigProfiles.length > 0) {
      this.updateSystemStigProfiles(
        system.id, 
        validatedData.stigProfiles, 
        validatedData.autoStigUpdates ?? true
      )
        .then(() => console.log(`✅ STIG profiles assigned to system ${system.id}`))
        .catch(error => console.error('Failed to assign STIG profiles to system:', error));
    }

    return system;
  }

  /**
   * Get system by ID
   */
  async getSystemById(systemId: string) {
    const [system] = await db
      .select({
        id: systems.id,
        name: systems.name,
        description: systems.description,
        category: systems.category,
        impactLevel: systems.impactLevel,
        complianceStatus: systems.complianceStatus,
        owner: systems.owner,
        stigProfiles: systems.stigProfiles,
        createdAt: systems.createdAt,
        updatedAt: systems.updatedAt,
        ownerDetails: {
          id: users.id,
          username: users.username,
        },
      })
      .from(systems)
      .leftJoin(users, eq(systems.owner, users.id))
      .where(eq(systems.id, systemId))
      .limit(1);

    return system || null;
  }

  /**
   * Get system by name
   */
  async getSystemByName(name: string) {
    const [system] = await db
      .select()
      .from(systems)
      .where(eq(systems.name, name))
      .limit(1);

    return system || null;
  }

  /**
   * Get systems with filtering and pagination
   */
  async getSystems(query: SystemQuery) {
    // Validate query parameters - use safeParse to handle already-parsed numbers
    const parseResult = SystemQuerySchema.safeParse(query);
    const validatedQuery = parseResult.success ? parseResult.data : {
      ...query,
      limit: typeof query.limit === 'number' ? query.limit : 20,
      offset: typeof query.offset === 'number' ? query.offset : 0,
      sortBy: (query.sortBy as any) || 'name',
      sortOrder: (query.sortOrder as any) || 'asc',
    };

    // Build where conditions
    const whereConditions = [];

    if (validatedQuery.search) {
      whereConditions.push(like(systems.name, `%${validatedQuery.search}%`));
    }

    if (validatedQuery.category) {
      whereConditions.push(eq(systems.category, validatedQuery.category as any));
    }

    if (validatedQuery.impactLevel) {
      whereConditions.push(eq(systems.impactLevel, validatedQuery.impactLevel as any));
    }

    if (validatedQuery.complianceStatus) {
      whereConditions.push(eq(systems.complianceStatus, validatedQuery.complianceStatus as any));
    }

    if (validatedQuery.owner) {
      whereConditions.push(eq(systems.owner, validatedQuery.owner));
    }

    // Build order by clause
    const orderBy = validatedQuery.sortOrder === 'asc' 
      ? asc(systems[validatedQuery.sortBy])
      : desc(systems[validatedQuery.sortBy]);

    // Execute query
    const systemsList = await db
      .select({
        id: systems.id,
        name: systems.name,
        description: systems.description,
        category: systems.category,
        impactLevel: systems.impactLevel,
        complianceStatus: systems.complianceStatus,
        owner: systems.owner,
        stigProfiles: systems.stigProfiles,
        createdAt: systems.createdAt,
        updatedAt: systems.updatedAt,
        ownerDetails: {
          id: users.id,
          username: users.username,
        },
      })
      .from(systems)
      .leftJoin(users, eq(systems.owner, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(orderBy)
      .limit(validatedQuery.limit)
      .offset(validatedQuery.offset);

    // Return systems without enrichment for now
    const enrichedSystems = systemsList;

    const totalCount = await db
      .select({ count: systems.id })
      .from(systems)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return {
      systems: enrichedSystems,
      totalCount: totalCount.length,
      limit: validatedQuery.limit,
      offset: validatedQuery.offset,
      hasMore: validatedQuery.offset + validatedQuery.limit < totalCount.length,
    };
  }

  /**
   * Update system
   */
  async updateSystem(systemId: string, updateData: UpdateSystemData) {
    // Validate input
    const validatedData = UpdateSystemSchema.parse(updateData);

    // Check if system exists
    const existingSystem = await this.getSystemById(systemId);
    if (!existingSystem) {
      throw new Error('System not found');
    }

    // Check for name conflicts
    if (validatedData.name && validatedData.name !== existingSystem.name) {
      const nameExists = await this.getSystemByName(validatedData.name);
      if (nameExists) {
        throw new Error('System name already exists');
      }
    }

    // Update system
    const [updatedSystem] = await db
      .update(systems)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(systems.id, systemId))
      .returning();

    return updatedSystem;
  }

  /**
   * Delete system
   */
  async deleteSystem(systemId: string) {
    // Check if system exists
    const existingSystem = await this.getSystemById(systemId);
    if (!existingSystem) {
      throw new Error('System not found');
    }

    // TODO: Check for dependencies (assessments, documents, etc.)
    // For now, we'll allow deletion

    // Delete system
    await db.delete(systems).where(eq(systems.id, systemId));

    return { message: 'System deleted successfully' };
  }

  /**
   * Get systems by owner
   */
  async getSystemsByOwner(ownerId: string, limit = 20, offset = 0) {
    const ownerSystems = await db
      .select()
      .from(systems)
      .where(eq(systems.owner, ownerId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(systems.updatedAt));

    return ownerSystems;
  }

  /**
   * Get system statistics
   */
  async getSystemStatistics() {
    const stats = await db
      .select({
        total: systems.id,
        byCategory: systems.category,
        byImpactLevel: systems.impactLevel,
        byComplianceStatus: systems.complianceStatus,
      })
      .from(systems);

    const total = stats.length;
    const byCategory = stats.reduce((acc, system) => {
      acc[system.byCategory] = (acc[system.byCategory] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byImpactLevel = stats.reduce((acc, system) => {
      acc[system.byImpactLevel] = (acc[system.byImpactLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byComplianceStatus = stats.reduce((acc, system) => {
      acc[system.byComplianceStatus] = (acc[system.byComplianceStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      byCategory,
      byImpactLevel,
      byComplianceStatus,
    };
  }

  /**
   * Search systems
   */
  async searchSystems(searchTerm: string, limit = 20) {
    const searchResults = await db
      .select()
      .from(systems)
      .where(
        and(
          like(systems.name, `%${searchTerm}%`),
          like(systems.description, `%${searchTerm}%`)
        )
      )
      .limit(limit)
      .orderBy(desc(systems.updatedAt));

    return searchResults;
  }

  /**
   * Update system compliance status
   */
  async updateComplianceStatus(systemId: string, status: 'not-started' | 'in-progress' | 'compliant' | 'non-compliant') {
    const existingSystem = await this.getSystemById(systemId);
    if (!existingSystem) {
      throw new Error('System not found');
    }

    const [updatedSystem] = await db
      .update(systems)
      .set({
        complianceStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(systems.id, systemId))
      .returning();

    return updatedSystem;
  }

  /**
   * Verify system exists
   */
  async verifySystem(systemId: string) {
    const system = await this.getSystemById(systemId);
    return system !== null;
  }

  /**
   * Assign baseline controls based on system impact level
   */
  async assignBaselineControls(systemId: string, impactLevel: string): Promise<number> {
    console.log(`Assigning ${impactLevel} baseline controls to system ${systemId}`);
    
    // Get all controls for the specified impact level
    const baselineControls = await db
      .select({
        id: controls.id,
        framework: controls.framework,
        title: controls.title,
        family: controls.family
      })
      .from(controls)
      .where(sql`${impactLevel} = ANY(baseline)`);
    
    console.log(`Found ${baselineControls.length} baseline controls for ${impactLevel} impact level`);
    
    if (baselineControls.length === 0) {
      return 0;
    }
    
    // Bulk check for existing assignments (single query)
    const controlIds = baselineControls.map(c => c.id);
    const existingAssignments = await db
      .select({ controlId: systemControls.controlId })
      .from(systemControls)
      .where(
        and(
          eq(systemControls.systemId, systemId),
          inArray(systemControls.controlId, controlIds)
        )
      );
    
    const existingControlIds = new Set(existingAssignments.map(a => a.controlId));
    
    // Filter out already assigned controls
    const controlsToAssign = baselineControls.filter(c => !existingControlIds.has(c.id));
    
    if (controlsToAssign.length === 0) {
      console.log(`All ${baselineControls.length} baseline controls already assigned`);
      return 0;
    }
    
    // Bulk insert new assignments (single query)
    const assignments = controlsToAssign.map(control => ({
      systemId,
      controlId: control.id,
      status: 'not_implemented' as const,
      implementationText: `Auto-assigned from ${impactLevel} baseline`,
      lastUpdated: new Date()
    }));
    
    try {
      await db.insert(systemControls).values(assignments);
      console.log(`✅ Assigned ${assignments.length} baseline controls to system ${systemId}`);
      return assignments.length;
    } catch (error) {
      console.error(`Error bulk assigning controls to system ${systemId}:`, error);
      throw error;
    }
  }

  /**
   * Update system STIG profiles and assign mapped controls
   */
  async updateSystemStigProfiles(
    systemId: string,
    stigProfiles: string[],
    autoStigUpdates: boolean = true
  ) {
    // Import StigMappingService dynamically to avoid circular imports
    const { StigMappingService } = await import('./stig-mapping.service');
    const stigMappingService = new StigMappingService();
    
    return await stigMappingService.updateSystemStigProfiles(systemId, stigProfiles, autoStigUpdates);
  }

  /**
   * Get system with STIG profile details
   */
  async getSystemWithStigProfiles(systemId: string) {
    // Import StigMappingService dynamically to avoid circular imports
    const { StigMappingService } = await import('./stig-mapping.service');
    const stigMappingService = new StigMappingService();
    
    return await stigMappingService.getSystemWithStigProfiles(systemId);
  }
}

/**
 * Calculate confidence score based on evidence summary
 */
function calculateConfidence(summary: ArtifactSummary | null, documentCount: number): number {
  if (!summary || documentCount === 0) return 0;

  // Simple confidence calculation based on evidence quality
  const totalArtifacts = summary.totalCount || 0;
  const artifactTypes = (summary as any).artifactTypes;
  const hasDescriptions = artifactTypes && Array.isArray(artifactTypes) 
    ? artifactTypes.some((t: any) => t.count > 0) 
    : false;

  if (totalArtifacts === 0) return 0;
  if (totalArtifacts >= 10 && hasDescriptions) return 90;
  if (totalArtifacts >= 5 && hasDescriptions) return 75;
  if (totalArtifacts >= 3) return 60;
  if (totalArtifacts >= 1) return 40;

  return 20;
}

// Export singleton instance
export const systemService = new SystemService();
