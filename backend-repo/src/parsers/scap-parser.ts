// SCAP XCCDF Parser
// Parses SCAP XCCDF XML files into standardized vulnerability data

import { DOMParser } from '@xmldom/xmldom';
import type {
  VulnerabilityParser,
  ParsedScanResult,
  ParsedHost,
  ParsedVulnerability,
  ParserOptions,
  ParsingError
} from './types';

export class ScapParser implements VulnerabilityParser {
  name = 'SCAP XCCDF Parser';
  supportedFormats = ['.xml', '.xccdf', 'application/xml', 'text/xml'];

  async validate(content: string | Buffer): Promise<boolean> {
    try {
      const xmlContent = content.toString();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Check for XCCDF root element or TestResult
      const root = doc.documentElement;
      return root.tagName === 'Benchmark' || 
             root.tagName === 'TestResult' || 
             root.tagName.includes('xccdf');
    } catch (error) {
      return false;
    }
  }

  async getMetadata(content: string | Buffer): Promise<{
    scanner: string;
    version?: string;
    scanDate?: Date;
    targetCount?: number;
  }> {
    const xmlContent = content.toString();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    const testResult = doc.getElementsByTagName('TestResult')[0];
    const benchmark = doc.getElementsByTagName('Benchmark')[0];
    
    let scanDate: Date | undefined;
    let version: string | undefined;
    
    if (testResult) {
      const endTime = testResult.getAttribute('end-time');
      if (endTime) {
        scanDate = new Date(endTime);
      }
      version = testResult.getAttribute('version') || undefined;
    }
    
    if (benchmark) {
      version = version || benchmark.getAttribute('id') || undefined;
    }
    
    const targets = doc.getElementsByTagName('target');
    
    return {
      scanner: 'scap',
      version,
      scanDate,
      targetCount: targets.length || 1
    };
  }

  async parse(content: string | Buffer, options: ParserOptions = {}): Promise<ParsedScanResult> {
    const errors: ParsingError[] = [];
    const xmlContent = content.toString();
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Validate SCAP format
      if (!await this.validate(content)) {
        throw new Error('Invalid SCAP XCCDF format');
      }

      const testResult = doc.getElementsByTagName('TestResult')[0];
      const benchmark = doc.getElementsByTagName('Benchmark')[0];
      
      if (!testResult && !benchmark) {
        throw new Error('No TestResult or Benchmark element found in SCAP file');
      }

      // Parse scan metadata
      let scanName = 'SCAP Scan';
      let scanDate = new Date();
      let scannerVersion: string | undefined;
      
      if (testResult) {
        scanName = testResult.getAttribute('id') || scanName;
        const endTime = testResult.getAttribute('end-time');
        if (endTime) {
          scanDate = new Date(endTime);
        }
        scannerVersion = testResult.getAttribute('version') || undefined;
      }
      
      if (benchmark) {
        scanName = benchmark.getAttribute('id') || scanName;
        scannerVersion = scannerVersion || benchmark.getAttribute('version') || undefined;
      }

      // Parse targets and results
      const hosts: ParsedHost[] = [];
      
      if (testResult) {
        // Parse from TestResult format
        const host = this.parseTestResult(testResult, doc, options);
        if (host) {
          hosts.push(host);
        }
      } else if (benchmark) {
        // Parse from Benchmark format (checklist)
        const host = this.parseBenchmark(benchmark, doc, options);
        if (host) {
          hosts.push(host);
        }
      }

      // Calculate vulnerability summary
      const vulnerabilitySummary = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      };

      let totalVulnerabilities = 0;
      hosts.forEach(host => {
        host.vulnerabilities.forEach(vuln => {
          totalVulnerabilities++;
          vulnerabilitySummary[vuln.severity]++;
        });
      });

      return {
        scanName,
        scanDate,
        scanner: 'scap',
        scannerVersion,
        hosts,
        totalVulnerabilities,
        vulnerabilitySummary,
        fileName: 'scap-results.xml',
        fileSize: xmlContent.length,
        parseDate: new Date(),
        parsingErrors: errors.length > 0 ? errors.map(e => e.message) : undefined
      };
    } catch (error) {
      throw new Error(`SCAP parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseTestResult(testResult: Element, doc: Document, options: ParserOptions): ParsedHost | null {
    // Extract target information
    const target = testResult.getElementsByTagName('target')[0];
    const targetAddress = target?.textContent || 'localhost';
    
    // Parse rule results
    const ruleResults = testResult.getElementsByTagName('rule-result');
    const vulnerabilities: ParsedVulnerability[] = [];
    
    for (let i = 0; i < ruleResults.length; i++) {
      const vuln = this.parseRuleResult(ruleResults[i], doc, targetAddress, options);
      if (vuln) {
        vulnerabilities.push(vuln);
      }
    }

    return {
      ip: targetAddress,
      hostname: targetAddress,
      vulnerabilities,
      scanStart: this.parseDate(testResult.getAttribute('start-time')),
      scanEnd: this.parseDate(testResult.getAttribute('end-time'))
    };
  }

  private parseBenchmark(benchmark: Element, doc: Document, options: ParserOptions): ParsedHost | null {
    // For benchmark format, we create a synthetic host
    const targetAddress = 'localhost';
    
    // Parse rules from benchmark
    const rules = benchmark.getElementsByTagName('Rule');
    const vulnerabilities: ParsedVulnerability[] = [];
    
    for (let i = 0; i < rules.length; i++) {
      const vuln = this.parseRule(rules[i], targetAddress, options);
      if (vuln) {
        vulnerabilities.push(vuln);
      }
    }

    return {
      ip: targetAddress,
      hostname: targetAddress,
      vulnerabilities
    };
  }

  private parseRuleResult(ruleResult: Element, doc: Document, hostIp: string, options: ParserOptions): ParsedVulnerability | null {
    const ruleId = ruleResult.getAttribute('idref') || '';
    const result = ruleResult.getAttribute('result') || '';
    
    // Only process failed rules (findings)
    if (result !== 'fail' && result !== 'error') {
      return null;
    }

    // Find the corresponding rule definition
    const rules = doc.getElementsByTagName('Rule');
    let ruleElement: Element | null = null;
    
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].getAttribute('id') === ruleId) {
        ruleElement = rules[i];
        break;
      }
    }

    if (!ruleElement) {
      return null;
    }

    return this.createVulnerabilityFromRule(ruleElement, hostIp, result, options);
  }

  private parseRule(rule: Element, hostIp: string, options: ParserOptions): ParsedVulnerability | null {
    // For benchmark parsing, we treat all rules as potential findings
    const severity = rule.getAttribute('severity') || 'medium';
    
    // Filter by severity if specified
    if (options.filterBySeverity && !options.filterBySeverity.includes(severity)) {
      return null;
    }

    return this.createVulnerabilityFromRule(rule, hostIp, 'fail', options);
  }

  private createVulnerabilityFromRule(rule: Element, hostIp: string, result: string, options: ParserOptions): ParsedVulnerability | null {
    const ruleId = rule.getAttribute('id') || '';
    const severity = this.mapSeverity(rule.getAttribute('severity') || 'medium');
    
    // Filter by severity if specified
    if (options.filterBySeverity && !options.filterBySeverity.includes(severity)) {
      return null;
    }

    // Skip informational if not requested
    if (!options.includeInformational && severity === 'info') {
      return null;
    }

    // Extract rule details
    const title = this.getElementText(rule, 'title') || ruleId;
    const description = this.getElementText(rule, 'description') || '';
    const rationale = this.getElementText(rule, 'rationale') || '';
    
    // Extract references
    const references: string[] = [];
    const refElements = rule.getElementsByTagName('reference');
    for (let i = 0; i < refElements.length; i++) {
      const href = refElements[i].getAttribute('href');
      if (href) {
        references.push(href);
      }
    }

    // Extract identifiers (CCE, CCI, etc.)
    const identifiers = rule.getElementsByTagName('ident');
    const cce: string[] = [];
    const cci: string[] = [];
    let stigId: string | undefined;
    
    for (let i = 0; i < identifiers.length; i++) {
      const system = identifiers[i].getAttribute('system') || '';
      const value = identifiers[i].textContent || '';
      
      if (system.includes('cce')) {
        cce.push(value);
      } else if (system.includes('cci')) {
        cci.push(value);
      } else if (system.includes('stig')) {
        stigId = value;
      }
    }

    // Extract STIG V-number if available
    const vulnId = this.extractVulnId(ruleId, stigId);

    // Detect JSIG vs STIG patterns
    const ruleType = this.detectRuleType(rule, ruleId, title, description, options);

    return {
      id: `scap-${ruleId}-${hostIp}`,
      title,
      description: description || rationale,
      severity,
      host: hostIp,
      hostIp,
      stigId,
      vulnId,
      cce: cce.length > 0 ? cce : undefined,
      cci: cci.length > 0 ? cci : undefined,
      ruleType,
      solution: this.getElementText(rule, 'fixtext'),
      evidence: `SCAP Rule Result: ${result}`,
      references: references.length > 0 ? references : undefined,
      scanner: 'scap',
      scanDate: new Date()
    };
  }

  private mapSeverity(scapLevel: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    switch (scapLevel.toLowerCase()) {
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      case 'info':
      case 'informational': return 'info';
      default: return 'medium';
    }
  }

  private getElementText(parent: Element, tagName: string): string | undefined {
    const elements = parent.getElementsByTagName(tagName);
    return elements[0]?.textContent || undefined;
  }

  private extractVulnId(ruleId: string, stigId?: string): string | undefined {
    // Try to extract V-number from rule ID or STIG ID
    const vNumberMatch = (ruleId + ' ' + (stigId || '')).match(/V-\d+/);
    return vNumberMatch ? vNumberMatch[0] : undefined;
  }

  private parseDate(dateString: string | null): Date | undefined {
    if (!dateString) return undefined;
    try {
      return new Date(dateString);
    } catch {
      return undefined;
    }
  }

  private detectRuleType(rule: Element, ruleId: string, title: string, description: string, options: ParserOptions): 'stig' | 'jsig' | undefined {
    // Check rule ID for JSIG patterns
    if (/\b(jsig|joint[_\s-]*stig)\b/i.test(ruleId)) {
      return 'jsig';
    }

    // Check title for JSIG patterns
    const jsigTitlePattern = /\b(jsig|joint\s*stig|joint\s*security\s*technical\s*implementation\s*guide)\b/i;
    if (jsigTitlePattern.test(title)) {
      return 'jsig';
    }

    // Check description for JSIG patterns
    if (description && jsigTitlePattern.test(description)) {
      return 'jsig';
    }

    // Check identifiers for JSIG-specific system attributes
    const identifiers = rule.getElementsByTagName('ident');
    for (let i = 0; i < identifiers.length; i++) {
      const system = identifiers[i].getAttribute('system') || '';
      const value = identifiers[i].textContent || '';
      
      // Look for JSIG in system URIs or values
      if (system.toLowerCase().includes('jsig') || 
          system.toLowerCase().includes('joint') ||
          /\b(jsig|joint[_\s-]*stig)\b/i.test(value)) {
        return 'jsig';
      }
    }

    // Check additional rule elements for JSIG indicators
    const allElements = rule.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i];
      const tagName = element.tagName.toLowerCase();
      const content = element.textContent || '';
      const href = element.getAttribute('href') || '';
      
      // Check for JSIG in tag names, content, or hrefs
      if (tagName.includes('jsig') || 
          /\b(jsig|joint[_\s-]*stig)\b/i.test(content) ||
          /\b(jsig|joint[_\s-]*stig)\b/i.test(href)) {
        return 'jsig';
      }
    }

    // Check parser options for auto-mapping
    if (options.autoMapJsig && options.jsigVersion) {
      const versionPattern = new RegExp(`\\b${options.jsigVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (versionPattern.test(title + ' ' + description + ' ' + ruleId)) {
        return 'jsig';
      }
    }

    // Check for traditional STIG patterns
    const stigPattern = /\b(stig|security\s*technical\s*implementation\s*guide)\b/i;
    const stigIdPattern = /\bV-\d+\b/;
    
    // Look for STIG indicators in various places
    let hasStigIndicators = false;
    
    // Check rule ID, title, description for STIG patterns
    if (stigPattern.test(ruleId + ' ' + title + ' ' + description) || 
        stigIdPattern.test(ruleId + ' ' + title + ' ' + description)) {
      hasStigIndicators = true;
    }

    // Check identifiers for traditional STIG system URIs
    for (let i = 0; i < identifiers.length; i++) {
      const system = identifiers[i].getAttribute('system') || '';
      if (system.toLowerCase().includes('stig') && !system.toLowerCase().includes('jsig')) {
        hasStigIndicators = true;
        break;
      }
    }

    if (hasStigIndicators) {
      return 'stig';
    }

    // Default to undefined if no clear patterns detected
    return undefined;
  }
}
