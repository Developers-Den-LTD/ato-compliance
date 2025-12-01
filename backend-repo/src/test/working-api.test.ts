import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../index';

describe('Working API Tests', () => {
  describe('Health Check', () => {
    it('should return 200 for health check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });
  });

  describe('Authentication Endpoints', () => {
    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Protected Routes', () => {
    it('should return 401 for protected routes without token', async () => {
      const response = await request(app)
        .get('/api/systems');

      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/systems')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route');

      expect(response.status).toBe(404);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/systems');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/health')
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should respond within acceptable time', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // 1 second
    });
  });
});











