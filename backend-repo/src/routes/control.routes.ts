import { Router } from 'express';
import { controlController } from '../controllers/control.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All control routes require authentication
router.use(authenticate);

// Control library endpoints
router.get('/controls', (req, res) => controlController.getControls(req, res));
router.get('/controls/stats', (req, res) => controlController.getControlStats(req, res));
router.get('/controls/families', (req, res) => controlController.getControlFamilies(req, res));
router.get('/controls/:id', (req, res) => controlController.getControlById(req, res));

// System control implementation endpoints
import { AuthRequest } from '../types/auth.types';

router.get('/systems/:systemId/controls', (req: AuthRequest, res) => controlController.getSystemControls(req, res));
router.get('/systems/:systemId/controls/stats', (req: AuthRequest, res) => controlController.getSystemControlStats(req, res));
router.get('/systems/:systemId/controls/:controlId', (req: AuthRequest, res) => controlController.getSystemControlById(req, res));
router.put('/systems/:systemId/controls/:controlId', (req: AuthRequest, res) => controlController.updateSystemControl(req, res));
router.post('/systems/:systemId/controls/bulk-assign', (req: AuthRequest, res) => controlController.bulkAssignControls(req, res));
router.delete('/systems/:systemId/controls/:controlId', (req: AuthRequest, res) => controlController.removeSystemControl(req, res));

export default router;
