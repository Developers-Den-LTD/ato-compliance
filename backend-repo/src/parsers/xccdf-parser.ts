import { DOMParser } from '@xmldom/xmldom';

export interface XCCDFRule {
  id: string;
  title: string;
  description: string;
  severity: string;
  checkText: string;
  fixText: string;
  version?: string;
  ruleTitle?: string;
  stigId?: string;
  stigTitle?: string;
}

export interface XCCDFBenchmark {
  id: string;
  title: string;
  version: string;
  description: string;
  rules: XCCDFRule[];
}

/**
 * Parses DISA STIG XCCDF files into structured rule data
 */
export class XCCDFParser {
  
  /**
   * Parse XCCDF content from string
   */
  static parseXCCDF(xmlContent: string): XCCDFBenchmark {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'application/xml');
    
    // Check for parsing errors
    const parseError = doc.getElementsByTagName('parsererror')[0];
    if (parseError) {
      throw new Error(`XML parsing error: ${parseError.textContent}`);
    }

    // Get benchmark element (root of XCCDF)
    const benchmark = doc.getElementsByTagName('Benchmark')[0] || 
                     doc.getElementsByTagNameNS('*', 'Benchmark')[0];
    
    if (!benchmark) {
      throw new Error('Invalid XCCDF file: No Benchmark element found');
    }

    // Extract benchmark metadata
    const benchmarkId = benchmark.getAttribute('id') || 'unknown-stig';
    const titleEl = this.getElementByTagName(benchmark, 'title');
    const descriptionEl = this.getElementByTagName(benchmark, 'description');
    const versionEl = this.getElementByTagName(benchmark, 'version');

    const benchmarkTitle = titleEl?.textContent?.trim() || benchmarkId;
    const benchmarkDescription = descriptionEl?.textContent?.trim() || '';
    const benchmarkVersion = versionEl?.textContent?.trim() || 'V1R1';

    // Parse all Rule elements
    const rules = this.parseRules(benchmark, benchmarkId, benchmarkTitle);

    return {
      id: benchmarkId,
      title: benchmarkTitle,
      version: benchmarkVersion,
      description: benchmarkDescription,
      rules
    };
  }

  /**
   * Parse all Rule elements from benchmark
   */
  private static parseRules(benchmark: Element, stigId: string, stigTitle: string): XCCDFRule[] {
    const rules: XCCDFRule[] = [];
    
    // Get all Rule elements (handle namespaces)
    const ruleElements = Array.from(benchmark.getElementsByTagName('Rule'))
      .concat(Array.from(benchmark.getElementsByTagNameNS('*', 'Rule')));

    for (const ruleEl of ruleElements) {
      try {
        const rule = this.parseRule(ruleEl, stigId, stigTitle);
        if (rule) {
          rules.push(rule);
        }
      } catch (error) {
        console.warn(`Failed to parse rule: ${error.message}`);
        // Continue with other rules
      }
    }

    return rules;
  }

  /**
   * Parse individual Rule element
   */
  private static parseRule(ruleEl: Element, stigId: string, stigTitle: string): XCCDFRule | null {
    const ruleId = ruleEl.getAttribute('id');
    if (!ruleId) {
      throw new Error('Rule missing required id attribute');
    }

    // Extract rule metadata
    const titleEl = this.getElementByTagName(ruleEl, 'title');
    const descriptionEl = this.getElementByTagName(ruleEl, 'description');
    const versionEl = this.getElementByTagName(ruleEl, 'version');
    
    // Extract severity (can be attribute or element)
    let severity = ruleEl.getAttribute('severity') || 'medium';
    const severityEl = this.getElementByTagName(ruleEl, 'severity');
    if (severityEl) {
      severity = severityEl.textContent?.trim() || severity;
    }

    // Map XCCDF severity to our format
    severity = this.mapSeverity(severity);

    // Extract check content
    const checkEl = this.getElementByTagName(ruleEl, 'check');
    let checkText = 'No check text provided';
    if (checkEl) {
      const checkContentEl = this.getElementByTagName(checkEl, 'check-content') ||
                            this.getElementByTagName(checkEl, 'checkContent');
      checkText = checkContentEl?.textContent?.trim() || checkText;
    }

    // Extract fix text
    const fixEl = this.getElementByTagName(ruleEl, 'fix') ||
                 this.getElementByTagName(ruleEl, 'fixtext');
    let fixText = 'No fix text provided';
    if (fixEl) {
      fixText = fixEl.textContent?.trim() || fixText;
    }

    // Clean up rule ID (remove namespace prefixes if any)
    const cleanRuleId = ruleId.replace(/^.*:/, '');

    return {
      id: cleanRuleId,
      title: titleEl?.textContent?.trim() || `Rule ${cleanRuleId}`,
      description: descriptionEl?.textContent?.trim() || 'No description provided',
      severity,
      checkText,
      fixText,
      version: versionEl?.textContent?.trim(),
      ruleTitle: titleEl?.textContent?.trim(),
      stigId,
      stigTitle
    };
  }

  /**
   * Helper to get element by tag name (handles namespaces)
   */
  private static getElementByTagName(parent: Element, tagName: string): Element | null {
    // Try without namespace first
    let element = parent.getElementsByTagName(tagName)[0];
    if (element) return element;

    // Try with any namespace
    element = parent.getElementsByTagNameNS('*', tagName)[0];
    if (element) return element;

    // Try common XCCDF namespace patterns
    const commonNamespaces = [
      'http://checklists.nist.gov/xccdf/1.1',
      'http://checklists.nist.gov/xccdf/1.2',
      'http://oval.mitre.org/XMLSchema/oval-definitions-5'
    ];

    for (const ns of commonNamespaces) {
      element = parent.getElementsByTagNameNS(ns, tagName)[0];
      if (element) return element;
    }

    return null;
  }

  /**
   * Map XCCDF severity values to our standard format
   */
  private static mapSeverity(severity: string): string {
    const normalizedSeverity = severity.toLowerCase().trim();
    
    const severityMap: Record<string, string> = {
      'low': 'low',
      'medium': 'medium', 
      'high': 'high',
      'critical': 'critical',
      'info': 'low',
      'informational': 'low',
      'cat-i': 'critical',
      'cat-ii': 'high', 
      'cat-iii': 'medium',
      'category-i': 'critical',
      'category-ii': 'high',
      'category-iii': 'medium',
      'cat i': 'critical',
      'cat ii': 'high',
      'cat iii': 'medium'
    };

    return severityMap[normalizedSeverity] || 'medium';
  }

  /**
   * Validate XCCDF file structure
   */
  static validateXCCDF(xmlContent: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'application/xml');
      
      // Check for parsing errors
      const parseError = doc.getElementsByTagName('parsererror')[0];
      if (parseError) {
        errors.push(`XML parsing error: ${parseError.textContent}`);
        return { valid: false, errors };
      }

      // Check for benchmark element
      const benchmark = doc.getElementsByTagName('Benchmark')[0] || 
                       doc.getElementsByTagNameNS('*', 'Benchmark')[0];
      
      if (!benchmark) {
        errors.push('No Benchmark element found - not a valid XCCDF file');
      }

      // Check for rules
      const rules = Array.from(benchmark?.getElementsByTagName('Rule') || [])
        .concat(Array.from(benchmark?.getElementsByTagNameNS('*', 'Rule') || []));
      
      if (rules.length === 0) {
        errors.push('No Rule elements found in XCCDF file');
      }

      return { valid: errors.length === 0, errors };

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors };
    }
  }

  /**
   * Get preview of XCCDF file without full parsing
   */
  static previewXCCDF(xmlContent: string): { 
    benchmarkId?: string; 
    title?: string; 
    version?: string; 
    ruleCount: number 
  } {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'application/xml');
      
      const benchmark = doc.getElementsByTagName('Benchmark')[0] || 
                       doc.getElementsByTagNameNS('*', 'Benchmark')[0];
      
      if (!benchmark) {
        return { ruleCount: 0 };
      }

      const benchmarkId = benchmark.getAttribute('id') || undefined;
      const titleEl = this.getElementByTagName(benchmark, 'title');
      const versionEl = this.getElementByTagName(benchmark, 'version');
      
      const rules = Array.from(benchmark.getElementsByTagName('Rule'))
        .concat(Array.from(benchmark.getElementsByTagNameNS('*', 'Rule')));

      return {
        benchmarkId,
        title: titleEl?.textContent?.trim(),
        version: versionEl?.textContent?.trim(),
        ruleCount: rules.length
      };

    } catch (error) {
      console.warn('Failed to preview XCCDF:', error);
      return { ruleCount: 0 };
    }
  }
}
