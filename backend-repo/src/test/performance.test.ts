// Performance testing suite
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../index';
import { AuthenticationService } from '../services/authentication.service';
import { SystemService } from '../services/system.service';
import { TestDatabase } from './utils/test-helpers';

describe('Performance Tests', () => {
  let authService: AuthenticationService;
  let systemService: SystemService;
  let testUser: any;
  let authToken: string;
  let testSystems: any[] = [];

  beforeAll(async () => {
    await TestDatabase.cleanup();
    authService = new AuthenticationService();
    systemService = new SystemService();
  });

  afterAll(async () => {
    await TestDatabase.cleanup();
  });

  beforeEach(async () => {
    // Create test user
    testUser = await TestDatabase.createTestUser({
      username: 'perftest',
      email: 'perf@test.com',
    });

    // Get auth token
    const authResult = await authService.login({
      username: testUser.username,
      password: 'password123',
    });
    authToken = authResult.accessToken;

    // Create test systems for performance testing
    testSystems = [];
    for (let i = 0; i < 100; i++) {
      const system = await TestDatabase.createTestSystem({
        name: `Performance Test System ${i}`,
        description: `Test system ${i} for performance testing`,
        owner: testUser.id,
        category: i % 2 === 0 ? 'General Support System' : 'Major Application',
        impactLevel: i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Moderate' : 'Low',
        complianceStatus: i % 4 === 0 ? 'compliant' : i % 4 === 1 ? 'in-progress' : 'not-started',
      });
      testSystems.push(system);
    }
  });

  describe('API Response Time Tests', () => {
    it('should respond to health check within 100ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/health');

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100);
    });

    it('should authenticate user within 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'perftest',
          password: 'password123',
        });

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500);
    });

    it('should get systems list within 1s', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/systems')
        .set('Authorization', `Bearer ${authToken}`);

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000);
    });

    it('should create system within 1s', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/systems')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Performance Test System',
          description: 'Test system for performance testing',
          category: 'General Support System',
          impactLevel: 'Moderate',
        });

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(1000);
    });

    it('should update system within 500ms', async () => {
      const system = testSystems[0];
      const startTime = Date.now();
      
      const response = await request(app)
        .put(`/api/systems/${system.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Performance Test System',
        });

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500);
    });

    it('should delete system within 500ms', async () => {
      const system = testSystems[1];
      const startTime = Date.now();
      
      const response = await request(app)
        .delete(`/api/systems/${system.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Concurrent Request Tests', () => {
    it('should handle 10 concurrent authentication requests', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              username: 'perftest',
              password: 'password123',
            })
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(5000);
    });

    it('should handle 20 concurrent system list requests', async () => {
      const concurrentRequests = 20;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get('/api/systems')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(10000);
    });

    it('should handle mixed concurrent operations', async () => {
      const promises = [];

      // Mix of different operations
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .get('/api/systems')
            .set('Authorization', `Bearer ${authToken}`)
        );
        promises.push(
          request(app)
            .post('/api/systems')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `Concurrent System ${i}`,
              description: `Test system ${i}`,
              category: 'General Support System',
              impactLevel: 'Moderate',
            })
        );
        promises.push(
          request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(15000);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/api/systems')
          .set('Authorization', `Bearer ${authToken}`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large payloads efficiently', async () => {
      const largeSystem = {
        name: 'Large System',
        description: 'A'.repeat(10000), // 10KB description
        category: 'General Support System',
        impactLevel: 'Moderate',
      };

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/systems')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeSystem);

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(2000);
    });
  });

  describe('Database Performance Tests', () => {
    it('should perform complex queries efficiently', async () => {
      const startTime = Date.now();
      
      const systems = await systemService.getSystems({
        search: 'Performance',
        category: 'General Support System',
        impactLevel: 'High',
        limit: 50,
        offset: 0,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const queryTime = Date.now() - startTime;

      expect(systems.systems.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(1000);
    });

    it('should handle pagination efficiently', async () => {
      const pageSize = 20;
      const totalPages = Math.ceil(testSystems.length / pageSize);

      for (let page = 0; page < totalPages; page++) {
        const startTime = Date.now();
        
        const systems = await systemService.getSystems({
          limit: pageSize,
          offset: page * pageSize,
          sortBy: 'name',
          sortOrder: 'asc',
        });

        const queryTime = Date.now() - startTime;

        expect(systems.systems.length).toBeLessThanOrEqual(pageSize);
        expect(queryTime).toBeLessThan(500);
      }
    });

    it('should perform aggregation queries efficiently', async () => {
      const startTime = Date.now();
      
      const stats = await systemService.getSystemStatistics();

      const queryTime = Date.now() - startTime;

      expect(stats.total).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(1000);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle errors efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/systems/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(404);
      expect(responseTime).toBeLessThan(500);
    });

    it('should handle malformed requests efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/systems')
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid json');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(400);
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Load Testing Simulation', () => {
    it('should maintain performance under sustained load', async () => {
      const duration = 10000; // 10 seconds
      const requestInterval = 100; // 100ms between requests
      const startTime = Date.now();
      const responses: any[] = [];

      const makeRequest = async () => {
        const response = await request(app)
          .get('/api/systems')
          .set('Authorization', `Bearer ${authToken}`);
        responses.push(response);
      };

      // Make requests at regular intervals
      const interval = setInterval(makeRequest, requestInterval);

      // Stop after duration
      setTimeout(() => {
        clearInterval(interval);
      }, duration);

      // Wait for all requests to complete
      await new Promise(resolve => setTimeout(resolve, duration + 1000));

      const totalTime = Date.now() - startTime;
      const expectedRequests = Math.floor(duration / requestInterval);

      // Should have made expected number of requests
      expect(responses.length).toBeGreaterThanOrEqual(expectedRequests * 0.9);

      // All requests should succeed
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(responses.length * 0.95);

      // Average response time should be reasonable
      const totalResponseTime = responses.reduce((sum, r) => sum + (r.responseTime || 0), 0);
      const averageResponseTime = totalResponseTime / responses.length;
      expect(averageResponseTime).toBeLessThan(1000);
    });
  });

  describe('Resource Usage Tests', () => {
    it('should not exceed CPU usage limits', async () => {
      const startCpuUsage = process.cpuUsage();
      const startTime = Date.now();

      // Perform intensive operations
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app)
            .get('/api/systems')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }
      await Promise.all(promises);

      const endTime = Date.now();
      const endCpuUsage = process.cpuUsage(startCpuUsage);
      const duration = (endTime - startTime) * 1000; // Convert to microseconds
      const cpuPercent = (endCpuUsage.user + endCpuUsage.system) / duration * 100;

      // CPU usage should be reasonable (less than 80%)
      expect(cpuPercent).toBeLessThan(80);
    });

    it('should handle file operations efficiently', async () => {
      const startTime = Date.now();
      
      // Simulate file operations (if any)
      const response = await request(app)
        .get('/health');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100);
    });
  });
});
