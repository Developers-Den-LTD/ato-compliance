import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { AuthRequest } from '../types/auth.types';

export class UserController {
  async getUsers(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string || '';

      const result = await userService.getAllUsers(limit, (page - 1) * limit);

      return res.status(200).json(result);
    } catch (error) {
      console.error('Get users error:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  async getUserById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const user = await userService.getUserById(id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({ user });
    } catch (error) {
      console.error('Get user error:', error);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  async createUser(req: AuthRequest, res: Response) {
    try {
      const { username, password, role } = req.body;

      // Validation
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      if (role && !['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
      }

      const newUser = await userService.createUser({ username, password, role: role || 'user' });

      return res.status(201).json({ user: newUser });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Username already exists') {
          return res.status(409).json({ error: error.message });
        }
      }
      console.error('Create user error:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }

  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Prevent deleting yourself
      if (req.user?.userId === id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      await userService.deleteUser(id);

      return res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }
}

export const userController = new UserController();
