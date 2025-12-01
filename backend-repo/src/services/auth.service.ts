// Simple Authentication Service - Uses only our existing schema
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from "../schema";
import { authConfig } from '../config/auth.config';

export interface AuthResult {
  user: {
    id: string;
    username: string;
    email: string;
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthenticationService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;

  constructor() {
    this.accessTokenSecret = authConfig.jwt.accessTokenSecret;
    this.refreshTokenSecret = authConfig.jwt.refreshTokenSecret;
  }

  /**
   * Register a new user
   */
  async register(data: { username: string; password: string }): Promise<AuthResult> {
    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const [user] = await db.insert(users).values({
      username: data.username,
      passwordHash,
      role: 'user',
    }).returning();

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id, user.username);
    const refreshToken = this.generateRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: `${user.username}@example.com`,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login user
   */
  async login(data: { username: string; password: string }): Promise<AuthResult> {
    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id, user.username);
    const refreshToken = this.generateRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: `${user.username}@example.com`,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = jwt.verify(refreshToken, this.refreshTokenSecret) as { userId: string; type: string; username?: string };
      
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Verify user still exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      const accessToken = this.generateAccessToken(user.id, user.username);
      
      return { accessToken };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(userId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: `${user.username}@example.com`,
      role: user.role,
    };
  }

  /**
   * Generate access token
   */
  private generateAccessToken(userId: string, username: string): string {
    return jwt.sign(
      { userId, username, type: 'access' },
      this.accessTokenSecret,
      { expiresIn: authConfig.jwt.accessTokenExpiry }
    );
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      this.refreshTokenSecret,
      { expiresIn: authConfig.jwt.refreshTokenExpiry }
    );
  }
}

// Export singleton instance
export const authService = new AuthenticationService();
