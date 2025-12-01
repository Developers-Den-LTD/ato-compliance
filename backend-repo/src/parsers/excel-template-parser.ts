// Excel Template Parser
// Parses Excel files to extract merge fields and validate template structure

import ExcelJS from 'exceljs';
import type { TemplateVersion } from '../schema';

export interface ExcelTemplateParseResult {
  success: boolean;
  variables: ExcelTemplateVariable[];
  structure: ExcelTemplateStructure;
  errors: ExcelParsingError[];
  metadata: ExcelTemplateMetadata;
}

export interface ExcelTemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'formula' | 'list' | 'object';
  required: boolean;
  defaultValue?: string;
  description?: string;
  position: {
    worksheet: string;
    cell: string;
    row: number;
    column: number;
  };
  context: string; // Surrounding text for context
  isFormula: boolean;
  formula?: string;
}

export interface ExcelTemplateStructure {
  worksheets: ExcelWorksheet[];
  complianceRequirements: ComplianceRequirement[];
  documentType: 'sctm_excel' | 'pps_worksheet';
  estimatedRows: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface ExcelWorksheet {
  name: string;
  index: number;
  variables: string[]; // Variable names in this worksheet
  required: boolean;
  hasFormulas: boolean;
  hasCharts: boolean;
  hasConditionalFormatting: boolean;
  hasDataValidation: boolean;
  isProtected: boolean;
}

export interface ComplianceRequirement {
  section: string;
  requirement: string;
  status: 'present' | 'missing' | 'partial';
  variables: string[];
}

export interface ExcelTemplateMetadata {
  fileName: string;
  fileSize: number;
  lastModified: Date;
  excelVersion: string;
  totalWorksheets: number;
  totalVariables: number;
  hasMacros: boolean;
  isPasswordProtected: boolean;
}

export interface ExcelParsingError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  position?: {
    worksheet: string;
    cell?: string;
    row?: number;
    column?: number;
  };
}

export class ExcelTemplateParser {
  private readonly VARIABLE_PATTERNS = [
    /\{\{([^}]+)\}\}/g,  // {{variableName}}
    /\{([^}]+)\}/g,       // {variableName}
    /\$\{([^}]+)\}/g,     // ${variableName}
    /\[\[([^\]]+)\]\]/g,  // [[variableName]]
    /\{%([^%]+)%\}/g      // {%variableName%}
  ];

  /**
   * Parse Excel template to extract variables and structure
   */
  async parseTemplate(template: TemplateVersion): Promise<ExcelTemplateParseResult> {
    const result: ExcelTemplateParseResult = {
      success: false,
      variables: [],
      structure: {
        worksheets: [],
        complianceRequirements: [],
        documentType: this.determineDocumentType(template.fileName),
        estimatedRows: 0,
        complexity: 'low'
      },
      errors: [],
      metadata: {
        fileName: template.fileName,
        fileSize: template.sizeBytes,
        lastModified: template.createdAt,
        excelVersion: 'Unknown',
        totalWorksheets: 0,
        totalVariables: 0,
        hasMacros: false,
        isPasswordProtected: false
      }
    };

    try {
      // Read template file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(template.filePath);

      // Update metadata
      result.metadata.totalWorksheets = workbook.worksheets.length;
      result.metadata.excelVersion = workbook.creator || 'Unknown';

      // Parse each worksheet
      for (let i = 0; i < workbook.worksheets.length; i++) {
        const worksheet = workbook.worksheets[i];
        const worksheetResult = await this.parseWorksheet(worksheet, result.documentType);
        
        result.variables.push(...worksheetResult.variables);
        result.structure.worksheets.push(worksheetResult.worksheet);
        result.errors.push(...worksheetResult.errors);
      }

      // Update summary metadata
      result.metadata.totalVariables = result.variables.length;
      result.structure.estimatedRows = this.calculateEstimatedRows(result.structure.worksheets);
      result.structure.complexity = this.calculateComplexity(result.structure.worksheets);

      // Validate compliance requirements
      result.structure.complianceRequirements = this.validateComplianceRequirements(
        result.structure.worksheets,
        result.structure.documentType
      );

      // Check for critical errors
      const criticalErrors = result.errors.filter(e => e.severity === 'error');
      if (criticalErrors.length === 0) {
        result.success = true;
      }

    } catch (error) {
      result.errors.push({
        code: 'PARSE_ERROR',
        message: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }

    return result;
  }

  /**
   * Parse individual worksheet
   */
  private async parseWorksheet(
    worksheet: ExcelJS.Worksheet, 
    documentType: string
  ): Promise<{
    variables: ExcelTemplateVariable[];
    worksheet: ExcelWorksheet;
    errors: ExcelParsingError[];
  }> {
    const variables: ExcelTemplateVariable[] = [];
    const errors: ExcelParsingError[] = [];

    const worksheetInfo: ExcelWorksheet = {
      name: worksheet.name,
      index: worksheet.id,
      variables: [],
      required: this.isRequiredWorksheet(worksheet.name, documentType),
      hasFormulas: false,
      hasCharts: false,
      hasConditionalFormatting: false,
      hasDataValidation: false,
      isProtected: worksheet.protect ? true : false
    };

    // Check for charts
    if (worksheet.model && (worksheet.model as any).drawings) {
      worksheetInfo.hasCharts = true;
    }

    // Check for conditional formatting
    if (worksheet.model && (worksheet.model as any).conditionalFormattings) {
      worksheetInfo.hasConditionalFormatting = true;
    }

    // Check for data validation
    if (worksheet.model && (worksheet.model as any).dataValidations) {
      worksheetInfo.hasDataValidation = true;
    }

    // Parse each cell for variables
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        const cellAddress = cell.address;
        const cellValue = cell.value;

        // Check if cell contains variables
        if (typeof cellValue === 'string' || typeof cellValue === 'number') {
          const cellText = String(cellValue);
          const foundVariables = this.extractVariablesFromText(cellText);

          for (const variable of foundVariables) {
            const templateVariable: ExcelTemplateVariable = {
              name: variable.name,
              type: this.determineVariableType(variable.name, cellText),
              required: this.isRequiredVariable(variable.name),
              description: this.getVariableDescription(variable.name),
              position: {
                worksheet: worksheet.name,
                cell: cellAddress,
                row: rowNumber,
                column: colNumber
              },
              context: this.getContextAroundCell(worksheet, rowNumber, colNumber),
              isFormula: false,
              formula: undefined
            };

            variables.push(templateVariable);
            worksheetInfo.variables.push(variable.name);
          }
        }

        // Check if cell contains formula with variables
        if (cell.formula) {
          worksheetInfo.hasFormulas = true;
          const formulaText = cell.formula;
          const foundVariables = this.extractVariablesFromText(formulaText);

          for (const variable of foundVariables) {
            const templateVariable: ExcelTemplateVariable = {
              name: variable.name,
              type: 'formula',
              required: this.isRequiredVariable(variable.name),
              description: this.getVariableDescription(variable.name),
              position: {
                worksheet: worksheet.name,
                cell: cellAddress,
                row: rowNumber,
                column: colNumber
              },
              context: this.getContextAroundCell(worksheet, rowNumber, colNumber),
              isFormula: true,
              formula: formulaText
            };

            variables.push(templateVariable);
            worksheetInfo.variables.push(variable.name);
          }
        }
      });
    });

    return { variables, worksheet: worksheetInfo, errors };
  }

  /**
   * Extract variables from text using multiple patterns
   */
  private extractVariablesFromText(text: string): Array<{ name: string; fullMatch: string }> {
    const variables: Array<{ name: string; fullMatch: string }> = [];

    for (const pattern of this.VARIABLE_PATTERNS) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        variables.push({
          name: match[1].trim(),
          fullMatch: match[0]
        });
      }
    }

    return variables;
  }

  /**
   * Determine document type from filename
   */
  private determineDocumentType(fileName: string): 'sctm_excel' | 'pps_worksheet' {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('sctm') || lowerName.includes('traceability')) {
      return 'sctm_excel';
    } else if (lowerName.includes('pps') || lowerName.includes('privacy')) {
      return 'pps_worksheet';
    }
    return 'sctm_excel'; // Default
  }

  /**
   * Determine if worksheet is required for document type
   */
  private isRequiredWorksheet(worksheetName: string, documentType: string): boolean {
    const lowerName = worksheetName.toLowerCase();
    
    if (documentType === 'sctm_excel') {
      return lowerName.includes('control') || lowerName.includes('traceability') || lowerName.includes('summary');
    } else if (documentType === 'pps_worksheet') {
      return lowerName.includes('privacy') || lowerName.includes('data') || lowerName.includes('assessment');
    }
    
    return false;
  }

  /**
   * Determine variable type based on name and context
   */
  private determineVariableType(name: string, context: string): ExcelTemplateVariable['type'] {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('date') || lowerName.includes('time')) {
      return 'date';
    } else if (lowerName.includes('count') || lowerName.includes('total') || lowerName.includes('number')) {
      return 'number';
    } else if (lowerName.includes('status') || lowerName.includes('enabled') || lowerName.includes('active')) {
      return 'boolean';
    } else if (lowerName.includes('list') || lowerName.includes('array')) {
      return 'list';
    } else if (lowerName.includes('object') || lowerName.includes('data')) {
      return 'object';
    }
    
    return 'text';
  }

  /**
   * Check if variable is required
   */
  private isRequiredVariable(name: string): boolean {
    const requiredVariables = [
      'systemName', 'systemDescription', 'impactLevel', 'owner',
      'totalControls', 'implementedControls', 'assessmentDate'
    ];
    
    return requiredVariables.some(req => name.toLowerCase().includes(req.toLowerCase()));
  }

  /**
   * Get variable description
   */
  private getVariableDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'systemName': 'Name of the system being assessed',
      'systemDescription': 'Description of the system',
      'impactLevel': 'Impact level (Low, Moderate, High)',
      'owner': 'System owner or responsible party',
      'assessmentDate': 'Date of the assessment',
      'totalControls': 'Total number of controls',
      'implementedControls': 'Number of implemented controls',
      'controlId': 'Control identifier (e.g., AC-1)',
      'controlTitle': 'Control title',
      'implementationStatus': 'Implementation status',
      'stigRuleId': 'STIG rule identifier',
      'complianceStatus': 'Compliance status'
    };

    return descriptions[name] || `Variable: ${name}`;
  }

  /**
   * Get context around cell
   */
  private getContextAroundCell(worksheet: ExcelJS.Worksheet, row: number, col: number): string {
    const context: string[] = [];
    
    // Get cell above
    const cellAbove = worksheet.getCell(row - 1, col);
    if (cellAbove.value) {
      context.push(`Above: ${cellAbove.value}`);
    }
    
    // Get cell to the left
    const cellLeft = worksheet.getCell(row, col - 1);
    if (cellLeft.value) {
      context.push(`Left: ${cellLeft.value}`);
    }
    
    return context.join(' | ');
  }

  /**
   * Calculate estimated rows
   */
  private calculateEstimatedRows(worksheets: ExcelWorksheet[]): number {
    return worksheets.reduce((total, ws) => {
      // Estimate based on variables (rough approximation)
      return total + Math.max(ws.variables.length * 2, 10);
    }, 0);
  }

  /**
   * Calculate complexity
   */
  private calculateComplexity(worksheets: ExcelWorksheet[]): 'low' | 'medium' | 'high' {
    let complexityScore = 0;
    
    for (const ws of worksheets) {
      if (ws.hasFormulas) complexityScore += 2;
      if (ws.hasCharts) complexityScore += 3;
      if (ws.hasConditionalFormatting) complexityScore += 2;
      if (ws.hasDataValidation) complexityScore += 1;
      if (ws.isProtected) complexityScore += 1;
      complexityScore += Math.min(ws.variables.length / 10, 5); // Cap at 5
    }
    
    if (complexityScore <= 5) return 'low';
    if (complexityScore <= 15) return 'medium';
    return 'high';
  }

  /**
   * Validate compliance requirements
   */
  private validateComplianceRequirements(
    worksheets: ExcelWorksheet[], 
    documentType: string
  ): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [];
    
    if (documentType === 'sctm_excel') {
      // Check for required SCTM sections
      const hasControlSection = worksheets.some(ws => 
        ws.name.toLowerCase().includes('control') || ws.name.toLowerCase().includes('traceability')
      );
      
      requirements.push({
        section: 'Control Traceability',
        requirement: 'Control mapping section must be present',
        status: hasControlSection ? 'present' : 'missing',
        variables: ['controlId', 'controlTitle', 'implementationStatus']
      });
    } else if (documentType === 'pps_worksheet') {
      // Check for required PPS sections
      const hasPrivacySection = worksheets.some(ws => 
        ws.name.toLowerCase().includes('privacy') || ws.name.toLowerCase().includes('data')
      );
      
      requirements.push({
        section: 'Privacy Assessment',
        requirement: 'Privacy assessment section must be present',
        status: hasPrivacySection ? 'present' : 'missing',
        variables: ['dataType', 'privacyRisk', 'mitigationStrategy']
      });
    }
    
    return requirements;
  }
}

// Export singleton instance
export const excelTemplateParser = new ExcelTemplateParser();
