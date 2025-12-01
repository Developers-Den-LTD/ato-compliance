import { Router } from 'express';
import { stigController } from '../controllers/stig.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All STIG routes require authentication
router.use(authenticate);

// Available STIG profiles (for system registration) - must be before parameterized routes
router.get('/stig/available-profiles', (req, res) => stigController.getAvailableProfiles(req, res));

// STIG profile endpoints
router.get('/stig/profiles', (req, res) => stigController.getProfiles(req, res));
router.get('/stig/profiles/:stigId', (req, res) => stigController.getProfileDetails(req, res));
router.get('/stig/profiles/:stigId/rules', (req, res) => stigController.getProfileRules(req, res));
router.get('/stig/profiles/:stigId/coverage', (req, res) => stigController.getControlCoverage(req, res));
router.get('/stig/rules/:ruleId', (req, res) => stigController.getRule(req, res));
router.get('/stig/stats', (req, res) => stigController.getStats(req, res));

// System STIG profile endpoints
router.get('/systems/:systemId/stig-profiles', (req, res) => {
  // Stub - method doesn't exist yet
  res.status(501).json({ error: 'Not implemented' });
});
router.put('/systems/:systemId/stig-profiles', (req, res) => {
  // Stub - method doesn't exist yet
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
