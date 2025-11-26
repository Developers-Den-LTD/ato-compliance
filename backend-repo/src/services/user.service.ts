import { eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../schema';

export class UserService {
  async getUsers(page: number = 1, limit: number = 10, search: string = '') {
    const offset = (page - 1) * limit;

    // Build where clause for search
    const whereClause = search
      ? or(
          ilike(users.username, `%${search}%`)
        )
      : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(whereClause);

    // Get paginated users
    const userList = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(users.username);

    return {
      users: userList,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getUserById(id: string) {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  async createUser(username: string, password: string, role: string = 'user') {
    const bcrypt = await import('bcrypt');
    
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('Username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.default.hash(password, 10);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        role,
      })
      .returning({ id: users.id, username: users.username, role: users.role });

    return newUser;
  }

  async deleteUser(id: string) {
    await db.delete(users).where(eq(users.id, id));
  }
}

export const userService = new UserService();
