// Template-Based Document Generation Service
// Integrates template system with existing generation pipeline

import { storage } from '../storage';
import { templateService } from './template-service';
import { templateParser } from '../parsers/template-parser';
import { modelRouter } from '../llm/model-router';
import { narrativeGenerationService } from './narrative-generation.service';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import mammoth from 'mammoth';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import type { 
  System, 
  Control,
  SystemControl,
  Finding, 
  Evidence, 
  Artifact,
  Template,
  TemplateVersion,
  TemplateMapping
} from '../schema';

export interface TemplateGenerationRequest {
  systemId: string;
  documentType: 'ssp' | 'sar' | 'poam' | 'checklist' | 'ato_package';
  templateId?: string; // Optional: specific template to use
  format: 'docx' | 'pdf' | 'html' | 'text';
  includeEvidence: boolean;
  includeAssessmentResults: boolean;
  includeDiagrams: boolean;
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

export interface TemplateGenerationResult {
  success: boolean;
  document: {
    content: Buffer;
    format: string;
    filename: string;
    metadata: {
      systemName: string;
      templateName: string;
      templateVersion: number;
      generatedDate: Date;
      totalControls: number;
      implementedControls: number;
      variablesUsed: string[];
      pages?: number;
    };
  };
  templateInfo: {
    id: string;
    name: string;
    version: number;
    variables: string[];
    structure: any;
  };
  errors?: string[];
}

export class TemplateGenerationService {
  private readonly MAX_GENERATION_TIME_MS = 30000; // 30 seconds
  private readonly TEMPLATE_CACHE_TTL_MS = 300000; // 5 minutes
  private templateCache = new Map<string, { template: TemplateVersion; timestamp: number }>();

  /**
   * Generate document using template system
   */
  async generateDocument(request: TemplateGenerationRequest): Promise<TemplateGenerationResult> {
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
        throw new Error(`No applicable template found for document type: ${request.documentType}`);
      }

      // 3. Parse template to extract variables
      const parseResult = await this.parseTemplate(template);
      if (!parseResult.success) {
        throw new Error(`Template parsing failed: ${parseResult.errors?.map(e => e.message).join(', ')}`);
      }

      // 4. Collect system data for template variables
      const systemData = await this.collectSystemData(request.systemId, parseResult.variables);

      // 5. Generate document content
      const documentContent = await this.generateDocumentContent(
        template,
        systemData,
        parseResult.variables,
        request.format
      );

      // 6. Create filename
      const filename = this.generateFilename(system.name, request.documentType, request.format);

      // 7. Calculate metadata
      const metadata = await this.calculateMetadata(system, template, parseResult.variables);

      // Check generation time
      const generationTime = Date.now() - startTime;
      if (generationTime > this.MAX_GENERATION_TIME_MS) {
        console.warn(`Document generation took ${generationTime}ms, exceeding ${this.MAX_GENERATION_TIME_MS}ms limit`);
      }

      return {
        success: true,
        document: {
          content: documentContent,
          format: request.format,
          filename,
          metadata
        },
        templateInfo: {
          id: template.templateId,
          name: template.fileName,
          version: template.version,
          variables: parseResult.variables.map(v => v.name),
          structure: parseResult.structure
        }
      };

    } catch (error) {
      console.error('Template generation error:', error);
      return {
        success: false,
        document: {
          content: Buffer.alloc(0),
          format: request.format,
          filename: 'error.txt',
          metadata: {
            systemName: 'Unknown',
            templateName: 'Unknown',
            templateVersion: 0,
            generatedDate: new Date(),
            totalControls: 0,
            implementedControls: 0,
            variablesUsed: []
          }
        },
        templateInfo: {
          id: '',
          name: 'Unknown',
          version: 0,
          variables: [],
          structure: {}
        },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Find applicable template for the request
   */
  private async findApplicableTemplate(request: TemplateGenerationRequest): Promise<TemplateVersion | null> {
    try {
      // If specific template ID provided, use it
      if (request.templateId) {
        const templateInfo = await templateService.getTemplateInfo(request.templateId);
        return templateInfo?.activeVersion || null;
      }

      // Find default template for document type and system
      const defaultTemplate = await templateService.getDefaultTemplate(
        request.documentType,
        request.systemId
      );

      if (defaultTemplate) {
        const templateInfo = await templateService.getTemplateInfo(defaultTemplate.id);
        return templateInfo?.activeVersion || null;
      }

      // Fallback: find any template for document type
      const templates = await storage.getTemplatesByType(request.documentType);
      const activeTemplate = templates.find(t => t.status === 'active');
      
      if (activeTemplate) {
        const templateInfo = await templateService.getTemplateInfo(activeTemplate.id);
        return templateInfo?.activeVersion || null;
      }

      return null;
    } catch (error) {
      console.error('Error finding applicable template:', error);
      return null;
    }
  }

  /**
   * Parse template to extract variables and structure
   */
  private async parseTemplate(template: TemplateVersion): Promise<any> {
    // Check cache first
    const cacheKey = `${template.templateId}-${template.version}`;
    const cached = this.templateCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.TEMPLATE_CACHE_TTL_MS) {
      // Parse from cache
      return await templateParser.parseTemplate(cached.template, {
        extractVariables: true,
        validateCompliance: true,
        analyzeStructure: true
      });
    }

    // Parse template
    const parseResult = await templateParser.parseTemplate(template, {
      extractVariables: true,
      validateCompliance: true,
      analyzeStructure: true
    });

    // Cache the result
    this.templateCache.set(cacheKey, {
      template,
      timestamp: Date.now()
    });

    return parseResult;
  }

  /**
   * Collect system data for template variables
   */
  private async collectSystemData(systemId: string, variables: any[]): Promise<Record<string, any>> {
    const systemData: Record<string, any> = {};

    try {
      // Get system information
      const system = await storage.getSystem(systemId);
      if (system) {
        systemData.systemName = system.name;
        systemData.systemDescription = system.description;
        systemData.systemCategory = system.category;
        systemData.impactLevel = system.impactLevel;
        systemData.complianceStatus = system.complianceStatus;
        systemData.owner = system.owner;
        systemData.createdAt = system.createdAt;
        systemData.updatedAt = system.updatedAt;
      }

      // Get controls and implementation status
      const systemControls = await storage.getSystemControls(systemId);
      systemData.totalControls = systemControls.length;
      systemData.implementedControls = systemControls.filter(sc => sc.status === 'implemented').length;
      systemData.partiallyImplementedControls = systemControls.filter(sc => sc.status === 'partially_implemented').length;
      systemData.notImplementedControls = systemControls.filter(sc => sc.status === 'not_implemented').length;

      // Get findings
      const findings = await storage.getFindingsBySystem(systemId);
      systemData.totalFindings = findings.length;
      systemData.criticalFindings = findings.filter(f => f.severity === 'critical').length;
      systemData.highFindings = findings.filter(f => f.severity === 'high').length;
      systemData.mediumFindings = findings.filter(f => f.severity === 'medium').length;
      systemData.lowFindings = findings.filter(f => f.severity === 'low').length;

      // Get evidence
      const evidence = await storage.getEvidenceBySystem(systemId);
      systemData.totalEvidence = evidence.length;
      systemData.satisfiesEvidence = evidence.filter(e => e.status === 'satisfies').length;
      systemData.partiallySatisfiesEvidence = evidence.filter(e => e.status === 'partially_satisfies').length;
      systemData.doesNotSatisfyEvidence = evidence.filter(e => e.status === 'does_not_satisfy').length;

      // Get artifacts
      const artifacts = await storage.getArtifactsBySystem(systemId);
      systemData.totalArtifacts = artifacts.length;

      // Generate control narratives for applicable controls
      const applicableControls = systemControls.filter(sc => 
        sc.status === 'implemented' || sc.status === 'partially_implemented'
      );

      for (const systemControl of applicableControls) {
        const control = await storage.getControl(systemControl.controlId);
        if (control) {
          const narrative = await narrativeGenerationService.generateNarrative({
            systemId,
            controlId: control.id,
            useAI: true
          });

          systemData[`control_${control.id}_narrative`] = narrative.narrative;
          systemData[`control_${control.id}_status`] = systemControl.status;
          systemData[`control_${control.id}_title`] = control.title;
          systemData[`control_${control.id}_family`] = control.family;
        }
      }

      // Add common variables
      systemData.generatedDate = new Date().toISOString();
      systemData.generatedBy = 'ATO Compliance Agent';
      systemData.documentVersion = '1.0';

      return systemData;
    } catch (error) {
      console.error('Error collecting system data:', error);
      return systemData;
    }
  }

  /**
   * Generate document content using template
   */
  private async generateDocumentContent(
    template: TemplateVersion,
    systemData: Record<string, any>,
    variables: any[],
    format: string
  ): Promise<Buffer> {
    try {
      // Read template file
      const templateContent = await fs.readFile(template.filePath);

      // Process based on template format
      const ext = extname(template.fileName).toLowerCase();
      
      switch (ext) {
        case '.docx':
          return await this.processDocxTemplate(templateContent, systemData, variables);
        case '.html':
          return await this.processHtmlTemplate(templateContent, systemData, variables);
        case '.txt':
        case '.md':
          return await this.processTextTemplate(templateContent, systemData, variables);
        default:
          throw new Error(`Unsupported template format: ${ext}`);
      }
    } catch (error) {
      console.error('Error generating document content:', error);
      throw error;
    }
  }

  /**
   * Process DOCX template
   */
  private async processDocxTemplate(
    templateContent: Buffer,
    systemData: Record<string, any>,
    variables: any[]
  ): Promise<Buffer> {
    try {
      // Load template with PizZip
      const zip = new PizZip(templateContent);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // Prepare data for template
      const templateData = this.prepareTemplateData(systemData, variables);

      // Set template data
      doc.setData(templateData);

      // Render document
      doc.render();

      // Generate output
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 4,
        },
      });

      return buffer;
    } catch (error) {
      console.error('Error processing DOCX template:', error);
      throw error;
    }
  }

  /**
   * Process HTML template
   */
  private async processHtmlTemplate(
    templateContent: Buffer,
    systemData: Record<string, any>,
    variables: any[]
  ): Promise<Buffer> {
    try {
      let htmlContent = templateContent.toString('utf8');
      
      // Prepare data for template
      const templateData = this.prepareTemplateData(systemData, variables);

      // Replace variables in HTML
      for (const [key, value] of Object.entries(templateData)) {
        const patterns = [
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          new RegExp(`\\{${key}\\}`, 'g'),
          new RegExp(`\\$\\{${key}\\}`, 'g'),
          new RegExp(`\\[\\[${key}\\]\\]`, 'g'),
          new RegExp(`\\{\\%${key}\\%\\}`, 'g')
        ];

        for (const pattern of patterns) {
          htmlContent = htmlContent.replace(pattern, String(value || ''));
        }
      }

      return Buffer.from(htmlContent, 'utf8');
    } catch (error) {
      console.error('Error processing HTML template:', error);
      throw error;
    }
  }

  /**
   * Process text template
   */
  private async processTextTemplate(
    templateContent: Buffer,
    systemData: Record<string, any>,
    variables: any[]
  ): Promise<Buffer> {
    try {
      let textContent = templateContent.toString('utf8');
      
      // Prepare data for template
      const templateData = this.prepareTemplateData(systemData, variables);

      // Replace variables in text
      for (const [key, value] of Object.entries(templateData)) {
        const patterns = [
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          new RegExp(`\\{${key}\\}`, 'g'),
          new RegExp(`\\$\\{${key}\\}`, 'g'),
          new RegExp(`\\[\\[${key}\\]\\]`, 'g'),
          new RegExp(`\\{\\%${key}\\%\\}`, 'g')
        ];

        for (const pattern of patterns) {
          textContent = textContent.replace(pattern, String(value || ''));
        }
      }

      return Buffer.from(textContent, 'utf8');
    } catch (error) {
      console.error('Error processing text template:', error);
      throw error;
    }
  }

  /**
   * Prepare template data with proper formatting
   */
  private prepareTemplateData(systemData: Record<string, any>, variables: any[]): Record<string, any> {
    const templateData: Record<string, any> = {};

    // Add all system data
    Object.assign(templateData, systemData);

    // Format specific data types
    if (templateData.generatedDate) {
      templateData.generatedDate = new Date(templateData.generatedDate).toLocaleDateString();
    }

    if (templateData.createdAt) {
      templateData.createdAt = new Date(templateData.createdAt).toLocaleDateString();
    }

    if (templateData.updatedAt) {
      templateData.updatedAt = new Date(templateData.updatedAt).toLocaleDateString();
    }

    // Calculate percentages
    if (templateData.totalControls > 0) {
      templateData.implementationPercentage = Math.round(
        (templateData.implementedControls / templateData.totalControls) * 100
      );
    }

    // Add conditional flags
    templateData.hasFindings = templateData.totalFindings > 0;
    templateData.hasCriticalFindings = templateData.criticalFindings > 0;
    templateData.hasHighFindings = templateData.highFindings > 0;
    templateData.isCompliant = templateData.complianceStatus === 'compliant';
    templateData.isHighImpact = templateData.impactLevel === 'High';
    templateData.isModerateImpact = templateData.impactLevel === 'Moderate';
    templateData.isLowImpact = templateData.impactLevel === 'Low';

    return templateData;
  }

  /**
   * Generate filename for document
   */
  private generateFilename(systemName: string, documentType: string, format: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const safeSystemName = systemName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${safeSystemName}_${documentType}_${timestamp}.${format}`;
  }

  /**
   * Calculate document metadata
   */
  private async calculateMetadata(
    system: System,
    template: TemplateVersion,
    variables: any[]
  ): Promise<any> {
    return {
      systemName: system.name,
      templateName: template.fileName,
      templateVersion: template.version,
      generatedDate: new Date(),
      totalControls: 0, // Will be populated by collectSystemData
      implementedControls: 0, // Will be populated by collectSystemData
      variablesUsed: variables.map(v => v.name),
      pages: 0 // Will be calculated based on content
    };
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.templateCache.size,
      entries: Array.from(this.templateCache.keys())
    };
  }
}

export const templateGenerationService = new TemplateGenerationService();
