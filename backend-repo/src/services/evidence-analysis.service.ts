// Evidence Analysis Service
// Analyzes uploaded evidence files to determine control implementation status

import { storage } from '../storage';
import { modelRouter as llmService } from '../llm/model-router';
import type {
  System, Control, Evidence, Finding, Artifact,
  ComplianceStatusType, EvidenceStatusType
} from '../schema';

export interface EvidenceAnalysisResult {
  evidenceId: string;
  controlId: string;
  analysisType: 'document' | 'scan_result' | 'configuration' | 'audit_log' | 'screenshot';
  implementationStatus: EvidenceStatusType;
  confidence: number; // 0-100
  keyFindings: string[];
  gaps: string[];
  recommendations: string[];
  extractedData: {
    policies?: string[];
    procedures?: string[];
    technologies?: string[];
    configurations?: Record<string, any>;
    testResults?: {
      passed: number;
      failed: number;
      details: string[];
    };
  };
  controlCoverage: {
    requirements: string[];
    addressed: string[];
    notAddressed: string[];
    coveragePercentage: number;
  };
  metadata: {
    analyzedAt: Date;
    analysisMethod: 'automated' | 'hybrid' | 'manual';
    llmModel?: string;
    processingTime: number;
  };
}

export interface BulkAnalysisResult {
  systemId: string;
  totalEvidence: number;
  analyzedEvidence: number;
  results: Map<string, EvidenceAnalysisResult>;
  controlStatusUpdates: Map<string, {
    oldStatus: ComplianceStatusType;
    newStatus: ComplianceStatusType;
    confidence: number;
  }>;
  summary: {
    highConfidenceImplemented: number;
    partiallyImplemented: number;
    notImplemented: number;
    needsReview: number;
  };
}

export interface AnalysisOptions {
  useAI: boolean;
  deepAnalysis: boolean;
  updateControlStatus: boolean;
  confidenceThreshold: number; // 0-100, min confidence to update status
  analyzeRelatedFindings: boolean;
  generateRecommendations: boolean;
}

export class EvidenceAnalysisService {
  private readonly DEFAULT_OPTIONS: AnalysisOptions = {
    useAI: true,
    deepAnalysis: true,
    updateControlStatus: false,
    confidenceThreshold: 80,
    analyzeRelatedFindings: true,
    generateRecommendations: true
  };

  /**
   * Analyze a single piece of evidence for control implementation
   */
  async analyzeEvidence(
    evidenceId: string,
    options: Partial<AnalysisOptions> = {}
  ): Promise<EvidenceAnalysisResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    // Get evidence details
    const evidence = await storage.getEvidenceItem(evidenceId);
    if (!evidence) {
      throw new Error(`Evidence with ID ${evidenceId} not found`);
    }

    // Get control details
    const control = await storage.getControl(evidence.controlId);
    if (!control) {
      throw new Error(`Control ${evidence.controlId} not found`);
    }

    // Get related artifacts if any
    const artifacts = evidence.artifactId ? 
      [await storage.getArtifact(evidence.artifactId)] :
      [];

    // Perform analysis based on evidence type
    let analysisResult: EvidenceAnalysisResult;
    
    switch (evidence.type) {
      case 'document':
        analysisResult = await this.analyzeDocumentEvidence(evidence, control, artifacts, opts);
        break;
      case 'scan_result':
        analysisResult = await this.analyzeScanEvidence(evidence, control, artifacts, opts);
        break;
      case 'configuration':
        analysisResult = await this.analyzeConfigurationEvidence(evidence, control, artifacts, opts);
        break;
      case 'audit_log':
        analysisResult = await this.analyzeAuditLogEvidence(evidence, control, artifacts, opts);
        break;
      case 'screenshot':
        analysisResult = await this.analyzeScreenshotEvidence(evidence, control, artifacts, opts);
        break;
      default:
        analysisResult = await this.performGenericAnalysis(evidence, control, artifacts, opts);
    }

    // Add metadata
    analysisResult.metadata = {
      analyzedAt: new Date(),
      analysisMethod: opts.useAI ? 'automated' : 'manual',
      llmModel: opts.useAI ? 'gpt-4' : undefined,
      processingTime: Date.now() - startTime
    };

    // Update control status if enabled and confidence is high enough
    if (opts.updateControlStatus && analysisResult.confidence >= opts.confidenceThreshold) {
      await this.updateControlImplementationStatus(
        evidence.systemId, 
        control.id, 
        analysisResult
      );
    }

    return analysisResult;
  }

  /**
   * Analyze all evidence for a system
   */
  async analyzeSystemEvidence(
    systemId: string,
    options: Partial<AnalysisOptions> = {}
  ): Promise<BulkAnalysisResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Get all evidence for the system
    const allEvidence = await storage.getEvidenceBySystem(systemId);
    
    const results = new Map<string, EvidenceAnalysisResult>();
    const controlStatusUpdates = new Map<string, any>();
    
    // Analyze each piece of evidence
    for (const evidence of allEvidence) {
      try {
        const result = await this.analyzeEvidence(evidence.id, opts);
        results.set(evidence.id, result);
        
        // Track control status changes
        if (opts.updateControlStatus && result.confidence >= opts.confidenceThreshold) {
          const currentStatus = await this.getCurrentControlStatus(systemId, evidence.controlId);
          const newStatus = this.determineControlStatus(result);
          
          if (currentStatus !== newStatus) {
            controlStatusUpdates.set(evidence.controlId, {
              oldStatus: currentStatus,
              newStatus: newStatus,
              confidence: result.confidence
            });
          }
        }
      } catch (error) {
        console.error(`Failed to analyze evidence ${evidence.id}:`, error);
      }
    }
    
    // Calculate summary
    const analysisResults = Array.from(results.values());
    const summary = {
      highConfidenceImplemented: analysisResults.filter(r => 
        r.implementationStatus === 'satisfies' && r.confidence >= 80
      ).length,
      partiallyImplemented: analysisResults.filter(r => 
        r.implementationStatus === 'partially_satisfies'
      ).length,
      notImplemented: analysisResults.filter(r => 
        r.implementationStatus === 'does_not_satisfy'
      ).length,
      needsReview: analysisResults.filter(r => 
        r.confidence < 60
      ).length
    };
    
    return {
      systemId,
      totalEvidence: allEvidence.length,
      analyzedEvidence: results.size,
      results,
      controlStatusUpdates,
      summary
    };
  }

  /**
   * Analyze document evidence (policies, procedures, plans)
   */
  private async analyzeDocumentEvidence(
    evidence: Evidence,
    control: Control,
    artifacts: (Artifact | null)[],
    options: AnalysisOptions
  ): Promise<EvidenceAnalysisResult> {
    const validArtifacts = artifacts.filter(a => a !== null) as Artifact[];
    
    if (options.useAI && validArtifacts.length > 0) {
      // Use LLM to analyze document content
      const documentContent = this.extractDocumentContent(validArtifacts);
      
      const prompt = `Analyze the following evidence to determine if it satisfies NIST control ${control.id}: ${control.title}.

Control Description: ${control.description}
Requirements: ${control.requirements || 'N/A'}
Objective: N/A

Evidence Type: document
Evidence Content:
${documentContent}

Provide analysis in JSON format with: implementationStatus, confidence (0-100), keyFindings, gaps, recommendations, extractedData, and controlCoverage.`;
      
      const llmAnalysis = await llmService.generateJSON([{ role: 'user', content: prompt }]);
      return this.parseAIAnalysisResult(evidence, control, llmAnalysis);
    }
    
    // Fallback to rule-based analysis
    return this.performRuleBasedDocumentAnalysis(evidence, control, validArtifacts);
  }

  /**
   * Analyze scan results evidence
   */
  private async analyzeScanEvidence(
    evidence: Evidence,
    control: Control,
    artifacts: (Artifact | null)[],
    options: AnalysisOptions
  ): Promise<EvidenceAnalysisResult> {
    // Get related findings
    const findings = await storage.getFindingsByControl(control.id);
    const systemFindings = findings.filter(f => f.systemId === evidence.systemId);
    
    // Analyze findings to determine implementation status
    const openFindings = systemFindings.filter(f => f.status === 'open');
    const criticalFindings = openFindings.filter(f => f.severity === 'critical' || f.severity === 'high');
    
    let implementationStatus: EvidenceStatusType;
    let confidence: number;
    
    if (systemFindings.length === 0) {
      // No findings - likely compliant
      implementationStatus = 'satisfies';
      confidence = 85;
    } else if (openFindings.length === 0) {
      // All findings resolved
      implementationStatus = 'satisfies';
      confidence = 90;
    } else if (criticalFindings.length > 0) {
      // Critical findings present
      implementationStatus = 'does_not_satisfy';
      confidence = 95;
    } else {
      // Some non-critical findings
      implementationStatus = 'partially_satisfies';
      confidence = 80;
    }
    
    const keyFindings = this.summarizeFindings(systemFindings);
    const gaps = openFindings.map(f => `${f.severity}: ${f.title}`);
    const recommendations = this.generateFindingRecommendations(openFindings);
    
    return {
      evidenceId: evidence.id,
      controlId: control.id,
      analysisType: 'scan_result',
      implementationStatus,
      confidence,
      keyFindings,
      gaps,
      recommendations,
      extractedData: {
        testResults: {
          passed: systemFindings.length - openFindings.length,
          failed: openFindings.length,
          details: keyFindings
        }
      },
      controlCoverage: {
        requirements: this.extractControlRequirements(control),
        addressed: this.determineAddressedRequirements(control, systemFindings),
        notAddressed: this.determineGapRequirements(control, systemFindings),
        coveragePercentage: this.calculateCoveragePercentage(control, systemFindings)
      },
      metadata: {} as any // Will be filled by caller
    };
  }

  /**
   * Analyze configuration evidence
   */
  private async analyzeConfigurationEvidence(
    evidence: Evidence,
    control: Control,
    artifacts: (Artifact | null)[],
    options: AnalysisOptions
  ): Promise<EvidenceAnalysisResult> {
    const validArtifacts = artifacts.filter(a => a !== null) as Artifact[];
    
    // Extract configuration data from artifacts
    const configurations = this.extractConfigurations(validArtifacts);
    
    if (options.useAI && configurations.length > 0) {
      // Use AI to analyze configurations against control requirements
      const configAnalysis = await this.analyzeConfigurationsWithAI(
        control,
        configurations,
        options
      );
      return configAnalysis;
    }
    
    // Rule-based configuration analysis
    return this.performRuleBasedConfigAnalysis(evidence, control, configurations);
  }

  /**
   * Analyze audit log evidence
   */
  private async analyzeAuditLogEvidence(
    evidence: Evidence,
    control: Control,
    artifacts: (Artifact | null)[],
    options: AnalysisOptions
  ): Promise<EvidenceAnalysisResult> {
    const validArtifacts = artifacts.filter(a => a !== null) as Artifact[];
    
    // Extract audit events
    const auditEvents = this.extractAuditEvents(validArtifacts);
    
    // Analyze audit coverage and compliance
    const auditAnalysis = this.analyzeAuditCoverage(control, auditEvents);
    
    return {
      evidenceId: evidence.id,
      controlId: control.id,
      analysisType: 'audit_log',
      implementationStatus: auditAnalysis.status,
      confidence: auditAnalysis.confidence,
      keyFindings: auditAnalysis.findings,
      gaps: auditAnalysis.gaps,
      recommendations: auditAnalysis.recommendations,
      extractedData: {
        testResults: {
          passed: auditAnalysis.compliantEvents,
          failed: auditAnalysis.nonCompliantEvents,
          details: auditAnalysis.findings
        }
      },
      controlCoverage: {
        requirements: this.extractControlRequirements(control),
        addressed: auditAnalysis.coveredRequirements,
        notAddressed: auditAnalysis.uncoveredRequirements,
        coveragePercentage: auditAnalysis.coveragePercentage
      },
      metadata: {} as any
    };
  }

  /**
   * Analyze screenshot evidence
   */
  private async analyzeScreenshotEvidence(
    evidence: Evidence,
    control: Control,
    artifacts: (Artifact | null)[],
    options: AnalysisOptions
  ): Promise<EvidenceAnalysisResult> {
    // Screenshots require manual review or advanced AI
    const confidence = options.useAI ? 60 : 30;
    
    return {
      evidenceId: evidence.id,
      controlId: control.id,
      analysisType: 'screenshot',
      implementationStatus: 'partially_satisfies',
      confidence,
      keyFindings: ['Screenshot evidence requires manual review for full validation'],
      gaps: ['Automated analysis of screenshots is limited'],
      recommendations: ['Manual review recommended to confirm implementation details'],
      extractedData: {},
      controlCoverage: {
        requirements: this.extractControlRequirements(control),
        addressed: [],
        notAddressed: [],
        coveragePercentage: 0
      },
      metadata: {} as any
    };
  }

  /**
   * Generic analysis for other evidence types
   */
  private async performGenericAnalysis(
    evidence: Evidence,
    control: Control,
    artifacts: (Artifact | null)[],
    options: AnalysisOptions
  ): Promise<EvidenceAnalysisResult> {
    // Basic analysis based on evidence metadata
    const hasArtifacts = artifacts.filter(a => a !== null).length > 0;
    const confidence = hasArtifacts ? 50 : 30;
    
    return {
      evidenceId: evidence.id,
      controlId: control.id,
      analysisType: evidence.type as any,
      implementationStatus: 'partially_satisfies',
      confidence,
      keyFindings: [`Evidence type '${evidence.type}' analyzed with basic rules`],
      gaps: ['Detailed analysis not available for this evidence type'],
      recommendations: ['Consider providing additional evidence types for comprehensive analysis'],
      extractedData: {},
      controlCoverage: {
        requirements: this.extractControlRequirements(control),
        addressed: [],
        notAddressed: this.extractControlRequirements(control),
        coveragePercentage: 0
      },
      metadata: {} as any
    };
  }

  // Helper methods

  private extractDocumentContent(artifacts: Artifact[]): string {
    return artifacts
      .map(a => {
        const content = (a.metadata as any)?.extractedText || (a.metadata as any)?.content;
        return content || `File: ${a.name}`;
      })
      .join('\n\n---\n\n');
  }

  private extractConfigurations(artifacts: Artifact[]): any[] {
    const configs = [];
    for (const artifact of artifacts) {
      const content = (artifact.metadata as any)?.extractedText || (artifact.metadata as any)?.content;
      if (content) {
        try {
          // Try to parse as JSON
          const config = JSON.parse(content);
          configs.push(config);
        } catch {
          // Try to parse as key-value pairs
          const kvPairs = this.parseKeyValueConfig(content);
          if (Object.keys(kvPairs).length > 0) {
            configs.push(kvPairs);
          }
        }
      }
    }
    return configs;
  }

  private parseKeyValueConfig(content: string): Record<string, string> {
    const config: Record<string, string> = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          config[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    
    return config;
  }

  private extractAuditEvents(artifacts: Artifact[]): any[] {
    const events = [];
    for (const artifact of artifacts) {
      const content = (artifact.metadata as any)?.extractedText || (artifact.metadata as any)?.content;
      if (content) {
        // Parse audit logs (simplified - real implementation would handle various formats)
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            events.push({
              raw: line,
              timestamp: this.extractTimestamp(line),
              action: this.extractAction(line),
              user: this.extractUser(line),
              result: this.extractResult(line)
            });
          }
        }
      }
    }
    return events;
  }

  private extractTimestamp(logLine: string): Date | null {
    // Simple timestamp extraction - would need more sophisticated parsing
    const timestampMatch = logLine.match(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/);
    return timestampMatch ? new Date(timestampMatch[0]) : null;
  }

  private extractAction(logLine: string): string {
    // Extract action keywords
    const actionKeywords = ['login', 'logout', 'create', 'delete', 'modify', 'access', 'denied', 'granted'];
    for (const keyword of actionKeywords) {
      if (logLine.toLowerCase().includes(keyword)) {
        return keyword;
      }
    }
    return 'unknown';
  }

  private extractUser(logLine: string): string {
    // Simple user extraction
    const userMatch = logLine.match(/user[:\s]+(\S+)/i);
    return userMatch ? userMatch[1] : 'unknown';
  }

  private extractResult(logLine: string): 'success' | 'failure' | 'unknown' {
    if (logLine.toLowerCase().includes('success') || logLine.toLowerCase().includes('granted')) {
      return 'success';
    }
    if (logLine.toLowerCase().includes('fail') || logLine.toLowerCase().includes('denied')) {
      return 'failure';
    }
    return 'unknown';
  }

  private analyzeAuditCoverage(control: Control, auditEvents: any[]): any {
    // Analyze audit events for control compliance
    const requiredEvents = this.getRequiredAuditEvents(control);
    const coveredEvents = new Set<string>();
    const findings: string[] = [];
    const gaps: string[] = [];
    
    // Check for required audit events
    for (const required of requiredEvents) {
      const found = auditEvents.some(e => e.action === required);
      if (found) {
        coveredEvents.add(required);
        findings.push(`Audit logs show ${required} events are being captured`);
      } else {
        gaps.push(`No ${required} events found in audit logs`);
      }
    }
    
    // Analyze event patterns
    const failureRate = this.calculateFailureRate(auditEvents);
    if (failureRate > 0.1) {
      gaps.push(`High failure rate detected: ${(failureRate * 100).toFixed(1)}%`);
    }
    
    const coveragePercentage = requiredEvents.length > 0 ? 
      (coveredEvents.size / requiredEvents.length) * 100 : 0;
    
    let status: EvidenceStatusType;
    let confidence: number;
    
    if (coveragePercentage >= 90) {
      status = 'satisfies';
      confidence = 85;
    } else if (coveragePercentage >= 70) {
      status = 'partially_satisfies';
      confidence = 75;
    } else {
      status = 'does_not_satisfy';
      confidence = 90;
    }
    
    return {
      status,
      confidence,
      findings,
      gaps,
      recommendations: this.generateAuditRecommendations(gaps),
      coveredRequirements: Array.from(coveredEvents),
      uncoveredRequirements: requiredEvents.filter(r => !coveredEvents.has(r)),
      coveragePercentage,
      compliantEvents: auditEvents.filter(e => e.result === 'success').length,
      nonCompliantEvents: auditEvents.filter(e => e.result === 'failure').length
    };
  }

  private getRequiredAuditEvents(control: Control): string[] {
    // Map control families to required audit events
    const auditRequirements: Record<string, string[]> = {
      'AC': ['login', 'logout', 'access'],
      'AU': ['create', 'modify', 'delete', 'access'],
      'IA': ['login', 'logout'],
      'SC': ['access', 'denied'],
    };
    
    return auditRequirements[control.family] || ['access'];
  }

  private calculateFailureRate(events: any[]): number {
    if (events.length === 0) return 0;
    const failures = events.filter(e => e.result === 'failure').length;
    return failures / events.length;
  }

  private generateAuditRecommendations(gaps: string[]): string[] {
    const recommendations: string[] = [];
    
    if (gaps.some(g => g.includes('No login events'))) {
      recommendations.push('Enable authentication logging for all system access');
    }
    if (gaps.some(g => g.includes('High failure rate'))) {
      recommendations.push('Investigate and address high rate of failed operations');
    }
    if (gaps.length > 2) {
      recommendations.push('Expand audit logging coverage to capture all required events');
    }
    
    return recommendations;
  }

  private summarizeFindings(findings: Finding[]): string[] {
    const summary: string[] = [];
    
    const bySeverity = findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(bySeverity).forEach(([severity, count]) => {
      summary.push(`${count} ${severity} severity findings identified`);
    });
    
    return summary;
  }

  private generateFindingRecommendations(findings: Finding[]): string[] {
    const recommendations: string[] = [];
    
    const critical = findings.filter(f => f.severity === 'critical');
    if (critical.length > 0) {
      recommendations.push('Address critical findings immediately to reduce risk');
    }
    
    const highCount = findings.filter(f => f.severity === 'high').length;
    if (highCount > 3) {
      recommendations.push('Develop remediation plan for high severity findings');
    }
    
    return recommendations;
  }

  private extractControlRequirements(control: Control): string[] {
    // Extract requirements from control description and requirements field
    const requirements: string[] = [];
    
    if (control.requirements) {
      // Parse requirements text
      const reqLines = control.requirements.split('\n');
      for (const line of reqLines) {
        if (line.trim() && !line.startsWith('#')) {
          requirements.push(line.trim());
        }
      }
    }
    
    return requirements;
  }

  private determineAddressedRequirements(control: Control, findings: Finding[]): string[] {
    // Simplified - in reality would map findings to specific requirements
    const requirements = this.extractControlRequirements(control);
    if (findings.filter(f => f.status === 'open').length === 0) {
      return requirements; // All addressed if no open findings
    }
    return requirements.slice(0, Math.floor(requirements.length / 2));
  }

  private determineGapRequirements(control: Control, findings: Finding[]): string[] {
    const all = this.extractControlRequirements(control);
    const addressed = this.determineAddressedRequirements(control, findings);
    return all.filter(r => !addressed.includes(r));
  }

  private calculateCoveragePercentage(control: Control, findings: Finding[]): number {
    const requirements = this.extractControlRequirements(control);
    if (requirements.length === 0) return 100;
    
    const addressed = this.determineAddressedRequirements(control, findings);
    return Math.round((addressed.length / requirements.length) * 100);
  }

  private async parseAIAnalysisResult(
    evidence: Evidence,
    control: Control,
    llmResponse: any
  ): Promise<EvidenceAnalysisResult> {
    // Parse LLM response into structured result
    try {
      const parsed = typeof llmResponse === 'string' ? JSON.parse(llmResponse) : llmResponse;
      return {
        evidenceId: evidence.id,
        controlId: control.id,
        analysisType: evidence.type as any,
        implementationStatus: parsed.implementationStatus || 'partially_satisfies',
        confidence: parsed.confidence || 70,
        keyFindings: parsed.keyFindings || [],
        gaps: parsed.gaps || [],
        recommendations: parsed.recommendations || [],
        extractedData: parsed.extractedData || {},
        controlCoverage: parsed.controlCoverage || {
          requirements: [],
          addressed: [],
          notAddressed: [],
          coveragePercentage: 0
        },
        metadata: {} as any
      };
    } catch (error) {
      // Fallback if parsing fails
      return this.performGenericAnalysis(evidence, control, [], { useAI: false } as any);
    }
  }

  private async performRuleBasedDocumentAnalysis(
    evidence: Evidence,
    control: Control,
    artifacts: Artifact[]
  ): Promise<EvidenceAnalysisResult> {
    // Simple keyword-based analysis
    const content = artifacts.map(a => {
      const text = (a.metadata as any)?.extractedText || (a.metadata as any)?.content;
      return text || '';
    }).join(' ').toLowerCase();
    const keywords = this.getControlKeywords(control);
    
    const foundKeywords = keywords.filter(k => content.includes(k.toLowerCase()));
    const coverage = keywords.length > 0 ? (foundKeywords.length / keywords.length) * 100 : 0;
    
    let status: EvidenceStatusType;
    if (coverage >= 80) status = 'satisfies';
    else if (coverage >= 50) status = 'partially_satisfies';
    else status = 'does_not_satisfy';
    
    return {
      evidenceId: evidence.id,
      controlId: control.id,
      analysisType: 'document',
      implementationStatus: status,
      confidence: Math.min(coverage, 70), // Cap confidence for rule-based analysis
      keyFindings: [`Document contains ${foundKeywords.length} of ${keywords.length} expected keywords`],
      gaps: keywords.filter(k => !foundKeywords.includes(k)).map(k => `Missing coverage for: ${k}`),
      recommendations: ['Consider AI-based analysis for more accurate assessment'],
      extractedData: {
        policies: foundKeywords.filter(k => k.includes('policy')),
        procedures: foundKeywords.filter(k => k.includes('procedure'))
      },
      controlCoverage: {
        requirements: keywords,
        addressed: foundKeywords,
        notAddressed: keywords.filter(k => !foundKeywords.includes(k)),
        coveragePercentage: Math.round(coverage)
      },
      metadata: {} as any
    };
  }

  private getControlKeywords(control: Control): string[] {
    // Extract keywords based on control family
    const familyKeywords: Record<string, string[]> = {
      'AC': ['access control', 'authentication', 'authorization', 'permissions'],
      'AU': ['audit', 'logging', 'monitoring', 'review'],
      'IA': ['identification', 'authentication', 'credentials', 'multi-factor'],
      'SC': ['encryption', 'protection', 'cryptography', 'secure']
    };
    
    const keywords = familyKeywords[control.family] || [];
    
    // Add control-specific keywords from title
    const titleWords = control.title.split(' ')
      .filter(w => w.length > 4)
      .map(w => w.toLowerCase());
    
    return [...keywords, ...titleWords];
  }

  private async analyzeConfigurationsWithAI(
    control: Control,
    configurations: any[],
    options: AnalysisOptions
  ): Promise<EvidenceAnalysisResult> {
    const configSummary = JSON.stringify(configurations, null, 2);
    
    const prompt = `Analyze system configurations to determine compliance with NIST control ${control.id}: ${control.title}.

Control Requirements:
${control.requirements || 'N/A'}

System Configurations:
${configSummary}

Review the configurations and provide analysis in JSON format with: implementationStatus, confidence (0-100), keyFindings, gaps, recommendations, extractedData, and controlCoverage.`;
    
    const analysis = await llmService.generateJSON([{ role: 'user', content: prompt }]);
    return this.parseAIAnalysisResult(
      { id: 'temp', controlId: control.id } as Evidence,
      control,
      analysis
    );
  }

  private performRuleBasedConfigAnalysis(
    evidence: Evidence,
    control: Control,
    configurations: any[]
  ): Promise<EvidenceAnalysisResult> {
    // Analyze configurations based on control requirements
    const requiredSettings = this.getRequiredSettings(control);
    const findings: string[] = [];
    const gaps: string[] = [];
    
    let compliantSettings = 0;
    for (const required of requiredSettings) {
      const found = this.findSetting(configurations, required.key);
      if (found && this.validateSetting(found, required)) {
        compliantSettings++;
        findings.push(`${required.key} is properly configured`);
      } else {
        gaps.push(`${required.key} is missing or misconfigured`);
      }
    }
    
    const compliance = requiredSettings.length > 0 ? 
      (compliantSettings / requiredSettings.length) * 100 : 0;
    
    return Promise.resolve({
      evidenceId: evidence.id,
      controlId: control.id,
      analysisType: 'configuration',
      implementationStatus: compliance >= 80 ? 'satisfies' : 
                           compliance >= 50 ? 'partially_satisfies' : 
                           'does_not_satisfy',
      confidence: 75,
      keyFindings: findings,
      gaps,
      recommendations: gaps.map(g => `Configure ${g}`),
      extractedData: {
        configurations: configurations[0] || {}
      },
      controlCoverage: {
        requirements: requiredSettings.map(s => s.key),
        addressed: findings.map(f => f.split(' ')[0]),
        notAddressed: gaps.map(g => g.split(' ')[0]),
        coveragePercentage: Math.round(compliance)
      },
      metadata: {} as any
    });
  }

  private getRequiredSettings(control: Control): Array<{key: string, value?: any}> {
    // Map control families to common required settings
    const settingsMap: Record<string, Array<{key: string, value?: any}>> = {
      'AC': [
        { key: 'password_policy_enabled', value: true },
        { key: 'session_timeout', value: 900 },
        { key: 'failed_login_attempts', value: 5 }
      ],
      'AU': [
        { key: 'audit_enabled', value: true },
        { key: 'log_retention_days', value: 90 }
      ],
      'SC': [
        { key: 'encryption_enabled', value: true },
        { key: 'tls_version', value: '1.2' }
      ]
    };
    
    return settingsMap[control.family] || [];
  }

  private findSetting(configurations: any[], key: string): any {
    for (const config of configurations) {
      if (config[key] !== undefined) {
        return config[key];
      }
      // Check nested objects
      for (const [k, v] of Object.entries(config)) {
        if (typeof v === 'object' && v !== null) {
          const nested = this.findSetting([v], key);
          if (nested !== undefined) return nested;
        }
      }
    }
    return undefined;
  }

  private validateSetting(value: any, required: {key: string, value?: any}): boolean {
    if (required.value === undefined) return true;
    
    if (typeof required.value === 'number') {
      return Number(value) >= required.value;
    }
    
    return String(value) === String(required.value);
  }

  private async getCurrentControlStatus(
    systemId: string,
    controlId: string
  ): Promise<ComplianceStatusType> {
    // Get current control status from evidence or system controls
    const evidence = await storage.getEvidenceByControl(controlId);
    const systemEvidence = evidence.filter(e => e.systemId === systemId);
    
    if (systemEvidence.length === 0) return 'not-assessed';
    
    // Determine status based on evidence
    const satisfies = systemEvidence.filter(e => e.status === 'satisfies').length;
    const partial = systemEvidence.filter(e => e.status === 'partially_satisfies').length;
    
    if (satisfies === systemEvidence.length) return 'compliant';
    if (satisfies + partial === systemEvidence.length && partial > 0) return 'in-progress';
    return 'non-compliant';
  }

  private determineControlStatus(analysis: EvidenceAnalysisResult): ComplianceStatusType {
    if (analysis.implementationStatus === 'satisfies' && analysis.confidence >= 80) {
      return 'compliant';
    }
    if (analysis.implementationStatus === 'partially_satisfies') {
      return 'in-progress';
    }
    if (analysis.implementationStatus === 'does_not_satisfy') {
      return 'non-compliant';
    }
    return 'not-assessed';
  }

  private async updateControlImplementationStatus(
    systemId: string,
    controlId: string,
    analysis: EvidenceAnalysisResult
  ): Promise<void> {
    // Update control status based on analysis
    const newStatus = this.determineControlStatus(analysis);
    
    // Note: This would require schema update to track control status per system
    console.log(`Control ${controlId} for system ${systemId} status: ${newStatus} (confidence: ${analysis.confidence}%)`);
    
    // Update evidence record with analysis results
    await storage.updateEvidence(analysis.evidenceId, {
      assessorNotes: `Automated analysis: ${analysis.keyFindings.join('; ')}`,
      status: analysis.implementationStatus
    });
  }
}

// Export singleton instance
export const evidenceAnalysisService = new EvidenceAnalysisService();
