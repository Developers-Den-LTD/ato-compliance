// SCTM Data Collection Service
// Collects and structures data for Security Control Traceability Matrix generation

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

export interface SCTMData {
  systemInfo: {
    systemName: string;
    systemDescription: string;
    impactLevel: string;
    owner: string;
    assessmentDate: string;
    assessorName: string;
    organization: string;
  };
  controls: Array<{
    controlId: string;
    controlTitle: string;
    controlFamily: string;
    implementationStatus: 'Implemented' | 'Partially Implemented' | 'Not Implemented';
    implementationDescription: string;
    stigRules: Array<{
      ruleId: string;
      ruleTitle: string;
      complianceStatus: 'Compliant' | 'Non-Compliant' | 'Not Applicable';
      evidence: string[];
    }>;
    evidence: string[];
    findings: Array<{
      findingId: string;
      description: string;
      severity: 'High' | 'Medium' | 'Low';
      status: 'Open' | 'Closed' | 'Mitigated';
    }>;
  }>;
  summary: {
    totalControls: number;
    implementedControls: number;
    partiallyImplementedControls: number;
    notImplementedControls: number;
    compliantStigRules: number;
    nonCompliantStigRules: number;
  };
}

export class SCTMDataCollectionService {
  /**
   * Collect SCTM data for a system
   */
  async collectSCTMData(systemId: string): Promise<SCTMData> {
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
      assessorName: latestAssessment?.assessor || 'Unknown',
      organization: 'Unknown' // system.organization not available in schema
    };

    // Build controls data
    const controls = await this.buildControlsData(systemControls, stigRules, findings, evidence);

    // Calculate summary
    const summary = this.calculateSummary(controls);

    return {
      systemInfo,
      controls,
      summary
    };
  }

  /**
   * Build controls data with STIG mappings and evidence
   */
  private async buildControlsData(
    systemControls: SystemControl[],
    stigRules: StigRule[],
    findings: Finding[],
    evidence: Evidence[]
  ): Promise<SCTMData['controls']> {
    const controls: SCTMData['controls'] = [];

    for (const systemControl of systemControls) {
      // Get control details
      const control = await storage.getControl(systemControl.controlId);
      if (!control) continue;

      // Get STIG rules for this control via the mapping table
      const controlStigRules = await storage.getStigRulesForControl(systemControl.controlId);

      // Get findings for this control (via STIG rules)
      const controlStigRuleIds = controlStigRules.map(rule => rule.id);
      const controlFindings = findings.filter(finding => 
        controlStigRuleIds.includes(finding.stigRuleId)
      );

      // Get evidence for this control
      const controlEvidence = evidence.filter(ev => 
        ev.controlId === systemControl.controlId
      );

      // Build STIG rules data
      const stigRulesData = controlStigRules.map(rule => ({
        ruleId: rule.id, // Using id instead of ruleId
        ruleTitle: rule.title,
        complianceStatus: this.determineComplianceStatus(rule, controlFindings),
        evidence: controlEvidence
          .filter(ev => ev.controlId === systemControl.controlId) // Link via controlId
          .map(ev => ev.description || 'Evidence file') // Using description instead of fileName
      }));

      // Build findings data
      const findingsData = controlFindings.map(finding => ({
        findingId: finding.id,
        description: finding.description || 'No description',
        severity: this.mapSeverity(finding.severity),
        status: this.mapStatus(finding.status)
      }));

      // Determine implementation status
      const implementationStatus = this.determineImplementationStatus(
        systemControl,
        controlFindings,
        stigRulesData
      );

      controls.push({
        controlId: control.id,
        controlTitle: control.title,
        controlFamily: control.family,
        implementationStatus,
        implementationDescription: this.buildImplementationDescription(
          systemControl,
          controlFindings,
          stigRulesData
        ),
        stigRules: stigRulesData,
        evidence: controlEvidence.map(ev => ev.description || 'Evidence file'),
        findings: findingsData
      });
    }

    return controls;
  }

  /**
   * Determine compliance status for STIG rule
   */
  private determineComplianceStatus(rule: StigRule, findings: Finding[]): 'Compliant' | 'Non-Compliant' | 'Not Applicable' {
    const ruleFindings = findings.filter(f => f.stigRuleId === rule.id);
    
    if (ruleFindings.length === 0) {
      return 'Compliant'; // No findings means compliant
    }
    
    const openFindings = ruleFindings.filter(f => f.status === 'open');
    if (openFindings.length === 0) {
      return 'Compliant'; // All findings are closed
    }
    
    return 'Non-Compliant';
  }

  /**
   * Map severity to standard values
   */
  private mapSeverity(severity: string): 'High' | 'Medium' | 'Low' {
    const lowerSeverity = severity.toLowerCase();
    if (lowerSeverity.includes('high') || lowerSeverity.includes('critical')) {
      return 'High';
    } else if (lowerSeverity.includes('medium') || lowerSeverity.includes('moderate')) {
      return 'Medium';
    }
    return 'Low';
  }

  /**
   * Map status to standard values
   */
  private mapStatus(status: string): 'Open' | 'Closed' | 'Mitigated' {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('closed') || lowerStatus.includes('resolved')) {
      return 'Closed';
    } else if (lowerStatus.includes('mitigated') || lowerStatus.includes('accepted')) {
      return 'Mitigated';
    }
    return 'Open';
  }

  /**
   * Determine implementation status
   */
  private determineImplementationStatus(
    systemControl: SystemControl,
    findings: Finding[],
    stigRules: Array<{ complianceStatus: string }>
  ): 'Implemented' | 'Partially Implemented' | 'Not Implemented' {
    // Check if control has implementation status
    if (systemControl.implementationText) {
      const status = systemControl.implementationText.toLowerCase();
      if (status.includes('implemented') && !status.includes('partial')) {
        return 'Implemented';
      } else if (status.includes('partial')) {
        return 'Partially Implemented';
      }
    }

    // Check STIG compliance
    const nonCompliantRules = stigRules.filter(rule => rule.complianceStatus === 'Non-Compliant');
    const totalRules = stigRules.length;

    if (totalRules === 0) {
      return 'Not Implemented'; // No STIG rules means not implemented
    }

    const complianceRate = (totalRules - nonCompliantRules.length) / totalRules;

    if (complianceRate >= 0.8) {
      return 'Implemented';
    } else if (complianceRate >= 0.3) {
      return 'Partially Implemented';
    }

    return 'Not Implemented';
  }

  /**
   * Build implementation description
   */
  private buildImplementationDescription(
    systemControl: SystemControl,
    findings: Finding[],
    stigRules: Array<{ complianceStatus: string; evidence: string[] }>
  ): string {
    const descriptions: string[] = [];

    // Add implementation status
    if (systemControl.implementationText) {
      descriptions.push(systemControl.implementationText);
    }

    // Add STIG compliance info
    const compliantRules = stigRules.filter(rule => rule.complianceStatus === 'Compliant');
    const totalRules = stigRules.length;
    
    if (totalRules > 0) {
      descriptions.push(`${compliantRules.length}/${totalRules} STIG rules are compliant`);
    }

    // Add evidence info
    const totalEvidence = stigRules.reduce((sum, rule) => sum + rule.evidence.length, 0);
    if (totalEvidence > 0) {
      descriptions.push(`${totalEvidence} evidence items collected`);
    }

    // Add findings info
    if (findings.length > 0) {
      const openFindings = findings.filter(f => f.status === 'open');
      descriptions.push(`${openFindings.length} open findings`);
    }

    return descriptions.join('; ') || 'No implementation details available';
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(controls: SCTMData['controls']): SCTMData['summary'] {
    const totalControls = controls.length;
    const implementedControls = controls.filter(c => c.implementationStatus === 'Implemented').length;
    const partiallyImplementedControls = controls.filter(c => c.implementationStatus === 'Partially Implemented').length;
    const notImplementedControls = controls.filter(c => c.implementationStatus === 'Not Implemented').length;

    let compliantStigRules = 0;
    let nonCompliantStigRules = 0;

    for (const control of controls) {
      for (const stigRule of control.stigRules) {
        if (stigRule.complianceStatus === 'Compliant') {
          compliantStigRules++;
        } else if (stigRule.complianceStatus === 'Non-Compliant') {
          nonCompliantStigRules++;
        }
      }
    }

    return {
      totalControls,
      implementedControls,
      partiallyImplementedControls,
      notImplementedControls,
      compliantStigRules,
      nonCompliantStigRules
    };
  }
}
