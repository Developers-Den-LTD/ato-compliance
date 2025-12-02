import { eq, ilike, or, sql, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { controls, systemControls } from '../schema';

export interface GetControlsParams {
  page?: number;
  limit?: number;
  search?: string;
  family?: string;
  baseline?: string;
  framework?: string;
}

export interface UpdateSystemControlData {
  status?: string;
  implementationText?: string;
  responsibleParty?: string;
  implementationDate?: Date;
  updatedBy: string;
}

export class ControlService {
  async getControls(params: GetControlsParams = {}) {
    const { page = 1, limit = 50, search = '', family, baseline, framework } = params;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: any[] = [];
    
    if (search) {
      const searchCondition = or(
        ilike(controls.id, `%${search}%`),
        ilike(controls.title, `%${search}%`),
        ilike(controls.description, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
    
    if (family) {
      conditions.push(eq(controls.family, family));
    }
    
    if (framework) {
      conditions.push(eq(controls.framework, framework));
    }
    
    if (baseline) {
      conditions.push(sql`${baseline} = ANY(${controls.baseline})`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(controls)
      .where(whereClause);

    // Get paginated controls
    const controlList = await db
      .select()
      .from(controls)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(controls.id);

    // Get family statistics (always from all controls, not filtered)
    const familyStats = await db
      .select({
        family: controls.family,
        total: sql<number>`count(*)::int`,
      })
      .from(controls)
      .groupBy(controls.family)
      .orderBy(controls.family);

    // Get unique baselines
    const baselineList = await db
      .selectDistinct({
        baseline: sql<string>`unnest(${controls.baseline})`,
      })
      .from(controls)
      .orderBy(sql`unnest(${controls.baseline})`);

    return {
      controls: controlList,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
      families: familyStats.map(f => ({
        name: f.family,
        total: f.total,
      })),
      baselines: baselineList.map(b => b.baseline),
    };
  }

  async getControlById(id: string) {
    const [control] = await db
      .select()
      .from(controls)
      .where(eq(controls.id, id))
      .limit(1);

    return control || null;
  }

  async getControlFamilies() {
    const families = await db
      .selectDistinct({ family: controls.family })
      .from(controls)
      .orderBy(controls.family);

    return families.map(f => f.family);
  }

  async getControlStats() {
    // Get total count
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(controls);

    // Get counts by family
    const familyStats = await db
      .select({
        family: controls.family,
        count: sql<number>`count(*)::int`,
      })
      .from(controls)
      .groupBy(controls.family)
      .orderBy(controls.family);

    // Get counts by baseline
    const baselineStats = await db
      .select({
        baseline: sql<string>`unnest(${controls.baseline})`,
        count: sql<number>`count(*)::int`,
      })
      .from(controls)
      .groupBy(sql`unnest(${controls.baseline})`);

    // Get counts by priority
    const priorityStats = await db
      .select({
        priority: controls.priority,
        count: sql<number>`count(*)::int`,
      })
      .from(controls)
      .where(sql`${controls.priority} IS NOT NULL`)
      .groupBy(controls.priority);

    return {
      total,
      byFamily: familyStats.reduce((acc, s) => {
        acc[s.family] = s.count;
        return acc;
      }, {} as Record<string, number>),
      byBaseline: baselineStats.reduce((acc, s) => {
        acc[s.baseline] = s.count;
        return acc;
      }, {} as Record<string, number>),
      byPriority: priorityStats.reduce((acc, s) => {
        acc[s.priority || 'unknown'] = s.count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // System Control Implementation methods
  async getSystemControls(systemId: string, params: GetControlsParams = {}) {
    const { page = 1, limit = 50, search = '', family, baseline } = params;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(systemControls.systemId, systemId)];
    
    if (search) {
      const searchCondition = or(
        ilike(controls.id, `%${search}%`),
        ilike(controls.title, `%${search}%`),
        ilike(controls.description, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
    
    if (family) {
      conditions.push(eq(controls.family, family));
    }
    
    if (baseline) {
      conditions.push(sql`${baseline} = ANY(${controls.baseline})`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(systemControls)
      .innerJoin(controls, eq(systemControls.controlId, controls.id))
      .where(whereClause);

    // Get paginated system controls with control details
    const systemControlList = await db
      .select({
        id: systemControls.id,
        systemId: systemControls.systemId,
        controlId: systemControls.controlId,
        status: systemControls.status,
        implementationText: systemControls.implementationText,
        responsibleParty: systemControls.responsibleParty,
        implementationDate: systemControls.implementationDate,
        lastUpdated: systemControls.lastUpdated,
        updatedBy: systemControls.updatedBy,
        createdAt: systemControls.createdAt,
        control: {
          id: controls.id,
          framework: controls.framework,
          family: controls.family,
          title: controls.title,
          description: controls.description,
          baseline: controls.baseline,
          priority: controls.priority,
          enhancement: controls.enhancement,
          parentControlId: controls.parentControlId,
          supplementalGuidance: controls.supplementalGuidance,
        },
      })
      .from(systemControls)
      .innerJoin(controls, eq(systemControls.controlId, controls.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(controls.id);

    return {
      systemControls: systemControlList,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getSystemControlById(systemId: string, controlId: string) {
    const [systemControl] = await db
      .select({
        id: systemControls.id,
        systemId: systemControls.systemId,
        controlId: systemControls.controlId,
        status: systemControls.status,
        implementationText: systemControls.implementationText,
        responsibleParty: systemControls.responsibleParty,
        implementationDate: systemControls.implementationDate,
        lastUpdated: systemControls.lastUpdated,
        updatedBy: systemControls.updatedBy,
        createdAt: systemControls.createdAt,
        control: {
          id: controls.id,
          framework: controls.framework,
          family: controls.family,
          title: controls.title,
          description: controls.description,
          baseline: controls.baseline,
          priority: controls.priority,
          enhancement: controls.enhancement,
          parentControlId: controls.parentControlId,
          supplementalGuidance: controls.supplementalGuidance,
        },
      })
      .from(systemControls)
      .innerJoin(controls, eq(systemControls.controlId, controls.id))
      .where(
        and(
          eq(systemControls.systemId, systemId),
          eq(systemControls.controlId, controlId)
        )
      )
      .limit(1);

    return systemControl || null;
  }

  async updateSystemControl(
    systemId: string,
    controlId: string,
    data: UpdateSystemControlData
  ) {
    const [updated] = await db
      .update(systemControls)
      .set({
        ...data,
        lastUpdated: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(systemControls.systemId, systemId),
          eq(systemControls.controlId, controlId)
        )
      )
      .returning();

    return updated;
  }

  async bulkAssignControls(systemId: string, controlIds: string[], userId: string) {
    const values = controlIds.map(controlId => ({
      systemId,
      controlId,
      status: 'not_implemented' as const,
      updatedBy: userId,
    }));

    const inserted = await db
      .insert(systemControls)
      .values(values)
      .onConflictDoNothing()
      .returning();

    return inserted;
  }

  async removeSystemControl(systemId: string, controlId: string) {
    await db
      .delete(systemControls)
      .where(
        and(
          eq(systemControls.systemId, systemId),
          eq(systemControls.controlId, controlId)
        )
      );
  }

  async getSystemControlStats(systemId: string) {
    const stats = await db
      .select({
        status: systemControls.status,
        count: sql<number>`count(*)::int`,
      })
      .from(systemControls)
      .where(eq(systemControls.systemId, systemId))
      .groupBy(systemControls.status);

    const total = stats.reduce((sum, s) => sum + s.count, 0);
    
    return {
      total,
      byStatus: stats.reduce((acc, s) => {
        acc[s.status] = s.count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

export const controlService = new ControlService();
