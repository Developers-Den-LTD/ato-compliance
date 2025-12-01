// SCTM Generation Service
// Generates Security Control Traceability Matrix documents using Excel templates

import ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { storage } from '../storage';
import { modelRouter } from '../llm/model-router';
import { SCTMDataCollectionService, type SCTMData } from './sctm-data-collection.service';
import { ExcelTemplateParser, type ExcelTemplateParseResult } from '../parsers/excel-template-parser';
import type { TemplateVersion } from '../schema';

export interface SCTMGenerationRequest {
  systemId: string;
  templateId?: string;
  format: 'xlsx' | 'xls';
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

export interface SCTMGenerationResult {
  success: boolean;
  document: {
    content: Buffer;
    filename: string;
    metadata: {
      totalControls: number;
      implementedControls: number;
      partiallyImplementedControls: number;
      notImplementedControls: number;
      compliantStigRules: number;
      nonCompliantStigRules: number;
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

export class SCTMGenerationService {
  private readonly MAX_GENERATION_TIME_MS = 30000; // 30 seconds
  private readonly TEMPLATE_CACHE_TTL_MS = 300000; // 5 minutes
  private templateCache = new Map<string, { template: TemplateVersion; timestamp: number }>();

  /**
   * Generate SCTM document using Excel template
   */
  async generateSCTM(request: SCTMGenerationRequest): Promise<SCTMGenerationResult> {
    const startTime = Date.now();
    
    try {
      // 1. Get system information
      const system = await storage.getSystem(request.systemId);
      if (!system) {
        throw new Error(`System not found: ${request.systemId}`);
      }

      // 2. Find applicable template
      const template = await this.findApplicableTemplate(request);
      
      // If no template found, generate programmatically
      if (!template) {
        console.log('No SCTM template found, generating programmatically');
        return await this.generateSCTMProgrammatically(system, request);
      }

      // 3. Parse template to extract variables
      const parseResult = await this.parseTemplate(template);
      if (!parseResult.success) {
        throw new Error(`Template parsing failed: ${parseResult.errors?.map(e => e.message).join(', ')}`);
      }

      // 4. Collect SCTM data
      const sctmDataCollectionService = new SCTMDataCollectionService();
      const sctmData = await sctmDataCollectionService.collectSCTMData(request.systemId);

      // 5. Generate Excel document
      const documentContent = await this.generateExcelDocument(
        template,
        sctmData,
        parseResult.variables,
        request.format
      );

      // 6. Create filename
      const filename = this.generateFilename(system.name, request.format);

      // 7. Calculate metadata
      const metadata = this.calculateMetadata(sctmData, template, parseResult.variables);

      // Check generation time
      const generationTime = Date.now() - startTime;
      if (generationTime > this.MAX_GENERATION_TIME_MS) {
        console.warn(`SCTM generation took ${generationTime}ms, exceeding limit of ${this.MAX_GENERATION_TIME_MS}ms`);
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
      console.error('SCTM generation failed:', error);
      return {
        success: false,
        document: {
          content: Buffer.alloc(0),
          filename: '',
          metadata: {
            totalControls: 0,
            implementedControls: 0,
            partiallyImplementedControls: 0,
            notImplementedControls: 0,
            compliantStigRules: 0,
            nonCompliantStigRules: 0,
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
   * Find applicable template for SCTM generation
   */
  private async findApplicableTemplate(request: SCTMGenerationRequest): Promise<TemplateVersion | null> {
    try {
      // If specific template ID provided, use it
      if (request.templateId) {
        const template = await storage.getTemplate(request.templateId);
        return template ? await storage.getTemplateVersion(template.activeVersion) : null;
      }

      // Find default template for SCTM
      const templates = await storage.getTemplatesByType('sctm_excel');
      const activeTemplate = templates.find(t => t.status === 'active');
      
      if (activeTemplate) {
        const template = await storage.getTemplate(activeTemplate.id);
        return template ? await storage.getTemplateVersion(template.activeVersion) : null;
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
  private async parseTemplate(template: TemplateVersion): Promise<ExcelTemplateParseResult> {
    // Check cache first
    const cacheKey = `${template.templateId}-${template.version}`;
    const cached = this.templateCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.TEMPLATE_CACHE_TTL_MS) {
      // Parse from cache
      const parser = new ExcelTemplateParser();
      return await parser.parseTemplate(cached.template);
    }

    // Parse template
    const parser = new ExcelTemplateParser();
    const parseResult = await parser.parseTemplate(template);

    // Cache the result
    this.templateCache.set(cacheKey, {
      template,
      timestamp: Date.now()
    });

    return parseResult;
  }

  /**
   * Generate Excel document with data
   */
  private async generateExcelDocument(
    template: TemplateVersion,
    sctmData: SCTMData,
    variables: any[],
    format: 'xlsx' | 'xls'
  ): Promise<Buffer> {
    try {
      // Read template file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(template.filePath);

      // Process each worksheet
      for (let i = 0; i < workbook.worksheets.length; i++) {
        const worksheet = workbook.worksheets[i];
        await this.processWorksheet(worksheet, sctmData, variables);
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);

    } catch (error) {
      console.error('Error generating Excel document:', error);
      throw error;
    }
  }

  /**
   * Process individual worksheet
   */
  private async processWorksheet(
    worksheet: ExcelJS.Worksheet,
    sctmData: SCTMData,
    variables: any[]
  ): Promise<void> {
    // Process each cell
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (typeof cell.value === 'string') {
          const cellValue = cell.value as string;
          const processedValue = this.processCellValue(cellValue, sctmData, variables);
          cell.value = processedValue;
        }
      });
    });

    // Process formulas
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell.formula) {
          const formula = cell.formula;
          const processedFormula = this.processFormula(formula, sctmData, variables);
          // Note: ExcelJS doesn't allow direct formula assignment, this would need to be handled differently
          // For now, we'll skip formula processing
        }
      });
    });
  }

  /**
   * Process cell value with variable substitution
   */
  private processCellValue(
    cellValue: string,
    sctmData: SCTMData,
    variables: any[]
  ): string {
    let processedValue = cellValue;

    // Replace system info variables
    processedValue = this.replaceSystemVariables(processedValue, sctmData.systemInfo);
    
    // Replace summary variables
    processedValue = this.replaceSummaryVariables(processedValue, sctmData.summary);

    // Replace control variables (for control rows)
    if (processedValue.includes('{{controlId}}') || processedValue.includes('{{controlTitle}}')) {
      // This is a control row template - we'll need to handle this differently
      // For now, just replace with placeholder
      const firstControl = sctmData.controls[0];
      if (firstControl) {
        processedValue = this.replaceControlVariables(processedValue, firstControl);
      }
    }

    return processedValue;
  }

  /**
   * Process formula with variable substitution
   */
  private processFormula(
    formula: string,
    sctmData: SCTMData,
    variables: any[]
  ): string {
    let processedFormula = formula;

    // Replace variables in formulas
    processedFormula = this.replaceSystemVariables(processedFormula, sctmData.systemInfo);
    processedFormula = this.replaceSummaryVariables(processedFormula, sctmData.summary);

    return processedFormula;
  }

  /**
   * Replace system information variables
   */
  private replaceSystemVariables(text: string, systemInfo: SCTMData['systemInfo']): string {
    const replacements: Record<string, string> = {
      '{{systemName}}': systemInfo.systemName,
      '{{systemDescription}}': systemInfo.systemDescription,
      '{{impactLevel}}': systemInfo.impactLevel,
      '{{owner}}': systemInfo.owner,
      '{{assessmentDate}}': systemInfo.assessmentDate,
      '{{assessorName}}': systemInfo.assessorName,
      '{{organization}}': systemInfo.organization
    };

    let result = text;
    for (const [variable, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Replace summary variables
   */
  private replaceSummaryVariables(text: string, summary: SCTMData['summary']): string {
    const replacements: Record<string, string> = {
      '{{totalControls}}': summary.totalControls.toString(),
      '{{implementedControls}}': summary.implementedControls.toString(),
      '{{partiallyImplementedControls}}': summary.partiallyImplementedControls.toString(),
      '{{notImplementedControls}}': summary.notImplementedControls.toString(),
      '{{compliantStigRules}}': summary.compliantStigRules.toString(),
      '{{nonCompliantStigRules}}': summary.nonCompliantStigRules.toString()
    };

    let result = text;
    for (const [variable, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Replace control variables
   */
  private replaceControlVariables(text: string, control: SCTMData['controls'][0]): string {
    const replacements: Record<string, string> = {
      '{{controlId}}': control.controlId,
      '{{controlTitle}}': control.controlTitle,
      '{{controlFamily}}': control.controlFamily,
      '{{implementationStatus}}': control.implementationStatus,
      '{{implementationDescription}}': control.implementationDescription
    };

    let result = text;
    for (const [variable, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Generate filename for SCTM document
   */
  private generateFilename(systemName: string, format: 'xlsx' | 'xls'): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedName = systemName.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `SCTM_${sanitizedName}_${timestamp}.${format}`;
  }

  /**
   * Calculate metadata for generated document
   */
  private calculateMetadata(
    sctmData: SCTMData,
    template: TemplateVersion,
    variables: any[]
  ): SCTMGenerationResult['document']['metadata'] {
    return {
      totalControls: sctmData.summary.totalControls,
      implementedControls: sctmData.summary.implementedControls,
      partiallyImplementedControls: sctmData.summary.partiallyImplementedControls,
      notImplementedControls: sctmData.summary.notImplementedControls,
      compliantStigRules: sctmData.summary.compliantStigRules,
      nonCompliantStigRules: sctmData.summary.nonCompliantStigRules,
      templateName: template.fileName,
      templateVersion: template.version.toString(),
      variablesUsed: variables.map(v => v.name)
    };
  }

  /**
   * Generate SCTM programmatically when no template is available
   */
  private async generateSCTMProgrammatically(
    system: any,
    request: SCTMGenerationRequest
  ): Promise<SCTMGenerationResult> {
    try {
      console.log(`Generating SCTM programmatically for system: ${system.name}`);

      // Collect SCTM data
      const sctmDataCollectionService = new SCTMDataCollectionService();
      const sctmData = await sctmDataCollectionService.collectSCTMData(request.systemId);

      // Create a new Excel workbook
      const workbook = new ExcelJS.Workbook();
      
      // Set workbook properties
      workbook.creator = 'ATO Compliance Agent';
      workbook.lastModifiedBy = 'ATO Compliance Agent';
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.title = `SCTM - ${system.name}`;
      
      // Create the main SCTM worksheet
      const worksheet = workbook.addWorksheet('SCTM');
      
      // Add headers
      const headers = [
        'Control ID',
        'Control Title', 
        'Control Family',
        'Implementation Status',
        'Implementation Description',
        'Responsible Entity',
        'Assessment Date',
        'Assessment Result',
        'Evidence References',
        'STIG Rules',
        'Vulnerabilities',
        'Notes'
      ];
      
      // Style the header row
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Add system info at the top
      worksheet.insertRow(1, [`System: ${system.name}`]);
      worksheet.insertRow(2, [`Impact Level: ${sctmData.systemInfo.impactLevel}`]);
      worksheet.insertRow(3, [`Assessment Date: ${sctmData.systemInfo.assessmentDate}`]);
      worksheet.insertRow(4, ['']); // Empty row

      // Add control data with enhanced descriptions
      for (let i = 0; i < sctmData.controls.length; i++) {
        const control = sctmData.controls[i];
        
        // Generate intelligent implementation description using LLM
        const enhancedDescription = await this.generateImplementationDescription(
          control, 
          sctmData.systemInfo
        );
        
        const rowData = [
          control.controlId,
          control.controlTitle,
          control.controlFamily,
          control.implementationStatus,
          enhancedDescription, // Use LLM-generated description
          'System Owner', // responsibleEntity
          sctmData.systemInfo.assessmentDate,
          control.implementationStatus === 'Implemented' ? 'Compliant' : 
            control.implementationStatus === 'Partially Implemented' ? 'Partially Compliant' : 'Non-Compliant',
          control.evidence.join('; '),
          control.stigRules.map(rule => `${rule.ruleId}: ${rule.ruleTitle}`).join('; '),
          control.findings.map(f => `${f.findingId} (${f.severity})`).join('; '),
          '' // notes
        ];
        
        const row = worksheet.addRow(rowData);
        
        // Style based on implementation status
        const statusColor = this.getStatusColor(control.implementationStatus);
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          if (statusColor) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor } };
          }
        });
      }

      // Auto-fit columns
      worksheet.columns.forEach((column, index) => {
        if (index === 1 || index === 4) { // Title and Description columns
          column.width = 40;
        } else if (index === 8 || index === 9 || index === 10) { // Reference columns
          column.width = 25;
        } else {
          column.width = 15;
        }
      });

      // Add summary worksheet
      const summaryWorksheet = workbook.addWorksheet('Summary');
      summaryWorksheet.addRow(['Security Control Traceability Matrix Summary']);
      summaryWorksheet.addRow([]);
      summaryWorksheet.addRow(['System Information:']);
      summaryWorksheet.addRow(['System Name:', system.name]);
      summaryWorksheet.addRow(['Impact Level:', sctmData.systemInfo.impactLevel]);
      summaryWorksheet.addRow(['Assessment Date:', sctmData.systemInfo.assessmentDate]);
      summaryWorksheet.addRow([]);
      summaryWorksheet.addRow(['Control Summary:']);
      summaryWorksheet.addRow(['Total Controls:', sctmData.summary.totalControls]);
      summaryWorksheet.addRow(['Implemented Controls:', sctmData.summary.implementedControls]);
      summaryWorksheet.addRow(['Partially Implemented:', sctmData.summary.partiallyImplementedControls]);
      summaryWorksheet.addRow(['Not Implemented:', sctmData.summary.notImplementedControls]);
      summaryWorksheet.addRow([]);
      summaryWorksheet.addRow(['STIG Compliance:']);
      summaryWorksheet.addRow(['Compliant Rules:', sctmData.summary.compliantStigRules]);
      summaryWorksheet.addRow(['Non-Compliant Rules:', sctmData.summary.nonCompliantStigRules]);

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = this.generateFilename(system.name, request.format);

      return {
        success: true,
        document: {
          content: Buffer.from(buffer),
          filename,
          metadata: {
            totalControls: sctmData.summary.totalControls,
            implementedControls: sctmData.summary.implementedControls,
            partiallyImplementedControls: sctmData.summary.partiallyImplementedControls,
            notImplementedControls: sctmData.summary.notImplementedControls,
            compliantStigRules: sctmData.summary.compliantStigRules,
            nonCompliantStigRules: sctmData.summary.nonCompliantStigRules,
            templateName: 'Built-in SCTM Template',
            templateVersion: '1.0',
            variablesUsed: []
          }
        },
        templateInfo: {
          name: 'Built-in SCTM Template',
          version: '1.0',
          variables: []
        }
      };

    } catch (error) {
      console.error('Programmatic SCTM generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate intelligent implementation description using LLM
   */
  private async generateImplementationDescription(
    control: SCTMData['controls'][0], 
    systemInfo: SCTMData['systemInfo']
  ): Promise<string> {
    try {
      const prompt = `Generate a professional implementation description for the following security control in a Security Control Traceability Matrix (SCTM):

**System Information:**
- System Name: ${systemInfo.systemName}
- System Description: ${systemInfo.systemDescription}
- Impact Level: ${systemInfo.impactLevel}
- Organization: ${systemInfo.organization}

**Control Information:**
- Control ID: ${control.controlId}
- Control Title: ${control.controlTitle}
- Control Family: ${control.controlFamily}
- Current Status: ${control.implementationStatus}
- Available Evidence: ${control.evidence.length > 0 ? control.evidence.join(', ') : 'No evidence provided'}
- STIG Rules: ${control.stigRules.length > 0 ? control.stigRules.map(r => r.ruleTitle).join(', ') : 'None applicable'}
- Findings: ${control.findings.length > 0 ? control.findings.map(f => `${f.description} (${f.severity})`).join(', ') : 'No findings'}

Generate a concise, professional implementation description (2-3 sentences) that:
1. Describes how this control is implemented in the context of this system
2. References specific evidence or implementation methods when available
3. Acknowledges any findings or gaps if present
4. Uses appropriate security terminology
5. Is suitable for an official government compliance document

Keep the response under 200 words and focus on factual implementation details.`;

      const response = await modelRouter.generateText([{ role: 'user', content: prompt }], {
        maxTokens: 300,
        temperature: 0.2  // Low temperature for consistent, factual content
      });
      
      return response.content.trim();
    } catch (error) {
      console.error('Failed to generate implementation description:', error);
      // Fallback to basic description
      return control.implementationDescription || `${control.controlTitle} is ${control.implementationStatus.toLowerCase()} for the ${systemInfo.systemName} system.`;
    }
  }

  /**
   * Get color for implementation status
   */
  private getStatusColor(status: string): string | null {
    switch (status) {
      case 'Implemented':
        return 'FF90EE90'; // Light green
      case 'Partially Implemented':
        return 'FFFFD700'; // Gold
      case 'Not Implemented':
        return 'FFFFA07A'; // Light salmon
      case 'Not Applicable':
        return 'FFD3D3D3'; // Light gray
      default:
        return null;
    }
  }
}

// Export singleton instance
export const sctmGenerationService = new SCTMGenerationService();
