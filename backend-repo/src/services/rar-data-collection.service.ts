// RAR Data Collection Service
// Collects and structures data for Risk Assessment Report generation

import { storage } from '../storage';
import type { 
  System, 
  Control, 
  SystemControl, 
  StigRule, 
  Finding, 
  Evidence, 
  Assessment 
} from '../schema';

export interface RARData {
  systemInfo: {
    systemName: string;
    systemDescription: string;
    impactLevel: string;
    owner: string;
    assessmentDate: string;
    assessorName: string;
    organization: string;
  };
  riskAssessment: {
    assessmentDate: string;
    assessorName: string;
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
    overallRiskScore: number;
    assessmentMethodology: string;
  };
  risks: Array<{
    riskId: string;
    riskTitle: string;
    riskDescription: string;
    riskCategory: string;
    likelihood: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
    impact: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
    riskScore: number;
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
    rootCause: string;
    affectedControls: string[];
    mitigationStrategy: string;
    mitigationStatus: 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';
    mitigationOwner: string;
    mitigationDueDate: string;
    residualRisk: 'Low' | 'Moderate' | 'High' | 'Critical';
    monitoringFrequency: string;
  }>;
  controlGaps: Array<{
    controlId: string;
    controlTitle: string;
    gapDescription: string;
    riskImpact: string;
    remediationPlan: string;
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
  }>;
  summary: {
    totalRisks: number;
    criticalRisks: number;
    highRisks: number;
    mediumRisks: number;
    lowRisks: number;
    risksWithMitigation: number;
    risksWithoutMitigation: number;
    averageRiskScore: number;
  };
}

export class RARDataCollectionService {
  /**
   * Collect RAR data for a system
   */
  async collectRARData(systemId: string): Promise<RARData> {
    // Get system information
    const system = await storage.getSystem(systemId);
    if (!system) {
      throw new Error(`System not found: ${systemId}`);
    }

    // Get system controls
    const systemControls = await storage.getSystemControls(systemId);
    
    // Get STIG rules
    const stigRules = await storage.getStigRules();
    
    // Get findings
    const findings = await storage.getFindingsBySystem(systemId);
    
    // Get evidence
    const evidence = await storage.getEvidenceBySystem(systemId);
    
    // Get assessments
    const assessments = await storage.getAssessmentsBySystem(systemId);
    const latestAssessment = assessments.length > 0 ? assessments[0] : null;

    // Build system info
    const systemInfo = {
      systemName: system.name,
      systemDescription: system.description || 'No description provided',
      impactLevel: system.impactLevel || 'Moderate',
      owner: system.owner || 'Unknown',
      assessmentDate: latestAssessment?.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      assessorName: latestAssessment?.assessorName || 'Unknown',
      organization: 'Unknown' // system.organization not available in schema
    };

    // Build risk assessment
    const riskAssessment = this.buildRiskAssessment(system, findings, latestAssessment);

    // Build risks from findings and control gaps
    const risks = await this.buildRisks(systemControls, stigRules, findings, evidence);

    // Build control gaps
    const controlGaps = await this.buildControlGaps(systemControls, stigRules, findings);

    // Calculate summary
    const summary = this.calculateSummary(risks);

    return {
      systemInfo,
      riskAssessment,
      risks,
      controlGaps,
      summary
    };
  }

  /**
   * Build risk assessment summary
   */
  private buildRiskAssessment(
    system: System,
    findings: Finding[],
    assessment: Assessment | null
  ): RARData['riskAssessment'] {
    const criticalFindings = findings.filter(f => this.mapSeverity(f.severity) === 'Critical').length;
    const highFindings = findings.filter(f => this.mapSeverity(f.severity) === 'High').length;
    const mediumFindings = findings.filter(f => this.mapSeverity(f.severity) === 'Medium').length;
    const lowFindings = findings.filter(f => this.mapSeverity(f.severity) === 'Low').length;

    // Calculate overall risk score (weighted by severity)
    const riskScore = (criticalFindings * 4) + (highFindings * 3) + (mediumFindings * 2) + (lowFindings * 1);
    const totalFindings = findings.length;
    const normalizedRiskScore = totalFindings > 0 ? (riskScore / (totalFindings * 4)) * 100 : 0;

    // Determine risk level based on score
    let riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
    if (normalizedRiskScore >= 80) {
      riskLevel = 'Critical';
    } else if (normalizedRiskScore >= 60) {
      riskLevel = 'High';
    } else if (normalizedRiskScore >= 40) {
      riskLevel = 'Moderate';
    } else {
      riskLevel = 'Low';
    }

    return {
      assessmentDate: assessment?.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      assessorName: assessment?.assessorName || 'Unknown',
      riskLevel,
      overallRiskScore: Math.round(normalizedRiskScore),
      assessmentMethodology: 'NIST SP 800-30 Risk Assessment Framework'
    };
  }

  /**
   * Build risks from findings and control gaps
   */
  private async buildRisks(
    systemControls: SystemControl[],
    stigRules: StigRule[],
    findings: Finding[],
    evidence: Evidence[]
  ): Promise<RARData['risks']> {
    const risks: RARData['risks'] = [];

    // Group findings by STIG rule to create risks
    const findingsByRule = new Map<string, Finding[]>();
    for (const finding of findings) {
      const ruleId = finding.stigRuleId;
      if (!findingsByRule.has(ruleId)) {
        findingsByRule.set(ruleId, []);
      }
      findingsByRule.get(ruleId)!.push(finding);
    }

    // Create risks from grouped findings
    for (const [ruleId, ruleFindings] of findingsByRule) {
      const stigRule = stigRules.find(rule => rule.id === ruleId);
      if (!stigRule) continue;

      const risk = this.createRiskFromFindings(stigRule, ruleFindings, systemControls, evidence);
      if (risk) {
        risks.push(risk);
      }
    }

    // Add risks for control gaps
    const controlGapRisks = await this.createRisksFromControlGaps(systemControls, stigRules);
    risks.push(...controlGapRisks);

    return risks;
  }

  /**
   * Create risk from findings
   */
  private createRiskFromFindings(
    stigRule: StigRule,
    findings: Finding[],
    systemControls: SystemControl[],
    evidence: Evidence[]
  ): RARData['risks'][0] | null {
    if (findings.length === 0) return null;

    const highestSeverity = findings.reduce((max, finding) => {
      const severity = this.mapSeverity(finding.severity);
      const severityOrder = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
      return severityOrder[severity] > severityOrder[max] ? severity : max;
    }, 'Low' as 'Low' | 'Medium' | 'High' | 'Critical');

    const riskScore = this.calculateRiskScore(highestSeverity, findings.length);
    const riskLevel = this.mapRiskLevel(riskScore);

    // Find affected controls
    const affectedControls = systemControls
      .filter(sc => sc.controlId)
      .map(sc => sc.controlId);

    // Build mitigation strategy
    const mitigationStrategy = this.buildMitigationStrategy(stigRule, findings, evidence);

    return {
      riskId: `RISK-${stigRule.id}`,
      riskTitle: stigRule.ruleTitle || stigRule.title,
      riskDescription: this.buildRiskDescription(stigRule, findings),
      riskCategory: this.categorizeRisk(stigRule),
      likelihood: this.mapLikelihood(highestSeverity),
      impact: this.mapImpact(highestSeverity),
      riskScore,
      riskLevel,
      rootCause: this.analyzeRootCause(findings),
      affectedControls,
      mitigationStrategy,
      mitigationStatus: this.determineMitigationStatus(findings),
      mitigationOwner: 'System Owner', // Default, should be configurable
      mitigationDueDate: this.calculateMitigationDueDate(highestSeverity),
      residualRisk: this.calculateResidualRisk(riskLevel, mitigationStrategy),
      monitoringFrequency: this.determineMonitoringFrequency(riskLevel)
    };
  }

  /**
   * Create risks from control gaps
   */
  private async createRisksFromControlGaps(
    systemControls: SystemControl[],
    stigRules: StigRule[]
  ): Promise<RARData['risks']> {
    const risks: RARData['risks'] = [];

    // Find controls that are not implemented or partially implemented
    for (const systemControl of systemControls) {
      const control = await storage.getControl(systemControl.controlId);
      if (!control) continue;

      // Check if control has implementation issues
      if (systemControl.status === 'not-assessed' || systemControl.status === 'non-compliant') {
        const risk = this.createRiskFromControlGap(control, systemControl);
        if (risk) {
          risks.push(risk);
        }
      }
    }

    return risks;
  }

  /**
   * Create risk from control gap
   */
  private createRiskFromControlGap(
    control: Control,
    systemControl: SystemControl
  ): RARData['risks'][0] | null {
    const riskScore = this.calculateControlGapRiskScore(control, systemControl);
    const riskLevel = this.mapRiskLevel(riskScore);

    return {
      riskId: `RISK-CONTROL-${control.id}`,
      riskTitle: `Control Gap: ${control.title}`,
      riskDescription: `Security control ${control.id} (${control.title}) is not properly implemented or assessed`,
      riskCategory: 'Control Implementation',
      likelihood: 'Medium',
      impact: this.mapControlImpact(control),
      riskScore,
      riskLevel,
      rootCause: 'Incomplete or missing control implementation',
      affectedControls: [control.id],
      mitigationStrategy: `Implement and properly configure ${control.title} according to NIST guidelines`,
      mitigationStatus: 'Not Started',
      mitigationOwner: 'System Owner',
      mitigationDueDate: this.calculateControlMitigationDueDate(riskLevel),
      residualRisk: this.calculateResidualRisk(riskLevel, 'Control implementation required'),
      monitoringFrequency: this.determineMonitoringFrequency(riskLevel)
    };
  }

  /**
   * Build control gaps
   */
  private async buildControlGaps(
    systemControls: SystemControl[],
    stigRules: StigRule[],
    findings: Finding[]
  ): Promise<RARData['controlGaps']> {
    const gaps: RARData['controlGaps'] = [];

    for (const systemControl of systemControls) {
      const control = await storage.getControl(systemControl.controlId);
      if (!control) continue;

      // Check for control gaps
      if (systemControl.status === 'not-assessed' || systemControl.status === 'non-compliant') {
        const gap = this.createControlGap(control, systemControl, findings);
        if (gap) {
          gaps.push(gap);
        }
      }
    }

    return gaps;
  }

  /**
   * Create control gap
   */
  private createControlGap(
    control: Control,
    systemControl: SystemControl,
    findings: Finding[]
  ): RARData['controlGaps'][0] | null {
    const relatedFindings = findings.filter(f => f.stigRuleId);
    const gapDescription = this.buildGapDescription(control, systemControl, relatedFindings);
    const priority = this.determineGapPriority(control, systemControl);

    return {
      controlId: control.id,
      controlTitle: control.title,
      gapDescription,
      riskImpact: this.assessGapRiskImpact(control, relatedFindings),
      remediationPlan: this.buildRemediationPlan(control, systemControl),
      priority
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(risks: RARData['risks']): RARData['summary'] {
    const totalRisks = risks.length;
    const criticalRisks = risks.filter(r => r.riskLevel === 'Critical').length;
    const highRisks = risks.filter(r => r.riskLevel === 'High').length;
    const mediumRisks = risks.filter(r => r.riskLevel === 'Moderate').length;
    const lowRisks = risks.filter(r => r.riskLevel === 'Low').length;
    const risksWithMitigation = risks.filter(r => r.mitigationStatus !== 'Not Started').length;
    const risksWithoutMitigation = totalRisks - risksWithMitigation;
    const averageRiskScore = totalRisks > 0 ? risks.reduce((sum, r) => sum + r.riskScore, 0) / totalRisks : 0;

    return {
      totalRisks,
      criticalRisks,
      highRisks,
      mediumRisks,
      lowRisks,
      risksWithMitigation,
      risksWithoutMitigation,
      averageRiskScore: Math.round(averageRiskScore)
    };
  }

  // Helper methods for risk calculations and mappings
  private mapSeverity(severity: string): 'Low' | 'Medium' | 'High' | 'Critical' {
    const lowerSeverity = severity.toLowerCase();
    if (lowerSeverity.includes('critical') || lowerSeverity.includes('high')) {
      return 'Critical';
    } else if (lowerSeverity.includes('medium') || lowerSeverity.includes('moderate')) {
      return 'Medium';
    }
    return 'Low';
  }

  private calculateRiskScore(severity: 'Low' | 'Medium' | 'High' | 'Critical', count: number): number {
    const severityScores = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
    return severityScores[severity] * Math.min(count, 5); // Cap at 5 for count multiplier
  }

  private mapRiskLevel(riskScore: number): 'Low' | 'Moderate' | 'High' | 'Critical' {
    if (riskScore >= 15) return 'Critical';
    if (riskScore >= 10) return 'High';
    if (riskScore >= 5) return 'Moderate';
    return 'Low';
  }

  private mapLikelihood(severity: 'Low' | 'Medium' | 'High' | 'Critical'): 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High' {
    const mapping = { 'Low': 'Low', 'Medium': 'Medium', 'High': 'High', 'Critical': 'Very High' };
    return mapping[severity] as 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
  }

  private mapImpact(severity: 'Low' | 'Medium' | 'High' | 'Critical'): 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High' {
    const mapping = { 'Low': 'Low', 'Medium': 'Medium', 'High': 'High', 'Critical': 'Very High' };
    return mapping[severity] as 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
  }

  private categorizeRisk(stigRule: StigRule): string {
    const title = stigRule.title.toLowerCase();
    if (title.includes('access') || title.includes('authentication')) return 'Access Control';
    if (title.includes('encryption') || title.includes('cryptographic')) return 'Cryptography';
    if (title.includes('network') || title.includes('firewall')) return 'Network Security';
    if (title.includes('audit') || title.includes('logging')) return 'Audit & Monitoring';
    if (title.includes('backup') || title.includes('recovery')) return 'Data Protection';
    return 'General Security';
  }

  private buildRiskDescription(stigRule: StigRule, findings: Finding[]): string {
    const findingCount = findings.length;
    const severity = findings.length > 0 ? this.mapSeverity(findings[0].severity) : 'Low';
    return `${stigRule.ruleTitle || stigRule.title}: ${findingCount} ${severity.toLowerCase()} severity finding(s) identified`;
  }

  private analyzeRootCause(findings: Finding[]): string {
    if (findings.length === 0) return 'Unknown';
    
    const commonCauses = [
      'Insufficient security controls',
      'Configuration errors',
      'Missing security patches',
      'Inadequate access controls',
      'Weak authentication mechanisms'
    ];
    
    // Simple heuristic based on finding count and severity
    const severity = this.mapSeverity(findings[0].severity);
    const causeIndex = Math.min(findings.length - 1, commonCauses.length - 1);
    return commonCauses[causeIndex];
  }

  private buildMitigationStrategy(stigRule: StigRule, findings: Finding[], evidence: Evidence[]): string {
    const evidenceCount = evidence.length;
    const findingCount = findings.length;
    
    if (evidenceCount > 0) {
      return `Implement recommended remediation based on ${evidenceCount} evidence item(s) and ${findingCount} finding(s)`;
    }
    
    return `Follow STIG guidelines for ${stigRule.ruleTitle || stigRule.title} to address ${findingCount} identified issue(s)`;
  }

  private determineMitigationStatus(findings: Finding[]): 'Not Started' | 'In Progress' | 'Completed' | 'On Hold' {
    const openFindings = findings.filter(f => f.status === 'open');
    const closedFindings = findings.filter(f => f.status === 'closed');
    
    if (closedFindings.length === findings.length) return 'Completed';
    if (openFindings.length === findings.length) return 'Not Started';
    return 'In Progress';
  }

  private calculateMitigationDueDate(severity: 'Low' | 'Medium' | 'High' | 'Critical'): string {
    const days = { 'Low': 30, 'Medium': 14, 'High': 7, 'Critical': 3 };
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days[severity]);
    return dueDate.toISOString().split('T')[0];
  }

  private calculateResidualRisk(riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical', mitigationStrategy: string): 'Low' | 'Moderate' | 'High' | 'Critical' {
    if (mitigationStrategy.includes('implemented') || mitigationStrategy.includes('completed')) {
      return 'Low';
    }
    return riskLevel;
  }

  private determineMonitoringFrequency(riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical'): string {
    const frequencies = {
      'Low': 'Quarterly',
      'Moderate': 'Monthly',
      'High': 'Bi-weekly',
      'Critical': 'Weekly'
    };
    return frequencies[riskLevel];
  }

  private calculateControlGapRiskScore(control: Control, systemControl: SystemControl): number {
    // Base score on control importance and implementation status
    const baselineScore = 5; // Base score for any control gap
    const priorityMultiplier = control.priority === 'High' ? 2 : 1;
    const statusMultiplier = systemControl.status === 'non-compliant' ? 2 : 1;
    
    return baselineScore * priorityMultiplier * statusMultiplier;
  }

  private mapControlImpact(control: Control): 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High' {
    if (control.priority === 'High') return 'High';
    if (control.priority === 'Medium') return 'Medium';
    return 'Low';
  }

  private calculateControlMitigationDueDate(riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical'): string {
    return this.calculateMitigationDueDate(riskLevel);
  }

  private buildGapDescription(control: Control, systemControl: SystemControl, findings: Finding[]): string {
    const findingCount = findings.length;
    const status = systemControl.status;
    
    if (status === 'not-assessed') {
      return `Control ${control.id} (${control.title}) has not been assessed for compliance`;
    }
    
    return `Control ${control.id} (${control.title}) is non-compliant with ${findingCount} related finding(s)`;
  }

  private determineGapPriority(control: Control, systemControl: SystemControl): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (control.priority === 'High' || systemControl.status === 'non-compliant') {
      return 'High';
    }
    return 'Medium';
  }

  private assessGapRiskImpact(control: Control, findings: Finding[]): string {
    const findingCount = findings.length;
    if (findingCount === 0) {
      return 'Potential security vulnerability due to unassessed control';
    }
    return `High risk due to ${findingCount} security finding(s) related to this control`;
  }

  private buildRemediationPlan(control: Control, systemControl: SystemControl): string {
    return `Implement and configure ${control.title} according to NIST SP 800-53 guidelines. Ensure proper assessment and monitoring of control effectiveness.`;
  }
}











