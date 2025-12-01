import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { sspGenerationService } from '../services/ssp-generation.service.js';
import { storage } from '../storage.js';

const router = Router();

// Generate System Security Plan
router.post('/ssp/generate', authenticate, async (req, res) => {
  try {
    const { 
      systemId, 
      format = 'docx',
      includeEvidence = true,
      includeAssessmentResults = true,
      includeDiagrams = true,
      templateOptions = {}
    } = req.body;

    // Verify system exists and user has access
    const system = await storage.getSystem(systemId);
    if (!system) {
      return res.status(404).json({ error: 'System not found' });
    }

    // TODO: Add authorization check for system access

    // Generate SSP
    const document = await sspGenerationService.generateSSP({
      systemId,
      format,
      includeEvidence,
      includeAssessmentResults,
      includeDiagrams,
      templateOptions
    });

    // Set appropriate headers for file download
    const contentType = format === 'pdf' ? 'application/pdf' : 
                       format === 'oscal' ? 'application/json' :
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.setHeader('Content-Length', document.content.length.toString());

    // Send the document
    res.send(document.content);
    
  } catch (error) {
    console.error('Failed to generate SSP:', error);
    res.status(500).json({ 
      error: 'Failed to generate SSP',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Preview SSP sections
router.post('/ssp/preview', authenticate, async (req, res) => {
  try {
    const { systemId, sections = ['executive_summary'] } = req.body;

    // Verify system exists
    const system = await storage.getSystem(systemId);
    if (!system) {
      return res.status(404).json({ error: 'System not found' });
    }

    // Generate a quick preview
    const systemControls = await storage.getSystemControls(systemId);
    const implementedCount = systemControls.filter(sc => sc.status === 'implemented').length;
    const totalCount = systemControls.length;

    let previewContent = `SYSTEM SECURITY PLAN PREVIEW
==============================

System: ${system.name}
Impact Level: ${system.impactLevel}
Category: ${system.category}

EXECUTIVE SUMMARY
-----------------
This System Security Plan (SSP) documents the security controls implemented 
for ${system.name}, a ${system.impactLevel} impact ${system.category} system.

Current Security Posture:
- Total Controls: ${totalCount}
- Implemented: ${implementedCount} (${Math.round((implementedCount / totalCount) * 100)}%)
- Partially Implemented: ${systemControls.filter(sc => sc.status === 'partial').length}
- Not Implemented: ${systemControls.filter(sc => sc.status === 'not_implemented').length}

COMPLIANCE SUMMARY
------------------
The system has implemented ${Math.round((implementedCount / totalCount) * 100)}% of required 
security controls. `;

    if (implementedCount < totalCount) {
      previewContent += `Additional work is needed to implement the remaining 
${totalCount - implementedCount} controls before achieving full compliance.`;
    } else {
      previewContent += `All required controls have been implemented. The system 
is ready for Authority to Operate (ATO) consideration.`;
    }

    res.json({
      success: true,
      content: previewContent,
      metadata: {
        systemName: system.name,
        totalControls: totalCount,
        implementedControls: implementedCount
      }
    });

  } catch (error) {
    console.error('Failed to generate SSP preview:', error);
    res.status(500).json({ 
      error: 'Failed to generate preview',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get document generation status
router.get('/status/:systemId', authenticate, async (req, res) => {
  try {
    const { systemId } = req.params;

    // Get system and check readiness
    const [system, systemControls, artifacts] = await Promise.all([
      storage.getSystem(systemId),
      storage.getSystemControls(systemId),
      storage.getArtifactsBySystem(systemId)
    ]);

    if (!system) {
      return res.status(404).json({ error: 'System not found' });
    }

    const totalControls = systemControls.length;
    const implementedControls = systemControls.filter(sc => 
      sc.status === 'implemented' && sc.implementationText
    ).length;
    const controlsWithNarratives = systemControls.filter(sc => 
      sc.implementationText
    ).length;

    res.json({
      systemId,
      systemName: system.name,
      readiness: {
        overall: totalControls > 0 ? Math.round((implementedControls / totalControls) * 100) : 0,
        controlsTotal: totalControls,
        controlsImplemented: implementedControls,
        controlsWithNarratives: controlsWithNarratives,
        hasArchitectureDiagram: artifacts.some(a => a.type === 'architecture_diagram'),
        hasAssessmentResults: false, // TODO: Check for completed assessments
        lastUpdated: new Date()
      },
      availableFormats: ['docx', 'pdf', 'oscal'],
      recommendations: getReadinessRecommendations(implementedControls, totalControls, artifacts)
    });

  } catch (error) {
    console.error('Failed to get document status:', error);
    res.status(500).json({ 
      error: 'Failed to get status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get document templates
router.get('/templates', authenticate, async (req, res) => {
  try {
    res.json({
      templates: [
        {
          id: 'ssp',
          name: 'System Security Plan',
          description: 'NIST SP 800-18 compliant SSP template',
          formats: ['docx', 'pdf', 'oscal'],
          required: true
        },
        {
          id: 'sar',
          name: 'Security Assessment Report',
          description: 'Document assessment findings and recommendations',
          formats: ['docx', 'pdf'],
          required: false
        },
        {
          id: 'poam',
          name: 'Plan of Action & Milestones',
          description: 'Track remediation of security findings',
          formats: ['docx', 'pdf'],
          required: false
        },
        {
          id: 'ra',
          name: 'Risk Assessment',
          description: 'Document system risks and mitigations',
          formats: ['docx', 'pdf'],
          required: false
        }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

// Helper function to provide recommendations
function getReadinessRecommendations(
  implemented: number, 
  total: number,
  artifacts: any[]
): string[] {
  const recommendations: string[] = [];
  const percentImplemented = total > 0 ? (implemented / total) * 100 : 0;

  if (percentImplemented < 100) {
    recommendations.push(`Complete implementation narratives for ${total - implemented} remaining controls`);
  }

  if (!artifacts.some(a => a.type === 'architecture_diagram')) {
    recommendations.push('Upload system architecture diagrams');
  }

  if (percentImplemented < 50) {
    recommendations.push('Focus on high-priority controls first');
  }

  if (recommendations.length === 0) {
    recommendations.push('System is ready for SSP generation');
  }

  return recommendations;
}

export default router;

