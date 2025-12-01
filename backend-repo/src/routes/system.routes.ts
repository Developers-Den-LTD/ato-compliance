import { Router } from 'express';
import { systemController } from '../controllers/system.controller';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../types/auth.types';

const router = Router();

// All system routes require authentication
router.use(authenticate);

router.get('/', (req: AuthRequest, res) => systemController.getSystems(req, res));
router.post('/', (req: AuthRequest, res) => systemController.createSystem(req, res));
router.get('/:id/metrics', (req: AuthRequest, res) => systemController.getSystemMetrics(req, res));
router.get('/:id/readiness', (req: AuthRequest, res) => systemController.getSystemReadiness(req, res));
router.get('/:id', (req: AuthRequest, res) => systemController.getSystemById(req, res));
router.put('/:id', (req: AuthRequest, res) => systemController.updateSystem(req, res));
router.delete('/:id', (req: AuthRequest, res) => systemController.deleteSystem(req, res));

export default router;
