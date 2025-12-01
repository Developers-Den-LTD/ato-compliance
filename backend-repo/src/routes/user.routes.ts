import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { AuthRequest } from '../types/auth.types';

const router = Router();

// All user routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

router.get('/', (req: AuthRequest, res) => userController.getUsers(req, res));
router.post('/', (req: AuthRequest, res) => userController.createUser(req, res));
router.get('/:id', (req: AuthRequest, res) => userController.getUserById(req, res));
router.delete('/:id', (req: AuthRequest, res) => userController.deleteUser(req, res));

export default router;
