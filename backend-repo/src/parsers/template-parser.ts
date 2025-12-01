// Template Document Parser
// Parses various document formats to extract merge fields and validate template structure

import { promises as fs } from 'fs';
import { join, extname } from 'path';
import type { TemplateVersion } from '../schema';

// Document parsing libraries
import * as mammoth from 'mammoth';
import * as htmlParser from 'node-html-parser';
import * as marked from 'marked';
import PizZip from 'pizzip';

export interface TemplateParseResult {
  success: boolean;
  variables: TemplateVariable[];
  structure: TemplateStructure;
  errors: ParsingError[];
  metadata: TemplateMetadata;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'list' | 'object';
  required: boolean;
  defaultValue?: string;
  description?: string;
  position: {
    start: number;
    end: number;
    line?: number;
    column?: number;
  };
  context: string; // Surrounding text for context
}

export interface TemplateStructure {
  sections: TemplateSection[];
  complianceRequirements: ComplianceRequirement[];
  documentType: 'ssp' | 'sar' | 'poam' | 'checklist' | 'ato_package' | 'sctm_excel' | 'rar' | 'pps_worksheet';
  estimatedPages: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface TemplateSection {
  name: string;
  type: 'header' | 'content' | 'table' | 'list' | 'footer';
  variables: string[]; // Variable names in this section
  required: boolean;
  order: number;
}

export interface ComplianceRequirement {
  standard: 'NIST' | 'FISMA' | 'FedRAMP' | 'CMMC' | 'Custom';
  control: string;
  section: string;
  required: boolean;
}

export interface TemplateMetadata {
  format: string;
  size: number;
  wordCount: number;
  pageCount: number;
  lastModified: Date;
  checksum: string;
  encoding: string;
}

export interface ParsingError {
  type: 'validation' | 'format' | 'structure' | 'memory';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  position?: {
    start: number;
    end: number;
    line?: number;
    column?: number;
  };
  suggestion?: string;
}

export interface ParserOptions {
  maxMemoryMB?: number;
  validateCompliance?: boolean;
  extractVariables?: boolean;
  analyzeStructure?: boolean;
  timeoutMs?: number;
}

export class TemplateParser {
  name = 'Template Document Parser';
  supportedFormats = [
    '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.odt', 'application/vnd.oasis.opendocument.text',
    '.rtf', 'application/rtf',
    '.html', 'text/html',
    '.md', '.markdown', 'text/markdown',
    '.txt', 'text/plain'
  ];

  private readonly MAX_MEMORY_MB = 512;
  private readonly DEFAULT_TIMEOUT_MS = 30000;

  /**
   * Parse a template document and extract merge fields
   */
  async parseTemplate(
    templateVersion: TemplateVersion,
    options: ParserOptions = {}
  ): Promise<TemplateParseResult> {
    const startTime = Date.now();
    const errors: ParsingError[] = [];
    
    try {
      // Validate file exists and is readable
      await this.validateFile(templateVersion, errors);
      if (errors.some(e => e.severity === 'critical')) {
        return this.createErrorResult(errors);
      }

      // Read file content
      const content = await this.readFileContent(templateVersion, errors);
      if (errors.some(e => e.severity === 'critical')) {
        return this.createErrorResult(errors);
      }

      // Check memory usage
      this.checkMemoryUsage(content, options.maxMemoryMB || this.MAX_MEMORY_MB, errors);

      // Parse based on file format
      const parseResult = await this.parseByFormat(templateVersion, content, options, errors);

      // Validate template structure
      if (options.validateCompliance !== false) {
        this.validateComplianceStructure(parseResult, errors);
      }

      // Calculate metadata
      const metadata = this.calculateMetadata(templateVersion, content);

      return {
        success: errors.filter(e => e.severity === 'critical').length === 0,
        variables: parseResult.variables,
        structure: parseResult.structure,
        errors,
        metadata
      };

    } catch (error) {
      errors.push({
        type: 'format',
        message: `Parser error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
      return this.createErrorResult(errors);
    }
  }

  /**
   * Validate template file
   */
  async validate(content: string | Buffer, mimeType?: string): Promise<boolean> {
    try {
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
      const ext = this.getFileExtension(buffer, mimeType);
      
      return this.supportedFormats.some(format => 
        format.startsWith('.') ? ext === format : format === mimeType
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  /**
   * Parse document by format
   */
  private async parseByFormat(
    templateVersion: TemplateVersion,
    content: Buffer,
    options: ParserOptions,
    errors: ParsingError[]
  ): Promise<{ variables: TemplateVariable[]; structure: TemplateStructure }> {
    const ext = extname(templateVersion.fileName).toLowerCase();
    const mimeType = templateVersion.mimeType;

    switch (ext) {
      case '.docx':
        return await this.parseDocx(content, options, errors);
      case '.odt':
        return await this.parseOdt(content, options, errors);
      case '.rtf':
        return await this.parseRtf(content, options, errors);
      case '.html':
        return await this.parseHtml(content, options, errors);
      case '.md':
      case '.markdown':
        return await this.parseMarkdown(content, options, errors);
      case '.txt':
        return await this.parseText(content, options, errors);
      default:
        errors.push({
          type: 'format',
          message: `Unsupported file format: ${ext}`,
          severity: 'high'
        });
        return { variables: [], structure: this.createEmptyStructure() };
    }
  }

  /**
   * Parse DOCX files
   */
  private async parseDocx(
    content: Buffer,
    options: ParserOptions,
    errors: ParsingError[]
  ): Promise<{ variables: TemplateVariable[]; structure: TemplateStructure }> {
    try {
      const result = await mammoth.extractRawText({ buffer: content });
      const text = result.value;
      
      if (result.messages.length > 0) {
        result.messages.forEach(msg => {
          errors.push({
            type: 'format',
            message: `DOCX parsing warning: ${msg.message}`,
            severity: msg.type === 'error' ? 'high' : 'low'
          });
        });
      }

      return this.extractVariablesFromText(text, 'docx', errors);
    } catch (error) {
      errors.push({
        type: 'format',
        message: `Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
      return { variables: [], structure: this.createEmptyStructure() };
    }
  }

  /**
   * Parse ODT files (OpenDocument Text)
   * ODT files are ZIP archives containing content.xml
   */
  private async parseOdt(
    content: Buffer,
    options: ParserOptions,
    errors: ParsingError[]
  ): Promise<{ variables: TemplateVariable[]; structure: TemplateStructure }> {
    try {
      // Load ODT as ZIP archive using PizZip
      const zip = new PizZip(content);

      // Extract content.xml (main document content)
      const contentXml = zip.file('content.xml')?.asText();

      if (!contentXml) {
        errors.push({
          type: 'format',
          message: 'Invalid ODT file: content.xml not found',
          severity: 'critical'
        });
        return { variables: [], structure: this.createEmptyStructure() };
      }

      // Remove XML tags to get plain text
      const text = contentXml
        .replace(/<[^>]*>/g, ' ')  // Remove XML tags
        .replace(/\s+/g, ' ')      // Normalize whitespace
        .trim();

      // Extract variables from text
      return this.extractVariablesFromText(text, 'odt', errors);

    } catch (error) {
      errors.push({
        type: 'format',
        message: `Failed to parse ODT: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical',
        suggestion: 'Ensure file is a valid OpenDocument Text (.odt) file'
      });
      return { variables: [], structure: this.createEmptyStructure() };
    }
  }

  /**
   * Parse RTF files (Rich Text Format)
   * Strips RTF control codes to extract plain text
   */
  private async parseRtf(
    content: Buffer,
    options: ParserOptions,
    errors: ParsingError[]
  ): Promise<{ variables: TemplateVariable[]; structure: TemplateStructure }> {
    try {
      const rtfText = content.toString('utf8');

      // Remove RTF header
      let cleanText = rtfText.replace(/^{\\rtf[^}]*}/, '');

      // Remove font table
      cleanText = cleanText.replace(/\{\\fonttbl[^}]*\}/g, '');

      // Remove color table
      cleanText = cleanText.replace(/\{\\colortbl[^}]*\}/g, '');

      // Remove style sheet
      cleanText = cleanText.replace(/\{\\stylesheet[^}]*\}/g, '');

      // Remove control words with parameters (e.g., \fs24)
      cleanText = cleanText.replace(/\\[a-z]+(-?\d+)?/g, '');

      // Remove control symbols (e.g., \', \~)
      cleanText = cleanText.replace(/\\[^a-z]/g, '');

      // Remove braces
      cleanText = cleanText.replace(/[{}]/g, '');

      // Normalize whitespace
      cleanText = cleanText.replace(/\s+/g, ' ').trim();

      // Extract variables from cleaned text
      return this.extractVariablesFromText(cleanText, 'rtf', errors);

    } catch (error) {
      errors.push({
        type: 'format',
        message: `Failed to parse RTF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical',
        suggestion: 'Ensure file is a valid Rich Text Format (.rtf) file'
      });
      return { variables: [], structure: this.createEmptyStructure() };
    }
  }

  /**
   * Parse HTML files
   */
  private async parseHtml(
    content: Buffer,
    options: ParserOptions,
    errors: ParsingError[]
  ): Promise<{ variables: TemplateVariable[]; structure: TemplateStructure }> {
    try {
      const html = content.toString('utf8');
      const root = htmlParser.parse(html);
      const text = root.text;
      
      return this.extractVariablesFromText(text, 'html', errors);
    } catch (error) {
      errors.push({
        type: 'format',
        message: `Failed to parse HTML: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
      return { variables: [], structure: this.createEmptyStructure() };
    }
  }

  /**
   * Parse Markdown files
   */
  private async parseMarkdown(
    content: Buffer,
    options: ParserOptions,
    errors: ParsingError[]
  ): Promise<{ variables: TemplateVariable[]; structure: TemplateStructure }> {
    try {
      const markdown = content.toString('utf8');
      const html = marked.parse(markdown);
      const root = htmlParser.parse(html);
      const text = root.text;
      
      return this.extractVariablesFromText(text, 'markdown', errors);
    } catch (error) {
      errors.push({
        type: 'format',
        message: `Failed to parse Markdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
      return { variables: [], structure: this.createEmptyStructure() };
    }
  }

  /**
   * Parse plain text files
   */
  private async parseText(
    content: Buffer,
    options: ParserOptions,
    errors: ParsingError[]
  ): Promise<{ variables: TemplateVariable[]; structure: TemplateStructure }> {
    try {
      const text = content.toString('utf8');
      return this.extractVariablesFromText(text, 'text', errors);
    } catch (error) {
      errors.push({
        type: 'format',
        message: `Failed to parse text: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
      return { variables: [], structure: this.createEmptyStructure() };
    }
  }

  /**
   * Extract variables from text content
   */
  private extractVariablesFromText(
    text: string,
    format: string,
    errors: ParsingError[]
  ): { variables: TemplateVariable[]; structure: TemplateStructure } {
    const variables: TemplateVariable[] = [];
    
    // Common variable patterns
    const patterns = [
      /\{\{([^}]+)\}\}/g,           // {{variable}}
      /\{([^}]+)\}/g,               // {variable}
      /\$\{([^}]+)\}/g,             // ${variable}
      /\[\[([^\]]+)\]\]/g,          // [[variable]]
      /\{\%([^%]+)\%\}/g,           // {%variable%}
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const variableName = match[1].trim();
        if (variableName && !variables.find(v => v.name === variableName)) {
          variables.push({
            name: variableName,
            type: this.inferVariableType(variableName),
            required: this.isRequiredVariable(variableName),
            position: {
              start: match.index,
              end: match.index + match[0].length
            },
            context: this.getContext(text, match.index, 50)
          });
        }
      }
    });

    // Analyze structure
    const structure = this.analyzeStructure(text, variables, format);

    return { variables, structure };
  }

  /**
   * Infer variable type from name
   */
  private inferVariableType(name: string): TemplateVariable['type'] {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('date') || lowerName.includes('time')) {
      return 'date';
    } else if (lowerName.includes('count') || lowerName.includes('number') || lowerName.includes('id')) {
      return 'number';
    } else if (lowerName.includes('enabled') || lowerName.includes('disabled') || lowerName.includes('active')) {
      return 'boolean';
    } else if (lowerName.includes('list') || lowerName.includes('items')) {
      return 'list';
    } else if (lowerName.includes('config') || lowerName.includes('settings')) {
      return 'object';
    } else {
      return 'text';
    }
  }

  /**
   * Check if variable is required
   */
  private isRequiredVariable(name: string): boolean {
    const lowerName = name.toLowerCase();
    return lowerName.includes('required') || 
           lowerName.includes('mandatory') || 
           lowerName.includes('name') ||
           lowerName.includes('title');
  }

  /**
   * Get context around a position
   */
  private getContext(text: string, position: number, length: number): string {
    const start = Math.max(0, position - length);
    const end = Math.min(text.length, position + length);
    return text.substring(start, end).replace(/\s+/g, ' ').trim();
  }

  /**
   * Analyze document structure
   */
  private analyzeStructure(
    text: string,
    variables: TemplateVariable[],
    format: string
  ): TemplateStructure {
    const sections: TemplateSection[] = [];
    const complianceRequirements: ComplianceRequirement[] = [];
    
    // Simple section detection based on headers
    const lines = text.split('\n');
    let currentSection: TemplateSection | null = null;
    let sectionOrder = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Detect headers (simplified)
      if (trimmed.match(/^#{1,6}\s/) || trimmed.match(/^[A-Z][A-Z\s]+$/)) {
        if (currentSection) {
          sections.push(currentSection);
        }
        
        currentSection = {
          name: trimmed.replace(/^#{1,6}\s/, ''),
          type: 'header',
          variables: [],
          required: true,
          order: sectionOrder++
        };
      }
      
      // Find variables in current section
      if (currentSection) {
        variables.forEach(variable => {
          if (text.indexOf(variable.name) >= index * 100) { // Rough line-based positioning
            currentSection!.variables.push(variable.name);
          }
        });
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    // Detect compliance requirements
    this.detectComplianceRequirements(text, complianceRequirements);

    // Determine document type
    const documentType = this.detectDocumentType(text);

    // Estimate complexity
    const complexity = this.estimateComplexity(variables.length, sections.length, text.length);

    return {
      sections,
      complianceRequirements,
      documentType,
      estimatedPages: Math.ceil(text.length / 2000), // Rough estimate
      complexity
    };
  }

  /**
   * Detect compliance requirements
   */
  private detectComplianceRequirements(text: string, requirements: ComplianceRequirement[]): void {
    const nistPatterns = [
      /NIST\s+800-53/gi,
      /AC-\d+/gi,
      /AU-\d+/gi,
      /CA-\d+/gi,
      /CM-\d+/gi,
      /CP-\d+/gi,
      /IA-\d+/gi,
      /IR-\d+/gi,
      /MA-\d+/gi,
      /MP-\d+/gi,
      /PE-\d+/gi,
      /PL-\d+/gi,
      /PS-\d+/gi,
      /RA-\d+/gi,
      /SA-\d+/gi,
      /SC-\d+/gi,
      /SI-\d+/gi
    ];

    nistPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        requirements.push({
          standard: 'NIST',
          control: match[0],
          section: this.getContext(text, match.index, 100),
          required: true
        });
      }
    });
  }

  /**
   * Detect document type
   */
  private detectDocumentType(text: string): TemplateStructure['documentType'] {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('system security plan') || lowerText.includes('ssp')) {
      return 'ssp';
    } else if (lowerText.includes('security assessment report') || lowerText.includes('sar')) {
      return 'sar';
    } else if (lowerText.includes('plan of action') || lowerText.includes('poam')) {
      return 'poam';
    } else if (lowerText.includes('checklist') || lowerText.includes('assessment')) {
      return 'checklist';
    } else if (lowerText.includes('authority to operate') || lowerText.includes('ato')) {
      return 'ato_package';
    } else {
      return 'ssp'; // Default
    }
  }

  /**
   * Estimate complexity
   */
  private estimateComplexity(variableCount: number, sectionCount: number, textLength: number): TemplateStructure['complexity'] {
    const score = (variableCount * 2) + sectionCount + (textLength / 10000);
    
    if (score < 10) return 'low';
    if (score < 25) return 'medium';
    return 'high';
  }

  /**
   * Validate file
   */
  private async validateFile(templateVersion: TemplateVersion, errors: ParsingError[]): Promise<void> {
    try {
      await fs.access(templateVersion.filePath);
    } catch (error) {
      errors.push({
        type: 'validation',
        message: `Template file not found: ${templateVersion.filePath}`,
        severity: 'critical'
      });
    }
  }

  /**
   * Read file content
   */
  private async readFileContent(templateVersion: TemplateVersion, errors: ParsingError[]): Promise<Buffer> {
    try {
      return await fs.readFile(templateVersion.filePath);
    } catch (error) {
      errors.push({
        type: 'validation',
        message: `Failed to read template file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
      throw error;
    }
  }

  /**
   * Check memory usage
   */
  private checkMemoryUsage(content: Buffer, maxMemoryMB: number, errors: ParsingError[]): void {
    const memoryUsageMB = content.length / (1024 * 1024);
    
    if (memoryUsageMB > maxMemoryMB) {
      errors.push({
        type: 'memory',
        message: `File size (${memoryUsageMB.toFixed(2)}MB) exceeds memory limit (${maxMemoryMB}MB)`,
        severity: 'high',
        suggestion: 'Consider using a smaller template or increasing memory limit'
      });
    }
  }

  /**
   * Validate compliance structure
   */
  private validateComplianceStructure(
    result: { variables: TemplateVariable[]; structure: TemplateStructure },
    errors: ParsingError[]
  ): void {
    const { structure } = result;
    
    // Check for required sections based on document type
    const requiredSections = this.getRequiredSections(structure.documentType);
    
    requiredSections.forEach(requiredSection => {
      if (!structure.sections.find(s => s.name.toLowerCase().includes(requiredSection.toLowerCase()))) {
        errors.push({
          type: 'structure',
          message: `Missing required section: ${requiredSection}`,
          severity: 'medium',
          suggestion: `Add a section for ${requiredSection} to meet compliance requirements`
        });
      }
    });
  }

  /**
   * Get required sections for document type
   */
  private getRequiredSections(documentType: TemplateStructure['documentType']): string[] {
    switch (documentType) {
      case 'ssp':
        return ['System Overview', 'Security Controls', 'Risk Assessment'];
      case 'sar':
        return ['Assessment Scope', 'Findings', 'Recommendations'];
      case 'poam':
        return ['Vulnerabilities', 'Remediation Plan', 'Timeline'];
      case 'checklist':
        return ['Assessment Items', 'Compliance Status'];
      case 'ato_package':
        return ['System Description', 'Security Controls', 'Risk Assessment', 'Authorization'];
      default:
        return [];
    }
  }

  /**
   * Calculate metadata
   */
  private calculateMetadata(templateVersion: TemplateVersion, content: Buffer): TemplateMetadata {
    const text = content.toString('utf8');
    const wordCount = text.split(/\s+/).length;
    
    return {
      format: templateVersion.mimeType,
      size: content.length,
      wordCount,
      pageCount: Math.ceil(wordCount / 250), // Rough estimate
      lastModified: templateVersion.createdAt,
      checksum: templateVersion.checksum,
      encoding: 'utf-8'
    };
  }

  /**
   * Get file extension
   */
  private getFileExtension(content: Buffer, mimeType?: string): string {
    if (mimeType) {
      const mimeToExt: Record<string, string> = {
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.oasis.opendocument.text': '.odt',
        'application/rtf': '.rtf',
        'text/html': '.html',
        'text/markdown': '.md',
        'text/plain': '.txt'
      };
      return mimeToExt[mimeType] || '';
    }
    return '';
  }

  /**
   * Create empty structure
   */
  private createEmptyStructure(): TemplateStructure {
    return {
      sections: [],
      complianceRequirements: [],
      documentType: 'ssp',
      estimatedPages: 0,
      complexity: 'low'
    };
  }

  /**
   * Create error result
   */
  private createErrorResult(errors: ParsingError[]): TemplateParseResult {
    return {
      success: false,
      variables: [],
      structure: this.createEmptyStructure(),
      errors,
      metadata: {
        format: '',
        size: 0,
        wordCount: 0,
        pageCount: 0,
        lastModified: new Date(),
        checksum: '',
        encoding: 'utf-8'
      }
    };
  }
}

export const templateParser = new TemplateParser();
