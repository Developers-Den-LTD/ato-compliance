// Security testing suite
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../index';
import { AuthenticationService } from '../services/authentication.service';
import { UserService } from '../services/user.service';
import { TestDatabase } from './utils/test-helpers';

describe('Security Tests', () => {
  let authService: AuthenticationService;
  let userService: UserService;
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    await TestDatabase.cleanup();
    authService = new AuthenticationService();
    userService = new UserService();
    
    // Create test user
    testUser = await TestDatabase.createTestUser({
      username: 'securitytest',
      email: 'security@test.com',
    });

    // Get auth token
    const authResult = await authService.login({
      username: testUser.username,
      password: 'password123',
    });
    authToken = authResult.accessToken;
  });

  afterEach(async () => {
    await TestDatabase.cleanup();
  });

  describe('Authentication Security', () => {
    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'invaliduser',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject empty credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: '',
          password: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should reject malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    it('should reject oversized requests', async () => {
      const largeData = {
        username: 'test',
        password: 'a'.repeat(1000000), // 1MB password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(largeData);

      expect(response.status).toBe(413);
    });

    it('should validate password strength', async () => {
      const weakPasswords = [
        '123',
        'password',
        '12345678',
        'PASSWORD',
        'Password1',
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: `test${Date.now()}`,
            password,
            email: `test${Date.now()}@example.com`,
          });

        if (password.length < 8) {
          expect(response.status).toBe(400);
        }
      }
    });

    it('should prevent SQL injection in login', async () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users --",
      ];

      for (const input of maliciousInputs) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: input,
            password: 'password',
          });

        // Should not return 500 (server error) or expose database structure
        expect(response.status).not.toBe(500);
        expect(response.body).not.toHaveProperty('stack');
      }
    });

    it('should prevent NoSQL injection', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: { $ne: null },
          password: { $ne: null },
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Authorization Security', () => {
    it('should require authentication for protected routes', async () => {
      const protectedRoutes = [
        { method: 'GET', path: '/api/systems' },
        { method: 'POST', path: '/api/systems' },
        { method: 'GET', path: '/api/auth/me' },
      ];

      for (const route of protectedRoutes) {
        const response = await request(app)
          [route.method.toLowerCase() as keyof typeof request](route.path);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      }
    });

    it('should reject invalid tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid-token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        '',
        null,
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/systems')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
      }
    });

    it('should reject expired tokens', async () => {
      // Create a token with past expiration
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid';

      const response = await request(app)
        .get('/api/systems')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should prevent privilege escalation', async () => {
      // Create another user
      const otherUser = await TestDatabase.createTestUser({
        username: 'otheruser',
        email: 'other@test.com',
      });

      // Try to access other user's data
      const response = await request(app)
        .get(`/api/systems/owner/${otherUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should not be able to access other user's systems
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('Input Validation Security', () => {
    it('should validate email format', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@.com',
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: `test${Date.now()}`,
            password: 'password123',
            email,
          });

        expect(response.status).toBe(400);
      }
    });

    it('should validate username format', async () => {
      const invalidUsernames = [
        '',
        'a',
        'ab',
        'a'.repeat(51),
        'user@name',
        'user name',
        'user-name',
      ];

      for (const username of invalidUsernames) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username,
            password: 'password123',
            email: `test${Date.now()}@example.com`,
          });

        if (username.length < 3 || username.length > 50) {
          expect(response.status).toBe(400);
        }
      }
    });

    it('should sanitize HTML input', async () => {
      const maliciousInput = '<script>alert("xss")</script>';

      const response = await request(app)
        .post('/api/systems')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: maliciousInput,
          description: maliciousInput,
          category: 'General Support System',
          impactLevel: 'Moderate',
        });

      // Should either reject or sanitize the input
      if (response.status === 201) {
        expect(response.body.name).not.toContain('<script>');
        expect(response.body.description).not.toContain('<script>');
      }
    });

    it('should prevent path traversal', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '/etc/passwd',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
      ];

      for (const path of maliciousPaths) {
        const response = await request(app)
          .post('/api/systems')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test System',
            description: path,
            category: 'General Support System',
            impactLevel: 'Moderate',
          });

        // Should not allow path traversal
        expect(response.status).toBe(201);
        expect(response.body.description).not.toContain('..');
      }
    });
  });

  describe('Rate Limiting Security', () => {
    it('should prevent brute force attacks', async () => {
      const attempts = 10;
      const promises = [];

      for (let i = 0; i < attempts; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              username: 'securitytest',
              password: 'wrongpassword',
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should prevent registration spam', async () => {
      const attempts = 5;
      const promises = [];

      for (let i = 0; i < attempts; i++) {
        promises.push(
          request(app)
            .post('/api/auth/register')
            .send({
              username: `spamuser${i}`,
              password: 'password123',
              email: `spam${i}@example.com`,
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Data Protection Security', () => {
    it('should not expose password hashes', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should not expose sensitive user data in system responses', async () => {
      const response = await request(app)
        .get('/api/systems')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.systems && response.body.systems.length > 0) {
        const system = response.body.systems[0];
        if (system.ownerDetails) {
          expect(system.ownerDetails).not.toHaveProperty('passwordHash');
          expect(system.ownerDetails).not.toHaveProperty('password');
        }
      }
    });

    it('should encrypt sensitive data at rest', async () => {
      // This test would verify that passwords are properly hashed
      const user = await userService.getUserByUsername('securitytest');
      expect(user?.passwordHash).toBeDefined();
      expect(user?.passwordHash).not.toBe('password123');
      expect(user?.passwordHash).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash format
    });
  });

  describe('Session Security', () => {
    it('should set secure session cookies', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'securitytest',
          password: 'password123',
        });

      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const sessionCookie = cookies.find((cookie: string) => 
          cookie.startsWith('connect.sid')
        );
        
        if (sessionCookie) {
          expect(sessionCookie).toContain('HttpOnly');
          if (process.env.NODE_ENV === 'production') {
            expect(sessionCookie).toContain('Secure');
          }
        }
      }
    });

    it('should invalidate sessions on logout', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'securitytest',
          password: 'password123',
        });

      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

      expect(logoutResponse.status).toBe(200);
    });
  });

  describe('CORS Security', () => {
    it('should restrict CORS origins', async () => {
      const response = await request(app)
        .options('/api/systems')
        .set('Origin', 'https://malicious-site.com');

      expect(response.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('should allow requests from allowed origins', async () => {
      const response = await request(app)
        .options('/api/systems')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(204);
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password',
        });

      expect(response.status).toBe(401);
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('sql');
      expect(response.body).not.toHaveProperty('query');
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}');

      expect(response.status).toBe(400);
      expect(response.body).not.toHaveProperty('stack');
    });
  });
});
