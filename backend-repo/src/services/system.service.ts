import { eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { systems } from '../schema';

export interface CreateSystemData {
  name: string;
  description?: string;
  category: string;
  impactLevel: string;
  owner?: string;
  systemType?: string;
  operatingSystem?: string;
  createdBy: string;
}

export interface UpdateSystemData {
  name?: string;
  description?: string;
  category?: string;
  impactLevel?: string;
  complianceStatus?: string;
  owner?: string;
  systemType?: string;
  operatingSystem?: string;
}

export class SystemService {
  async getSystems(page: number = 1, limit: number = 10, search: string = '') {
    const offset = (page - 1) * limit;

    // Build where clause for search
    const whereClause = search
      ? or(
          ilike(systems.name, `%${search}%`),
          ilike(systems.description, `%${search}%`),
          ilike(systems.owner, `%${search}%`)
        )
      : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(systems)
      .where(whereClause);

    // Get paginated systems
    const systemList = await db
      .select()
      .from(systems)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(systems.createdAt);

    return {
      systems: systemList,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getSystemById(id: string) {
    const [system] = await db
      .select()
      .from(systems)
      .where(eq(systems.id, id))
      .limit(1);

    return system || null;
  }

  async createSystem(data: CreateSystemData) {
    const [newSystem] = await db
      .insert(systems)
      .values({
        name: data.name,
        description: data.description,
        category: data.category,
        impactLevel: data.impactLevel,
        owner: data.owner,
        systemType: data.systemType,
        operatingSystem: data.operatingSystem,
        createdBy: data.createdBy,
        complianceStatus: 'not-assessed',
      })
      .returning();

    return newSystem;
  }

  async updateSystem(id: string, data: UpdateSystemData) {
    const [updatedSystem] = await db
      .update(systems)
      .set({
        ...data,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(systems.id, id))
      .returning();

    return updatedSystem;
  }

  async deleteSystem(id: string) {
    await db.delete(systems).where(eq(systems.id, id));
  }
}

export const systemService = new SystemService();
