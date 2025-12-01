// Unit tests for UserService
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserService } from '../user.service';
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

describe('UserService', () => {
  let userService: UserService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService();
    mockDb = db as any;
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        password: 'password123',
        email: 'test@example.com',
      };

      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockUser]),
        }),
      });

      const result = await userService.createUser(userData);

      expect(result).toEqual(mockUser);
      expect(mockDb.insert).toHaveBeenCalledWith(users);
    });

    it('should throw error for duplicate username', async () => {
      const userData = {
        username: 'existinguser',
        password: 'password123',
        email: 'test@example.com',
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(new Error('Username already exists')),
        }),
      });

      await expect(userService.createUser(userData)).rejects.toThrow('Username already exists');
    });
  });

  describe('authenticateUser', () => {
    it('should authenticate user with valid credentials', async () => {
      const username = 'testuser';
      const password = 'password123';

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

      const result = await userService.authenticateUser(username, password);

      expect(result).toEqual(mockUser);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null for invalid credentials', async () => {
      const username = 'testuser';
      const password = 'wrongpassword';

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await userService.authenticateUser(username, password);

      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const userId = 'user-1';
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

      const result = await userService.getUserById(userId);

      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent user', async () => {
      const userId = 'non-existent';

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await userService.getUserById(userId);

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const userId = 'user-1';
      const updateData = {
        email: 'newemail@example.com',
      };

      const mockUpdatedUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'newemail@example.com',
        updatedAt: new Date(),
      };

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockUpdatedUser]),
          }),
        }),
      });

      const result = await userService.updateUser(userId, updateData);

      expect(result).toEqual(mockUpdatedUser);
      expect(mockDb.update).toHaveBeenCalledWith(users);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const userId = 'user-1';

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      });

      await userService.deleteUser(userId);

      expect(mockDb.delete).toHaveBeenCalledWith(users);
    });
  });
});
