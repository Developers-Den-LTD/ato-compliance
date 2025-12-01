// PPS Data Collection Service
// Collects and structures data for Privacy Impact Assessment (PPS) worksheet generation

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

export interface PPSData {
  systemInfo: {
    systemName: string;
    systemDescription: string;
    dataClassification: string;
    owner: string;
    assessmentDate: string;
    privacyOfficer: string;
    organization: string;
  };
  privacyAssessment: {
    assessmentDate: string;
    privacyOfficer: string;
    assessmentType: 'Initial' | 'Periodic' | 'Significant Change';
    assessmentScope: string;
    legalBasis: string[];
    applicableLaws: string[];
  };
  dataCollection: Array<{
    dataType: string;
    dataCategory: 'Personal Data' | 'Sensitive Personal Data' | 'Special Categories';
    dataSource: string;
    dataPurpose: string;
    legalBasis: string;
    retentionPeriod: string;
    dataSubjects: string;
    dataVolume: string;
    dataLocation: string;
    dataSharing: string[];
    dataTransfers: string[];
  }>;
  privacyRisks: Array<{
    riskId: string;
    riskTitle: string;
    riskDescription: string;
    riskCategory: string;
    likelihood: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
    impact: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
    riskScore: number;
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
    affectedDataTypes: string[];
    privacyControls: string[];
    mitigationStrategy: string;
    mitigationStatus: 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';
    mitigationOwner: string;
    mitigationDueDate: string;
    residualRisk: 'Low' | 'Moderate' | 'High' | 'Critical';
  }>;
  privacyControls: Array<{
    controlId: string;
    controlTitle: string;
    controlDescription: string;
    controlType: 'Technical' | 'Organizational' | 'Physical';
    implementationStatus: 'Implemented' | 'Partially Implemented' | 'Not Implemented';
    effectiveness: 'High' | 'Medium' | 'Low';
    dataTypes: string[];
    riskMitigation: string[];
  }>;
  dataSubjectRights: {
    rightToAccess: string;
    rightToRectification: string;
    rightToErasure: string;
    rightToRestrictProcessing: string;
    rightToDataPortability: string;
    rightToObject: string;
    automatedDecisionMaking: string;
    complaintProcedures: string;
  };
  summary: {
    totalDataTypes: number;
    totalPrivacyRisks: number;
    criticalPrivacyRisks: number;
    highPrivacyRisks: number;
    mediumPrivacyRisks: number;
    lowPrivacyRisks: number;
    implementedControls: number;
    partiallyImplementedControls: number;
    notImplementedControls: number;
    averageRiskScore: number;
  };
}

export class PPSDataCollectionService {
  /**
   * Collect PPS data for a system
   */
  async collectPPSData(systemId: string): Promise<PPSData> {
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
      dataClassification: this.determineDataClassification(system, findings),
      owner: system.owner || 'Unknown',
      assessmentDate: latestAssessment?.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      privacyOfficer: 'Privacy Officer', // Default, should be configurable
      organization: 'Unknown' // system.organization not available in schema
    };

    // Build privacy assessment
    const privacyAssessment = this.buildPrivacyAssessment(system, findings, latestAssessment);

    // Build data collection activities
    const dataCollection = await this.buildDataCollection(system, findings, evidence);

    // Build privacy risks
    const privacyRisks = await this.buildPrivacyRisks(systemControls, stigRules, findings, evidence);

    // Build privacy controls
    const privacyControls = await this.buildPrivacyControls(systemControls, stigRules, findings);

    // Build data subject rights
    const dataSubjectRights = this.buildDataSubjectRights(system, findings);

    // Calculate summary
    const summary = this.calculateSummary(dataCollection, privacyRisks, privacyControls);

    return {
      systemInfo,
      privacyAssessment,
      dataCollection,
      privacyRisks,
      privacyControls,
      dataSubjectRights,
      summary
    };
  }

  /**
   * Determine data classification based on system and findings
   */
  private determineDataClassification(system: System, findings: Finding[]): string {
    // Check for sensitive data indicators in findings
    const sensitiveKeywords = ['personal', 'pii', 'phi', 'financial', 'biometric', 'health'];
    const hasSensitiveData = findings.some(finding => 
      sensitiveKeywords.some(keyword => 
        finding.description?.toLowerCase().includes(keyword)
      )
    );

    if (hasSensitiveData) {
      return 'Sensitive Personal Data';
    }

    // Check system impact level
    if (system.impactLevel === 'High') {
      return 'Personal Data';
    }

    return 'Public Data';
  }

  /**
   * Build privacy assessment summary
   */
  private buildPrivacyAssessment(
    system: System,
    findings: Finding[],
    assessment: Assessment | null
  ): PPSData['privacyAssessment'] {
    const privacyFindings = findings.filter(f => 
      f.description?.toLowerCase().includes('privacy') || 
      f.description?.toLowerCase().includes('data protection') ||
      f.description?.toLowerCase().includes('gdpr') ||
      f.description?.toLowerCase().includes('ccpa')
    );

    const assessmentType = this.determineAssessmentType(privacyFindings.length, assessment);
    const legalBasis = this.determineLegalBasis(system, privacyFindings);
    const applicableLaws = this.determineApplicableLaws(system, privacyFindings);

    return {
      assessmentDate: assessment?.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      privacyOfficer: 'Privacy Officer', // Default, should be configurable
      assessmentType,
      assessmentScope: `Privacy impact assessment for ${system.name} system`,
      legalBasis,
      applicableLaws
    };
  }

  /**
   * Build data collection activities
   */
  private async buildDataCollection(
    system: System,
    findings: Finding[],
    evidence: Evidence[]
  ): Promise<PPSData['dataCollection']> {
    const dataCollection: PPSData['dataCollection'] = [];

    // Extract data types from findings and evidence
    const dataTypes = this.extractDataTypes(findings, evidence);
    
    for (const dataType of dataTypes) {
      const collection = this.createDataCollectionEntry(dataType, system, findings, evidence);
      if (collection) {
        dataCollection.push(collection);
      }
    }

    // Add default data collection if none found
    if (dataCollection.length === 0) {
      dataCollection.push({
        dataType: 'System Data',
        dataCategory: 'Personal Data',
        dataSource: 'System Users',
        dataPurpose: 'System operation and security',
        legalBasis: 'Legitimate Interest',
        retentionPeriod: '7 years',
        dataSubjects: 'System users and administrators',
        dataVolume: 'Unknown',
        dataLocation: 'Primary data center',
        dataSharing: ['Internal departments'],
        dataTransfers: ['No international transfers']
      });
    }

    return dataCollection;
  }

  /**
   * Build privacy risks
   */
  private async buildPrivacyRisks(
    systemControls: SystemControl[],
    stigRules: StigRule[],
    findings: Finding[],
    evidence: Evidence[]
  ): Promise<PPSData['privacyRisks']> {
    const privacyRisks: PPSData['privacyRisks'] = [];

    // Identify privacy-related findings
    const privacyFindings = findings.filter(f => 
      f.description?.toLowerCase().includes('privacy') || 
      f.description?.toLowerCase().includes('data protection') ||
      f.description?.toLowerCase().includes('personal data') ||
      f.description?.toLowerCase().includes('pii')
    );

    // Create risks from privacy findings
    for (const finding of privacyFindings) {
      const stigRule = stigRules.find(rule => rule.id === finding.stigRuleId);
      if (!stigRule) continue;

      const risk = this.createPrivacyRiskFromFinding(stigRule, finding, evidence);
      if (risk) {
        privacyRisks.push(risk);
      }
    }

    // Add risks for data collection activities
    const dataCollectionRisks = await this.createRisksFromDataCollection(systemControls, findings);
    privacyRisks.push(...dataCollectionRisks);

    return privacyRisks;
  }

  /**
   * Build privacy controls
   */
  private async buildPrivacyControls(
    systemControls: SystemControl[],
    stigRules: StigRule[],
    findings: Finding[]
  ): Promise<PPSData['privacyControls']> {
    const privacyControls: PPSData['privacyControls'] = [];

    // Map existing controls to privacy controls
    for (const systemControl of systemControls) {
      const control = await storage.getControl(systemControl.controlId);
      if (!control) continue;

      const privacyControl = this.mapToPrivacyControl(control, systemControl, findings);
      if (privacyControl) {
        privacyControls.push(privacyControl);
      }
    }

    // Add default privacy controls if none found
    if (privacyControls.length === 0) {
      privacyControls.push(
        {
          controlId: 'PRIV-001',
          controlTitle: 'Data Encryption',
          controlDescription: 'Encrypt personal data at rest and in transit',
          controlType: 'Technical',
          implementationStatus: 'Not Implemented',
          effectiveness: 'High',
          dataTypes: ['Personal Data', 'Sensitive Personal Data'],
          riskMitigation: ['Data Breach', 'Unauthorized Access']
        },
        {
          controlId: 'PRIV-002',
          controlTitle: 'Access Controls',
          controlDescription: 'Implement role-based access controls for personal data',
          controlType: 'Technical',
          implementationStatus: 'Not Implemented',
          effectiveness: 'High',
          dataTypes: ['Personal Data', 'Sensitive Personal Data'],
          riskMitigation: ['Unauthorized Access', 'Data Misuse']
        }
      );
    }

    return privacyControls;
  }

  /**
   * Build data subject rights
   */
  private buildDataSubjectRights(system: System, findings: Finding[]): PPSData['dataSubjectRights'] {
    return {
      rightToAccess: 'Data subjects can request access to their personal data through the privacy officer',
      rightToRectification: 'Data subjects can request correction of inaccurate personal data',
      rightToErasure: 'Data subjects can request deletion of their personal data under certain conditions',
      rightToRestrictProcessing: 'Data subjects can request restriction of processing of their personal data',
      rightToDataPortability: 'Data subjects can request a copy of their personal data in a portable format',
      rightToObject: 'Data subjects can object to processing of their personal data',
      automatedDecisionMaking: 'Data subjects have the right to human review of automated decisions',
      complaintProcedures: 'Data subjects can file complaints with the privacy officer or supervisory authority'
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    dataCollection: PPSData['dataCollection'],
    privacyRisks: PPSData['privacyRisks'],
    privacyControls: PPSData['privacyControls']
  ): PPSData['summary'] {
    const totalDataTypes = dataCollection.length;
    const totalPrivacyRisks = privacyRisks.length;
    const criticalPrivacyRisks = privacyRisks.filter(r => r.riskLevel === 'Critical').length;
    const highPrivacyRisks = privacyRisks.filter(r => r.riskLevel === 'High').length;
    const mediumPrivacyRisks = privacyRisks.filter(r => r.riskLevel === 'Moderate').length;
    const lowPrivacyRisks = privacyRisks.filter(r => r.riskLevel === 'Low').length;
    const implementedControls = privacyControls.filter(c => c.implementationStatus === 'Implemented').length;
    const partiallyImplementedControls = privacyControls.filter(c => c.implementationStatus === 'Partially Implemented').length;
    const notImplementedControls = privacyControls.filter(c => c.implementationStatus === 'Not Implemented').length;
    const averageRiskScore = totalPrivacyRisks > 0 ? privacyRisks.reduce((sum, r) => sum + r.riskScore, 0) / totalPrivacyRisks : 0;

    return {
      totalDataTypes,
      totalPrivacyRisks,
      criticalPrivacyRisks,
      highPrivacyRisks,
      mediumPrivacyRisks,
      lowPrivacyRisks,
      implementedControls,
      partiallyImplementedControls,
      notImplementedControls,
      averageRiskScore: Math.round(averageRiskScore)
    };
  }

  // Helper methods for privacy assessment
  private determineAssessmentType(privacyFindingCount: number, assessment: Assessment | null): 'Initial' | 'Periodic' | 'Significant Change' {
    if (privacyFindingCount > 5) return 'Significant Change';
    if (assessment?.createdAt && new Date(assessment.createdAt).getTime() < Date.now() - 365 * 24 * 60 * 60 * 1000) {
      return 'Periodic';
    }
    return 'Initial';
  }

  private determineLegalBasis(system: System, privacyFindings: Finding[]): string[] {
    const legalBasis = ['Legitimate Interest'];
    
    if (privacyFindings.some(f => f.description?.toLowerCase().includes('consent'))) {
      legalBasis.push('Consent');
    }
    
    if (system.impactLevel === 'High') {
      legalBasis.push('Vital Interests');
    }
    
    return legalBasis;
  }

  private determineApplicableLaws(system: System, privacyFindings: Finding[]): string[] {
    const laws = ['GDPR', 'Data Protection Act'];
    
    if (privacyFindings.some(f => f.description?.toLowerCase().includes('ccpa'))) {
      laws.push('CCPA');
    }
    
    if (privacyFindings.some(f => f.description?.toLowerCase().includes('hipaa'))) {
      laws.push('HIPAA');
    }
    
    return laws;
  }

  private extractDataTypes(findings: Finding[], evidence: Evidence[]): string[] {
    const dataTypes = new Set<string>();
    
    // Extract from findings
    findings.forEach(finding => {
      if (finding.description?.toLowerCase().includes('personal data')) {
        dataTypes.add('Personal Data');
      }
      if (finding.description?.toLowerCase().includes('financial')) {
        dataTypes.add('Financial Data');
      }
      if (finding.description?.toLowerCase().includes('health')) {
        dataTypes.add('Health Data');
      }
      if (finding.description?.toLowerCase().includes('biometric')) {
        dataTypes.add('Biometric Data');
      }
    });

    // Extract from evidence
    evidence.forEach(ev => {
      if (ev.description?.toLowerCase().includes('user data')) {
        dataTypes.add('User Data');
      }
      if (ev.description?.toLowerCase().includes('system logs')) {
        dataTypes.add('System Logs');
      }
    });

    return Array.from(dataTypes);
  }

  private createDataCollectionEntry(
    dataType: string,
    system: System,
    findings: Finding[],
    evidence: Evidence[]
  ): PPSData['dataCollection'][0] | null {
    const dataCategory = this.categorizeData(dataType);
    const relatedFindings = findings.filter(f => 
      f.description?.toLowerCase().includes(dataType.toLowerCase())
    );

    return {
      dataType,
      dataCategory,
      dataSource: 'System Users',
      dataPurpose: `System operation and ${dataType.toLowerCase()} processing`,
      legalBasis: 'Legitimate Interest',
      retentionPeriod: this.determineRetentionPeriod(dataCategory),
      dataSubjects: 'System users and administrators',
      dataVolume: this.estimateDataVolume(relatedFindings),
      dataLocation: 'Primary data center',
      dataSharing: ['Internal departments'],
      dataTransfers: ['No international transfers']
    };
  }

  private createPrivacyRiskFromFinding(
    stigRule: StigRule,
    finding: Finding,
    evidence: Evidence[]
  ): PPSData['privacyRisks'][0] | null {
    const riskScore = this.calculatePrivacyRiskScore(finding);
    const riskLevel = this.mapPrivacyRiskLevel(riskScore);
    const affectedDataTypes = this.identifyAffectedDataTypes(finding);

    return {
      riskId: `PRIV-RISK-${stigRule.id}`,
      riskTitle: `Privacy Risk: ${stigRule.ruleTitle || stigRule.title}`,
      riskDescription: this.buildPrivacyRiskDescription(stigRule, finding),
      riskCategory: this.categorizePrivacyRisk(stigRule),
      likelihood: this.mapPrivacyLikelihood(finding.severity),
      impact: this.mapPrivacyImpact(finding.severity),
      riskScore,
      riskLevel,
      affectedDataTypes,
      privacyControls: this.identifyPrivacyControls(stigRule),
      mitigationStrategy: this.buildPrivacyMitigationStrategy(stigRule, finding),
      mitigationStatus: 'Not Started',
      mitigationOwner: 'Privacy Officer',
      mitigationDueDate: this.calculatePrivacyMitigationDueDate(riskLevel),
      residualRisk: riskLevel
    };
  }

  private async createRisksFromDataCollection(
    systemControls: SystemControl[],
    findings: Finding[]
  ): Promise<PPSData['privacyRisks']> {
    const risks: PPSData['privacyRisks'] = [];

    // Create risks for data collection activities
    const dataCollectionRisks = [
      {
        riskId: 'PRIV-RISK-DATA-001',
        riskTitle: 'Data Collection Risk',
        riskDescription: 'Risk associated with collection of personal data',
        riskCategory: 'Data Collection',
        likelihood: 'Medium' as const,
        impact: 'High' as const,
        riskScore: 6,
        riskLevel: 'Moderate' as const,
        affectedDataTypes: ['Personal Data'],
        privacyControls: ['Data Minimization', 'Purpose Limitation'],
        mitigationStrategy: 'Implement data minimization principles and clear purpose limitation',
        mitigationStatus: 'Not Started' as const,
        mitigationOwner: 'Privacy Officer',
        mitigationDueDate: this.calculatePrivacyMitigationDueDate('Moderate'),
        residualRisk: 'Low' as const
      }
    ];

    return dataCollectionRisks;
  }

  private mapToPrivacyControl(
    control: Control,
    systemControl: SystemControl,
    findings: Finding[]
  ): PPSData['privacyControls'][0] | null {
    // Map security control to privacy control
    const privacyControl = this.identifyPrivacyControl(control);
    if (!privacyControl) return null;

    return {
      controlId: `PRIV-${control.id}`,
      controlTitle: privacyControl.title,
      controlDescription: privacyControl.description,
      controlType: privacyControl.type,
      implementationStatus: this.mapImplementationStatus(systemControl.status),
      effectiveness: this.assessControlEffectiveness(control, findings),
      dataTypes: privacyControl.dataTypes,
      riskMitigation: privacyControl.riskMitigation
    };
  }

  // Additional helper methods
  private categorizeData(dataType: string): 'Personal Data' | 'Sensitive Personal Data' | 'Special Categories' {
    const sensitiveTypes = ['health', 'biometric', 'financial', 'genetic'];
    const specialCategories = ['health', 'biometric', 'genetic', 'political', 'religious'];
    
    if (specialCategories.some(type => dataType.toLowerCase().includes(type))) {
      return 'Special Categories';
    }
    
    if (sensitiveTypes.some(type => dataType.toLowerCase().includes(type))) {
      return 'Sensitive Personal Data';
    }
    
    return 'Personal Data';
  }

  private determineRetentionPeriod(dataCategory: string): string {
    const retentionPeriods = {
      'Personal Data': '7 years',
      'Sensitive Personal Data': '5 years',
      'Special Categories': '3 years'
    };
    
    return retentionPeriods[dataCategory] || '7 years';
  }

  private estimateDataVolume(findings: Finding[]): string {
    if (findings.length === 0) return 'Low';
    if (findings.length < 5) return 'Medium';
    return 'High';
  }

  private calculatePrivacyRiskScore(finding: Finding): number {
    const severityScores = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
    const severity = this.mapSeverity(finding.severity);
    return severityScores[severity] * 2; // Privacy risks are weighted higher
  }

  private mapPrivacyRiskLevel(riskScore: number): 'Low' | 'Moderate' | 'High' | 'Critical' {
    if (riskScore >= 8) return 'Critical';
    if (riskScore >= 6) return 'High';
    if (riskScore >= 4) return 'Moderate';
    return 'Low';
  }

  private mapSeverity(severity: string): 'Low' | 'Medium' | 'High' | 'Critical' {
    const lowerSeverity = severity.toLowerCase();
    if (lowerSeverity.includes('critical') || lowerSeverity.includes('high')) {
      return 'Critical';
    } else if (lowerSeverity.includes('medium') || lowerSeverity.includes('moderate')) {
      return 'Medium';
    }
    return 'Low';
  }

  private mapPrivacyLikelihood(severity: string): 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High' {
    const severityMap = { 'Low': 'Low', 'Medium': 'Medium', 'High': 'High', 'Critical': 'Very High' };
    return severityMap[this.mapSeverity(severity)] as 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
  }

  private mapPrivacyImpact(severity: string): 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High' {
    const severityMap = { 'Low': 'Low', 'Medium': 'Medium', 'High': 'High', 'Critical': 'Very High' };
    return severityMap[this.mapSeverity(severity)] as 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
  }

  private identifyAffectedDataTypes(finding: Finding): string[] {
    const dataTypes = [];
    const description = finding.description?.toLowerCase() || '';
    
    if (description.includes('personal data')) dataTypes.push('Personal Data');
    if (description.includes('financial')) dataTypes.push('Financial Data');
    if (description.includes('health')) dataTypes.push('Health Data');
    if (description.includes('biometric')) dataTypes.push('Biometric Data');
    
    return dataTypes.length > 0 ? dataTypes : ['Personal Data'];
  }

  private categorizePrivacyRisk(stigRule: StigRule): string {
    const title = stigRule.title.toLowerCase();
    if (title.includes('access') || title.includes('authentication')) return 'Access Control';
    if (title.includes('encryption') || title.includes('cryptographic')) return 'Data Protection';
    if (title.includes('audit') || title.includes('logging')) return 'Monitoring';
    if (title.includes('backup') || title.includes('recovery')) return 'Data Management';
    return 'General Privacy';
  }

  private buildPrivacyRiskDescription(stigRule: StigRule, finding: Finding): string {
    return `Privacy risk identified: ${stigRule.ruleTitle || stigRule.title}. ${finding.description || 'No additional details available.'}`;
  }

  private identifyPrivacyControls(stigRule: StigRule): string[] {
    const controls = [];
    const title = stigRule.title.toLowerCase();
    
    if (title.includes('encryption')) controls.push('Data Encryption');
    if (title.includes('access')) controls.push('Access Controls');
    if (title.includes('audit')) controls.push('Audit Logging');
    if (title.includes('backup')) controls.push('Data Backup');
    
    return controls.length > 0 ? controls : ['General Privacy Controls'];
  }

  private buildPrivacyMitigationStrategy(stigRule: StigRule, finding: Finding): string {
    return `Implement privacy controls for ${stigRule.ruleTitle || stigRule.title} to address identified privacy risk.`;
  }

  private calculatePrivacyMitigationDueDate(riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical'): string {
    const days = { 'Low': 30, 'Moderate': 14, 'High': 7, 'Critical': 3 };
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days[riskLevel]);
    return dueDate.toISOString().split('T')[0];
  }

  private identifyPrivacyControl(control: Control): any {
    const title = control.title.toLowerCase();
    
    if (title.includes('encryption')) {
      return {
        title: 'Data Encryption',
        description: 'Encrypt personal data at rest and in transit',
        type: 'Technical' as const,
        dataTypes: ['Personal Data', 'Sensitive Personal Data'],
        riskMitigation: ['Data Breach', 'Unauthorized Access']
      };
    }
    
    if (title.includes('access')) {
      return {
        title: 'Access Controls',
        description: 'Implement role-based access controls for personal data',
        type: 'Technical' as const,
        dataTypes: ['Personal Data', 'Sensitive Personal Data'],
        riskMitigation: ['Unauthorized Access', 'Data Misuse']
      };
    }
    
    return null;
  }

  private mapImplementationStatus(status: string): 'Implemented' | 'Partially Implemented' | 'Not Implemented' {
    if (status === 'compliant') return 'Implemented';
    if (status === 'partially-compliant') return 'Partially Implemented';
    return 'Not Implemented';
  }

  private assessControlEffectiveness(control: Control, findings: Finding[]): 'High' | 'Medium' | 'Low' {
    const relatedFindings = findings.filter(f => 
      f.description?.toLowerCase().includes(control.title.toLowerCase())
    );
    
    if (relatedFindings.length === 0) return 'High';
    if (relatedFindings.length < 3) return 'Medium';
    return 'Low';
  }
}











