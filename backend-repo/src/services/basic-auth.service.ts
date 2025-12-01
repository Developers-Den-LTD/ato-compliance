import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from "../schema";

export interface BasicAuthResult {
  success: boolean;
  user?: { id: string; username: string };
  sessionToken?: string;
  error?: string;
}

export class BasicAuthService {
  private sessions = new Map<string, { userId: string; expiresAt: Date }>();

  async authenticateUser(username: string, password: string): Promise<BasicAuthResult> {
    try {
      // Find user - only select id, username, and passwordHash
      const result = await db
        .select({
          id: users.id,
          username: users.username,
          passwordHash: users.passwordHash
        })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      
      const user = result[0];
      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Create session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Store in memory for backward compatibility
      this.sessions.set(sessionToken, {
        userId: user.id,
        expiresAt
      });
      
      // Also store in database for proper authentication
      try {
        await db.execute(sql`
          INSERT INTO user_sessions (
            id, user_id, token, expires_at, is_active
          ) VALUES (
            gen_random_uuid(),
            ${user.id},
            ${sessionToken},
            ${expiresAt},
            true
          )
        `);
      } catch (dbError) {
        console.error('Failed to store session in database:', dbError);
        // Continue anyway - memory session will work for basic operations
      }

      return {
        success: true,
        user: { id: user.id, username: user.username },
        sessionToken
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  async validateSession(sessionToken: string): Promise<{ userId: string } | null> {
    const session = this.sessions.get(sessionToken);
    if (!session) {
      return null;
    }

    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionToken);
      return null;
    }

    return { userId: session.userId };
  }

  async logout(sessionToken: string): Promise<void> {
    this.sessions.delete(sessionToken);
  }
}

export const basicAuthService = new BasicAuthService();
