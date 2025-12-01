// STIG Evaluation Service
// Evaluates evidence against STIG rules and generates compliance scores

import { storage } from '../storage';
import { ScapParser } from '../parsers/scap-parser';
import { XCCDFParser, XCCDFRule } from '../parsers/xccdf-parser';
import { evidenceAnalysisService } from './evidence-analysis.service';
import { processingProgressTracker } from './processing-progress-tracker';
import type { Artifact, Evidence, StigRule, System } from "../schema";
import crypto from 'crypto';

export interface TechnicalFinding {
  type: 'port' | 'service' | 'package' | 'configuration' | 'permission' | 'other';
  value: string;
  context?: string;
  relatedRules: string[];
}

export interface STIGRuleEvaluation {
  ruleId: string;
  ruleTitle: string;
  severity: string;
  status: 'pass' | 'fail' | 'not_evaluated' | 'not_applicable';
  finding?: string;
  evidence?: string;
  technicalData?: any;
  fixText?: string;
}

export interface STIGEvaluationResult {
  artifactId: string;
  systemId: string;
  stigProfile: string;
  benchmarkVersion?: string;
  evaluatedRules: STIGRuleEvaluation[];
  complianceScore: number;
  technicalFindings: TechnicalFinding[];
  categorizedResults: {
    passed: number;
    failed: number;
    notEvaluated: number;
    notApplicable: number;
    catI: { total: number; failed: number };
    catII: { total: number; failed: number };
    catIII: { total: number; failed: number };
  };
  processingTime: number;
  evaluatedAt: Date;
}

export interface STIGEvaluationOptions {
  includeNotApplicable?: boolean;
  extractTechnicalData?: boolean;
  generateNarratives?: boolean;
  jobId?: string;
}

export class STIGEvaluationService {
  private scapParser: ScapParser;
  
  constructor() {
    this.scapParser = new ScapParser();
  }

  /**
   * Evaluate an artifact against system STIG profiles
   */
  async evaluateArtifact(
    artifact: Artifact,
    system: System,
    options: STIGEvaluationOptions = {}
  ): Promise<STIGEvaluationResult | null> {
    const startTime = Date.now();
    
    // Check if system has STIG profiles
    if (!system.stigProfiles || system.stigProfiles.length === 0) {
      console.log('System has no STIG profiles assigned, skipping evaluation');
      return null;
    }

    // Check if artifact is SCAP/XCCDF result
    if (!this.isSTIGEvaluatable(artifact)) {
      console.log('Artifact is not STIG evaluatable:', artifact.type);
      return null;
    }

    console.log(`Evaluating artifact ${artifact.name} against STIG profiles:`, system.stigProfiles);

    try {
      // Update progress if job tracking
      if (options.jobId) {
        processingProgressTracker.updateStep(options.jobId, 4, 0, {
          stepDetails: 'Evaluating STIG compliance from scan results'
        });
      }

      // Get artifact content
      const content = await storage.getArtifactContent(artifact.id);
      if (!content) {
        throw new Error('Unable to retrieve artifact content');
      }

      // Parse SCAP results
      const scapResults = await this.scapParser.parse(content.data);
      console.log(`Parsed SCAP results: ${scapResults.hosts.length} hosts, ${scapResults.totalVulnerabilities} findings`);

      // Get STIG rules for the system's profiles
      const stigRules = await this.getSTIGRulesForProfiles(system.stigProfiles);
      console.log(`Loaded ${stigRules.length} STIG rules from profiles`);

      // Extract technical data if requested
      let technicalFindings: TechnicalFinding[] = [];
      if (options.extractTechnicalData) {
        technicalFindings = await this.extractTechnicalFindings(artifact, scapResults);
      }

      // Evaluate each STIG rule against the scan results
      const evaluatedRules = await this.evaluateRules(
        stigRules,
        scapResults,
        technicalFindings,
        options
      );

      // Calculate compliance metrics
      const categorizedResults = this.categorizeResults(evaluatedRules);
      const complianceScore = this.calculateComplianceScore(categorizedResults);

      if (options.jobId) {
        processingProgressTracker.updateStep(options.jobId, 4, 100, {
          stigRulesEvaluated: evaluatedRules.length,
          complianceScore: complianceScore
        });
      }

      const result: STIGEvaluationResult = {
        artifactId: artifact.id,
        systemId: system.id,
        stigProfile: system.stigProfiles[0], // Primary profile
        benchmarkVersion: scapResults.scannerVersion,
        evaluatedRules,
        complianceScore,
        technicalFindings,
        categorizedResults,
        processingTime: Date.now() - startTime,
        evaluatedAt: new Date()
      };

      return result;

    } catch (error) {
      console.error('STIG evaluation error:', error);
      throw error;
    }
  }

  /**
   * Check if artifact can be evaluated for STIG compliance
   */
  private isSTIGEvaluatable(artifact: Artifact): boolean {
    // Check file type
    const evaluatableTypes = ['scan_results', 'assessment_report', 'test_results'];
    if (!evaluatableTypes.includes(artifact.type)) {
      return false;
    }

    // Check file extension or mime type
    const fileName = artifact.name?.toLowerCase() || '';
    const mimeType = artifact.mimeType?.toLowerCase() || '';
    
    return fileName.endsWith('.xml') || 
           fileName.endsWith('.xccdf') ||
           fileName.includes('scap') ||
           fileName.includes('stig') ||
           mimeType.includes('xml');
  }

  /**
   * Get STIG rules for the specified profiles
   */
  private async getSTIGRulesForProfiles(profiles: string[]): Promise<StigRule[]> {
    const rules: StigRule[] = [];
    
    for (const profile of profiles) {
      // Get rules from database
      const profileRules = await storage.getSTIGRulesByProfile(profile);
      rules.push(...profileRules);
    }

    return rules;
  }

  /**
   * Extract technical findings from artifact and scan results
   */
  private async extractTechnicalFindings(
    artifact: Artifact,
    scapResults: any
  ): Promise<TechnicalFinding[]> {
    const findings: TechnicalFinding[] = [];
    
    // Use existing evidence analysis service
    const configurations = await evidenceAnalysisService.extractConfigurations({
      id: artifact.id,
      content: JSON.stringify(scapResults),
      type: 'scan_results'
    } as any);

    // Convert to technical findings format
    if (configurations.ports.length > 0) {
      configurations.ports.forEach(port => {
        findings.push({
          type: 'port',
          value: port,
          relatedRules: []
        });
      });
    }

    if (configurations.services.length > 0) {
      configurations.services.forEach(service => {
        findings.push({
          type: 'service',
          value: service,
          relatedRules: []
        });
      });
    }

    // Extract additional technical data from SCAP vulnerabilities
    scapResults.hosts.forEach((host: any) => {
      host.vulnerabilities.forEach((vuln: any) => {
        // Extract package information
        if (vuln.title?.includes('package') || vuln.description?.includes('package')) {
          const packageMatch = (vuln.title + ' ' + vuln.description).match(/(\w+)\s+package/i);
          if (packageMatch) {
            findings.push({
              type: 'package',
              value: packageMatch[1],
              context: vuln.title,
              relatedRules: vuln.stigId ? [vuln.stigId] : []
            });
          }
        }

        // Extract configuration issues
        if (vuln.vulnId && vuln.cci) {
          findings.push({
            type: 'configuration',
            value: vuln.vulnId,
            context: vuln.title,
            relatedRules: [vuln.vulnId]
          });
        }
      });
    });

    return findings;
  }

  /**
   * Evaluate STIG rules against scan results
   */
  private async evaluateRules(
    stigRules: StigRule[],
    scapResults: any,
    technicalFindings: TechnicalFinding[],
    options: STIGEvaluationOptions
  ): Promise<STIGRuleEvaluation[]> {
    const evaluations: STIGRuleEvaluation[] = [];
    
    // Create a map of SCAP findings by STIG rule ID for quick lookup
    const scapFindingsMap = new Map<string, any[]>();
    
    scapResults.hosts.forEach((host: any) => {
      host.vulnerabilities.forEach((vuln: any) => {
        if (vuln.stigId || vuln.vulnId) {
          const key = vuln.stigId || vuln.vulnId;
          if (!scapFindingsMap.has(key)) {
            scapFindingsMap.set(key, []);
          }
          scapFindingsMap.get(key)!.push(vuln);
        }
      });
    });

    // Evaluate each STIG rule
    for (const rule of stigRules) {
      const evaluation = await this.evaluateRule(
        rule,
        scapFindingsMap,
        technicalFindings,
        options
      );
      evaluations.push(evaluation);
    }

    return evaluations;
  }

  /**
   * Evaluate a single STIG rule
   */
  private async evaluateRule(
    rule: StigRule,
    scapFindingsMap: Map<string, any[]>,
    technicalFindings: TechnicalFinding[],
    options: STIGEvaluationOptions
  ): Promise<STIGRuleEvaluation> {
    // Check if rule was found in SCAP results
    const findings = scapFindingsMap.get(rule.ruleId) || [];
    
    let status: STIGRuleEvaluation['status'] = 'not_evaluated';
    let finding: string | undefined;
    let evidence: string | undefined;
    let technicalData: any = {};

    if (findings.length > 0) {
      // Rule was evaluated in SCAP scan
      const scapFinding = findings[0]; // Use first finding
      
      // Determine status based on SCAP result
      if (scapFinding.severity === 'info' || scapFinding.result === 'pass') {
        status = 'pass';
        evidence = 'SCAP scan indicates rule compliance';
      } else {
        status = 'fail';
        finding = scapFinding.description || scapFinding.title;
        evidence = scapFinding.evidence || 'SCAP scan found non-compliance';
      }
      
      technicalData = {
        scapResult: scapFinding.result,
        severity: scapFinding.severity,
        host: scapFinding.host
      };
    } else {
      // Try to infer from technical findings
      const relatedFindings = technicalFindings.filter(tf => 
        this.isFindingRelatedToRule(tf, rule)
      );
      
      if (relatedFindings.length > 0) {
        // Found related technical data
        status = this.inferStatusFromFindings(rule, relatedFindings);
        evidence = `Technical analysis found: ${relatedFindings.map(f => f.value).join(', ')}`;
        technicalData = { relatedFindings };
        
        // Update technical findings with rule association
        relatedFindings.forEach(tf => {
          if (!tf.relatedRules.includes(rule.ruleId)) {
            tf.relatedRules.push(rule.ruleId);
          }
        });
      }
    }

    return {
      ruleId: rule.ruleId,
      ruleTitle: rule.title,
      severity: rule.severity,
      status,
      finding,
      evidence,
      technicalData,
      fixText: rule.fixText
    };
  }

  /**
   * Check if a technical finding is related to a STIG rule
   */
  private isFindingRelatedToRule(finding: TechnicalFinding, rule: StigRule): boolean {
    const ruleText = (rule.title + ' ' + rule.description + ' ' + rule.checkText).toLowerCase();
    const findingValue = finding.value.toLowerCase();
    
    // Direct rule ID match
    if (finding.relatedRules.includes(rule.ruleId)) {
      return true;
    }
    
    // Pattern matching based on rule content
    switch (finding.type) {
      case 'package':
        return ruleText.includes(findingValue) || ruleText.includes('package');
        
      case 'service':
        return ruleText.includes(findingValue) || ruleText.includes('service');
        
      case 'port':
        return ruleText.includes(findingValue) || ruleText.includes('port');
        
      case 'configuration':
        return ruleText.includes('configuration') || ruleText.includes('setting');
        
      default:
        return false;
    }
  }

  /**
   * Infer compliance status from technical findings
   */
  private inferStatusFromFindings(
    rule: StigRule,
    findings: TechnicalFinding[]
  ): STIGRuleEvaluation['status'] {
    // This is a simplified inference - in production, would need more sophisticated logic
    const ruleText = rule.checkText.toLowerCase();
    
    // Check for negative patterns (things that should NOT exist)
    const negativePatterns = ['must not', 'should not', 'remove', 'disable', 'uninstall'];
    const hasNegativeRequirement = negativePatterns.some(pattern => ruleText.includes(pattern));
    
    if (hasNegativeRequirement && findings.length > 0) {
      // Found something that shouldn't exist
      return 'fail';
    } else if (!hasNegativeRequirement && findings.length === 0) {
      // Didn't find something that should exist
      return 'fail';
    }
    
    // Default to not evaluated if unsure
    return 'not_evaluated';
  }

  /**
   * Categorize evaluation results
   */
  private categorizeResults(evaluations: STIGRuleEvaluation[]): STIGEvaluationResult['categorizedResults'] {
    const results = {
      passed: 0,
      failed: 0,
      notEvaluated: 0,
      notApplicable: 0,
      catI: { total: 0, failed: 0 },
      catII: { total: 0, failed: 0 },
      catIII: { total: 0, failed: 0 }
    };

    evaluations.forEach(evaluation => {
      // Count by status
      switch (evaluation.status) {
        case 'pass':
          results.passed++;
          break;
        case 'fail':
          results.failed++;
          break;
        case 'not_evaluated':
          results.notEvaluated++;
          break;
        case 'not_applicable':
          results.notApplicable++;
          break;
      }

      // Count by severity category
      const category = this.mapSeverityToCategory(evaluation.severity);
      switch (category) {
        case 'CAT I':
          results.catI.total++;
          if (evaluation.status === 'fail') results.catI.failed++;
          break;
        case 'CAT II':
          results.catII.total++;
          if (evaluation.status === 'fail') results.catII.failed++;
          break;
        case 'CAT III':
          results.catIII.total++;
          if (evaluation.status === 'fail') results.catIII.failed++;
          break;
      }
    });

    return results;
  }

  /**
   * Map severity to STIG category
   */
  private mapSeverityToCategory(severity: string): 'CAT I' | 'CAT II' | 'CAT III' {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'CAT I';
      case 'medium':
        return 'CAT II';
      case 'low':
      default:
        return 'CAT III';
    }
  }

  /**
   * Calculate overall compliance score
   */
  private calculateComplianceScore(results: STIGEvaluationResult['categorizedResults']): number {
    const total = results.passed + results.failed;
    if (total === 0) return 0;
    
    // Weight by severity
    const catIWeight = 3;
    const catIIWeight = 2;
    const catIIIWeight = 1;
    
    const catIScore = results.catI.total > 0 
      ? ((results.catI.total - results.catI.failed) / results.catI.total) * catIWeight
      : 0;
      
    const catIIScore = results.catII.total > 0
      ? ((results.catII.total - results.catII.failed) / results.catII.total) * catIIWeight
      : 0;
      
    const catIIIScore = results.catIII.total > 0
      ? ((results.catIII.total - results.catIII.failed) / results.catIII.total) * catIIIWeight
      : 0;
    
    const totalWeight = 
      (results.catI.total > 0 ? catIWeight : 0) +
      (results.catII.total > 0 ? catIIWeight : 0) +
      (results.catIII.total > 0 ? catIIIWeight : 0);
    
    if (totalWeight === 0) {
      // Simple percentage if no severity info
      return Math.round((results.passed / total) * 100);
    }
    
    const weightedScore = (catIScore + catIIScore + catIIIScore) / totalWeight;
    return Math.round(weightedScore * 100);
  }

  /**
   * Create evidence records from STIG evaluation
   */
  async createSTIGEvidence(
    evaluation: STIGEvaluationResult,
    systemId: string
  ): Promise<Evidence[]> {
    const evidenceRecords: Evidence[] = [];
    
    // Group failed rules by control for evidence creation
    const failedRulesByControl = new Map<string, STIGRuleEvaluation[]>();
    
    for (const rule of evaluation.evaluatedRules) {
      if (rule.status === 'fail') {
        // Get control mappings for this STIG rule
        const mappings = await storage.getSTIGRuleControlMappings(rule.ruleId);
        
        for (const mapping of mappings) {
          if (!failedRulesByControl.has(mapping.controlId)) {
            failedRulesByControl.set(mapping.controlId, []);
          }
          failedRulesByControl.get(mapping.controlId)!.push(rule);
        }
      }
    }

    // Create evidence for each control with failed STIG rules
    for (const [controlId, failedRules] of failedRulesByControl) {
      const evidence: Omit<Evidence, 'id' | 'createdAt' | 'updatedAt'> = {
        systemId,
        controlId,
        artifactId: evaluation.artifactId,
        type: 'stig_evaluation',
        description: `STIG evaluation found ${failedRules.length} non-compliant rules`,
        implementation: failedRules.map(r => 
          `• ${r.ruleTitle} (${r.ruleId}): ${r.finding || 'Non-compliant'}`
        ).join('\n'),
        assessorNotes: `STIG Profile: ${evaluation.stigProfile}\nCompliance Score: ${evaluation.complianceScore}%\nFailed Rules: ${failedRules.length}`,
        status: 'does_not_satisfy',
        metadata: {
          stigEvaluation: {
            profile: evaluation.stigProfile,
            complianceScore: evaluation.complianceScore,
            failedRules: failedRules.map(r => ({
              ruleId: r.ruleId,
              severity: r.severity,
              finding: r.finding
            }))
          }
        }
      };

      const createdEvidence = await storage.createEvidence(evidence);
      evidenceRecords.push(createdEvidence);
    }

    return evidenceRecords;
  }

  /**
   * Get STIG evaluation status for an artifact
   */
  async getEvaluationStatus(artifactId: string): Promise<{
    evaluated: boolean;
    profile?: string;
    complianceScore?: number;
    evaluatedAt?: Date;
  }> {
    try {
      const artifact = await storage.getArtifact(artifactId);
      if (!artifact) {
        return { evaluated: false };
      }

      const stigEvaluation = (artifact.metadata as any)?.processingResults?.stigEvaluation;
      if (!stigEvaluation) {
        return { evaluated: false };
      }

      return {
        evaluated: true,
        profile: stigEvaluation.profile,
        complianceScore: stigEvaluation.complianceScore,
        evaluatedAt: stigEvaluation.evaluatedAt ? new Date(stigEvaluation.evaluatedAt) : undefined
      };
    } catch (error) {
      console.error('Error getting STIG evaluation status:', error);
      return { evaluated: false };
    }
  }
}

// Export singleton instance
export const stigEvaluationService = new STIGEvaluationService();
