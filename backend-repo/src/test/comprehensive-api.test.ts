import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../index';

// Mock the database
jest.mock('../db', () => ({
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

describe('Comprehensive API Tests', () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = require('../db').db;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Endpoints', () => {
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

  describe('Systems Endpoints', () => {
    it('should create a new system', async () => {
      const systemData = {
        name: 'Test System',
        description: 'Test system description',
        category: 'General Support System',
        impactLevel: 'Moderate',
        complianceStatus: 'in-progress',
      };

      const mockSystem = {
        id: 'system-1',
        name: 'Test System',
        description: 'Test system description',
        category: 'General Support System',
        impactLevel: 'Moderate',
        complianceStatus: 'in-progress',
        owner: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockSystem]),
        }),
      });

      const response = await request(app)
        .post('/api/systems')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send(systemData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: 'system-1',
        name: 'Test System',
        description: 'Test system description',
        category: 'General Support System',
        impactLevel: 'Moderate',
        complianceStatus: 'in-progress',
        owner: 'test-user-id',
      });
    });

    it('should get all systems', async () => {
      const mockSystems = [
        { id: 'system-1', name: 'System 1' },
        { id: 'system-2', name: 'System 2' },
      ];

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            offset: jest.fn().mockResolvedValue(mockSystems),
          }),
        }),
      });

      const response = await request(app)
        .get('/api/systems')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200);

      expect(response.body.systems).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/systems')
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid input', async () => {
      await request(app)
        .post('/api/systems')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          name: '', // Invalid empty name
          description: 'Test',
        })
        .expect(400);
    });

    it('should return 404 for non-existent resource', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      await request(app)
        .get('/api/systems/non-existent-id')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(404);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            offset: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const promises = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/systems')
          .set('Authorization', 'Bearer mock-jwt-token')
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should respond within acceptable time', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            offset: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const start = Date.now();
      
      await request(app)
        .get('/api/systems')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // 2 seconds
    });
  });
});
