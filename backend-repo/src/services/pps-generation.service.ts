// PPS Generation Service
// Generates Privacy Impact Assessment (PPS) worksheets using Excel templates

import * as ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { storage } from '../storage';
import { PPSDataCollectionService, type PPSData } from './pps-data-collection.service';
import { ExcelTemplateParser, type ExcelTemplateParseResult } from '../parsers/excel-template-parser';
import type { TemplateVersion } from '../schema';

export interface PPSGenerationRequest {
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

export interface PPSGenerationResult {
  success: boolean;
  document: {
    content: Buffer;
    filename: string;
    metadata: {
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

export class PPSGenerationService {
  private readonly MAX_GENERATION_TIME_MS = 30000; // 30 seconds
  private readonly TEMPLATE_CACHE_TTL_MS = 300000; // 5 minutes
  private templateCache = new Map<string, { template: TemplateVersion; timestamp: number }>();

  /**
   * Generate PPS worksheet using Excel template
   */
  async generatePPS(request: PPSGenerationRequest): Promise<PPSGenerationResult> {
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
        throw new Error(`No applicable template found for PPS generation`);
      }

      // 3. Parse template to extract variables
      const parseResult = await this.parseTemplate(template);
      if (!parseResult.success) {
        throw new Error(`Template parsing failed: ${parseResult.errors?.map(e => e.message).join(', ')}`);
      }

      // 4. Collect PPS data
      const ppsDataCollectionService = new PPSDataCollectionService();
      const ppsData = await ppsDataCollectionService.collectPPSData(request.systemId);

      // 5. Generate Excel document
      const documentContent = await this.generateExcelDocument(
        template,
        ppsData,
        parseResult.variables,
        request.format
      );

      // 6. Create filename
      const filename = this.generateFilename(system.name, request.format);

      // 7. Calculate metadata
      const metadata = this.calculateMetadata(ppsData, template, parseResult.variables);

      // Check generation time
      const generationTime = Date.now() - startTime;
      if (generationTime > this.MAX_GENERATION_TIME_MS) {
        console.warn(`PPS generation took ${generationTime}ms, exceeding limit of ${this.MAX_GENERATION_TIME_MS}ms`);
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
      console.error('PPS generation failed:', error);
      return {
        success: false,
        document: {
          content: Buffer.alloc(0),
          filename: '',
          metadata: {
            totalDataTypes: 0,
            totalPrivacyRisks: 0,
            criticalPrivacyRisks: 0,
            highPrivacyRisks: 0,
            mediumPrivacyRisks: 0,
            lowPrivacyRisks: 0,
            implementedControls: 0,
            partiallyImplementedControls: 0,
            notImplementedControls: 0,
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
   * Find applicable template for PPS generation
   */
  private async findApplicableTemplate(request: PPSGenerationRequest): Promise<TemplateVersion | null> {
    try {
      // If specific template ID provided, use it
      if (request.templateId) {
        const template = await storage.getTemplate(request.templateId);
        return template?.activeVersion || null;
      }

      // Find default template for PPS
      const templates = await storage.getTemplatesByType('pps_worksheet');
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
    ppsData: PPSData,
    variables: any[],
    format: 'xlsx' | 'xls'
  ): Promise<Buffer> {
    try {
      // Load template file
      const templatePath = join(process.cwd(), 'uploads', 'templates', template.fileName);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(templatePath);

      // Apply data to worksheets
      this.applyDataToWorkbook(workbook, ppsData, variables);

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);

    } catch (error) {
      console.error('Error generating Excel document:', error);
      // Fallback: generate simple Excel document
      return this.generateFallbackExcelDocument(ppsData);
    }
  }

  /**
   * Apply data to workbook
   */
  private applyDataToWorkbook(
    workbook: ExcelJS.Workbook,
    ppsData: PPSData,
    variables: any[]
  ): void {
    // Process each worksheet
    workbook.eachSheet((worksheet, sheetId) => {
      this.applyDataToWorksheet(worksheet, ppsData, variables);
    });
  }

  /**
   * Apply data to worksheet
   */
  private applyDataToWorksheet(
    worksheet: ExcelJS.Worksheet,
    ppsData: PPSData,
    variables: any[]
  ): void {
    // Replace variables in cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell.value && typeof cell.value === 'string') {
          const newValue = this.replaceVariables(cell.value, ppsData, variables);
          if (newValue !== cell.value) {
            cell.value = newValue;
          }
        }
      });
    });

    // Add data collection rows
    this.addDataCollectionRows(worksheet, ppsData.dataCollection);
    
    // Add privacy risk rows
    this.addPrivacyRiskRows(worksheet, ppsData.privacyRisks);
    
    // Add privacy control rows
    this.addPrivacyControlRows(worksheet, ppsData.privacyControls);
  }

  /**
   * Replace variables in text
   */
  private replaceVariables(text: string, ppsData: PPSData, variables: any[]): string {
    let result = text;

    // Replace system info variables
    result = this.replaceSystemVariables(result, ppsData.systemInfo);
    
    // Replace privacy assessment variables
    result = this.replacePrivacyAssessmentVariables(result, ppsData.privacyAssessment);
    
    // Replace summary variables
    result = this.replaceSummaryVariables(result, ppsData.summary);
    
    // Replace data subject rights variables
    result = this.replaceDataSubjectRightsVariables(result, ppsData.dataSubjectRights);

    return result;
  }

  /**
   * Replace system information variables
   */
  private replaceSystemVariables(text: string, systemInfo: PPSData['systemInfo']): string {
    const replacements: Record<string, string> = {
      '{{systemName}}': systemInfo.systemName,
      '{{systemDescription}}': systemInfo.systemDescription,
      '{{dataClassification}}': systemInfo.dataClassification,
      '{{owner}}': systemInfo.owner,
      '{{assessmentDate}}': systemInfo.assessmentDate,
      '{{privacyOfficer}}': systemInfo.privacyOfficer,
      '{{organization}}': systemInfo.organization
    };

    let result = text;
    for (const [variable, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Replace privacy assessment variables
   */
  private replacePrivacyAssessmentVariables(text: string, privacyAssessment: PPSData['privacyAssessment']): string {
    const replacements: Record<string, string> = {
      '{{assessmentType}}': privacyAssessment.assessmentType,
      '{{assessmentScope}}': privacyAssessment.assessmentScope,
      '{{legalBasis}}': privacyAssessment.legalBasis.join(', '),
      '{{applicableLaws}}': privacyAssessment.applicableLaws.join(', ')
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
  private replaceSummaryVariables(text: string, summary: PPSData['summary']): string {
    const replacements: Record<string, string> = {
      '{{totalDataTypes}}': summary.totalDataTypes.toString(),
      '{{totalPrivacyRisks}}': summary.totalPrivacyRisks.toString(),
      '{{criticalPrivacyRisks}}': summary.criticalPrivacyRisks.toString(),
      '{{highPrivacyRisks}}': summary.highPrivacyRisks.toString(),
      '{{mediumPrivacyRisks}}': summary.mediumPrivacyRisks.toString(),
      '{{lowPrivacyRisks}}': summary.lowPrivacyRisks.toString(),
      '{{implementedControls}}': summary.implementedControls.toString(),
      '{{partiallyImplementedControls}}': summary.partiallyImplementedControls.toString(),
      '{{notImplementedControls}}': summary.notImplementedControls.toString(),
      '{{averageRiskScore}}': summary.averageRiskScore.toString()
    };

    let result = text;
    for (const [variable, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Replace data subject rights variables
   */
  private replaceDataSubjectRightsVariables(text: string, dataSubjectRights: PPSData['dataSubjectRights']): string {
    const replacements: Record<string, string> = {
      '{{rightToAccess}}': dataSubjectRights.rightToAccess,
      '{{rightToRectification}}': dataSubjectRights.rightToRectification,
      '{{rightToErasure}}': dataSubjectRights.rightToErasure,
      '{{rightToRestrictProcessing}}': dataSubjectRights.rightToRestrictProcessing,
      '{{rightToDataPortability}}': dataSubjectRights.rightToDataPortability,
      '{{rightToObject}}': dataSubjectRights.rightToObject,
      '{{automatedDecisionMaking}}': dataSubjectRights.automatedDecisionMaking,
      '{{complaintProcedures}}': dataSubjectRights.complaintProcedures
    };

    let result = text;
    for (const [variable, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Add data collection rows to worksheet
   */
  private addDataCollectionRows(worksheet: ExcelJS.Worksheet, dataCollection: PPSData['dataCollection']): void {
    // Find the data collection section (look for header row)
    let startRow = 1;
    let found = false;
    
    worksheet.eachRow((row, rowNumber) => {
      if (!found && row.getCell(1).value?.toString().toLowerCase().includes('data collection')) {
        startRow = rowNumber + 1;
        found = true;
      }
    });

    // Add data collection entries
    dataCollection.forEach((data, index) => {
      const row = startRow + index;
      worksheet.getRow(row).values = [
        data.dataType,
        data.dataCategory,
        data.dataSource,
        data.dataPurpose,
        data.legalBasis,
        data.retentionPeriod,
        data.dataSubjects,
        data.dataVolume,
        data.dataLocation,
        data.dataSharing.join('; '),
        data.dataTransfers.join('; ')
      ];
    });
  }

  /**
   * Add privacy risk rows to worksheet
   */
  private addPrivacyRiskRows(worksheet: ExcelJS.Worksheet, privacyRisks: PPSData['privacyRisks']): void {
    // Find the privacy risks section
    let startRow = 1;
    let found = false;
    
    worksheet.eachRow((row, rowNumber) => {
      if (!found && row.getCell(1).value?.toString().toLowerCase().includes('privacy risk')) {
        startRow = rowNumber + 1;
        found = true;
      }
    });

    // Add privacy risk entries
    privacyRisks.forEach((risk, index) => {
      const row = startRow + index;
      worksheet.getRow(row).values = [
        risk.riskId,
        risk.riskTitle,
        risk.riskDescription,
        risk.riskCategory,
        risk.likelihood,
        risk.impact,
        risk.riskScore,
        risk.riskLevel,
        risk.affectedDataTypes.join('; '),
        risk.privacyControls.join('; '),
        risk.mitigationStrategy,
        risk.mitigationStatus,
        risk.mitigationOwner,
        risk.mitigationDueDate,
        risk.residualRisk
      ];
    });
  }

  /**
   * Add privacy control rows to worksheet
   */
  private addPrivacyControlRows(worksheet: ExcelJS.Worksheet, privacyControls: PPSData['privacyControls']): void {
    // Find the privacy controls section
    let startRow = 1;
    let found = false;
    
    worksheet.eachRow((row, rowNumber) => {
      if (!found && row.getCell(1).value?.toString().toLowerCase().includes('privacy control')) {
        startRow = rowNumber + 1;
        found = true;
      }
    });

    // Add privacy control entries
    privacyControls.forEach((control, index) => {
      const row = startRow + index;
      worksheet.getRow(row).values = [
        control.controlId,
        control.controlTitle,
        control.controlDescription,
        control.controlType,
        control.implementationStatus,
        control.effectiveness,
        control.dataTypes.join('; '),
        control.riskMitigation.join('; ')
      ];
    });
  }

  /**
   * Generate fallback Excel document
   */
  private async generateFallbackExcelDocument(ppsData: PPSData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Create summary worksheet
    const summarySheet = workbook.addWorksheet('Privacy Assessment Summary');
    this.createSummaryWorksheet(summarySheet, ppsData);
    
    // Create data collection worksheet
    const dataSheet = workbook.addWorksheet('Data Collection');
    this.createDataCollectionWorksheet(dataSheet, ppsData);
    
    // Create privacy risks worksheet
    const risksSheet = workbook.addWorksheet('Privacy Risks');
    this.createPrivacyRisksWorksheet(risksSheet, ppsData);
    
    // Create privacy controls worksheet
    const controlsSheet = workbook.addWorksheet('Privacy Controls');
    this.createPrivacyControlsWorksheet(controlsSheet, ppsData);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Create summary worksheet
   */
  private createSummaryWorksheet(worksheet: ExcelJS.Worksheet, ppsData: PPSData): void {
    worksheet.addRow(['Privacy Impact Assessment Summary']);
    worksheet.addRow(['System Name', ppsData.systemInfo.systemName]);
    worksheet.addRow(['Assessment Date', ppsData.privacyAssessment.assessmentDate]);
    worksheet.addRow(['Privacy Officer', ppsData.privacyAssessment.privacyOfficer]);
    worksheet.addRow(['Assessment Type', ppsData.privacyAssessment.assessmentType]);
    worksheet.addRow(['']);
    worksheet.addRow(['Summary Statistics']);
    worksheet.addRow(['Total Data Types', ppsData.summary.totalDataTypes]);
    worksheet.addRow(['Total Privacy Risks', ppsData.summary.totalPrivacyRisks]);
    worksheet.addRow(['Critical Risks', ppsData.summary.criticalPrivacyRisks]);
    worksheet.addRow(['High Risks', ppsData.summary.highPrivacyRisks]);
    worksheet.addRow(['Medium Risks', ppsData.summary.mediumPrivacyRisks]);
    worksheet.addRow(['Low Risks', ppsData.summary.lowPrivacyRisks]);
    worksheet.addRow(['Implemented Controls', ppsData.summary.implementedControls]);
    worksheet.addRow(['Partially Implemented Controls', ppsData.summary.partiallyImplementedControls]);
    worksheet.addRow(['Not Implemented Controls', ppsData.summary.notImplementedControls]);
    worksheet.addRow(['Average Risk Score', ppsData.summary.averageRiskScore]);
  }

  /**
   * Create data collection worksheet
   */
  private createDataCollectionWorksheet(worksheet: ExcelJS.Worksheet, ppsData: PPSData): void {
    worksheet.addRow(['Data Collection Activities']);
    worksheet.addRow(['Data Type', 'Category', 'Source', 'Purpose', 'Legal Basis', 'Retention', 'Subjects', 'Volume', 'Location', 'Sharing', 'Transfers']);
    
    ppsData.dataCollection.forEach(data => {
      worksheet.addRow([
        data.dataType,
        data.dataCategory,
        data.dataSource,
        data.dataPurpose,
        data.legalBasis,
        data.retentionPeriod,
        data.dataSubjects,
        data.dataVolume,
        data.dataLocation,
        data.dataSharing.join('; '),
        data.dataTransfers.join('; ')
      ]);
    });
  }

  /**
   * Create privacy risks worksheet
   */
  private createPrivacyRisksWorksheet(worksheet: ExcelJS.Worksheet, ppsData: PPSData): void {
    worksheet.addRow(['Privacy Risks']);
    worksheet.addRow(['Risk ID', 'Title', 'Description', 'Category', 'Likelihood', 'Impact', 'Score', 'Level', 'Data Types', 'Controls', 'Mitigation', 'Status', 'Owner', 'Due Date', 'Residual Risk']);
    
    ppsData.privacyRisks.forEach(risk => {
      worksheet.addRow([
        risk.riskId,
        risk.riskTitle,
        risk.riskDescription,
        risk.riskCategory,
        risk.likelihood,
        risk.impact,
        risk.riskScore,
        risk.riskLevel,
        risk.affectedDataTypes.join('; '),
        risk.privacyControls.join('; '),
        risk.mitigationStrategy,
        risk.mitigationStatus,
        risk.mitigationOwner,
        risk.mitigationDueDate,
        risk.residualRisk
      ]);
    });
  }

  /**
   * Create privacy controls worksheet
   */
  private createPrivacyControlsWorksheet(worksheet: ExcelJS.Worksheet, ppsData: PPSData): void {
    worksheet.addRow(['Privacy Controls']);
    worksheet.addRow(['Control ID', 'Title', 'Description', 'Type', 'Status', 'Effectiveness', 'Data Types', 'Risk Mitigation']);
    
    ppsData.privacyControls.forEach(control => {
      worksheet.addRow([
        control.controlId,
        control.controlTitle,
        control.controlDescription,
        control.controlType,
        control.implementationStatus,
        control.effectiveness,
        control.dataTypes.join('; '),
        control.riskMitigation.join('; ')
      ]);
    });
  }

  /**
   * Generate filename for PPS document
   */
  private generateFilename(systemName: string, format: 'xlsx' | 'xls'): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedName = systemName.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `PPS_${sanitizedName}_${timestamp}.${format}`;
  }

  /**
   * Calculate metadata for generated document
   */
  private calculateMetadata(
    ppsData: PPSData,
    template: TemplateVersion,
    variables: any[]
  ): PPSGenerationResult['document']['metadata'] {
    return {
      totalDataTypes: ppsData.summary.totalDataTypes,
      totalPrivacyRisks: ppsData.summary.totalPrivacyRisks,
      criticalPrivacyRisks: ppsData.summary.criticalPrivacyRisks,
      highPrivacyRisks: ppsData.summary.highPrivacyRisks,
      mediumPrivacyRisks: ppsData.summary.mediumPrivacyRisks,
      lowPrivacyRisks: ppsData.summary.lowPrivacyRisks,
      implementedControls: ppsData.summary.implementedControls,
      partiallyImplementedControls: ppsData.summary.partiallyImplementedControls,
      notImplementedControls: ppsData.summary.notImplementedControls,
      averageRiskScore: ppsData.summary.averageRiskScore,
      templateName: template.fileName,
      templateVersion: template.version.toString(),
      variablesUsed: variables.map(v => v.name)
    };
  }
}

// Export singleton instance
export const ppsGenerationService = new PPSGenerationService();











