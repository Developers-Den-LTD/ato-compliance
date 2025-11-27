import { Request, Response } from 'express';
import { stigService } from '../services/stig.service';
import { AuthRequest } from '../types/auth.types';

export class STIGController {
  // GET /api/stig/profiles - Get all STIG profiles
  async getProfiles(req: Request, res: Response) {
    try {
      const category = req.query.category as string;
      
      const profiles = category 
        ? await stigService.getSTIGProfilesByCategory(category)
        : await stigService.getSTIGProfiles();

      res.json({
        profiles,
        total: profiles.length,
      });
    } catch (error) {
      console.error('Error fetching STIG profiles:', error);
      res.status(500).json({ error: 'Failed to fetch STIG profiles' });
    }
  }

  // GET /api/stig/available-profiles - Get available STIG profiles for system registration
  async getAvailableProfiles(req: Request, res: Response) {
    try {
      const category = req.query.category as string;
      const operatingSystem = req.query.operatingSystem as string;
      const profiles = await stigService.getAvailableProfilesForCategory(category, operatingSystem);

      res.json(profiles);
    } catch (error) {
      console.error('Error fetching available STIG profiles:', error);
      res.status(500).json({ error: 'Failed to fetch available STIG profiles' });
    }
  }

  // GET /api/stig/profiles/:stigId - Get detailed profile information
  async getProfileDetails(req: Request, res: Response) {
    try {
      const { stigId } = req.params;
      const profile = await stigService.getProfileDetails(stigId);

      if (!profile) {
        return res.status(404).json({ error: 'STIG profile not found' });
      }

      res.json(profile);
    } catch (error) {
      console.error('Error fetching STIG profile details:', error);
      res.status(500).json({ error: 'Failed to fetch STIG profile details' });
    }
  }

  // GET /api/stig/profiles/:stigId/rules - Get rules for a STIG profile
  async getProfileRules(req: Request, res: Response) {
    try {
      const { stigId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      
      const rules = await stigService.getSTIGRules(stigId, limit, offset);

      // Get total count
      const [profile] = await stigService.getSTIGProfiles();
      const totalCount = profile ? profile.totalRules : rules.length;

      res.json({
        stigId,
        rules,
        total: totalCount,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Error fetching STIG rules:', error);
      res.status(500).json({ error: 'Failed to fetch STIG rules' });
    }
  }

  // GET /api/stig/rules/:ruleId - Get a specific STIG rule with mappings
  async getRule(req: Request, res: Response) {
    try {
      const { ruleId } = req.params;
      const rule = await stigService.getSTIGRuleWithMappings(ruleId);

      if (!rule) {
        return res.status(404).json({ error: 'STIG rule not found' });
      }

      res.json(rule);
    } catch (error) {
      console.error('Error fetching STIG rule:', error);
      res.status(500).json({ error: 'Failed to fetch STIG rule' });
    }
  }

  // GET /api/stig/stats - Get STIG statistics
  async getStats(req: Request, res: Response) {
    try {
      const stats = await stigService.getSTIGStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching STIG stats:', error);
      res.status(500).json({ error: 'Failed to fetch STIG stats' });
    }
  }

  // GET /api/stig/profiles/:stigId/coverage - Get NIST control coverage
  async getControlCoverage(req: Request, res: Response) {
    try {
      const { stigId } = req.params;
      const coverage = await stigService.getSTIGControlCoverage(stigId);

      res.json({
        stigId,
        coverage,
        totalControls: coverage.length,
      });
    } catch (error) {
      console.error('Error fetching control coverage:', error);
      res.status(500).json({ error: 'Failed to fetch control coverage' });
    }
  }

  // GET /api/systems/:systemId/stig-profiles - Get STIG profiles for a system
  async getSystemProfiles(req: Request, res: Response) {
    try {
      const { systemId } = req.params;
      const profiles = await stigService.getSystemSTIGProfiles(systemId);

      res.json({
        systemId,
        profiles,
        total: profiles.length,
      });
    } catch (error) {
      console.error('Error fetching system STIG profiles:', error);
      res.status(500).json({ error: 'Failed to fetch system STIG profiles' });
    }
  }

  // PUT /api/systems/:systemId/stig-profiles - Assign STIG profiles to a system
  async assignSystemProfiles(req: AuthRequest, res: Response) {
    try {
      const { systemId } = req.params;
      const { stigIds } = req.body;

      if (!Array.isArray(stigIds)) {
        return res.status(400).json({ error: 'stigIds must be an array' });
      }

      const profiles = await stigService.assignSTIGProfiles(systemId, stigIds);

      res.json({
        systemId,
        profiles,
        message: 'STIG profiles assigned successfully',
      });
    } catch (error) {
      console.error('Error assigning STIG profiles:', error);
      res.status(500).json({ error: 'Failed to assign STIG profiles' });
    }
  }
}

export const stigController = new STIGController();
