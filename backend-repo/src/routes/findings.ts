// Findings API routes
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/findings?systemId=X
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { systemId } = req.query;

    // Return empty array for now
    // TODO: Implement actual findings fetch from database
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
