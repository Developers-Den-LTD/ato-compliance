// Assessment API Routes
// Endpoints for automated control assessment and human review

import { Router } from 'express';
import { z } from 'zod';
import { controlAssessmentService } from '../services/control-assessment.service';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../types/auth.types';
import { storage } from '../storage';
import type { ControlAssessmentRequest, SystemAssessmentRequest } from '../services/control-assessment.service';

// Helper function for system access check
const checkSystemAccess = async (userId: string, systemId: string): Promise<boolean> => {
  const system = await storage.getSystem(systemId);
  return !!system;
};

const router = Router();

// Request validation schemas
const controlAssessmentSchema = z.object({
  systemId: z.string().uuid(),
  controlId: z.string(),
  includeNarrative: z.boolean().optional().default(true),
  assessorNotes: z.string().optional(),
  forceReassess: z.boolean().optional().default(false)
});

const systemAssessmentSchema = z.object({
  systemId: z.string().uuid(),
  controlIds: z.array(z.string()).optional(),
  includeNarratives: z.boolean().optional().default(false),
  assessmentMode: z.enum(['automated', 'manual', 'hybrid']).optional().default('automated'),
  confidenceThreshold: z.number().min(0).max(1).optional().default(0.8)
});

const reviewSubmissionSchema = z.object({
  systemId: z.string().uuid(),
  controlId: z.string(),
  status: z.enum(['compliant', 'partially_compliant', 'non_compliant', 'not_applicable']),
  reviewerNotes: z.string(),
  approvedBy: z.string()
});

/**
 * POST /api/assessment/control/assess
 * Assess a single control
 */
router.post('/control/assess', authenticate, async (req: AuthRequest, res) => {
  try {
    const parsed = controlAssessmentSchema.parse(req.body);
    const request: ControlAssessmentRequest = {
      systemId: parsed.systemId,
      controlId: parsed.controlId,
      includeNarrative: parsed.includeNarrative,
      assessorNotes: parsed.assessorNotes,
      forceReassess: parsed.forceReassess
    };
    
    // Check system access
    const hasAccess = await checkSystemAccess(req.user!.userId, request.systemId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }
    
    // Perform assessment
    const result = await controlAssessmentService.assessControl(request);
    
    res.json({
      success: true,
      assessment: result
    });
    
  } catch (error) {
    console.error('Control assessment error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to assess control'
    });
  }
});

/**
 * POST /api/assessment/system/assess
 * Assess all controls for a system
 */
router.post('/system/assess', authenticate, async (req: AuthRequest, res) => {
  try {
    const parsed = systemAssessmentSchema.parse(req.body);
    const request: SystemAssessmentRequest = {
      systemId: parsed.systemId,
      controlIds: parsed.controlIds,
      includeNarratives: parsed.includeNarratives,
      assessmentMode: parsed.assessmentMode,
      confidenceThreshold: parsed.confidenceThreshold
    };
    
    // Check system access
    const hasAccess = await checkSystemAccess(req.user!.userId, request.systemId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }
    
    // Start assessment (this could be long-running)
    res.json({
      success: true,
      message: 'System assessment started',
      systemId: request.systemId
    });
    
    // Perform assessment asynchronously
    controlAssessmentService.assessSystem(request)
      .then(summary => {
        console.log(`System assessment completed for ${request.systemId}:`, {
          total: summary.totalControls,
          compliant: summary.compliantControls,
          score: summary.overallComplianceScore
        });
        // In production, you'd send a notification or update a job status
      })
      .catch(error => {
        console.error(`System assessment failed for ${request.systemId}:`, error);
      });
    
  } catch (error) {
    console.error('System assessment error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start system assessment'
    });
  }
});

/**
 * GET /api/assessment/system/:systemId/summary
 * Get assessment summary for a system
 */
router.get('/system/:systemId/summary', authenticate, async (req: AuthRequest, res) => {
  try {
    const { systemId } = req.params;
    
    // Validate UUID
    if (!z.string().uuid().safeParse(systemId).success) {
      return res.status(400).json({
        error: 'Invalid system ID format'
      });
    }
    
    // Check system access
    const hasAccess = await checkSystemAccess(req.user!.userId, systemId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }
    
    // Get system controls with their current status
    const systemControls = await storage.getSystemControls(systemId);
    
    // Calculate summary
    const summary = {
      systemId,
      totalControls: systemControls.length,
      assessedControls: systemControls.filter(sc => sc.status !== 'not_implemented').length,
      compliantControls: systemControls.filter(sc => sc.status === 'implemented').length,
      partiallyCompliantControls: systemControls.filter(sc => sc.status === 'partial').length,
      nonCompliantControls: systemControls.filter(sc => sc.status === 'not_implemented').length,
      notApplicableControls: systemControls.filter(sc => sc.status === 'not_applicable').length,
      overallComplianceScore: Math.round(
        (systemControls.filter(sc => sc.status === 'implemented').length / systemControls.length) * 100
      ),
      lastAssessed: new Date()
    };
    
    res.json({
      success: true,
      summary
    });
    
  } catch (error) {
    console.error('Get assessment summary error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get assessment summary'
    });
  }
});

/**
 * GET /api/assessment/control/:systemId/:controlId/status
 * Get detailed assessment status for a control
 */
router.get('/control/:systemId/:controlId/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { systemId, controlId } = req.params;
    
    // Validate UUID
    if (!z.string().uuid().safeParse(systemId).success) {
      return res.status(400).json({
        error: 'Invalid system ID format'
      });
    }
    
    // Check system access
    const hasAccess = await checkSystemAccess(req.user!.userId, systemId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }
    
    // Get control data
    const [control, systemControl, evidence, findings] = await Promise.all([
      storage.getControl(controlId),
      storage.getSystemControl(systemId, controlId),
      storage.getEvidenceByControl(controlId),
      storage.getFindingsBySystem(systemId)
    ]);
    
    if (!control || !systemControl) {
      return res.status(404).json({
        error: 'Control not found for this system'
      });
    }
    
    // Filter evidence for this system
    const systemEvidence = evidence.filter(e => e.systemId === systemId);
    
    // Get related STIG rules and findings
    const ccis = await storage.getCcisByControl(controlId);
    const stigRuleIds = new Set<string>();
    
    for (const cci of ccis) {
      const mappings = await storage.getStigRuleCcisByCci(cci);
      mappings.forEach(m => stigRuleIds.add(m.stigRuleId));
    }
    
    const relatedFindings = findings.filter(f => 
      stigRuleIds.has(f.stigRuleId) && f.status === 'open'
    );
    
    res.json({
      success: true,
      assessment: {
        controlId: control.id,
        controlTitle: control.title,
        status: systemControl.status,
        implementationText: systemControl.implementationText,
        evidence: {
          total: systemEvidence.length,
          satisfying: systemEvidence.filter(e => e.status === 'satisfies').length,
          partial: systemEvidence.filter(e => e.status === 'partially_satisfies').length
        },
        findings: {
          total: relatedFindings.length,
          critical: relatedFindings.filter(f => f.severity === 'critical').length,
          high: relatedFindings.filter(f => f.severity === 'high').length
        },
        lastUpdated: systemControl.lastUpdated
      }
    });
    
  } catch (error) {
    console.error('Get control status error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get control status'
    });
  }
});

/**
 * POST /api/assessment/review/submit
 * Submit human review for an assessment
 */
router.post('/review/submit', authenticate, async (req: AuthRequest, res) => {
  try {
    const review = reviewSubmissionSchema.parse(req.body);
    
    // Check system access
    const hasAccess = await checkSystemAccess(req.user!.userId, review.systemId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }
    
    // Submit review
    const result = await controlAssessmentService.submitReview(
      review.systemId,
      review.controlId,
      {
        status: review.status,
        reviewerNotes: review.reviewerNotes,
        approvedBy: review.approvedBy || req.user!.username
      }
    );
    
    res.json({
      success: true,
      assessment: result
    });
    
  } catch (error) {
    console.error('Submit review error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to submit review'
    });
  }
});

/**
 * GET /api/assessment/pending-reviews/:systemId
 * Get controls pending human review
 */
router.get('/pending-reviews/:systemId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { systemId } = req.params;
    
    // Validate UUID
    if (!z.string().uuid().safeParse(systemId).success) {
      return res.status(400).json({
        error: 'Invalid system ID format'
      });
    }
    
    // Check system access
    const hasAccess = await checkSystemAccess(req.user!.userId, systemId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied - insufficient permissions for this system'
      });
    }
    
    // Get system controls
    const systemControls = await storage.getSystemControls(systemId);
    
    // Filter controls that need review (low confidence or explicitly marked)
    const pendingReviews = systemControls
      .filter(sc => 
        sc.status === 'not_implemented' || 
        !sc.implementationText ||
        sc.assignedTo // Has been assigned for review
      )
      .map(sc => ({
        controlId: sc.controlId,
        controlTitle: sc.control.title,
        controlFamily: sc.control.family,
        currentStatus: sc.status,
        assignedTo: sc.assignedTo,
        lastUpdated: sc.lastUpdated
      }));
    
    res.json({
      success: true,
      pendingReviews,
      total: pendingReviews.length
    });
    
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get pending reviews'
    });
  }
});

/**
 * POST /api/assessment/batch
 * Batch assess multiple controls
 */
router.post('/batch', authenticate, async (req: AuthRequest, res) => {
  try {
    const batchSchema = z.object({
      assessments: z.array(controlAssessmentSchema).min(1).max(50)
    });
    
    const { assessments: parsedAssessments } = batchSchema.parse(req.body);
    
    // Convert to proper type
    const assessments: ControlAssessmentRequest[] = parsedAssessments.map(a => ({
      systemId: a.systemId,
      controlId: a.controlId,
      includeNarrative: a.includeNarrative,
      assessorNotes: a.assessorNotes,
      forceReassess: a.forceReassess
    }));
    
    // Verify access to all systems
    const systemIds = new Set(assessments.map(a => a.systemId));
    for (const systemId of systemIds) {
      const hasAccess = await checkSystemAccess(req.user!.userId, systemId);
      if (!hasAccess) {
        return res.status(403).json({
          error: `Access denied - insufficient permissions for system ${systemId}`
        });
      }
    }
    
    // Process assessments
    const results = [];
    const errors = [];
    
    for (const assessment of assessments) {
      try {
        const result = await controlAssessmentService.assessControl(assessment);
        results.push(result);
      } catch (error) {
        errors.push({
          controlId: assessment.controlId,
          systemId: assessment.systemId,
          error: error instanceof Error ? error.message : 'Assessment failed'
        });
      }
    }
    
    res.json({
      success: true,
      completed: results.length,
      failed: errors.length,
      results,
      errors
    });
    
  } catch (error) {
    console.error('Batch assessment error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process batch assessment'
    });
  }
});

export default router;


