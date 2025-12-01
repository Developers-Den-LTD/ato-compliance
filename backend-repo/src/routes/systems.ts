// Systems API routes
import { Router } from 'express';
import { SystemService } from '../services/system.service';
import { authenticateToken } from '../middleware/auth';
import { ComplianceStatus, systemControls, controls, documents } from "../schema";
import { z } from 'zod';
import { db } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();
const systemService = new SystemService();

// Validation middleware
const validateRequest = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Validation error',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }
  };
};

// GET /api/systems
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = {
      search: req.query.search as string,
      category: req.query.category as string,
      impactLevel: req.query.impactLevel as string,
      complianceStatus: req.query.complianceStatus as string,
      owner: req.query.owner as string,
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
      sortBy: (req.query.sortBy as string) || 'name',
      sortOrder: (req.query.sortOrder as string) || 'asc',
    };

    const result = await systemService.getSystems(query);
    res.json(result);
  } catch (error) {
    console.error('GET /api/systems error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test route (specific routes must come before /:id)
router.get('/test-live-reload', (req, res) => {
  res.json({ message: 'Live reload working!', timestamp: new Date().toISOString() });
});

// ========== STIG PROFILES FOR ENHANCED REGISTRATION ==========

/**
 * GET /api/systems/stig-profiles
 * Get available STIG profiles by category for enhanced system registration
 */
router.get('/stig-profiles', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    
    // Import stigRules from schema
    const { stigRules } = await import('../schema');
    const { sql } = await import('drizzle-orm');
    
    // Get distinct STIG profiles from the database
    const profilesQuery = await db.execute<{
      stig_id: string;
      stig_title: string;
      version: string;
      rule_count: number;
    }>(sql`
      SELECT 
        stig_id,
        stig_title,
        version,
        COUNT(*) as rule_count
      FROM ${stigRules}
      WHERE rule_type = 'stig'
      ${category ? sql`AND stig_id ILIKE ${`%${category}%`}` : sql``}
      GROUP BY stig_id, stig_title, version
      ORDER BY stig_id
    `);
    
    // Helper function to categorize STIG profiles
    const categorizeProfile = (stigId: string): string => {
      const id = (stigId || '').toUpperCase();
      if (id.includes('WEB') || id.includes('DATABASE') || id.includes('APP')) {
        return 'Application';
      } else if (id.includes('WINDOWS') || id.includes('RHEL') || id.includes('UBUNTU') || id.includes('LINUX')) {
        return 'Operating System';
      } else if (id.includes('ROUTER') || id.includes('SWITCH') || id.includes('FIREWALL')) {
        return 'Network Device';
      } else if (id.includes('IOS') || id.includes('ANDROID') || id.includes('MOBILE')) {
        return 'Mobile Device';
      } else if (id.includes('AWS') || id.includes('AZURE') || id.includes('CLOUD')) {
        return 'Cloud';
      }
      return 'Other';
    };
    
    const formattedProfiles = profilesQuery.rows.map(profile => ({
      stig_id: profile.stig_id,
      stig_title: profile.stig_title || `STIG Profile ${profile.stig_id}`,
      version: profile.version || '1.0',
      category: categorizeProfile(profile.stig_id),
      rule_count: Number(profile.rule_count)
    }));
    
    res.json(formattedProfiles);
    
  } catch (error) {
    console.error('Error fetching STIG profiles:', error);
    res.status(500).json({ error: 'Failed to fetch STIG profiles' });
  }
});


// GET /api/systems/:id/documents - Get documents for a specific system
router.get('/:id/documents', authenticateToken, async (req, res) => {
  try {
    console.log('Documents route accessed for system:', req.params.id);
    const systemId = req.params.id;

    // Fetch all documents for the system
    const systemDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.systemId, systemId));

    res.json(systemDocuments);
  } catch (error) {
    console.error('Error fetching system documents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/systems/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const system = await systemService.getSystemById(req.params.id);
    if (!system) {
      return res.status(404).json({ error: 'System not found' });
    }
    res.json(system);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/systems
router.post('/', authenticateToken, validateRequest(z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  category: z.enum(['General Support System', 'Major Application', 'Minor Application', 'Enclave']),
  impactLevel: z.enum(['Low', 'Moderate', 'High']),
  complianceStatus: ComplianceStatus.optional(),
  stigProfiles: z.array(z.string()).optional(),
  autoStigUpdates: z.boolean().optional(),
})), async (req, res) => {
  try {
    const systemData = {
      ...req.body,
      owner: '160b3477-c30d-482f-b2ac-2d75d9919a1a',
      complianceStatus: req.body.complianceStatus || 'not-assessed',
    };

    const system = await systemService.createSystem(systemData);
    res.status(201).json(system);
  } catch (error) {
    console.error('System creation error:', error);
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
    }
    res.status(500).json({ error: 'Failed to create system', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PUT /api/systems/:id
router.put('/:id', authenticateToken, validateRequest(z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(1000).optional(),
  category: z.enum(['General Support System', 'Major Application', 'Minor Application', 'Enclave']).optional(),
  impactLevel: z.enum(['Low', 'Moderate', 'High']).optional(),
  complianceStatus: ComplianceStatus.optional(),
})), async (req, res) => {
  try {
    const system = await systemService.updateSystem(req.params.id, req.body);
    res.json(system);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'System not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/systems/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await systemService.deleteSystem(req.params.id);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'System not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/systems/owner/:ownerId
router.get('/owner/:ownerId', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const systems = await systemService.getSystemsByOwner(req.params.ownerId, limit, offset);
    res.json(systems);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/systems/statistics
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const stats = await systemService.getSystemStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/systems/search/:term
router.get('/search/:term', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const systems = await systemService.searchSystems(req.params.term, limit);
    res.json(systems);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/systems/:id/compliance-status
router.patch('/:id/compliance-status', authenticateToken, validateRequest(z.object({
  status: z.enum(['not-started', 'in-progress', 'compliant', 'non-compliant']),
})), async (req, res) => {
  try {
    const system = await systemService.updateComplianceStatus(req.params.id, req.body.status);
    res.json(system);
  } catch (error) {
    if (error instanceof Error && error.message === 'System not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/systems/:id/metrics
router.get('/:id/metrics', authenticateToken, async (req, res) => {
  try {
    // Return mock metrics data for now
    // TODO: Implement actual metrics calculation from database
    res.json({
      controlsImplemented: 0,
      totalControls: 0,
      documentsCount: 0,
      findingsCount: 0,
      lastAssessment: 'Never',
      nextAssessment: 'Not scheduled',
      compliancePercentage: 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/systems/:id/controls
router.get('/:id/controls', authenticateToken, async (req, res) => {
  try {
    const systemId = req.params.id;

    // Fetch assigned controls with full control details
    const assignedControls = await db
      .select({
        id: systemControls.id,
        systemId: systemControls.systemId,
        controlId: systemControls.controlId,
        status: systemControls.status,
        assignedTo: systemControls.assignedTo,
        implementationText: systemControls.implementationText,
        lastUpdated: systemControls.lastUpdated,
        // Include control details
        controlNumber: controls.id,
        controlTitle: controls.title,
        controlFamily: controls.family,
        controlDescription: controls.description,
      })
      .from(systemControls)
      .leftJoin(controls, eq(systemControls.controlId, controls.id))
      .where(eq(systemControls.systemId, systemId));

    res.json(assignedControls);
  } catch (error) {
    console.error('Error fetching system controls:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/systems/:id/readiness - Get system readiness for document generation
router.get('/:id/readiness', authenticateToken, async (req, res) => {
  try {
    const systemId = req.params.id;

    // Validate system exists
    const system = await db
      .select()
      .from(systemControls)
      .where(eq(systemControls.systemId, systemId))
      .limit(1);

    // Get control assignments using existing pattern
    const controlStats = await db
      .select({
        total: systemControls.controlId,
        implemented: systemControls.status,
        implementationText: systemControls.implementationText
      })
      .from(systemControls)
      .where(eq(systemControls.systemId, systemId));

    const totalControls = controlStats.length;
    const implementedControls = controlStats.filter(c => c.status === 'implemented').length;
    const documentedControls = controlStats.filter(c => 
      c.implementationText && c.implementationText.length > 10
    ).length;

    // Calculate readiness percentage using existing business logic pattern
    const hasSystemProfile = true; // System exists if we got here
    const hasControlAssignments = totalControls > 0;
    const hasEvidenceUploaded = false; // Simplified for now
    const hasAssessmentResults = false; // Simplified for now
    const implementationRate = totalControls > 0 ? (implementedControls / totalControls) : 0;
    
    const readinessPercentage = Math.round(
      (hasSystemProfile ? 10 : 0) +
      (hasControlAssignments ? 25 : 0) +
      (hasEvidenceUploaded ? 20 : 0) +
      (hasAssessmentResults ? 15 : 0) +
      (implementationRate * 30)
    );

    // Generate recommendations following existing pattern
    const recommendations = [];
    if (!hasControlAssignments) {
      recommendations.push('Assign security controls to the system');
    }
    if (implementationRate < 0.8) {
      recommendations.push('Complete control implementation details');
    }
    if (recommendations.length === 0) {
      recommendations.push('System is ready for document generation!');
    }

    const readiness = {
      systemId,
      hasSystemProfile,
      hasControlAssignments,
      hasEvidenceUploaded,
      hasAssessmentResults,
      hasStigMappings: hasControlAssignments, // Simplified assumption
      hasRiskAssessments: hasAssessmentResults,
      totalControls,
      implementedControls,
      evidenceCount: 0, // Simplified for now
      readinessPercentage,
      recommendations
    };

    res.json({
      success: true,
      readiness
    });

  } catch (error) {
    console.error('Error fetching system readiness:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced STIG Profile Support Routes

// Enhanced system registration schema
const enhancedSystemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(["Major Application", "General Support System"]),
  impactLevel: z.enum(["Low", "Moderate", "High"]),
  complianceStatus: z.enum(["compliant", "non-compliant", "in-progress", "not-assessed"]),
  owner: z.string().optional(),
  systemType: z.enum(["Application", "Operating System", "Network Device", "Mobile Device", "Cloud"]),
  operatingSystem: z.string().optional(),
  stigProfiles: z.array(z.string()).default([]),
  autoStigUpdates: z.boolean().default(true)
});

// Debug endpoint to check authentication
router.get('/debug-auth', authenticateToken, async (req, res) => {
  res.json({
    user: req.user,
    userId: req.user?.userId,
    userIdType: typeof req.user?.userId,
    userIdLength: req.user?.userId?.length,
    authDisabled: process.env.DISABLE_AUTH
  });
});

// Enhanced system registration endpoint
router.post('/enhanced', authenticateToken, async (req, res) => {
  try {
    const validatedData = enhancedSystemSchema.parse(req.body);
    
    // Insert the basic system record using same pattern as regular endpoint
    const systemData = {
      name: validatedData.name,
      description: validatedData.description || 'TBD',
      category: validatedData.category,
      impactLevel: validatedData.impactLevel,
      complianceStatus: validatedData.complianceStatus,
      owner: '160b3477-c30d-482f-b2ac-2d75d9919a1a',
      systemType: validatedData.systemType,
      operatingSystem: validatedData.operatingSystem
    };
    
    const newSystem = await systemService.createSystem(systemData);
    
    // If STIG profiles are selected, assign them and their mapped controls
    let stigAssignment = null;
    if (validatedData.stigProfiles && validatedData.stigProfiles.length > 0) {
      stigAssignment = await systemService.updateSystemStigProfiles(
        newSystem.id,
        validatedData.stigProfiles,
        validatedData.autoStigUpdates
      );
    }
    
    res.status(201).json({
      ...newSystem,
      stigProfiles: validatedData.stigProfiles,
      stigControlsAssigned: stigAssignment?.assigned || 0
    });
    
  } catch (error) {
    console.error('Enhanced system registration error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to register system with STIG profiles' 
      });
    }
  }
});

// Update system STIG profiles
router.patch('/:systemId/stig-profiles', authenticateToken, async (req, res) => {
  try {
    const { systemId } = req.params;
    const { stigProfiles, autoStigUpdates } = req.body;
    
    // Validate input
    if (!Array.isArray(stigProfiles)) {
      return res.status(400).json({ error: 'stigProfiles must be an array' });
    }
    
    // Update system record via service
    await systemService.updateSystemStigProfiles(systemId, stigProfiles, autoStigUpdates);
    
    res.json({ 
      message: 'STIG profiles updated successfully',
      systemId,
      stigProfiles,
      autoStigUpdates 
    });
    
  } catch (error) {
    console.error('Error updating STIG profiles:', error);
    res.status(500).json({ error: 'Failed to update STIG profiles' });
  }
});

// Get system with STIG profile details
router.get('/:systemId/stig-profiles', authenticateToken, async (req, res) => {
  try {
    const { systemId } = req.params;
    
    const systemWithProfiles = await systemService.getSystemWithStigProfiles(systemId);
    
    if (!systemWithProfiles) {
      return res.status(404).json({ error: 'System not found' });
    }
    
    res.json(systemWithProfiles);
    
  } catch (error) {
    console.error('Error fetching system STIG profiles:', error);
    res.status(500).json({ error: 'Failed to fetch system STIG profiles' });
  }
});

export default router;
