// RAR Generation Service
// Generates Risk Assessment Report documents using document templates

import * as mammoth from 'mammoth';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { storage } from '../storage';
import { RARDataCollectionService, type RARData } from './rar-data-collection.service';
import { templateParser } from '../parsers/template-parser';
import type { TemplateVersion } from '../schema';

export interface RARGenerationRequest {
  systemId: string;
  templateId?: string;
  format: 'docx' | 'pdf' | 'html';
  includeEvidence: boolean;
  includeAssessmentResults: boolean;
  templateOptions?: {
    classification?: string;
    organization?: string;
    preparedBy?: string;
    reviewedBy?: string;
    approvedBy?: string;
    version?: string;
    date?: string;
    customFields?: Record<string, any>;
  };
}

export interface RARGenerationResult {
  success: boolean;
  document: {
    content: Buffer;
    filename: string;
    metadata: {
      totalRisks: number;
      criticalRisks: number;
      highRisks: number;
      mediumRisks: number;
      lowRisks: number;
      risksWithMitigation: number;
      risksWithoutMitigation: number;
      averageRiskScore: number;
      templateName: string;
      templateVersion: string;
      variablesUsed: string[];
    };
  };
  templateInfo: {
    name: string;
    version: string;
    variables: string[];
  };
  errors?: string[];
}

export class RARGenerationService {
  private readonly MAX_GENERATION_TIME_MS = 30000; // 30 seconds
  private readonly TEMPLATE_CACHE_TTL_MS = 300000; // 5 minutes
  private templateCache = new Map<string, { template: TemplateVersion; timestamp: number }>();

  /**
   * Generate RAR document using document template
   */
  async generateRAR(request: RARGenerationRequest): Promise<RARGenerationResult> {
    const startTime = Date.now();
    
    try {
      // 1. Get system information
      const system = await storage.getSystem(request.systemId);
      if (!system) {
        throw new Error(`System not found: ${request.systemId}`);
      }

      // 2. Find applicable template
      const template = await this.findApplicableTemplate(request);
      if (!template) {
        throw new Error(`No applicable template found for RAR generation`);
      }

      // 3. Parse template to extract variables
      const parseResult = await this.parseTemplate(template);
      if (!parseResult.success) {
        throw new Error(`Template parsing failed: ${parseResult.errors?.map(e => e.message).join(', ')}`);
      }

      // 4. Collect RAR data
      const rarDataCollectionService = new RARDataCollectionService();
      const rarData = await rarDataCollectionService.collectRARData(request.systemId);

      // 5. Generate document
      const documentContent = await this.generateDocument(
        template,
        rarData,
        parseResult.variables,
        request.format
      );

      // 6. Create filename
      const filename = this.generateFilename(system.name, request.format);

      // 7. Calculate metadata
      const metadata = this.calculateMetadata(rarData, template, parseResult.variables);

      // Check generation time
      const generationTime = Date.now() - startTime;
      if (generationTime > this.MAX_GENERATION_TIME_MS) {
        console.warn(`RAR generation took ${generationTime}ms, exceeding limit of ${this.MAX_GENERATION_TIME_MS}ms`);
      }

      return {
        success: true,
        document: {
          content: documentContent,
          filename,
          metadata
        },
        templateInfo: {
          name: template.fileName,
          version: template.version.toString(),
          variables: parseResult.variables.map(v => v.name)
        }
      };

    } catch (error) {
      console.error('RAR generation failed:', error);
      return {
        success: false,
        document: {
          content: Buffer.alloc(0),
          filename: '',
          metadata: {
            totalRisks: 0,
            criticalRisks: 0,
            highRisks: 0,
            mediumRisks: 0,
            lowRisks: 0,
            risksWithMitigation: 0,
            risksWithoutMitigation: 0,
            averageRiskScore: 0,
            templateName: '',
            templateVersion: '',
            variablesUsed: []
          }
        },
        templateInfo: {
          name: '',
          version: '',
          variables: []
        },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Find applicable template for RAR generation
   */
  private async findApplicableTemplate(request: RARGenerationRequest): Promise<TemplateVersion | null> {
    try {
      // If specific template ID provided, use it
      if (request.templateId) {
        const template = await storage.getTemplate(request.templateId);
        return template?.activeVersion || null;
      }

      // Find default template for RAR
      const templates = await storage.getTemplatesByType('rar');
      const activeTemplate = templates.find(t => t.status === 'active');
      
      if (activeTemplate) {
        const template = await storage.getTemplate(activeTemplate.id);
        return template?.activeVersion || null;
      }

      return null;
    } catch (error) {
      console.error('Error finding applicable template:', error);
      return null;
    }
  }

  /**
   * Parse template to extract variables
   */
  private async parseTemplate(template: TemplateVersion): Promise<any> {
    // Check cache first
    const cacheKey = `${template.templateId}-${template.version}`;
    const cached = this.templateCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.TEMPLATE_CACHE_TTL_MS) {
      // Parse from cache
      return await templateParser.parseTemplate(cached.template);
    }

    // Parse template
    const parseResult = await templateParser.parseTemplate(template);

    // Cache the result
    this.templateCache.set(cacheKey, {
      template,
      timestamp: Date.now()
    });

    return parseResult;
  }

  /**
   * Generate document with data
   */
  private async generateDocument(
    template: TemplateVersion,
    rarData: RARData,
    variables: any[],
    format: 'docx' | 'pdf' | 'html'
  ): Promise<Buffer> {
    try {
      if (format === 'docx') {
        return await this.generateDocxDocument(template, rarData, variables);
      } else if (format === 'html') {
        return await this.generateHtmlDocument(template, rarData, variables);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error('Error generating document:', error);
      throw error;
    }
  }

  /**
   * Generate DOCX document
   */
  private async generateDocxDocument(
    template: TemplateVersion,
    rarData: RARData,
    variables: any[]
  ): Promise<Buffer> {
    // For DOCX, we'll use the existing template generation service
    // This is a simplified implementation - in production, you'd use docxtemplater
    const content = this.buildDocumentContent(rarData, variables);
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Generate HTML document
   */
  private async generateHtmlDocument(
    template: TemplateVersion,
    rarData: RARData,
    variables: any[]
  ): Promise<Buffer> {
    const content = this.buildDocumentContent(rarData, variables);
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Build document content with variable substitution
   */
  private buildDocumentContent(rarData: RARData, variables: any[]): string {
    let content = this.getTemplateContent();
    
    // Replace system info variables
    content = this.replaceSystemVariables(content, rarData.systemInfo);
    
    // Replace risk assessment variables
    content = this.replaceRiskAssessmentVariables(content, rarData.riskAssessment);
    
    // Replace summary variables
    content = this.replaceSummaryVariables(content, rarData.summary);
    
    // Replace risk-specific variables
    content = this.replaceRiskVariables(content, rarData.risks);
    
    // Replace control gap variables
    content = this.replaceControlGapVariables(content, rarData.controlGaps);
    
    return content;
  }

  /**
   * Get template content (simplified - in production, read from template file)
   */
  private getTemplateContent(): string {
    return `
# Risk Assessment Report

## Executive Summary
System: {{systemName}}
Assessment Date: {{assessmentDate}}
Overall Risk Level: {{riskLevel}}
Total Risks: {{totalRisks}}

## System Information
- **System Name**: {{systemName}}
- **Description**: {{systemDescription}}
- **Impact Level**: {{impactLevel}}
- **Owner**: {{owner}}
- **Organization**: {{organization}}

## Risk Assessment Summary
- **Assessment Date**: {{assessmentDate}}
- **Assessor**: {{assessorName}}
- **Risk Level**: {{riskLevel}}
- **Risk Score**: {{riskScore}}
- **Methodology**: {{assessmentMethodology}}

## Risk Summary
- **Total Risks**: {{totalRisks}}
- **Critical Risks**: {{criticalRisks}}
- **High Risks**: {{highRisks}}
- **Medium Risks**: {{mediumRisks}}
- **Low Risks**: {{lowRisks}}
- **Risks with Mitigation**: {{risksWithMitigation}}
- **Risks without Mitigation**: {{risksWithoutMitigation}}
- **Average Risk Score**: {{averageRiskScore}}

## Identified Risks
{{#risks}}
### {{riskTitle}}
- **Risk ID**: {{riskId}}
- **Category**: {{riskCategory}}
- **Description**: {{riskDescription}}
- **Likelihood**: {{likelihood}}
- **Impact**: {{impact}}
- **Risk Score**: {{riskScore}}
- **Risk Level**: {{riskLevel}}
- **Root Cause**: {{rootCause}}
- **Mitigation Strategy**: {{mitigationStrategy}}
- **Mitigation Status**: {{mitigationStatus}}
- **Mitigation Owner**: {{mitigationOwner}}
- **Due Date**: {{mitigationDueDate}}
- **Residual Risk**: {{residualRisk}}
- **Monitoring Frequency**: {{monitoringFrequency}}

{{/risks}}

## Control Gaps
{{#controlGaps}}
### {{controlTitle}}
- **Control ID**: {{controlId}}
- **Gap Description**: {{gapDescription}}
- **Risk Impact**: {{riskImpact}}
- **Remediation Plan**: {{remediationPlan}}
- **Priority**: {{priority}}

{{/controlGaps}}

## Recommendations
Based on the risk assessment, the following recommendations are made:
1. Address all critical and high risks immediately
2. Implement mitigation strategies for risks without current mitigation
3. Establish regular monitoring and review processes
4. Update risk assessment on a regular basis

## Conclusion
This risk assessment identifies {{totalRisks}} risks across the system, with {{criticalRisks}} critical and {{highRisks}} high risks requiring immediate attention. The implementation of recommended mitigation strategies will help reduce the overall risk exposure of the system.
    `;
  }

  /**
   * Replace system information variables
   */
  private replaceSystemVariables(content: string, systemInfo: RARData['systemInfo']): string {
    const replacements: Record<string, string> = {
      '{{systemName}}': systemInfo.systemName,
      '{{systemDescription}}': systemInfo.systemDescription,
      '{{impactLevel}}': systemInfo.impactLevel,
      '{{owner}}': systemInfo.owner,
      '{{assessmentDate}}': systemInfo.assessmentDate,
      '{{assessorName}}': systemInfo.assessorName,
      '{{organization}}': systemInfo.organization
    };

    let result = content;
    for (const [variable, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Replace risk assessment variables
   */
  private replaceRiskAssessmentVariables(content: string, riskAssessment: RARData['riskAssessment']): string {
    const replacements: Record<string, string> = {
      '{{riskLevel}}': riskAssessment.riskLevel,
      '{{riskScore}}': riskAssessment.overallRiskScore.toString(),
      '{{assessmentMethodology}}': riskAssessment.assessmentMethodology
    };

    let result = content;
    for (const [variable, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Replace summary variables
   */
  private replaceSummaryVariables(content: string, summary: RARData['summary']): string {
    const replacements: Record<string, string> = {
      '{{totalRisks}}': summary.totalRisks.toString(),
      '{{criticalRisks}}': summary.criticalRisks.toString(),
      '{{highRisks}}': summary.highRisks.toString(),
      '{{mediumRisks}}': summary.mediumRisks.toString(),
      '{{lowRisks}}': summary.lowRisks.toString(),
      '{{risksWithMitigation}}': summary.risksWithMitigation.toString(),
      '{{risksWithoutMitigation}}': summary.risksWithoutMitigation.toString(),
      '{{averageRiskScore}}': summary.averageRiskScore.toString()
    };

    let result = content;
    for (const [variable, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Replace risk variables (simplified - in production, use proper template engine)
   */
  private replaceRiskVariables(content: string, risks: RARData['risks']): string {
    // This is a simplified implementation
    // In production, you'd use a proper template engine like Handlebars or Mustache
    let result = content;
    
    // Replace risk list placeholder with actual risks
    const riskList = risks.map(risk => `
### ${risk.riskTitle}
- **Risk ID**: ${risk.riskId}
- **Category**: ${risk.riskCategory}
- **Description**: ${risk.riskDescription}
- **Likelihood**: ${risk.likelihood}
- **Impact**: ${risk.impact}
- **Risk Score**: ${risk.riskScore}
- **Risk Level**: ${risk.riskLevel}
- **Root Cause**: ${risk.rootCause}
- **Mitigation Strategy**: ${risk.mitigationStrategy}
- **Mitigation Status**: ${risk.mitigationStatus}
- **Mitigation Owner**: ${risk.mitigationOwner}
- **Due Date**: ${risk.mitigationDueDate}
- **Residual Risk**: ${risk.residualRisk}
- **Monitoring Frequency**: ${risk.monitoringFrequency}
    `).join('\n');

    result = result.replace(/\{\{#risks\}\}[\s\S]*?\{\{\/risks\}\}/g, riskList);
    
    return result;
  }

  /**
   * Replace control gap variables (simplified - in production, use proper template engine)
   */
  private replaceControlGapVariables(content: string, controlGaps: RARData['controlGaps']): string {
    let result = content;
    
    // Replace control gap list placeholder with actual gaps
    const gapList = controlGaps.map(gap => `
### ${gap.controlTitle}
- **Control ID**: ${gap.controlId}
- **Gap Description**: ${gap.gapDescription}
- **Risk Impact**: ${gap.riskImpact}
- **Remediation Plan**: ${gap.remediationPlan}
- **Priority**: ${gap.priority}
    `).join('\n');

    result = result.replace(/\{\{#controlGaps\}\}[\s\S]*?\{\{\/controlGaps\}\}/g, gapList);
    
    return result;
  }

  /**
   * Generate filename for RAR document
   */
  private generateFilename(systemName: string, format: 'docx' | 'pdf' | 'html'): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedName = systemName.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `RAR_${sanitizedName}_${timestamp}.${format}`;
  }

  /**
   * Calculate metadata for generated document
   */
  private calculateMetadata(
    rarData: RARData,
    template: TemplateVersion,
    variables: any[]
  ): RARGenerationResult['document']['metadata'] {
    return {
      totalRisks: rarData.summary.totalRisks,
      criticalRisks: rarData.summary.criticalRisks,
      highRisks: rarData.summary.highRisks,
      mediumRisks: rarData.summary.mediumRisks,
      lowRisks: rarData.summary.lowRisks,
      risksWithMitigation: rarData.summary.risksWithMitigation,
      risksWithoutMitigation: rarData.summary.risksWithoutMitigation,
      averageRiskScore: rarData.summary.averageRiskScore,
      templateName: template.fileName,
      templateVersion: template.version.toString(),
      variablesUsed: variables.map(v => v.name)
    };
  }
}

// Export singleton instance
export const rarGenerationService = new RARGenerationService();











