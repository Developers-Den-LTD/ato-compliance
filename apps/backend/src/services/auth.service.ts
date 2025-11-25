import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@ato-compliance/shared';
import { authConfig } from '../config/auth.config';
import { RegisterRequest, LoginRequest, TokenPayload } from '../types/auth.types';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.utils';

export class AuthService {
  async register(data: RegisterRequest) {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('Username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, authConfig.bcrypt.saltRounds);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        username: data.username,
        passwordHash,
      })
      .returning({ id: users.id, username: users.username, role: users.role });

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role || 'user',
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role || 'user',
      },
      accessToken,
      refreshToken,
    };
  }

  async login(data: LoginRequest) {
    // Find user
    const [user] = await db
      .select({ 
        id: users.id, 
        username: users.username, 
        passwordHash: users.passwordHash,
        role: users.role 
      })
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role || 'user',
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role || 'user',
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const { verifyRefreshToken } = await import('../utils/jwt.utils');
    
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    // Verify user still exists
    const [user] = await db
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Generate new access token
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role || 'user',
    };

    const accessToken = generateAccessToken(tokenPayload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role || 'user',
      },
    };
  }

  async getCurrentUser(userId: string) {
    const [user] = await db
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}

export const authService = new AuthService();
