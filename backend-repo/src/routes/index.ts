import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import systemRoutes from './system.routes';
import controlRoutes from './control.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/systems', systemRoutes);
router.use(controlRoutes);

export default router;
