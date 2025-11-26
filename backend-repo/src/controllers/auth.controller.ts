import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../types/auth.types';
import { authConfig } from '../config/auth.config';

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      // Validation
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Register user
      const result = await authService.register({ username, password });

      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, authConfig.cookie);

      // Return user and access token
      return res.status(201).json({
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Username already exists') {
          return res.status(409).json({ error: error.message });
        }
      }
      console.error('Registration error:', error);
      return res.status(500).json({ error: 'Registration failed' });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      // Validation
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      // Login user
      const result = await authService.login({ username, password });

      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, authConfig.cookie);

      // Return user and access token
      return res.status(200).json({
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid credentials') {
          return res.status(401).json({ error: error.message });
        }
      }
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Login failed' });
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      // Get refresh token from cookie or body
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token not provided' });
      }

      // Refresh access token
      const result = await authService.refreshAccessToken(refreshToken);

      return res.status(200).json({
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Refresh token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({ error: 'Invalid refresh token' });
        }
      }
      console.error('Token refresh error:', error);
      return res.status(401).json({ error: 'Token refresh failed' });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ error: 'Logout failed' });
    }
  }

  async getCurrentUser(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await authService.getCurrentUser(req.user.userId);

      return res.status(200).json({ user });
    } catch (error) {
      console.error('Get current user error:', error);
      return res.status(500).json({ error: 'Failed to get user' });
    }
  }
}

export const authController = new AuthController();
