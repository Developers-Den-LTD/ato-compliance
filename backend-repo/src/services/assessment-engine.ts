// Assessment Engine Service
// Orchestrates compliance assessment workflows for STIG rules and NIST controls

import { storage } from '../storage';
import { stigEvaluationService } from './stig-evaluation.service';
import type {
  System, Control, StigRule, Finding, Evidence, Checklist, PoamItem,
  InsertEvidence, InsertPoamItem, InsertChecklist, InsertAssessment,
  ComplianceStatusType, SeverityType, FindingStatusType, EvidenceStatusType
} from '../schema';
import type { Assessment } from '../schema';

// Assessment result types
export interface SystemAssessmentSnapshot {
  assessmentId: string | null;
  systemId: string;
  status: 'not_started' | 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: Date | null;
  endTime?: Date | null;
  currentStep?: string | null;
  summary: AssessmentSummaryStats;
  findings: AssessmentFindingsStats;
  stigCompliance: AssessmentStigStats;
  controlAssessments?: ControlAssessmentResult[];
  poamItems?: PoamItem[];
  errors: string[];
}

export interface AssessmentSummaryStats {
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  partiallyImplementedControls: number;
  notAssessedControls: number;
  overallCompliancePercentage: number;
  riskScore: number;
}

export interface AssessmentFindingsStats {
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  resolvedFindings: number;
}

export interface AssessmentStigStats {
  totalRules: number;
  compliantRules: number;
  nonCompliantRules: number;
  notApplicableRules: number;
  notReviewedRules: number;
  stigCompliancePercentage: number;
}

export function defaultSummary(): AssessmentSummaryStats {
  return {
    totalControls: 0,
    compliantControls: 0,
    nonCompliantControls: 0,
    partiallyImplementedControls: 0,
    notAssessedControls: 0,
    overallCompliancePercentage: 0,
    riskScore: 100,
  };
}

export function defaultFindings(): AssessmentFindingsStats {
  return {
    totalFindings: 0,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: 0,
    resolvedFindings: 0,
  };
}

export function defaultStigStats(): AssessmentStigStats {
  return {
    totalRules: 0,
    compliantRules: 0,
    nonCompliantRules: 0,
    notApplicableRules: 0,
    notReviewedRules: 0,
    stigCompliancePercentage: 0,
  };
}

export interface SystemAssessmentResult {
  systemId: string;
  assessmentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: Date;
  endTime?: Date;
  summary: AssessmentSummaryStats;
  findings: AssessmentFindingsStats;
  stigCompliance: AssessmentStigStats;
  controlAssessments: ControlAssessmentResult[];
  poamItems: PoamItem[];
  errors: string[];
}

export interface ControlAssessmentResult {
  controlId: string;
  title: string;
  family: string;
  status: ComplianceStatusType;
  implementationStatus: 'implemented' | 'partially_implemented' | 'planned' | 'alternative_implementation' | 'not_applicable' | 'not_implemented';
  assessmentNarrative: string;
  evidence: Evidence[];
  relatedFindings: Finding[];
  stigRulesMapped: number;
  stigRulesCompliant: number;
  compliancePercentage: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastAssessed: Date;
}

export interface StigAssessmentResult {
  stigRuleId: string;
  title: string;
  status: 'pass' | 'fail' | 'not_applicable' | 'not_reviewed' | 'informational';
  severity: SeverityType;
  findings: Finding[];
  evidence: string;
  assessorComments: string;
  lastAssessed: Date;
}

export interface AssessmentOptions {
  assessmentMode: 'automated' | 'manual' | 'hybrid';
  includeInformationalFindings: boolean;
  generatePoamItems: boolean;
  generateEvidence: boolean;
  updateControlStatus: boolean;
  riskTolerance: 'low' | 'medium' | 'high';
  userId?: string;
  // Enhanced configuration options from ATOC-001
  assessmentType?: 'full' | 'partial' | 'continuous';
  scope?: {
    includeInherited: boolean;
    controlFamilies?: string[];
    specificControls?: string[];
  };
  schedule?: {
    frequency: 'once' | 'daily' | 'weekly' | 'monthly';
    startDate: Date;
  };
  notificationSettings?: {
    emailOnComplete: boolean;
    emailOnFailure: boolean;
    recipients: string[];
  };
}

export class AssessmentEngine {
  private activeAssessments: Map<string, SystemAssessmentResult> = new Map();

  getActiveAssessments(): SystemAssessmentResult[] {
    return Array.from(this.activeAssessments.values());
  }

  getAssessmentSnapshot(systemId: string): SystemAssessmentSnapshot {
    const active = Array.from(this.activeAssessments.values()).find((a) => a.systemId === systemId);
    if (!active) {
      return {
        assessmentId: null,
        systemId,
        status: 'not_started',
        progress: 0,
        startTime: null,
        endTime: null,
        currentStep: 'Assessment not started',
        summary: defaultSummary(),
        findings: defaultFindings(),
        stigCompliance: defaultStigStats(),
        controlAssessments: [],
        poamItems: [],
        errors: [],
      };
    }

    return {
      assessmentId: active.assessmentId,
      systemId: active.systemId,
      status: active.status,
      progress: active.progress,
      startTime: active.startTime,
      endTime: active.endTime ?? null,
      currentStep: active.status === 'running' ? 'Assessment in progress' : 'Assessment completed',
      summary: active.summary,
      findings: active.findings,
      stigCompliance: active.stigCompliance,
      controlAssessments: active.controlAssessments,
      poamItems: active.poamItems,
      errors: active.errors,
    };
  }

  /**
   * Trigger comprehensive system assessment
   */
  async assessSystem(systemId: string, options: AssessmentOptions = {
    assessmentMode: 'automated',
    includeInformationalFindings: false,
    generatePoamItems: true,
    generateEvidence: true,
    updateControlStatus: true,
    riskTolerance: 'medium'
  }): Promise<SystemAssessmentResult> {
    const assessmentId = `assessment_${systemId}_${Date.now()}`;
    
    // Initialize assessment result
    const assessment: SystemAssessmentResult = {
      systemId,
      assessmentId,
      status: 'running',
      progress: 0,
      startTime: new Date(),
      summary: {
        totalControls: 0,
        compliantControls: 0,
        nonCompliantControls: 0,
        partiallyImplementedControls: 0,
        notAssessedControls: 0,
        overallCompliancePercentage: 0,
        riskScore: 0
      },
      findings: {
        totalFindings: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0,
        resolvedFindings: 0
      },
      stigCompliance: {
        totalRules: 0,
        compliantRules: 0,
        nonCompliantRules: 0,
        notApplicableRules: 0,
        notReviewedRules: 0,
        stigCompliancePercentage: 0
      },
      controlAssessments: [],
      poamItems: [],
      errors: []
    };

    this.activeAssessments.set(assessmentId, assessment);

    let assessmentRecord: any;
    let generationJob: any;
    
    try {
      // Create generation job for unified job tracking
      generationJob = await storage.createGenerationJob({
        systemId,
        type: 'assessment',
        status: 'processing',
        progress: 0,
        metadata: {
          assessmentId,
          assessmentMode: options.assessmentMode,
          includeInformationalFindings: options.includeInformationalFindings,
          generatePoamItems: options.generatePoamItems,
          generateEvidence: options.generateEvidence,
          updateControlStatus: options.updateControlStatus,
          riskTolerance: options.riskTolerance,
          startTime: assessment.startTime.toISOString(),
          userId: options.userId
        }
      });

      // Create assessment record in database
      assessmentRecord = await storage.createAssessment({
        systemId,
        assessmentId,
        status: 'in_progress',
        progress: 0,
        startTime: assessment.startTime,
        summary: assessment.summary,
        findings: assessment.findings,
        stigCompliance: assessment.stigCompliance,
        assessmentOptions: options,
        controlAssessments: [],
        errors: [],
        assessedBy: options.userId || undefined
      });
      // Step 1: Validate system exists
      const system = await storage.getSystem(systemId);
      if (!system) {
        throw new Error(`System with ID ${systemId} not found`);
      }

      assessment.progress = 10;
      
      // Update progress in both assessment and generation job
      await Promise.all([
        storage.updateAssessment(assessmentRecord.id, { progress: 10 }),
        storage.updateGenerationJob(generationJob.id, { 
          progress: 10,
          metadata: {
            ...(generationJob.metadata as object),
            currentStep: 'Gathering baseline data',
            lastUpdated: new Date().toISOString()
          }
        })
      ]);

      // Step 2: Gather baseline data
      const [findings, allControls, stigRules] = await Promise.all([
        storage.getFindingsBySystem(systemId),
        storage.getControls(),
        storage.getStigRules()
      ]);

      // Filter controls based on assessment scope
      let controls = allControls;
      if (options.assessmentType === 'partial' && options.scope?.controlFamilies) {
        controls = allControls.filter(control => 
          options.scope!.controlFamilies!.includes(control.family)
        );
      } else if (options.scope?.specificControls) {
        controls = allControls.filter(control => 
          options.scope!.specificControls!.includes(control.id)
        );
      }

      assessment.progress = 20;

      // Step 3: Calculate findings summary
      assessment.findings = this.calculateFindingsSummary(findings);
      assessment.progress = 30;
      await Promise.all([
        storage.updateAssessment(assessmentRecord.id, { progress: 30, findings: assessment.findings }),
        storage.updateGenerationJob(generationJob.id, { 
          progress: 30,
          metadata: {
            ...(generationJob.metadata as object),
            currentStep: 'Analyzing findings',
            lastUpdated: new Date().toISOString()
          }
        })
      ]);

      // Step 4: Assess STIG rule compliance
      const stigAssessments = await this.assessStigRules(systemId, stigRules, findings, options);
      assessment.stigCompliance = this.calculateStigCompliance(stigAssessments);
      assessment.progress = 50;
      await Promise.all([
        storage.updateAssessment(assessmentRecord.id, { progress: 50, stigCompliance: assessment.stigCompliance }),
        storage.updateGenerationJob(generationJob.id, { 
          progress: 50,
          metadata: {
            ...(generationJob.metadata as object),
            currentStep: 'Assessing STIG compliance',
            lastUpdated: new Date().toISOString()
          }
        })
      ]);

      // Step 5: Assess NIST control implementation
      const controlAssessments = await this.assessControlImplementation(systemId, controls, stigAssessments, findings, options);
      assessment.controlAssessments = controlAssessments;
      assessment.progress = 70;
      await Promise.all([
        storage.updateAssessment(assessmentRecord.id, { progress: 70, controlAssessments: controlAssessments }),
        storage.updateGenerationJob(generationJob.id, { 
          progress: 70,
          metadata: {
            ...(generationJob.metadata as object),
            currentStep: 'Evaluating control implementation',
            lastUpdated: new Date().toISOString()
          }
        })
      ]);

      // Step 6: Calculate overall compliance metrics
      assessment.summary = this.calculateComplianceSummary(controlAssessments, assessment.findings);
      assessment.progress = 80;
      await Promise.all([
        storage.updateAssessment(assessmentRecord.id, { progress: 80, summary: assessment.summary }),
        storage.updateGenerationJob(generationJob.id, { 
          progress: 80,
          metadata: {
            ...(generationJob.metadata as object),
            currentStep: 'Calculating compliance metrics',
            lastUpdated: new Date().toISOString()
          }
        })
      ]);

      // Step 7: Generate POA&M items for non-compliant findings
      if (options.generatePoamItems) {
        assessment.poamItems = await this.generatePoamItems(systemId, findings, controlAssessments, options);
      }
      assessment.progress = 90;

      // Step 8: Update system compliance status
      await this.updateSystemComplianceStatus(systemId, assessment);
      
      assessment.status = 'completed';
      assessment.progress = 100;
      assessment.endTime = new Date();
      
      // Persist final completed assessment results to database
      await Promise.all([
        storage.updateAssessment(assessmentRecord.id, {
          status: 'completed',
          progress: 100,
          endTime: assessment.endTime,
          summary: assessment.summary,
          findings: assessment.findings,
          stigCompliance: assessment.stigCompliance,
          controlAssessments: assessment.controlAssessments,
          errors: assessment.errors
        }),
        storage.updateGenerationJob(generationJob.id, {
          status: 'completed',
          progress: 100,
          endTime: assessment.endTime,
          metadata: {
            ...(generationJob.metadata as object),
            currentStep: 'Assessment completed',
            endTime: assessment.endTime?.toISOString(),
            lastUpdated: new Date().toISOString(),
            summary: assessment.summary,
            totalControls: assessment.summary.totalControls,
            compliancePercentage: assessment.summary.overallCompliancePercentage
          }
        })
      ]);

    } catch (error) {
      assessment.status = 'failed';
      assessment.progress = 0;
      assessment.endTime = new Date();
      assessment.errors.push(`Assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.activeAssessments.set(assessmentId, assessment);

      await storage.updateGenerationJob(generationJob?.id, {
        status: 'failed',
        progress: 0,
        endTime: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (assessmentRecord?.id) {
        await storage.updateAssessment(assessmentRecord.id, {
          status: 'failed',
          progress: 0,
          endTime: assessment.endTime,
          errors: assessment.errors,
        });
      }
    }

    this.activeAssessments.set(assessmentId, assessment);
    return assessment;
  }

  /**
   * Assess STIG rule compliance based on findings and STIG evaluation results
   */
  private async assessStigRules(
    systemId: string, 
    stigRules: StigRule[], 
    findings: Finding[], 
    options: AssessmentOptions
  ): Promise<Map<string, StigAssessmentResult>> {
    const assessments = new Map<string, StigAssessmentResult>();
    
    // First, check for STIG evaluation results from document processing
    const stigEvaluationEvidence = await storage.getEvidenceBySystem(systemId);
    const stigEvaluationResults = stigEvaluationEvidence
      .filter(e => e.type === 'stig_evaluation' && (e.metadata as any)?.stigEvaluation)
      .map(e => (e.metadata as any).stigEvaluation);

    for (const rule of stigRules) {
      // First check if we have STIG evaluation results from document processing
      let stigEvalResult = null;
      for (const evalData of stigEvaluationResults) {
        if (evalData.failedRules) {
          const failedRule = evalData.failedRules.find((r: any) => r.ruleId === rule.id);
          if (failedRule) {
            stigEvalResult = { status: 'fail', finding: failedRule.finding, severity: failedRule.severity };
            break;
          }
        }
        // If not in failed rules and evaluation was done, assume it passed
        if (evalData.profile && evalData.rulesEvaluated > 0 && !stigEvalResult) {
          stigEvalResult = { status: 'pass' };
        }
      }
      
      // Find all findings related to this STIG rule
      const relatedFindings = findings.filter(f => f.stigRuleId === rule.id);
      
      // Determine compliance status based on STIG evaluation and findings
      let status: StigAssessmentResult['status'] = 'not_reviewed';
      let evidence = '';
      let assessorComments = '';

      if (stigEvalResult) {
        // Use STIG evaluation result if available
        status = stigEvalResult.status as StigAssessmentResult['status'];
        evidence = stigEvalResult.status === 'fail' 
          ? `STIG evaluation failed: ${stigEvalResult.finding || 'Non-compliant'}` 
          : 'STIG evaluation passed';
        assessorComments = `Automated STIG evaluation from SCAP scan`;
      } else if (relatedFindings.length === 0) {
        // No findings for this rule - could be compliant or not assessed
        status = options.assessmentMode === 'automated' ? 'pass' : 'not_reviewed';
        evidence = 'No security findings identified for this STIG rule';
        assessorComments = 'Automated assessment: No vulnerabilities detected';
      } else {
        // Analyze findings to determine compliance
        const openFindings = relatedFindings.filter(f => f.status === 'open');
        const resolvedFindings = relatedFindings.filter(f => f.status === 'fixed' || f.status === 'accepted');
        
        if (openFindings.length === 0) {
          status = 'pass';
          evidence = `All ${relatedFindings.length} findings have been resolved or accepted`;
          assessorComments = `${resolvedFindings.length} findings resolved, rule now compliant`;
        } else {
          status = 'fail';
          evidence = `${openFindings.length} open findings require remediation`;
          assessorComments = this.generateAssessorComments(openFindings, rule);
        }
      }

      assessments.set(rule.id, {
        stigRuleId: rule.id,
        title: rule.title,
        status,
        severity: rule.severity as SeverityType,
        findings: relatedFindings,
        evidence,
        assessorComments,
        lastAssessed: new Date()
      });
    }

    return assessments;
  }

  /**
   * Assess NIST control implementation based on STIG compliance and findings
   */
  private async assessControlImplementation(
    systemId: string,
    controls: Control[],
    stigAssessments: Map<string, StigAssessmentResult>,
    findings: Finding[],
    options: AssessmentOptions
  ): Promise<ControlAssessmentResult[]> {
    const controlAssessments: ControlAssessmentResult[] = [];

    for (const control of controls) {
      try {
        // Get CCIs mapped to this control
        const ccis = await storage.getCcisByControl(control.id);
        
        // Get STIG rules mapped to these CCIs
        const stigRuleIds = new Set<string>();
        for (const cci of ccis) {
          const mappings = await storage.getStigRuleCcisByCci(cci);
          mappings.forEach(mapping => stigRuleIds.add(mapping.stigRuleId));
        }

        // Assess control based on mapped STIG rules
        const mappedStigAssessments = Array.from(stigRuleIds)
          .map(id => stigAssessments.get(id))
          .filter(Boolean) as StigAssessmentResult[];

        const controlAssessment = await this.calculateControlCompliance(
          control,
          mappedStigAssessments,
          findings,
          systemId,
          options
        );

        controlAssessments.push(controlAssessment);
      } catch (error) {
        console.error(`Error assessing control ${control.id}:`, error);
        // Add error placeholder assessment
        controlAssessments.push({
          controlId: control.id,
          title: control.title,
          family: control.family,
          status: 'not-assessed',
          implementationStatus: 'not_implemented',
          assessmentNarrative: `Assessment error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          evidence: [],
          relatedFindings: [],
          stigRulesMapped: 0,
          stigRulesCompliant: 0,
          compliancePercentage: 0,
          riskLevel: 'high',
          lastAssessed: new Date()
        });
      }
    }

    return controlAssessments;
  }

  /**
   * Calculate control compliance based on STIG assessments
   */
  private async calculateControlCompliance(
    control: Control,
    stigAssessments: StigAssessmentResult[],
    allFindings: Finding[],
    systemId: string,
    options: AssessmentOptions
  ): Promise<ControlAssessmentResult> {
    // Get existing evidence for this control
    const existingEvidence = await storage.getEvidenceByControl(control.id);
    const systemEvidence = existingEvidence.filter(e => e.systemId === systemId);
    
    // Calculate compliance based on STIG assessments
    const totalStigRules = stigAssessments.length;
    const compliantStigRules = stigAssessments.filter(a => a.status === 'pass' || a.status === 'not_applicable').length;
    const failedStigRules = stigAssessments.filter(a => a.status === 'fail').length;
    
    const compliancePercentage = totalStigRules > 0 ? (compliantStigRules / totalStigRules) * 100 : 0;
    
    // Determine overall control status
    let status: ComplianceStatusType;
    let implementationStatus: ControlAssessmentResult['implementationStatus'];
    let riskLevel: ControlAssessmentResult['riskLevel'];
    
    if (totalStigRules === 0) {
      // No STIG rules mapped - cannot assess compliance
      status = 'not-assessed';
      implementationStatus = 'not_implemented';
      riskLevel = 'medium';
    } else if (compliancePercentage >= 95) {
      status = 'compliant';
      implementationStatus = 'implemented';
      riskLevel = 'low';
    } else if (compliancePercentage >= 80) {
      status = 'in-progress';
      implementationStatus = 'partially_implemented';
      riskLevel = 'medium';
    } else if (compliancePercentage >= 50) {
      status = 'in-progress';
      implementationStatus = 'partially_implemented';
      riskLevel = 'high';
    } else {
      status = 'non-compliant';
      implementationStatus = 'not_implemented';
      riskLevel = 'critical';
    }

    // Get related findings from STIG assessments
    const relatedFindings = stigAssessments.flatMap(a => a.findings);
    
    // Generate assessment narrative
    const assessmentNarrative = this.generateControlAssessmentNarrative(
      control,
      stigAssessments,
      compliancePercentage,
      relatedFindings
    );

    // Update control status if enabled
    if (options.updateControlStatus) {
      // Note: Control status update would require schema modification to include status field
      // For now, we track status in evidence records
      console.log(`Control ${control.id} status would be updated to: ${status}`);
    }

    // Generate evidence record if enabled
    if (options.generateEvidence && relatedFindings.length > 0) {
      await this.generateControlEvidence(systemId, control.id, stigAssessments, status);
    }

    return {
      controlId: control.id,
      title: control.title,
      family: control.family,
      status,
      implementationStatus,
      assessmentNarrative,
      evidence: systemEvidence,
      relatedFindings,
      stigRulesMapped: totalStigRules,
      stigRulesCompliant: compliantStigRules,
      compliancePercentage: Math.round(compliancePercentage * 100) / 100,
      riskLevel,
      lastAssessed: new Date()
    };
  }

  /**
   * Generate control evidence record based on assessment
   */
  private async generateControlEvidence(
    systemId: string,
    controlId: string,
    stigAssessments: StigAssessmentResult[],
    status: ComplianceStatusType
  ): Promise<void> {
    const evidenceStatus: EvidenceStatusType = 
      status === 'compliant' ? 'satisfies' :
      status === 'in-progress' ? 'partially_satisfies' :
      'does_not_satisfy';

    const evidence: InsertEvidence = {
      systemId,
      controlId,
      type: 'scan_result',
      description: 'Automated assessment based on security scan results and STIG compliance',
      implementation: this.generateImplementationDescription(stigAssessments),
      assessorNotes: `Assessment completed on ${new Date().toISOString()}. Based on ${stigAssessments.length} STIG rule assessments.`,
      status: evidenceStatus
    };

    await storage.createEvidence(evidence);
  }

  /**
   * Generate POA&M items for non-compliant findings
   */
  private async generatePoamItems(
    systemId: string,
    findings: Finding[],
    controlAssessments: ControlAssessmentResult[],
    options: AssessmentOptions
  ): Promise<PoamItem[]> {
    const poamItems: PoamItem[] = [];
    
    // Generate POA&M for critical and high severity findings
    const criticalFindings = findings.filter(f => 
      f.status === 'open' && 
      (f.severity === 'critical' || f.severity === 'high')
    );

    for (const finding of criticalFindings) {
      // Find related control assessment
      const relatedControl = controlAssessments.find(ca => 
        ca.relatedFindings.some(rf => rf.id === finding.id)
      );

      const poamItem: InsertPoamItem = {
        systemId,
        controlId: relatedControl?.controlId,
        findingId: finding.id,
        weakness: `Security finding: ${finding.title}`,
        riskStatement: this.generateRiskStatement(finding, relatedControl),
        remediation: finding.remediation || 'Remediation steps to be determined',
        status: 'open',
        priority: this.mapSeverityToPriority(finding.severity as SeverityType),
        plannedCompletionDate: this.calculatePlannedCompletionDate(finding.severity as SeverityType),
        resources: 'System administrator, security team',
        assignedTo: 'System Owner'
      };

      // createPoamItem doesn't exist yet, stub it
      // const createdItem = await storage.createPoamItem(poamItem);
      // poamItems.push(createdItem);
    }

    return poamItems;
  }

  /**
   * Calculate findings summary statistics
   */
  private calculateFindingsSummary(findings: Finding[]): SystemAssessmentResult['findings'] {
    return {
      totalFindings: findings.length,
      criticalFindings: findings.filter(f => f.severity === 'critical').length,
      highFindings: findings.filter(f => f.severity === 'high').length,
      mediumFindings: findings.filter(f => f.severity === 'medium').length,
      lowFindings: findings.filter(f => f.severity === 'low' || f.severity === 'informational').length,
      resolvedFindings: findings.filter(f => f.status === 'fixed' || f.status === 'accepted').length
    };
  }

  /**
   * Calculate STIG compliance statistics
   */
  private calculateStigCompliance(stigAssessments: Map<string, StigAssessmentResult>): SystemAssessmentResult['stigCompliance'] {
    const assessments = Array.from(stigAssessments.values());
    const total = assessments.length;
    const compliant = assessments.filter(a => a.status === 'pass').length;
    const nonCompliant = assessments.filter(a => a.status === 'fail').length;
    const notApplicable = assessments.filter(a => a.status === 'not_applicable').length;
    const notReviewed = assessments.filter(a => a.status === 'not_reviewed').length;

    return {
      totalRules: total,
      compliantRules: compliant,
      nonCompliantRules: nonCompliant,
      notApplicableRules: notApplicable,
      notReviewedRules: notReviewed,
      stigCompliancePercentage: total > 0 ? Math.round(((compliant + notApplicable) / total) * 100) : 0
    };
  }

  /**
   * Calculate overall compliance summary
   */
  private calculateComplianceSummary(
    controlAssessments: ControlAssessmentResult[],
    findings: SystemAssessmentResult['findings']
  ): SystemAssessmentResult['summary'] {
    const total = controlAssessments.length;
    const compliant = controlAssessments.filter(ca => ca.status === 'compliant').length;
    const nonCompliant = controlAssessments.filter(ca => ca.status === 'non-compliant').length;
    const inProgress = controlAssessments.filter(ca => ca.status === 'in-progress').length;
    const notAssessed = controlAssessments.filter(ca => ca.status === 'not-assessed').length;

    // Calculate risk score based on findings and compliance
    const riskScore = this.calculateRiskScore(controlAssessments, findings);

    return {
      totalControls: total,
      compliantControls: compliant,
      nonCompliantControls: nonCompliant,
      partiallyImplementedControls: inProgress,
      notAssessedControls: notAssessed,
      overallCompliancePercentage: total > 0 ? Math.round((compliant / total) * 100) : 0,
      riskScore
    };
  }

  /**
   * Calculate system risk score
   */
  private calculateRiskScore(
    controlAssessments: ControlAssessmentResult[],
    findings: SystemAssessmentResult['findings']
  ): number {
    let riskScore = 0;
    
    // Risk from critical findings
    riskScore += findings.criticalFindings * 10;
    
    // Risk from high findings
    riskScore += findings.highFindings * 5;
    
    // Risk from medium findings
    riskScore += findings.mediumFindings * 2;
    
    // Risk from non-compliant controls
    const criticalControls = controlAssessments.filter(ca => ca.riskLevel === 'critical').length;
    const highRiskControls = controlAssessments.filter(ca => ca.riskLevel === 'high').length;
    
    riskScore += criticalControls * 15;
    riskScore += highRiskControls * 8;
    
    // Normalize to 0-100 scale
    return Math.min(100, Math.max(0, riskScore));
  }

  /**
   * Update system compliance status based on assessment
   */
  private async updateSystemComplianceStatus(systemId: string, assessment: SystemAssessmentResult): Promise<void> {
    let complianceStatus: ComplianceStatusType;
    
    if (assessment.summary.overallCompliancePercentage >= 95) {
      complianceStatus = 'compliant';
    } else if (assessment.summary.overallCompliancePercentage >= 50) {
      complianceStatus = 'in-progress';
    } else {
      complianceStatus = 'non-compliant';
    }

    await storage.updateSystem(systemId, { complianceStatus });
  }

  // Helper methods for generating narratives and descriptions
  private generateAssessorComments(findings: Finding[], rule: StigRule): string {
    const severityCounts = findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const comments = [`STIG Rule ${rule.id} has ${findings.length} open findings:`];
    Object.entries(severityCounts).forEach(([severity, count]) => {
      comments.push(`- ${count} ${severity} severity findings`);
    });
    
    return comments.join(' ');
  }

  private generateControlAssessmentNarrative(
    control: Control,
    stigAssessments: StigAssessmentResult[],
    compliancePercentage: number,
    findings: Finding[]
  ): string {
    const narrative = [
      `Control ${control.id} - ${control.title}`
    ];

    if (stigAssessments.length === 0) {
      narrative.push('No STIG rules are mapped to this control. Control assessment cannot be completed without applicable STIG mappings.');
    } else {
      narrative.push(`Assessment based on ${stigAssessments.length} mapped STIG rules with ${compliancePercentage.toFixed(1)}% compliance.`);
      
      if (findings.length === 0) {
        narrative.push('No security findings identified. Control appears to be effectively implemented.');
      } else {
        const openFindings = findings.filter(f => f.status === 'open').length;
        if (openFindings === 0) {
          narrative.push('All identified findings have been resolved or accepted.');
        } else {
          narrative.push(`${openFindings} open findings require attention to achieve full compliance.`);
        }
      }
    }

    return narrative.join(' ');
  }

  private generateImplementationDescription(stigAssessments: StigAssessmentResult[]): string {
    const passed = stigAssessments.filter(a => a.status === 'pass').length;
    const total = stigAssessments.length;
    
    return `Control implementation assessed through ${total} STIG rules. ` +
           `${passed} rules are compliant (${Math.round((passed/total)*100)}% compliance rate). ` +
           `Implementation status determined through automated security scan analysis.`;
  }

  private generateRiskStatement(finding: Finding, control?: ControlAssessmentResult): string {
    const controlInfo = control ? ` affecting control ${control.controlId} (${control.title})` : '';
    return `${finding.severity.toUpperCase()} severity vulnerability: ${finding.title}${controlInfo}. ` +
           `This finding may compromise system security and regulatory compliance if not addressed.`;
  }

  private mapSeverityToPriority(severity: SeverityType): 'critical' | 'high' | 'medium' | 'low' {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      default: return 'low';
    }
  }

  private calculatePlannedCompletionDate(severity: SeverityType): Date {
    const now = new Date();
    const days = severity === 'critical' ? 30 : severity === 'high' ? 60 : 90;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * Get assessment status
   */
  getAssessmentStatus(assessmentId: string): SystemAssessmentResult | undefined {
    return this.activeAssessments.get(assessmentId);
  }

  /**
   * Clear completed assessments older than specified hours
   */
  cleanupAssessments(olderThanHours: number = 24): void {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const entries = Array.from(this.activeAssessments.entries());
    for (const [id, assessment] of entries) {
      if (assessment.endTime && assessment.endTime < cutoff) {
        this.activeAssessments.delete(id);
      }
    }
  }
}

// Export singleton instance
export const assessmentEngine = new AssessmentEngine();
