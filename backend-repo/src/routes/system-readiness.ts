import { Router } from 'express';
import { db } from '../db';
import { systems, systemControls, artifacts, generationJobs } from "../schema";
import { eq, sql, count, and } from 'drizzle-orm';
import { validateAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

export interface SystemReadiness {
  systemId: string;
  hasSystemProfile: boolean;
  hasControlAssignments: boolean;
  hasEvidenceUploaded: boolean;
  hasAssessmentResults: boolean;
  hasStigMappings: boolean;
  hasRiskAssessments: boolean;
  totalControls: number;
  implementedControls: number;
  evidenceCount: number;
  lastAssessmentDate?: string;
  readinessPercentage: number;
  recommendations: string[];
}

// GET /api/systems/:systemId/readiness - Get system readiness for document generation
router.get('/:systemId/readiness', validateAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { systemId } = req.params;

    // Validate system exists
    const system = await db
      .select()
      .from(systems)
      .where(eq(systems.id, systemId))
      .limit(1);

    if (!system.length) {
      return res.status(404).json({
        success: false,
        error: 'System not found'
      });
    }

    // Get control assignments
    const controlStats = await db
      .select({
        total: count(),
        implemented: sql<number>`COUNT(CASE WHEN status = 'implemented' THEN 1 END)`.as('implemented'),
        documented: sql<number>`COUNT(CASE WHEN implementation_text IS NOT NULL AND length(implementation_text) > 10 THEN 1 END)`.as('documented')
      })
      .from(systemControls)
      .where(eq(systemControls.systemId, systemId));

    const controls = controlStats[0] || { total: 0, implemented: 0, documented: 0 };

    // Get evidence/artifacts count
    const evidenceStats = await db
      .select({
        count: count()
      })
      .from(artifacts)
      .where(eq(artifacts.systemId, systemId));

    const evidenceCount = evidenceStats[0]?.count || 0;

    // Get recent generation jobs to check assessment results
    const recentJobs = await db
      .select({
        count: count(),
        latestDate: sql<string>`MAX(created_at)`.as('latestDate')
      })
      .from(generationJobs)
      .where(
        and(
          eq(generationJobs.systemId, systemId),
          eq(generationJobs.status, 'completed')
        )
      );

    const hasAssessmentResults = (recentJobs[0]?.count || 0) > 0;
    const lastAssessmentDate = recentJobs[0]?.latestDate;

    // Calculate readiness criteria
    const readinessChecks = {
      hasSystemProfile: true, // Assume true if system exists
      hasControlAssignments: controls.total > 0,
      hasEvidenceUploaded: evidenceCount > 0,
      hasAssessmentResults,
      hasStigMappings: controls.total > 0, // Simplified - assume STIG mappings exist if controls assigned
      hasRiskAssessments: hasAssessmentResults, // Simplified - assume risk assessments done if assessments run
      implementationRate: controls.total > 0 ? (controls.implemented / controls.total) : 0,
      documentationRate: controls.total > 0 ? (controls.documented / controls.total) : 0
    };

    // Calculate overall readiness percentage
    const criteriaWeight = {
      hasSystemProfile: 10,
      hasControlAssignments: 25,
      hasEvidenceUploaded: 20,
      hasAssessmentResults: 15,
      hasStigMappings: 10,
      hasRiskAssessments: 10,
      implementationRate: 10 // Additional weight for implementation completeness
    };

    let totalScore = 0;
    let maxScore = 0;

    Object.entries(criteriaWeight).forEach(([criteria, weight]) => {
      maxScore += weight;
      if (criteria === 'implementationRate') {
        totalScore += readinessChecks.implementationRate * weight;
      } else {
        totalScore += (readinessChecks[criteria as keyof typeof readinessChecks] ? weight : 0);
      }
    });

    const readinessPercentage = Math.round((totalScore / maxScore) * 100);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (!readinessChecks.hasControlAssignments) {
      recommendations.push('Assign security controls to the system');
    }
    
    if (!readinessChecks.hasEvidenceUploaded) {
      recommendations.push('Upload system documentation and evidence files');
    }
    
    if (readinessChecks.implementationRate < 0.8) {
      recommendations.push('Complete control implementation details');
    }
    
    if (readinessChecks.documentationRate < 0.7) {
      recommendations.push('Add implementation descriptions for controls');
    }
    
    if (!readinessChecks.hasAssessmentResults) {
      recommendations.push('Run security assessments to generate findings');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is ready for document generation!');
    }

    const readiness: SystemReadiness = {
      systemId,
      hasSystemProfile: readinessChecks.hasSystemProfile,
      hasControlAssignments: readinessChecks.hasControlAssignments,
      hasEvidenceUploaded: readinessChecks.hasEvidenceUploaded,
      hasAssessmentResults: readinessChecks.hasAssessmentResults,
      hasStigMappings: readinessChecks.hasStigMappings,
      hasRiskAssessments: readinessChecks.hasRiskAssessments,
      totalControls: controls.total,
      implementedControls: controls.implemented,
      evidenceCount,
      lastAssessmentDate,
      readinessPercentage,
      recommendations
    };

    res.json({
      success: true,
      readiness
    });

  } catch (error) {
    console.error('Error fetching system readiness:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system readiness'
    });
  }
});

// GET /api/systems/:systemId/document-prerequisites/:documentType - Check specific document prerequisites
router.get('/:systemId/document-prerequisites/:documentType', validateAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { systemId, documentType } = req.params;

    // Define prerequisites for each document type
    const documentPrerequisites: Record<string, {
      required: string[];
      optional: string[];
      minimumReadiness: number;
    }> = {
      'ssp': {
        required: ['hasSystemProfile', 'hasControlAssignments'],
        optional: ['hasEvidenceUploaded'],
        minimumReadiness: 60
      },
      'sctm_excel': {
        required: ['hasControlAssignments'],
        optional: ['hasStigMappings'],
        minimumReadiness: 40
      },
      'poam_report': {
        required: ['hasAssessmentResults'],
        optional: ['hasControlAssignments'],
        minimumReadiness: 50
      },
      'stig_checklist': {
        required: ['hasControlAssignments', 'hasStigMappings'],
        optional: ['hasAssessmentResults'],
        minimumReadiness: 60
      },
      'rar': {
        required: ['hasRiskAssessments'],
        optional: ['hasAssessmentResults', 'hasControlAssignments'],
        minimumReadiness: 70
      },
      'control_narratives': {
        required: ['hasControlAssignments'],
        optional: ['hasEvidenceUploaded'],
        minimumReadiness: 50
      }
    };

    const prerequisites = documentPrerequisites[documentType];
    if (!prerequisites) {
      return res.status(400).json({
        success: false,
        error: 'Unknown document type'
      });
    }

    // Get system readiness (reuse logic from above endpoint)
    const readinessResponse = await fetch(`${req.protocol}://${req.get('host')}/api/systems/${systemId}/readiness`, {
      headers: { 'Authorization': req.headers.authorization || '' }
    });
    
    if (!readinessResponse.ok) {
      throw new Error('Failed to fetch system readiness');
    }

    const { readiness } = await readinessResponse.json();

    // Check prerequisites
    const requirementsMet = prerequisites.required.every(req => readiness[req]);
    const readinessMetMinimum = readiness.readinessPercentage >= prerequisites.minimumReadiness;
    const canGenerate = requirementsMet && readinessMetMinimum;

    // Get missing requirements
    const missingRequirements = prerequisites.required.filter(req => !readiness[req]);
    const optionalMissing = prerequisites.optional.filter(opt => !readiness[opt]);

    res.json({
      success: true,
      canGenerate,
      requirements: {
        met: requirementsMet,
        missing: missingRequirements,
        optionalMissing
      },
      readiness: {
        current: readiness.readinessPercentage,
        minimum: prerequisites.minimumReadiness,
        sufficient: readinessMetMinimum
      },
      recommendations: canGenerate ? 
        ['System is ready for document generation'] : 
        [
          ...missingRequirements.map(req => `Complete: ${req.replace('has', '').replace(/([A-Z])/g, ' $1').trim()}`),
          ...(readinessMetMinimum ? [] : [`Improve system readiness to at least ${prerequisites.minimumReadiness}%`])
        ]
    });

  } catch (error) {
    console.error('Error checking document prerequisites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check document prerequisites'
    });
  }
});

export default router;
