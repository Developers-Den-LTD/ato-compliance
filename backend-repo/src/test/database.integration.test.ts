// Database integration tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db } from '../db';
import { users, systems, controls, documents, assessments } from './schema';
import { eq, and } from 'drizzle-orm';
import { TestDatabase } from './utils/test-helpers';

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    // Set up test database
    await TestDatabase.cleanup();
  });

  afterAll(async () => {
    // Clean up test database
    await TestDatabase.cleanup();
  });

  beforeEach(async () => {
    // Clean up before each test
    await TestDatabase.cleanup();
  });

  describe('User Operations', () => {
    it('should create and retrieve user', async () => {
      const user = await TestDatabase.createTestUser({
        username: 'testuser',
        email: 'test@example.com',
      });

      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');

      // Verify user exists in database
      const retrievedUser = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      expect(retrievedUser).toHaveLength(1);
      expect(retrievedUser[0].username).toBe('testuser');
    });

    it('should update user', async () => {
      const user = await TestDatabase.createTestUser({
        username: 'testuser',
        email: 'test@example.com',
      });

      const updatedUser = await db
        .update(users)
        .set({
          email: 'updated@example.com',
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();

      expect(updatedUser).toHaveLength(1);
      expect(updatedUser[0].email).toBe('updated@example.com');
    });

    it('should delete user', async () => {
      const user = await TestDatabase.createTestUser();

      await db.delete(users).where(eq(users.id, user.id));

      const deletedUser = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      expect(deletedUser).toHaveLength(0);
    });

    it('should enforce unique username constraint', async () => {
      await TestDatabase.createTestUser({
        username: 'uniqueuser',
        email: 'user1@example.com',
      });

      // Try to create another user with same username
      await expect(
        TestDatabase.createTestUser({
          username: 'uniqueuser',
          email: 'user2@example.com',
        })
      ).rejects.toThrow();
    });

    it('should enforce unique email constraint', async () => {
      await TestDatabase.createTestUser({
        username: 'user1',
        email: 'unique@example.com',
      });

      // Try to create another user with same email
      await expect(
        TestDatabase.createTestUser({
          username: 'user2',
          email: 'unique@example.com',
        })
      ).rejects.toThrow();
    });
  });

  describe('System Operations', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await TestDatabase.createTestUser();
    });

    it('should create and retrieve system', async () => {
      const system = await TestDatabase.createTestSystem({
        name: 'Test System',
        description: 'Test system description',
        owner: testUser.id,
      });

      expect(system).toBeDefined();
      expect(system.name).toBe('Test System');
      expect(system.owner).toBe(testUser.id);

      // Verify system exists in database
      const retrievedSystem = await db
        .select()
        .from(systems)
        .where(eq(systems.id, system.id))
        .limit(1);

      expect(retrievedSystem).toHaveLength(1);
      expect(retrievedSystem[0].name).toBe('Test System');
    });

    it('should update system', async () => {
      const system = await TestDatabase.createTestSystem({
        name: 'Test System',
        owner: testUser.id,
      });

      const updatedSystem = await db
        .update(systems)
        .set({
          name: 'Updated System',
          updatedAt: new Date(),
        })
        .where(eq(systems.id, system.id))
        .returning();

      expect(updatedSystem).toHaveLength(1);
      expect(updatedSystem[0].name).toBe('Updated System');
    });

    it('should delete system', async () => {
      const system = await TestDatabase.createTestSystem({
        owner: testUser.id,
      });

      await db.delete(systems).where(eq(systems.id, system.id));

      const deletedSystem = await db
        .select()
        .from(systems)
        .where(eq(systems.id, system.id))
        .limit(1);

      expect(deletedSystem).toHaveLength(0);
    });

    it('should enforce foreign key constraint for owner', async () => {
      // Try to create system with non-existent owner
      await expect(
        TestDatabase.createTestSystem({
          owner: 'non-existent-user-id',
        })
      ).rejects.toThrow();
    });
  });

  describe('Control Operations', () => {
    it('should create and retrieve control', async () => {
      const control = await TestDatabase.createTestControl({
        id: 'AC-1',
        title: 'Access Control Policy',
        description: 'Test control description',
      });

      expect(control).toBeDefined();
      expect(control.id).toBe('AC-1');
      expect(control.title).toBe('Access Control Policy');

      // Verify control exists in database
      const retrievedControl = await db
        .select()
        .from(controls)
        .where(eq(controls.id, control.id))
        .limit(1);

      expect(retrievedControl).toHaveLength(1);
      expect(retrievedControl[0].title).toBe('Access Control Policy');
    });

    it('should update control', async () => {
      const control = await TestDatabase.createTestControl({
        id: 'AC-1',
        title: 'Original Title',
      });

      const updatedControl = await db
        .update(controls)
        .set({
          title: 'Updated Title',
          updatedAt: new Date(),
        })
        .where(eq(controls.id, control.id))
        .returning();

      expect(updatedControl).toHaveLength(1);
      expect(updatedControl[0].title).toBe('Updated Title');
    });

    it('should delete control', async () => {
      const control = await TestDatabase.createTestControl();

      await db.delete(controls).where(eq(controls.id, control.id));

      const deletedControl = await db
        .select()
        .from(controls)
        .where(eq(controls.id, control.id))
        .limit(1);

      expect(deletedControl).toHaveLength(0);
    });
  });

  describe('Document Operations', () => {
    let testUser: any;
    let testSystem: any;

    beforeEach(async () => {
      testUser = await TestDatabase.createTestUser();
      testSystem = await TestDatabase.createTestSystem({
        owner: testUser.id,
      });
    });

    it('should create and retrieve document', async () => {
      const document = await TestDatabase.createTestDocument({
        systemId: testSystem.id,
        name: 'test-document.pdf',
        title: 'Test Document',
      });

      expect(document).toBeDefined();
      expect(document.name).toBe('test-document.pdf');
      expect(document.systemId).toBe(testSystem.id);

      // Verify document exists in database
      const retrievedDocument = await db
        .select()
        .from(documents)
        .where(eq(documents.id, document.id))
        .limit(1);

      expect(retrievedDocument).toHaveLength(1);
      expect(retrievedDocument[0].name).toBe('test-document.pdf');
    });

    it('should update document', async () => {
      const document = await TestDatabase.createTestDocument({
        systemId: testSystem.id,
        title: 'Original Title',
      });

      const updatedDocument = await db
        .update(documents)
        .set({
          title: 'Updated Title',
          updatedAt: new Date(),
        })
        .where(eq(documents.id, document.id))
        .returning();

      expect(updatedDocument).toHaveLength(1);
      expect(updatedDocument[0].title).toBe('Updated Title');
    });

    it('should delete document', async () => {
      const document = await TestDatabase.createTestDocument({
        systemId: testSystem.id,
      });

      await db.delete(documents).where(eq(documents.id, document.id));

      const deletedDocument = await db
        .select()
        .from(documents)
        .where(eq(documents.id, document.id))
        .limit(1);

      expect(deletedDocument).toHaveLength(0);
    });

    it('should enforce foreign key constraint for system', async () => {
      // Try to create document with non-existent system
      await expect(
        TestDatabase.createTestDocument({
          systemId: 'non-existent-system-id',
        })
      ).rejects.toThrow();
    });
  });

  describe('Assessment Operations', () => {
    let testUser: any;
    let testSystem: any;

    beforeEach(async () => {
      testUser = await TestDatabase.createTestUser();
      testSystem = await TestDatabase.createTestSystem({
        owner: testUser.id,
      });
    });

    it('should create and retrieve assessment', async () => {
      const assessment = await TestDatabase.createTestAssessment({
        systemId: testSystem.id,
        name: 'Test Assessment',
        createdBy: testUser.id,
      });

      expect(assessment).toBeDefined();
      expect(assessment.name).toBe('Test Assessment');
      expect(assessment.systemId).toBe(testSystem.id);
      expect(assessment.createdBy).toBe(testUser.id);

      // Verify assessment exists in database
      const retrievedAssessment = await db
        .select()
        .from(assessments)
        .where(eq(assessments.id, assessment.id))
        .limit(1);

      expect(retrievedAssessment).toHaveLength(1);
      expect(retrievedAssessment[0].name).toBe('Test Assessment');
    });

    it('should update assessment', async () => {
      const assessment = await TestDatabase.createTestAssessment({
        systemId: testSystem.id,
        createdBy: testUser.id,
        name: 'Original Name',
      });

      const updatedAssessment = await db
        .update(assessments)
        .set({
          name: 'Updated Name',
          updatedAt: new Date(),
        })
        .where(eq(assessments.id, assessment.id))
        .returning();

      expect(updatedAssessment).toHaveLength(1);
      expect(updatedAssessment[0].name).toBe('Updated Name');
    });

    it('should delete assessment', async () => {
      const assessment = await TestDatabase.createTestAssessment({
        systemId: testSystem.id,
        createdBy: testUser.id,
      });

      await db.delete(assessments).where(eq(assessments.id, assessment.id));

      const deletedAssessment = await db
        .select()
        .from(assessments)
        .where(eq(assessments.id, assessment.id))
        .limit(1);

      expect(deletedAssessment).toHaveLength(0);
    });

    it('should enforce foreign key constraints', async () => {
      // Try to create assessment with non-existent system
      await expect(
        TestDatabase.createTestAssessment({
          systemId: 'non-existent-system-id',
          createdBy: testUser.id,
        })
      ).rejects.toThrow();

      // Try to create assessment with non-existent user
      await expect(
        TestDatabase.createTestAssessment({
          systemId: testSystem.id,
          createdBy: 'non-existent-user-id',
        })
      ).rejects.toThrow();
    });
  });

  describe('Complex Queries', () => {
    let testUser: any;
    let testSystem: any;
    let testControl: any;
    let testDocument: any;
    let testAssessment: any;

    beforeEach(async () => {
      testUser = await TestDatabase.createTestUser();
      testSystem = await TestDatabase.createTestSystem({
        owner: testUser.id,
      });
      testControl = await TestDatabase.createTestControl();
      testDocument = await TestDatabase.createTestDocument({
        systemId: testSystem.id,
      });
      testAssessment = await TestDatabase.createTestAssessment({
        systemId: testSystem.id,
        createdBy: testUser.id,
      });
    });

    it('should perform complex join queries', async () => {
      // Get system with owner details
      const systemWithOwner = await db
        .select({
          id: systems.id,
          name: systems.name,
          owner: systems.owner,
          ownerUsername: users.username,
          ownerEmail: users.email,
        })
        .from(systems)
        .leftJoin(users, eq(systems.owner, users.id))
        .where(eq(systems.id, testSystem.id))
        .limit(1);

      expect(systemWithOwner).toHaveLength(1);
      expect(systemWithOwner[0].name).toBe(testSystem.name);
      expect(systemWithOwner[0].ownerUsername).toBe(testUser.username);
    });

    it('should perform aggregation queries', async () => {
      // Count systems by category
      const systemCounts = await db
        .select({
          category: systems.category,
          count: systems.id,
        })
        .from(systems)
        .groupBy(systems.category);

      expect(systemCounts).toBeDefined();
      expect(Array.isArray(systemCounts)).toBe(true);
    });

    it('should perform filtered queries', async () => {
      // Get systems by owner
      const userSystems = await db
        .select()
        .from(systems)
        .where(eq(systems.owner, testUser.id));

      expect(userSystems).toHaveLength(1);
      expect(userSystems[0].id).toBe(testSystem.id);
    });
  });

  describe('Transaction Operations', () => {
    it('should handle successful transactions', async () => {
      const result = await db.transaction(async (tx) => {
        const user = await tx.insert(users).values({
          id: 'transaction-user',
          username: 'transactionuser',
          passwordHash: 'hashedpassword',
          email: 'transaction@example.com',
        }).returning();

        const system = await tx.insert(systems).values({
          id: 'transaction-system',
          name: 'Transaction System',
          description: 'Test system',
          category: 'General Support System',
          impactLevel: 'Moderate',
          complianceStatus: 'in-progress',
          owner: user[0].id,
        }).returning();

        return { user: user[0], system: system[0] };
      });

      expect(result.user).toBeDefined();
      expect(result.system).toBeDefined();
      expect(result.system.owner).toBe(result.user.id);
    });

    it('should handle failed transactions with rollback', async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.insert(users).values({
            id: 'rollback-user',
            username: 'rollbackuser',
            passwordHash: 'hashedpassword',
            email: 'rollback@example.com',
          });

          // This should fail and cause rollback
          await tx.insert(systems).values({
            id: 'rollback-system',
            name: 'Rollback System',
            description: 'Test system',
            category: 'General Support System',
            impactLevel: 'Moderate',
            complianceStatus: 'in-progress',
            owner: 'non-existent-user-id', // This will cause foreign key error
          });

          return true;
        })
      ).rejects.toThrow();

      // Verify that the user was not created due to rollback
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, 'rollback-user'))
        .limit(1);

      expect(user).toHaveLength(0);
    });
  });
});
