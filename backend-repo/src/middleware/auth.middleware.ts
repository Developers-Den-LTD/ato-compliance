import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { verifyAccessToken } from '../utils/jwt.utils';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Bypass authentication in development mode or when auth is disabled
    if (process.env.NODE_ENV !== 'production' || process.env.DISABLE_AUTH === 'true') {
      req.user = {
        userId: '00000000-0000-0000-0000-000000000000', // Valid UUID for dev mode
        username: 'admin',
        email: 'admin@dev.local',
        role: 'admin',
        permissions: ['*'],
        systems: ['*']
      };
      return next();
    }

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = verifyAccessToken(token);
    
    // Attach user to request
    req.user = payload;
    
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      req.user = payload;
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
