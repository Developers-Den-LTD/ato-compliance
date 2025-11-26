import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';

const router = Router();

// All user routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

router.get('/', (req, res) => userController.getUsers(req, res));
router.post('/', (req, res) => userController.createUser(req, res));
router.get('/:id', (req, res) => userController.getUserById(req, res));
router.delete('/:id', (req, res) => userController.deleteUser(req, res));

export default router;
