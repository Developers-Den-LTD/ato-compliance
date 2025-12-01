// AuthenticationService - Comprehensive authentication and authorization service
import jwt from 'jsonwebtoken';
import { UserService } from './user.service';
import { z } from 'zod';

// Validation schemas
const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  email: z.string().email(),
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LoginData = z.infer<typeof LoginSchema>;
export type RegisterData = z.infer<typeof RegisterSchema>;
export type RefreshTokenData = z.infer<typeof RefreshTokenSchema>;

export interface AuthResult {
  user: {
    id: string;
    username: string;
    email: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  type: 'access' | 'refresh';
}

export class AuthenticationService {
  private userService: UserService;
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.userService = new UserService();
    this.accessTokenSecret = process.env.JWT_SECRET || 'default-secret';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret';
    this.accessTokenExpiry = process.env.JWT_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  /**
   * Register a new user
   */
  async register(registerData: RegisterData): Promise<AuthResult> {
    // Validate input
    const validatedData = RegisterSchema.parse(registerData);

    // Create user
    const user = await this.userService.createUser(validatedData);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      ...tokens,
    };
  }

  /**
   * Login user
   */
  async login(loginData: LoginData): Promise<AuthResult> {
    // Validate input
    const validatedData = LoginSchema.parse(loginData);

    // Authenticate user
    const user = await this.userService.authenticateUser(
      validatedData.username,
      validatedData.password
    );

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      ...tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshTokenData: RefreshTokenData): Promise<{ accessToken: string; expiresIn: number }> {
    // Validate input
    const validatedData = RefreshTokenSchema.parse(refreshTokenData);

    try {
      // Verify refresh token
      const payload = jwt.verify(validatedData.refreshToken, this.refreshTokenSecret) as TokenPayload;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Get user
      const user = await this.userService.getUserById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      return {
        accessToken,
        expiresIn: this.getTokenExpiryInSeconds(this.accessTokenExpiry),
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.accessTokenSecret) as TokenPayload;

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Verify user still exists
      const user = await this.userService.getUserById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  /**
   * Logout user (invalidate tokens)
   */
  async logout(userId: string): Promise<{ message: string }> {
    // In a real application, you would maintain a blacklist of tokens
    // For now, we'll just return a success message
    return { message: 'Logged out successfully' };
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    await this.userService.changePassword(userId, currentPassword, newPassword);
    return { message: 'Password changed successfully' };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    const expiresIn = this.getTokenExpiryInSeconds(this.accessTokenExpiry);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Generate access token
   */
  private generateAccessToken(user: any): string {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      type: 'access',
    };

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
    });
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(user: any): string {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      type: 'refresh',
    };

    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
    });
  }

  /**
   * Get token expiry in seconds
   */
  private getTokenExpiryInSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900; // Default 15 minutes
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: return 900;
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(email: string): Promise<{ token: string; expiresIn: number }> {
    const user = await this.userService.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    const payload = {
      userId: user.id,
      email: user.email,
      type: 'password-reset',
    };

    const token = jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: '1h', // Password reset tokens expire in 1 hour
    });

    return {
      token,
      expiresIn: 3600, // 1 hour in seconds
    };
  }

  /**
   * Verify password reset token
   */
  async verifyPasswordResetToken(token: string): Promise<{ userId: string; email: string }> {
    try {
      const payload = jwt.verify(token, this.accessTokenSecret) as any;

      if (payload.type !== 'password-reset') {
        throw new Error('Invalid token type');
      }

      return {
        userId: payload.userId,
        email: payload.email,
      };
    } catch (error) {
      throw new Error('Invalid or expired password reset token');
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const { userId } = await this.verifyPasswordResetToken(token);

    // Validate password strength
    const validation = this.validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    // Update password
    await this.userService.updateUser(userId, { password: newPassword });

    return { message: 'Password reset successfully' };
  }
}
