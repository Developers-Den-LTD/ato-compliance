import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../index';
import { TestDatabase, TestApiClient } from '../../test/utils/test-helpers';

describe('Comprehensive API Tests', () => {
  let authToken: string;
  let testUser: any;

  beforeEach(async () => {
    // Create test user
    testUser = await TestDatabase.createTestUser({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashedpassword'
    });

    // Login to get auth token
    const loginResponse = await TestApiClient.login(app, 'testuser', 'password123');
    authToken = loginResponse.token;
  });

  afterEach(async () => {
    await TestDatabase.cleanup();
  });

  describe('Authentication Endpoints', () => {
    it('should register a new user', async () => {
      const userData = {
        username: 'newuser',
        password: 'password123',
        email: 'newuser@example.com'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        username: 'newuser',
        email: 'newuser@example.com'
      });
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        user: expect.objectContaining({
          id: testUser.id,
          username: 'testuser',
          email: 'test@example.com'
        }),
        token: expect.any(String)
      });
    });

    it('should return 401 for invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        })
        .expect(401);
    });

    it('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testUser.id,
        username: 'testuser',
        email: 'test@example.com'
      });
    });

    it('should return 401 without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('Systems Endpoints', () => {
    it('should create a new system', async () => {
      const systemData = {
        name: 'Test System',
        description: 'Test system description',
        category: 'General Support System',
        impactLevel: 'Moderate',
        complianceStatus: 'in-progress'
      };

      const response = await request(app)
        .post('/api/systems')
        .set('Authorization', `Bearer ${authToken}`)
        .send(systemData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Test System',
        description: 'Test system description',
        category: 'General Support System',
        impactLevel: 'Moderate',
        complianceStatus: 'in-progress',
        owner: testUser.id
      });
    });

    it('should get all systems', async () => {
      // Create test systems
      await TestDatabase.createTestSystem({ name: 'System 1' });
      await TestDatabase.createTestSystem({ name: 'System 2' });

      const response = await request(app)
        .get('/api/systems')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.systems).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should get system by ID', async () => {
      const system = await TestDatabase.createTestSystem();

      const response = await request(app)
        .get(`/api/systems/${system.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: system.id,
        name: system.name
      });
    });

    it('should update a system', async () => {
      const system = await TestDatabase.createTestSystem();

      const updateData = {
        name: 'Updated System Name',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/systems/${system.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: system.id,
        name: 'Updated System Name',
        description: 'Updated description'
      });
    });

    it('should delete a system', async () => {
      const system = await TestDatabase.createTestSystem();

      await request(app)
        .delete(`/api/systems/${system.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify system is deleted
      await request(app)
        .get(`/api/systems/${system.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Assessment Endpoints', () => {
    let testSystem: any;

    beforeEach(async () => {
      testSystem = await TestDatabase.createTestSystem();
    });

    it('should create a new assessment', async () => {
      const assessmentData = {
        name: 'Test Assessment',
        description: 'Test assessment description',
        systemId: testSystem.id
      };

      const response = await request(app)
        .post('/api/assessments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(assessmentData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Test Assessment',
        description: 'Test assessment description',
        systemId: testSystem.id,
        createdBy: testUser.id
      });
    });

    it('should get all assessments', async () => {
      await TestDatabase.createTestAssessment({ systemId: testSystem.id });

      const response = await request(app)
        .get('/api/assessments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.assessments).toHaveLength(1);
    });

    it('should run an assessment', async () => {
      const assessment = await TestDatabase.createTestAssessment({ 
        systemId: testSystem.id 
      });

      const response = await request(app)
        .post(`/api/assessments/${assessment.id}/run`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: assessment.id,
        status: 'running'
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid input', async () => {
      await request(app)
        .post('/api/systems')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '', // Invalid empty name
          description: 'Test'
        })
        .expect(400);
    });

    it('should return 404 for non-existent resource', async () => {
      await request(app)
        .get('/api/systems/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 500 for server errors', async () => {
      // Mock database error
      jest.spyOn(require('../../db'), 'db').mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await request(app)
        .get('/api/systems')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/systems')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should respond within acceptable time', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/systems')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // 2 seconds
    });
  });
});











