// UserService - Comprehensive user management service
import { db } from '../db';
import { users } from "../schema";
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { z } from 'zod';

// Validation schemas
const CreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  email: z.string().email(),
});

const UpdateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

const AuthenticateUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type CreateUserData = z.infer<typeof CreateUserSchema>;
export type UpdateUserData = z.infer<typeof UpdateUserSchema>;
export type AuthenticateUserData = z.infer<typeof AuthenticateUserSchema>;

export class UserService {
  /**
   * Create a new user
   */
  async createUser(userData: CreateUserData) {
    // Validate input
    const validatedData = CreateUserSchema.parse(userData);

    // Check if username already exists
    const existingUser = await this.getUserByUsername(validatedData.username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Check if email already exists
    const existingEmail = await this.getUserByEmail(validatedData.email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 12);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        username: validatedData.username,
        passwordHash,
        email: validatedData.email,
      })
      .returning();

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Authenticate user with username and password
   */
  async authenticateUser(username: string, password: string) {
    // Validate input
    const validatedData = AuthenticateUserSchema.parse({ username, password });

    // Find user by username
    const user = await this.getUserByUsername(validatedData.username);
    if (!user) {
      return null;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(validatedData.password, user.passwordHash);
    if (!isValidPassword) {
      return null;
    }

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return null;
    }

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user || null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updateData: UpdateUserData) {
    // Validate input
    const validatedData = UpdateUserSchema.parse(updateData);

    // Check if user exists
    const existingUser = await this.getUserById(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Check for username conflicts
    if (validatedData.username && validatedData.username !== existingUser.username) {
      const usernameExists = await this.getUserByUsername(validatedData.username);
      if (usernameExists) {
        throw new Error('Username already exists');
      }
    }

    // Check for email conflicts
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailExists = await this.getUserByEmail(validatedData.email);
      if (emailExists) {
        throw new Error('Email already exists');
      }
    }

    // Prepare update data
    const updateFields: any = {
      ...validatedData,
      updatedAt: new Date(),
    };

    // Hash password if provided
    if (validatedData.password) {
      updateFields.passwordHash = await bcrypt.hash(validatedData.password, 12);
      delete updateFields.password;
    }

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, userId))
      .returning();

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string) {
    // Check if user exists
    const existingUser = await this.getUserById(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Delete user
    await db.delete(users).where(eq(users.id, userId));

    return { message: 'User deleted successfully' };
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(limit = 50, offset = 0) {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .limit(limit)
      .offset(offset)
      .orderBy(users.createdAt);

    return allUsers;
  }

  /**
   * Search users by username or email
   */
  async searchUsers(query: string, limit = 20) {
    const searchResults = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.username, query),
          eq(users.email, query)
        )
      )
      .limit(limit);

    return searchResults;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Get user with password hash
    const user = await this.getUserByUsername(
      (await this.getUserById(userId))?.username || ''
    );
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { message: 'Password changed successfully' };
  }

  /**
   * Verify user exists and is active
   */
  async verifyUser(userId: string) {
    const user = await this.getUserById(userId);
    return user !== null;
  }
}

// Export singleton instance
export const userService = new UserService();
