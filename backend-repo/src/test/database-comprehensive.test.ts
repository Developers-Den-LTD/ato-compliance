import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { TestDatabase } from '../test/utils/test-helpers';
import { users, systems, controls, documents, assessments } from './schema';

describe('Database Integration Tests', () => {
  let container: StartedPostgreSqlContainer;
  let db: any;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:15')
      .withDatabase('testdb')
      .withUsername('testuser')
      .withPassword('testpass')
      .start();

    // Create database connection
    const connectionString = container.getConnectionUri();
    const client = postgres(connectionString);
    db = drizzle(client);
  });

  afterAll(async () => {
    await container.stop();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await TestDatabase.cleanup();
  });

  describe('Schema Validation', () => {
    it('should create all tables with correct structure', async () => {
      // Test users table
      const user = await TestDatabase.createTestUser();
      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.passwordHash).toBeDefined();

      // Test systems table
      const system = await TestDatabase.createTestSystem();
      expect(system.id).toBeDefined();
      expect(system.name).toBeDefined();
      expect(system.category).toBeDefined();
      expect(system.impactLevel).toBeDefined();

      // Test controls table
      const control = await TestDatabase.createTestControl();
      expect(control.id).toBeDefined();
      expect(control.family).toBeDefined();
      expect(control.title).toBeDefined();
      expect(control.baseline).toBeDefined();

      // Test documents table
      const document = await TestDatabase.createTestDocument();
      expect(document.id).toBeDefined();
      expect(document.name).toBeDefined();
      expect(document.type).toBeDefined();
      expect(document.filePath).toBeDefined();

      // Test assessments table
      const assessment = await TestDatabase.createTestAssessment();
      expect(assessment.id).toBeDefined();
      expect(assessment.name).toBeDefined();
      expect(assessment.status).toBeDefined();
    });
  });

  describe('CRUD Operations', () => {
    it('should perform complete CRUD operations on users', async () => {
      // Create
      const user = await TestDatabase.createTestUser({
        username: 'crudtest',
        email: 'crud@example.com'
      });
      expect(user.id).toBeDefined();

      // Read
      const foundUser = await db.select().from(users).where(eq(users.id, user.id));
      expect(foundUser).toHaveLength(1);
      expect(foundUser[0].username).toBe('crudtest');

      // Update
      await db.update(users)
        .set({ username: 'updateduser' })
        .where(eq(users.id, user.id));

      const updatedUser = await db.select().from(users).where(eq(users.id, user.id));
      expect(updatedUser[0].username).toBe('updateduser');

      // Delete
      await db.delete(users).where(eq(users.id, user.id));
      const deletedUser = await db.select().from(users).where(eq(users.id, user.id));
      expect(deletedUser).toHaveLength(0);
    });

    it('should perform complete CRUD operations on systems', async () => {
      const user = await TestDatabase.createTestUser();
      
      // Create
      const system = await TestDatabase.createTestSystem({
        name: 'CRUD System',
        owner: user.id
      });
      expect(system.id).toBeDefined();

      // Read
      const foundSystem = await db.select().from(systems).where(eq(systems.id, system.id));
      expect(foundSystem).toHaveLength(1);

      // Update
      await db.update(systems)
        .set({ name: 'Updated System' })
        .where(eq(systems.id, system.id));

      const updatedSystem = await db.select().from(systems).where(eq(systems.id, system.id));
      expect(updatedSystem[0].name).toBe('Updated System');

      // Delete
      await db.delete(systems).where(eq(systems.id, system.id));
      const deletedSystem = await db.select().from(systems).where(eq(systems.id, system.id));
      expect(deletedSystem).toHaveLength(0);
    });
  });

  describe('Data Integrity', () => {
    it('should enforce foreign key constraints', async () => {
      // Try to create system with non-existent owner
      await expect(
        TestDatabase.createTestSystem({ owner: 'non-existent-user' })
      ).rejects.toThrow();
    });

    it('should enforce unique constraints', async () => {
      // Create first user
      await TestDatabase.createTestUser({ username: 'uniqueuser' });

      // Try to create second user with same username
      await expect(
        TestDatabase.createTestUser({ username: 'uniqueuser' })
      ).rejects.toThrow();
    });

    it('should enforce not null constraints', async () => {
      // Try to create user without required fields
      await expect(
        db.insert(users).values({ username: 'test' }) // Missing required fields
      ).rejects.toThrow();
    });
  });

  describe('Query Performance', () => {
    it('should handle large datasets efficiently', async () => {
      // Create large dataset
      const users = [];
      for (let i = 0; i < 1000; i++) {
        users.push({
          id: `user-${i}`,
          username: `user${i}`,
          email: `user${i}@example.com`,
          passwordHash: 'hashedpassword',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      const start = Date.now();
      await db.insert(users).values(users);
      const insertTime = Date.now() - start;
      expect(insertTime).toBeLessThan(5000); // 5 seconds

      // Test query performance
      const queryStart = Date.now();
      const result = await db.select().from(users).limit(100);
      const queryTime = Date.now() - queryStart;
      expect(queryTime).toBeLessThan(1000); // 1 second
    });

    it('should handle complex joins efficiently', async () => {
      const user = await TestDatabase.createTestUser();
      const system = await TestDatabase.createTestSystem({ owner: user.id });
      const assessment = await TestDatabase.createTestAssessment({ 
        systemId: system.id,
        createdBy: user.id
      });

      const start = Date.now();
      const result = await db
        .select()
        .from(assessments)
        .innerJoin(systems, eq(assessments.systemId, systems.id))
        .innerJoin(users, eq(assessments.createdBy, users.id))
        .where(eq(assessments.id, assessment.id));

      const queryTime = Date.now() - start;
      expect(queryTime).toBeLessThan(500); // 500ms
      expect(result).toHaveLength(1);
    });
  });

  describe('Transaction Handling', () => {
    it('should handle successful transactions', async () => {
      const user = await TestDatabase.createTestUser();

      await db.transaction(async (tx) => {
        const system = await tx.insert(systems).values({
          id: 'transaction-system',
          name: 'Transaction System',
          description: 'Test system',
          category: 'General Support System',
          impactLevel: 'Moderate',
          complianceStatus: 'in-progress',
          owner: user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();

        const assessment = await tx.insert(assessments).values({
          id: 'transaction-assessment',
          name: 'Transaction Assessment',
          description: 'Test assessment',
          systemId: system[0].id,
          status: 'in-progress',
          createdBy: user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();

        expect(system[0].id).toBeDefined();
        expect(assessment[0].id).toBeDefined();
      });
    });

    it('should rollback failed transactions', async () => {
      const user = await TestDatabase.createTestUser();

      await expect(
        db.transaction(async (tx) => {
          await tx.insert(systems).values({
            id: 'rollback-system',
            name: 'Rollback System',
            description: 'Test system',
            category: 'General Support System',
            impactLevel: 'Moderate',
            complianceStatus: 'in-progress',
            owner: user.id,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // Force error
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow();

      // Verify no data was inserted
      const systems = await db.select().from(systems).where(eq(systems.id, 'rollback-system'));
      expect(systems).toHaveLength(0);
    });
  });
});
