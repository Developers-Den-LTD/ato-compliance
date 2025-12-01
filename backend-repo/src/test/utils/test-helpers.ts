// Test utilities and helpers for server-side tests
import { db } from '../../db';
import { users, systems, controls, documents, assessments } from '../../schema';
import { eq } from 'drizzle-orm';

export class TestDatabase {
  static async cleanup() {
    // Clean up test data in reverse dependency order
    await db.delete(documents);
    await db.delete(assessments);
    await db.delete(controls);
    await db.delete(systems);
    await db.delete(users);
  }

  static async createTestUser(userData: Partial<typeof users.$inferInsert> = {}) {
    const defaultUser = {
      id: `test-user-${Date.now()}`,
      username: 'testuser',
      passwordHash: 'hashedpassword',
      email: 'test@example.com',
      ...userData,
    };

    const [user] = await db.insert(users).values(defaultUser).returning();
    return user;
  }

  static async createTestSystem(systemData: Partial<typeof systems.$inferInsert> = {}) {
    const defaultSystem = {
      id: `test-system-${Date.now()}`,
      name: 'Test System',
      description: 'Test system description',
      category: 'General Support System',
      impactLevel: 'Moderate',
      complianceStatus: 'in-progress',
      owner: 'test-user-id',
      ...systemData,
    };

    const [system] = await db.insert(systems).values(defaultSystem).returning();
    return system;
  }

  static async createTestControl(controlData: Partial<typeof controls.$inferInsert> = {}) {
    const defaultControl = {
      id: `AC-${Date.now()}`,
      family: 'Access Control',
      title: 'Test Control',
      description: 'Test control description',
      baseline: ['Low', 'Moderate', 'High'],
      status: 'not_implemented',
      framework: 'NIST 800-53',
      ...controlData,
    };

    const [control] = await db.insert(controls).values(defaultControl).returning();
    return control;
  }

  static async createTestDocument(documentData: Partial<typeof documents.$inferInsert> = {}) {
    const defaultDocument = {
      id: `test-document-${Date.now()}`,
      systemId: 'test-system-id',
      name: 'test-document.pdf',
      title: 'Test Document',
      type: 'policy_document',
      filePath: '/path/to/test-document.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      metadata: {},
      status: 'approved',
      ...documentData,
    };

    const [document] = await db.insert(documents).values(defaultDocument).returning();
    return document;
  }

  static async createTestAssessment(assessmentData: Partial<typeof assessments.$inferInsert> = {}) {
    const defaultAssessment = {
      id: `test-assessment-${Date.now()}`,
      systemId: 'test-system-id',
      name: 'Test Assessment',
      description: 'Test assessment description',
      status: 'in-progress',
      createdBy: 'test-user-id',
      ...assessmentData,
    };

    const [assessment] = await db.insert(assessments).values(defaultAssessment).returning();
    return assessment;
  }
}

export class TestApiClient {
  static async makeRequest(app: any, method: string, path: string, data?: any, headers?: any) {
    const request = require('supertest')(app);
    
    let req = request[method.toLowerCase()](path);
    
    if (headers) {
      req = req.set(headers);
    }
    
    if (data) {
      req = req.send(data);
    }
    
    return req;
  }

  static async login(app: any, username: string, password: string) {
    const response = await this.makeRequest(app, 'POST', '/api/auth/login', {
      username,
      password,
    });
    
    return {
      token: response.body.token,
      user: response.body.user,
    };
  }

  static async authenticatedRequest(app: any, method: string, path: string, token: string, data?: any) {
    return this.makeRequest(app, method, path, data, {
      'Authorization': `Bearer ${token}`,
    });
  }
}

export class TestDataFactory {
  static createUser(overrides: Partial<typeof users.$inferInsert> = {}) {
    return {
      id: `user-${Date.now()}`,
      username: 'testuser',
      passwordHash: 'hashedpassword',
      email: 'test@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createSystem(overrides: Partial<typeof systems.$inferInsert> = {}) {
    return {
      id: `system-${Date.now()}`,
      name: 'Test System',
      description: 'Test system description',
      category: 'General Support System',
      impactLevel: 'Moderate',
      complianceStatus: 'in-progress',
      owner: 'test-user-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createControl(overrides: Partial<typeof controls.$inferInsert> = {}) {
    return {
      id: `AC-${Date.now()}`,
      family: 'Access Control',
      title: 'Test Control',
      description: 'Test control description',
      baseline: ['Low', 'Moderate', 'High'],
      status: 'not_implemented',
      framework: 'NIST 800-53',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createDocument(overrides: Partial<typeof documents.$inferInsert> = {}) {
    return {
      id: `document-${Date.now()}`,
      systemId: 'test-system-id',
      name: 'test-document.pdf',
      title: 'Test Document',
      type: 'policy_document',
      filePath: '/path/to/test-document.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      metadata: {},
      status: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createAssessment(overrides: Partial<typeof assessments.$inferInsert> = {}) {
    return {
      id: `assessment-${Date.now()}`,
      systemId: 'test-system-id',
      name: 'Test Assessment',
      description: 'Test assessment description',
      status: 'in-progress',
      createdBy: 'test-user-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }
}

export class TestMocks {
  static mockJWT() {
    const jwt = require('jsonwebtoken');
    jwt.sign.mockReturnValue('mock-jwt-token');
    jwt.verify.mockReturnValue({ userId: 'test-user-id' });
  }

  static mockBcrypt() {
    const bcrypt = require('bcryptjs');
    bcrypt.hash.mockResolvedValue('hashedpassword');
    bcrypt.compare.mockResolvedValue(true);
  }

  static mockFileSystem() {
    const fs = require('fs/promises');
    fs.readFile.mockResolvedValue('file content');
    fs.writeFile.mockResolvedValue(undefined);
    fs.mkdir.mockResolvedValue(undefined);
    fs.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
    fs.access.mockResolvedValue(undefined);
  }

  static mockMulter() {
    const multer = require('multer');
    multer.mockReturnValue({
      single: () => (req: any, res: any, next: any) => {
        req.file = {
          fieldname: 'file',
          originalname: 'test.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('test file content'),
        };
        next();
      },
      array: () => (req: any, res: any, next: any) => {
        req.files = [];
        next();
      },
    });
  }
}

export const testUtils = {
  TestDatabase,
  TestApiClient,
  TestDataFactory,
  TestMocks,
};
