// Integration tests for authentication API endpoints
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../index';
import { db } from '../../db';
import { users } from './schema';

// Mock the database
jest.mock('../../db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedpassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ userId: 'test-user-id' }),
}));

describe('Auth API Integration Tests', () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = db as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'newuser',
        password: 'password123',
        email: 'newuser@example.com',
      };

      const mockUser = {
        id: 'user-1',
        username: 'newuser',
        passwordHash: 'hashedpassword',
        email: 'newuser@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockUser]),
        }),
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: 'user-1',
        username: 'newuser',
        email: 'newuser@example.com',
      });
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('should return 400 for invalid input', async () => {
      const invalidData = {
        username: '',
        password: '123',
        email: 'invalid-email',
      };

      await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);
    });

    it('should return 409 for duplicate username', async () => {
      const userData = {
        username: 'existinguser',
        password: 'password123',
        email: 'existing@example.com',
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(new Error('Username already exists')),
        }),
      });

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        username: 'testuser',
        password: 'password123',
      };

      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        email: 'test@example.com',
      };

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockUser]),
        }),
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
        },
        token: 'mock-jwt-token',
      });
    });

    it('should return 401 for invalid credentials', async () => {
      const loginData = {
        username: 'testuser',
        password: 'wrongpassword',
      };

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);
    });

    it('should return 400 for missing credentials', async () => {
      const loginData = {
        username: 'testuser',
        // password missing
      };

      await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Logged out successfully',
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
      };

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockUser]),
        }),
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200);

      expect(response.body).toEqual(mockUser);
    });

    it('should return 401 without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      // Mock jwt.verify to throw error
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
