import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import systemRoutes from './system.routes';
import controlRoutes from './control.routes';
import stigRoutes from './stig.routes';
import analyticsRoutes from './analytics';
import assessmentRoutes from './assessment';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/systems', systemRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/assessment', assessmentRoutes);
router.use(controlRoutes);
router.use(stigRoutes);

export default router;
