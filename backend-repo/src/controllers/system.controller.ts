import { Response } from 'express';
import { systemService } from '../services/system.service';
import { AuthRequest } from '../types/auth.types';

export class SystemController {
  async getSystems(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      const offset = (page - 1) * limit;

      // Validate sortBy to match expected union type
      const sortByParam = req.query.sortBy as string;
      const validSortBy = ['name', 'createdAt', 'updatedAt', 'complianceStatus'];
      const sortBy = validSortBy.includes(sortByParam) ? sortByParam as 'name' | 'createdAt' | 'updatedAt' | 'complianceStatus' : 'name';

      // Validate sortOrder to match expected union type
      const sortOrderParam = req.query.sortOrder as string;
      const sortOrder: 'asc' | 'desc' = (sortOrderParam === 'asc' || sortOrderParam === 'desc') ? sortOrderParam : 'asc';

      const query = {
        search,
        category: req.query.category as string,
        impactLevel: req.query.impactLevel as string,
        complianceStatus: req.query.complianceStatus as string,
        owner: req.query.owner as string,
        limit,
        offset,
        sortBy,
        sortOrder,
      };

      const result = await systemService.getSystems(query);

      return res.status(200).json(result);
    } catch (error) {
      console.error('Get systems error:', error);
      return res.status(500).json({ error: 'Failed to fetch systems' });
    }
  }

  async getSystemById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const system = await systemService.getSystemById(id);

      if (!system) {
        return res.status(404).json({ error: 'System not found' });
      }

      return res.status(200).json({ system });
    } catch (error) {
      console.error('Get system error:', error);
      return res.status(500).json({ error: 'Failed to fetch system' });
    }
  }

  async createSystem(req: AuthRequest, res: Response) {
    try {
      const { name, description, category, impactLevel, complianceStatus, systemType, operatingSystem, stigProfiles, autoStigUpdates } = req.body;

      // Validation
      if (!name || !category || !impactLevel) {
        return res.status(400).json({ error: 'Name, category, and impact level are required' });
      }

      if (!['Major Application', 'General Support System'].includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      if (!['High', 'Moderate', 'Low'].includes(impactLevel)) {
        return res.status(400).json({ error: 'Invalid impact level' });
      }

      const newSystem = await systemService.createSystem({
        name,
        description: description || 'TBD',
        category,
        impactLevel,
        complianceStatus: complianceStatus || 'not-assessed',
        owner: req.user!.userId, // Use authenticated user's ID as owner
        systemType,
        operatingSystem,
        stigProfiles,
        autoStigUpdates,
      });

      return res.status(201).json({ system: newSystem });
    } catch (error) {
      console.error('Create system error:', error);
      return res.status(500).json({ error: 'Failed to create system', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async updateSystem(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if system exists
      const existingSystem = await systemService.getSystemById(id);
      if (!existingSystem) {
        return res.status(404).json({ error: 'System not found' });
      }

      // Validate category if provided
      if (updateData.category && !['Major Application', 'General Support System'].includes(updateData.category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      // Validate impact level if provided
      if (updateData.impactLevel && !['High', 'Moderate', 'Low'].includes(updateData.impactLevel)) {
        return res.status(400).json({ error: 'Invalid impact level' });
      }

      const updatedSystem = await systemService.updateSystem(id, updateData);

      return res.status(200).json({ system: updatedSystem });
    } catch (error) {
      console.error('Update system error:', error);
      return res.status(500).json({ error: 'Failed to update system' });
    }
  }

  async deleteSystem(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Check if system exists
      const existingSystem = await systemService.getSystemById(id);
      if (!existingSystem) {
        return res.status(404).json({ error: 'System not found' });
      }

      await systemService.deleteSystem(id);

      return res.status(200).json({ message: 'System deleted successfully' });
    } catch (error) {
      console.error('Delete system error:', error);
      return res.status(500).json({ error: 'Failed to delete system' });
    }
  }

  async getSystemMetrics(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Check if system exists
      const existingSystem = await systemService.getSystemById(id);
      if (!existingSystem) {
        return res.status(404).json({ error: 'System not found' });
      }

      // Return mock metrics for now
      // TODO: Implement actual metrics calculation when controls/evidence/assessments are implemented
      return res.status(200).json({
        controlsImplemented: 0,
        totalControls: 0,
        documentsCount: 0,
        findingsCount: 0,
        lastAssessment: 'Not assessed',
        nextAssessment: 'TBD',
        compliancePercentage: 0,
      });
    } catch (error) {
      console.error('Get system metrics error:', error);
      return res.status(500).json({ error: 'Failed to fetch system metrics' });
    }
  }

  async getSystemReadiness(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Check if system exists
      const existingSystem = await systemService.getSystemById(id);
      if (!existingSystem) {
        return res.status(404).json({ error: 'System not found' });
      }

      // Return mock readiness for now
      // TODO: Implement actual readiness calculation when controls/evidence/assessments are implemented
      return res.status(200).json({
        success: true,
        readiness: {
          systemId: id,
          hasSystemProfile: true,
          hasControlAssignments: false,
          hasEvidenceUploaded: false,
          hasAssessmentResults: false,
          hasStigMappings: false,
          hasRiskAssessments: false,
          totalControls: 0,
          implementedControls: 0,
          evidenceCount: 0,
          lastAssessmentDate: null,
          readinessPercentage: 10, // Only has system profile
          recommendations: [
            'Assign security controls to the system',
            'Upload system documentation and evidence files',
            'Run security assessments to generate findings',
          ],
        },
      });
    } catch (error) {
      console.error('Get system readiness error:', error);
      return res.status(500).json({ error: 'Failed to fetch system readiness' });
    }
  }
}

export const systemController = new SystemController();
