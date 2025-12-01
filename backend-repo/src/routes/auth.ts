// Authentication API routes
import { Router } from 'express';
import { AuthenticationService } from '../services/authentication.service';
import { UserService } from '../services/user.service';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const authService = new AuthenticationService();
const userService = new UserService();

// Validation middleware
const validateRequest = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Validation error',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }
  };
};

// POST /api/auth/register
router.post('/register', validateRequest(z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  email: z.string().email(),
})), async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message.includes('validation')) {
        return res.status(400).json({ error: error.message });
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', validateRequest(z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})), async (req, res) => {
  try {
    // Bypass authentication in development mode or when auth is disabled
    if (process.env.NODE_ENV !== 'production' || process.env.DISABLE_AUTH === 'true') {
      // Return in both formats for compatibility
      const mockResult = {
        success: true,
        user: {
          id: '160b3477-c30d-482f-b2ac-2d75d9919a1a',
          username: req.body.username || 'admin',
          email: 'admin@example.com',
          role: 'admin'
        },
        accessToken: 'dev-session-token-123',
        refreshToken: 'dev-refresh-token',
        expiresIn: 86400,
        session: {
          sessionToken: 'dev-session-token-123',
          refreshToken: 'dev-refresh-token',
          expiresIn: 86400
        }
      };
      return res.json(mockResult);
    }
    
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid credentials') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const result = await authService.logout(req.user.userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Bypass in development mode or when auth is disabled
    if (process.env.NODE_ENV !== 'production' || process.env.DISABLE_AUTH === 'true') {
      return res.json({
        id: '160b3477-c30d-482f-b2ac-2d75d9919a1a',
        username: 'admin',
        displayName: 'Administrator',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        permissions: ['*'],
        systems: ['*']
      });
    }
    
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const user = await userService.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return user data in the same format as bypass mode for frontend compatibility
    const userResponse = {
      id: user.id,
      username: user.username,
      displayName: user.username || 'Administrator',
      email: `${user.username}@example.com`,
      firstName: 'Admin',
      lastName: 'User', 
      role: 'admin',
      permissions: ['*'],
      systems: ['*']
    };
    
    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', validateRequest(z.object({
  refreshToken: z.string().min(1),
})), async (req, res) => {
  try {
    // Bypass authentication in development mode or when auth is disabled
    if (process.env.NODE_ENV !== 'production' || process.env.DISABLE_AUTH === 'true') {
      // Return a mock refresh response in the format expected by the frontend
      const mockResult = {
        success: true,
        user: {
          id: '160b3477-c30d-482f-b2ac-2d75d9919a1a',
          username: 'admin',
          email: 'admin@example.com',
          role: 'admin'
        },
        accessToken: 'dev-session-token-123',
        refreshToken: 'dev-refresh-token',
        expiresIn: 86400
      };
      return res.json(mockResult);
    }
    
    const result = await authService.refreshToken(req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid refresh token') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, validateRequest(z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await authService.changePassword(
      req.user.userId,
      req.body.currentPassword,
      req.body.newPassword
    );
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('incorrect')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('validation')) {
        return res.status(400).json({ error: error.message });
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', validateRequest(z.object({
  email: z.string().email(),
})), async (req, res) => {
  try {
    const result = await authService.generatePasswordResetToken(req.body.email);
    // In a real application, you would send the token via email
    res.json({ 
      message: 'Password reset token generated',
      // Only include token in development
      ...(process.env.NODE_ENV === 'development' && { token: result.token })
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', validateRequest(z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
})), async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body.token, req.body.newPassword);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid or expired')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('validation')) {
        return res.status(400).json({ error: error.message });
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
