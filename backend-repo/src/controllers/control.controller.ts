import { Request, Response } from 'express';
import { controlService } from '../services/control.service';
import { AuthRequest } from '../types/auth.types';

export class ControlController {
  async getControls(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || '';
      const family = req.query.family as string;
      const baseline = req.query.baseline as string;
      const framework = req.query.framework as string;

      const result = await controlService.getControls({
        page,
        limit,
        search,
        family,
        baseline,
        framework,
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching controls:', error);
      res.status(500).json({ error: 'Failed to fetch controls' });
    }
  }

  async getControlById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const control = await controlService.getControlById(id);

      if (!control) {
        return res.status(404).json({ error: 'Control not found' });
      }

      res.json(control);
    } catch (error) {
      console.error('Error fetching control:', error);
      res.status(500).json({ error: 'Failed to fetch control' });
    }
  }

  async getControlFamilies(req: Request, res: Response) {
    try {
      const families = await controlService.getControlFamilies();
      res.json({ families });
    } catch (error) {
      console.error('Error fetching control families:', error);
      res.status(500).json({ error: 'Failed to fetch control families' });
    }
  }

  // System Control Implementation endpoints
  async getSystemControls(req: Request, res: Response) {
    try {
      const { systemId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || '';
      const family = req.query.family as string;
      const baseline = req.query.baseline as string;

      const result = await controlService.getSystemControls(systemId, {
        page,
        limit,
        search,
        family,
        baseline,
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching system controls:', error);
      res.status(500).json({ error: 'Failed to fetch system controls' });
    }
  }

  async getSystemControlById(req: Request, res: Response) {
    try {
      const { systemId, controlId } = req.params;
      const systemControl = await controlService.getSystemControlById(systemId, controlId);

      if (!systemControl) {
        return res.status(404).json({ error: 'System control not found' });
      }

      res.json(systemControl);
    } catch (error) {
      console.error('Error fetching system control:', error);
      res.status(500).json({ error: 'Failed to fetch system control' });
    }
  }

  async updateSystemControl(req: AuthRequest, res: Response) {
    try {
      const { systemId, controlId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const data = {
        ...req.body,
        updatedBy: userId,
      };

      const updated = await controlService.updateSystemControl(systemId, controlId, data);

      if (!updated) {
        return res.status(404).json({ error: 'System control not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating system control:', error);
      res.status(500).json({ error: 'Failed to update system control' });
    }
  }

  async bulkAssignControls(req: AuthRequest, res: Response) {
    try {
      const { systemId } = req.params;
      const { controlIds } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!Array.isArray(controlIds) || controlIds.length === 0) {
        return res.status(400).json({ error: 'controlIds must be a non-empty array' });
      }

      const assigned = await controlService.bulkAssignControls(systemId, controlIds, userId);

      res.json({
        message: 'Controls assigned successfully',
        assigned: assigned.length,
        controls: assigned,
      });
    } catch (error) {
      console.error('Error assigning controls:', error);
      res.status(500).json({ error: 'Failed to assign controls' });
    }
  }

  async removeSystemControl(req: Request, res: Response) {
    try {
      const { systemId, controlId } = req.params;

      await controlService.removeSystemControl(systemId, controlId);

      res.json({ message: 'System control removed successfully' });
    } catch (error) {
      console.error('Error removing system control:', error);
      res.status(500).json({ error: 'Failed to remove system control' });
    }
  }

  async getSystemControlStats(req: Request, res: Response) {
    try {
      const { systemId } = req.params;
      const stats = await controlService.getSystemControlStats(systemId);

      res.json(stats);
    } catch (error) {
      console.error('Error fetching system control stats:', error);
      res.status(500).json({ error: 'Failed to fetch system control stats' });
    }
  }
}

export const controlController = new ControlController();
