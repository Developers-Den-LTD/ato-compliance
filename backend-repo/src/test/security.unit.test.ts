import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../index';

describe('Security Tests', () => {
  let server: any;

  beforeAll(() => {
    server = app;
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('Authentication Security', () => {
    it('should prevent SQL injection in login', async () => {
      const maliciousInput = "admin'; DROP TABLE users; --";
      
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          username: maliciousInput,
          password: 'password'
        });

      expect(response.status).not.toBe(500);
      expect(response.body).not.toContain('error');
    });

    it('should prevent XSS in user input', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          username: xssPayload,
          password: 'password123',
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
    });

    it('should enforce password complexity', async () => {
      const weakPassword = '123';
      
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: weakPassword,
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('password');
    });
  });

  describe('Authorization Security', () => {
    it('should require authentication for protected routes', async () => {
      const response = await request(server)
        .get('/api/systems');

      expect(response.status).toBe(401);
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await request(server)
        .get('/api/systems')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should handle malformed authorization headers', async () => {
      const response = await request(server)
        .get('/api/systems')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation Security', () => {
    it('should validate email format', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
    });

    it('should limit request body size', async () => {
      const largeData = 'x'.repeat(10000);
      
      const response = await request(server)
        .post('/api/systems')
        .send({
          name: largeData,
          description: largeData
        });

      expect(response.status).toBe(413);
    });
  });

  describe('CORS Security', () => {
    it('should include proper CORS headers', async () => {
      const response = await request(server)
        .options('/api/systems');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should implement rate limiting on auth endpoints', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(server)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
