import { Router } from 'express';
import { systemController } from '../controllers/system.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All system routes require authentication
router.use(authenticate);

router.get('/', (req, res) => systemController.getSystems(req, res));
router.post('/', (req, res) => systemController.createSystem(req, res));
router.get('/:id/metrics', (req, res) => systemController.getSystemMetrics(req, res));
router.get('/:id/readiness', (req, res) => systemController.getSystemReadiness(req, res));
router.get('/:id', (req, res) => systemController.getSystemById(req, res));
router.put('/:id', (req, res) => systemController.updateSystem(req, res));
router.delete('/:id', (req, res) => systemController.deleteSystem(req, res));

export default router;
