// Automated Control Assessment Service
// Uses LLMs to analyze evidence and determine control compliance status

import { storage } from '../storage';
import { modelRouter } from '../llm/model-router';
import { narrativeGenerationService } from './narrative-generation.service';
import type {
  Control,
  System,
  Evidence,
  Artifact,
  Finding,
  SystemControl,
  StigRule,
  InsertSystemControl,
  InsertAssessmentResult
} from '../schema';

export interface ControlAssessmentRequest {
  systemId: string;
  controlId: string;
  includeNarrative?: boolean;
  assessorNotes?: string;
  forceReassess?: boolean;
}

export interface SystemAssessmentRequest {
  systemId: string;
  controlIds?: string[]; // Optional: assess specific controls only
  includeNarratives?: boolean;
  assessmentMode?: 'automated' | 'manual' | 'hybrid';
  confidenceThreshold?: number; // Minimum confidence for automated approval
}

export interface AssessmentResult {
  controlId: string;
  systemId: string;
  status: 'compliant' | 'partially_compliant' | 'non_compliant' | 'not_applicable' | 'manual_review_required';
  confidence: number;
  implementationScore: number;
  evidenceAnalysis: {
    totalEvidence: number;
    satisfyingEvidence: number;
    partialEvidence: number;
    missingEvidence: string[];
  };
  findingsAnalysis: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    unresolvedFindings: number;
  };
  recommendation: string;
  requiresReview: boolean;
  assessmentDate: Date;
  narrative?: string;
  assessorNotes?: string;
}

export interface SystemAssessmentSummary {
  systemId: string;
  totalControls: number;
  assessedControls: number;
  compliantControls: number;
  partiallyCompliantControls: number;
  nonCompliantControls: number;
  notApplicableControls: number;
  requiresReviewControls: number;
  overallComplianceScore: number;
  assessmentDate: Date;
  controlResults: AssessmentResult[];
}

export class ControlAssessmentService {
  /**
   * Assess a single control for a system
   */
  async assessControl(request: ControlAssessmentRequest): Promise<AssessmentResult> {
    const { systemId, controlId, includeNarrative, assessorNotes, forceReassess } = request;
    
    // Check if we have a recent assessment and should skip
    if (!forceReassess) {
      const existingAssessment = await this.getRecentAssessment(systemId, controlId);
      if (existingAssessment) {
        return existingAssessment;
      }
    }
    
    // Gather all relevant data
    const [system, control, systemControl, evidence, artifacts, findings, stigRules] = await Promise.all([
      storage.getSystem(systemId),
      storage.getControl(controlId),
      storage.getSystemControl(systemId, controlId),
      storage.getEvidenceByControl(controlId),
      storage.getArtifactsBySystem(systemId),
      storage.getFindingsBySystem(systemId),
      this.getRelatedStigRules(controlId)
    ]);
    
    if (!system || !control) {
      throw new Error('System or control not found');
    }
    
    // Filter evidence for this system
    const systemEvidence = evidence.filter(e => e.systemId === systemId);
    
    // Analyze evidence using LLM
    const evidenceAnalysis = await this.analyzeEvidence(control, systemEvidence, artifacts);
    
    // Analyze findings impact
    const findingsAnalysis = await this.analyzeFindings(control, findings, stigRules);
    
    // Determine compliance status
    const assessmentData = await this.determineComplianceStatus(
      control,
      evidenceAnalysis,
      findingsAnalysis,
      systemControl
    );
    
    // Generate narrative if requested
    let narrative: string | undefined;
    if (includeNarrative) {
      const narrativeResult = await narrativeGenerationService.generateContextAwareNarrative({
        system,
        control,
        systemControl,
        evidence: systemEvidence,
        artifacts,
        findings
      });
      narrative = narrativeResult.narrative;
    }
    
    // Create assessment result
    const result: AssessmentResult = {
      controlId,
      systemId,
      status: assessmentData.status,
      confidence: assessmentData.confidence,
      implementationScore: assessmentData.implementationScore,
      evidenceAnalysis,
      findingsAnalysis,
      recommendation: assessmentData.recommendation,
      requiresReview: assessmentData.requiresReview,
      assessmentDate: new Date(),
      narrative,
      assessorNotes
    };
    
    // Update system control status
    await this.updateControlStatus(systemId, controlId, result);
    
    // Store assessment result
    await this.storeAssessmentResult(result);
    
    return result;
  }
  
  /**
   * Assess all controls for a system
   */
  async assessSystem(request: SystemAssessmentRequest): Promise<SystemAssessmentSummary> {
    const { 
      systemId, 
      controlIds, 
      includeNarratives, 
      assessmentMode = 'automated',
      confidenceThreshold = 0.8 
    } = request;
    
    // Get system and controls
    const system = await storage.getSystem(systemId);
    if (!system) {
      throw new Error('System not found');
    }
    
    // Get controls to assess
    let controlsToAssess: Control[];
    if (controlIds && controlIds.length > 0) {
      controlsToAssess = await Promise.all(
        controlIds.map(id => storage.getControl(id))
      ).then(controls => controls.filter(Boolean) as Control[]);
    } else {
      const systemControls = await storage.getSystemControls(systemId);
      controlsToAssess = systemControls.map(sc => sc.control);
    }
    
    // Assess each control
    const controlResults: AssessmentResult[] = [];
    
    for (const control of controlsToAssess) {
      try {
        const result = await this.assessControl({
          systemId,
          controlId: control.id,
          includeNarrative: includeNarratives,
          forceReassess: true
        });
        
        // Apply confidence threshold for automated approval
        if (assessmentMode === 'automated' && result.confidence < confidenceThreshold) {
          result.requiresReview = true;
          result.status = 'manual_review_required';
        }
        
        controlResults.push(result);
      } catch (error) {
        console.error(`Failed to assess control ${control.id}:`, error);
        // Create error result
        controlResults.push({
          controlId: control.id,
          systemId,
          status: 'manual_review_required',
          confidence: 0,
          implementationScore: 0,
          evidenceAnalysis: {
            totalEvidence: 0,
            satisfyingEvidence: 0,
            partialEvidence: 0,
            missingEvidence: ['Assessment failed - manual review required']
          },
          findingsAnalysis: {
            totalFindings: 0,
            criticalFindings: 0,
            highFindings: 0,
            unresolvedFindings: 0
          },
          recommendation: 'Manual assessment required due to automated assessment failure',
          requiresReview: true,
          assessmentDate: new Date()
        });
      }
    }
    
    // Calculate summary statistics
    const summary: SystemAssessmentSummary = {
      systemId,
      totalControls: controlsToAssess.length,
      assessedControls: controlResults.length,
      compliantControls: controlResults.filter(r => r.status === 'compliant').length,
      partiallyCompliantControls: controlResults.filter(r => r.status === 'partially_compliant').length,
      nonCompliantControls: controlResults.filter(r => r.status === 'non_compliant').length,
      notApplicableControls: controlResults.filter(r => r.status === 'not_applicable').length,
      requiresReviewControls: controlResults.filter(r => r.requiresReview).length,
      overallComplianceScore: this.calculateOverallScore(controlResults),
      assessmentDate: new Date(),
      controlResults
    };
    
    // Store system assessment summary
    await this.storeSystemAssessment(summary);
    
    return summary;
  }
  
  /**
   * Analyze evidence using LLM
   */
  private async analyzeEvidence(
    control: Control,
    evidence: Evidence[],
    artifacts: Artifact[]
  ): Promise<AssessmentResult['evidenceAnalysis']> {
    if (evidence.length === 0) {
      return {
        totalEvidence: 0,
        satisfyingEvidence: 0,
        partialEvidence: 0,
        missingEvidence: ['No evidence provided for this control']
      };
    }
    
    // Build prompt for evidence analysis
    const prompt = `Analyze the following evidence for NIST control ${control.id} - ${control.title}:

Control Description: ${control.description}

Evidence Items:
${evidence.map((e, i) => `
${i + 1}. Type: ${e.type}
   Description: ${e.description || 'No description'}
   Status: ${e.status}
   Implementation: ${e.implementation || 'Not specified'}
`).join('\n')}

Related Artifacts:
${artifacts.map((a, i) => `
${i + 1}. ${a.name} (${a.type})
   Description: ${a.description || 'No description'}
`).join('\n')}

Analyze the evidence and determine:
1. How many evidence items fully satisfy the control requirements
2. How many partially satisfy the requirements
3. What evidence is missing to fully satisfy the control

Respond in JSON format:
{
  "satisfyingEvidence": <number>,
  "partialEvidence": <number>,
  "missingEvidence": ["<missing evidence item 1>", "<missing evidence item 2>", ...]
}`;
    
    try {
      const response = await modelRouter.generateJSON([
        { role: 'user', content: prompt }
      ], {
        maxTokens: 1000,
        temperature: 0.2
      });
      
      const analysis = response as any;
      
      return {
        totalEvidence: evidence.length,
        satisfyingEvidence: analysis.satisfyingEvidence || 0,
        partialEvidence: analysis.partialEvidence || 0,
        missingEvidence: analysis.missingEvidence || []
      };
    } catch (error) {
      console.error('Failed to analyze evidence:', error);
      // Fallback to basic analysis
      const satisfying = evidence.filter(e => e.status === 'satisfies').length;
      const partial = evidence.filter(e => e.status === 'partially_satisfies').length;
      
      return {
        totalEvidence: evidence.length,
        satisfyingEvidence: satisfying,
        partialEvidence: partial,
        missingEvidence: satisfying > 0 ? [] : ['Additional evidence required']
      };
    }
  }
  
  /**
   * Analyze findings impact on control
   */
  private async analyzeFindings(
    control: Control,
    findings: Finding[],
    stigRules: StigRule[]
  ): Promise<AssessmentResult['findingsAnalysis']> {
    // Get STIG rule IDs for this control
    const stigRuleIds = stigRules.map(r => r.id);
    
    // Filter findings related to this control's STIG rules
    const relatedFindings = findings.filter(f => 
      stigRuleIds.includes(f.stigRuleId) && f.status === 'open'
    );
    
    return {
      totalFindings: relatedFindings.length,
      criticalFindings: relatedFindings.filter(f => f.severity === 'critical').length,
      highFindings: relatedFindings.filter(f => f.severity === 'high').length,
      unresolvedFindings: relatedFindings.filter(f => f.status === 'open').length
    };
  }
  
  /**
   * Determine compliance status based on evidence and findings
   */
  private async determineComplianceStatus(
    control: Control,
    evidenceAnalysis: AssessmentResult['evidenceAnalysis'],
    findingsAnalysis: AssessmentResult['findingsAnalysis'],
    systemControl?: SystemControl
  ): Promise<{
    status: AssessmentResult['status'];
    confidence: number;
    implementationScore: number;
    recommendation: string;
    requiresReview: boolean;
  }> {
    // Build prompt for status determination
    const prompt = `Determine the compliance status for NIST control ${control.id} based on the following analysis:

Evidence Analysis:
- Total Evidence: ${evidenceAnalysis.totalEvidence}
- Fully Satisfying: ${evidenceAnalysis.satisfyingEvidence}
- Partially Satisfying: ${evidenceAnalysis.partialEvidence}
- Missing Evidence: ${evidenceAnalysis.missingEvidence.length > 0 ? evidenceAnalysis.missingEvidence.join(', ') : 'None'}

Findings Analysis:
- Total Open Findings: ${findingsAnalysis.totalFindings}
- Critical Findings: ${findingsAnalysis.criticalFindings}
- High Findings: ${findingsAnalysis.highFindings}

Current Status: ${systemControl?.status || 'not assessed'}

Determine:
1. Compliance status (compliant, partially_compliant, non_compliant, not_applicable)
2. Confidence level (0-1) in the assessment
3. Implementation score (0-100)
4. Recommendation for next steps
5. Whether human review is required

Consider:
- Critical/high findings should significantly impact compliance
- Missing evidence reduces confidence
- Partial evidence indicates partial compliance

Respond in JSON format:
{
  "status": "<status>",
  "confidence": <0-1>,
  "implementationScore": <0-100>,
  "recommendation": "<recommendation>",
  "requiresReview": <boolean>
}`;
    
    try {
      const response = await modelRouter.generateJSON([
        { role: 'user', content: prompt }
      ], {
        maxTokens: 500,
        temperature: 0.1
      });
      
      const determination = response as any;
      
      return {
        status: determination.status || 'manual_review_required',
        confidence: determination.confidence || 0.5,
        implementationScore: determination.implementationScore || 0,
        recommendation: determination.recommendation || 'Manual review recommended',
        requiresReview: determination.requiresReview || false
      };
    } catch (error) {
      console.error('Failed to determine compliance status:', error);
      // Fallback logic
      let status: AssessmentResult['status'] = 'manual_review_required';
      let confidence = 0.5;
      let score = 50;
      
      if (findingsAnalysis.criticalFindings > 0 || findingsAnalysis.highFindings > 2) {
        status = 'non_compliant';
        score = 20;
      } else if (evidenceAnalysis.satisfyingEvidence > 0 && findingsAnalysis.totalFindings === 0) {
        status = 'compliant';
        confidence = 0.8;
        score = 90;
      } else if (evidenceAnalysis.partialEvidence > 0) {
        status = 'partially_compliant';
        score = 60;
      }
      
      return {
        status,
        confidence,
        implementationScore: score,
        recommendation: 'Automated assessment completed. Review for accuracy.',
        requiresReview: confidence < 0.7
      };
    }
  }
  
  /**
   * Get related STIG rules for a control
   */
  private async getRelatedStigRules(controlId: string): Promise<StigRule[]> {
    const ccis = await storage.getCcisByControl(controlId);
    const stigRuleIds = new Set<string>();
    
    for (const cci of ccis) {
      const mappings = await storage.getStigRuleCcisByCci(cci.cci);
      mappings.forEach(m => stigRuleIds.add(m.stigRuleId));
    }
    
    const stigRules = await Promise.all(
      Array.from(stigRuleIds).map(id => storage.getStigRule(id))
    );
    
    return stigRules.filter(Boolean) as StigRule[];
  }
  
  /**
   * Update control status based on assessment
   */
  private async updateControlStatus(
    systemId: string,
    controlId: string,
    result: AssessmentResult
  ): Promise<void> {
    const statusMap = {
      'compliant': 'implemented',
      'partially_compliant': 'partial',
      'non_compliant': 'not_implemented',
      'not_applicable': 'not_applicable',
      'manual_review_required': 'not_implemented'
    };
    
    await storage.updateSystemControl(systemId, controlId, {
      status: statusMap[result.status] as any,
      implementationText: result.narrative
    });
  }
  
  /**
   * Calculate overall compliance score
   */
  private calculateOverallScore(results: AssessmentResult[]): number {
    if (results.length === 0) return 0;
    
    const totalScore = results.reduce((sum, r) => sum + r.implementationScore, 0);
    return Math.round(totalScore / results.length);
  }
  
  /**
   * Check for recent assessment
   */
  private async getRecentAssessment(
    systemId: string,
    controlId: string
  ): Promise<AssessmentResult | null> {
    // Check if we have an assessment from the last 24 hours
    // This would require a database table for assessment results
    // For now, return null to always reassess
    return null;
  }
  
  /**
   * Store assessment result
   */
  private async storeAssessmentResult(result: AssessmentResult): Promise<void> {
    // Store in database - would need an assessment_results table
    // For now, just log
    console.log(`Assessment completed for control ${result.controlId}:`, {
      status: result.status,
      confidence: result.confidence,
      score: result.implementationScore
    });
  }
  
  /**
   * Store system assessment summary
   */
  private async storeSystemAssessment(summary: SystemAssessmentSummary): Promise<void> {
    // Store in database - would need a system_assessments table
    console.log(`System assessment completed for ${summary.systemId}:`, {
      compliance: summary.overallComplianceScore,
      compliant: summary.compliantControls,
      total: summary.totalControls
    });
  }
  
  /**
   * Submit human review for an assessment
   */
  async submitReview(
    systemId: string,
    controlId: string,
    review: {
      status: AssessmentResult['status'];
      reviewerNotes: string;
      approvedBy: string;
    }
  ): Promise<AssessmentResult> {
    // Get the existing assessment
    const existingResult = await this.getRecentAssessment(systemId, controlId);
    
    if (!existingResult) {
      throw new Error('No assessment found to review');
    }
    
    // Update with review
    existingResult.status = review.status;
    existingResult.assessorNotes = `${existingResult.assessorNotes || ''}\n\nReviewer Notes: ${review.reviewerNotes}\nApproved by: ${review.approvedBy}`;
    existingResult.requiresReview = false;
    existingResult.confidence = 1.0; // Human reviewed = 100% confidence
    
    // Update control status
    await this.updateControlStatus(systemId, controlId, existingResult);
    
    // Store updated result
    await this.storeAssessmentResult(existingResult);
    
    return existingResult;
  }
}

// Export singleton instance
export const controlAssessmentService = new ControlAssessmentService();
