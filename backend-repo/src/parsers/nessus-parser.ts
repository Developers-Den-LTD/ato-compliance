// Nessus XML Parser
// Parses Nessus .nessus XML files into standardized vulnerability data

import { DOMParser } from '@xmldom/xmldom';
import type {
  VulnerabilityParser,
  ParsedScanResult,
  ParsedHost,
  ParsedVulnerability,
  ParserOptions,
  ParsingError
} from './types';

export class NessusParser implements VulnerabilityParser {
  name = 'Nessus XML Parser';
  supportedFormats = ['.nessus', 'application/xml', 'text/xml'];

  async validate(content: string | Buffer): Promise<boolean> {
    try {
      const xmlContent = content.toString();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Check for Nessus root element
      const root = doc.documentElement;
      return root.tagName === 'NessusClientData_v2';
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
    
    const reports = doc.getElementsByTagName('Report');
    const report = reports[0];
    
    const hosts = doc.getElementsByTagName('ReportHost');
    const scanStart = this.getTagValue(report, 'scan_start');
    
    return {
      scanner: 'nessus',
      version: this.getTagValue(doc.documentElement, 'ServerVersion'),
      scanDate: scanStart ? new Date(parseInt(scanStart) * 1000) : undefined,
      targetCount: hosts.length
    };
  }

  async parse(content: string | Buffer, options: ParserOptions = {}): Promise<ParsedScanResult> {
    const errors: ParsingError[] = [];
    const xmlContent = content.toString();
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Validate Nessus format
      if (!await this.validate(content)) {
        throw new Error('Invalid Nessus XML format');
      }

      const reports = doc.getElementsByTagName('Report');
      if (reports.length === 0) {
        throw new Error('No Report element found in Nessus file');
      }

      const report = reports[0];
      const reportName = report.getAttribute('name') || 'Unknown Scan';
      
      // Parse scan metadata
      const scanStart = this.getTagValue(report, 'scan_start');
      const scanEnd = this.getTagValue(report, 'scan_end');
      const policy = this.getTagValue(report, 'policy_used');
      
      // Parse hosts
      const hosts: ParsedHost[] = [];
      const hostElements = doc.getElementsByTagName('ReportHost');
      
      for (let i = 0; i < hostElements.length; i++) {
        try {
          const host = this.parseHost(hostElements[i], options);
          if (host) {
            hosts.push(host);
          }
        } catch (error) {
          errors.push({
            type: 'error',
            message: `Failed to parse host ${i + 1}: ${error instanceof Error ? error.message : String(error)}`,
            element: 'ReportHost'
          });
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
        scanName: reportName,
        scanDate: scanStart ? new Date(parseInt(scanStart) * 1000) : new Date(),
        scanDuration: scanStart && scanEnd ? parseInt(scanEnd) - parseInt(scanStart) : undefined,
        scanner: 'nessus',
        scanPolicy: policy,
        hosts,
        totalVulnerabilities,
        vulnerabilitySummary,
        fileName: 'nessus-scan.nessus',
        fileSize: xmlContent.length,
        parseDate: new Date(),
        parsingErrors: errors.length > 0 ? errors.map(e => e.message) : undefined
      };
    } catch (error) {
      throw new Error(`Nessus parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseHost(hostElement: Element, options: ParserOptions): ParsedHost | null {
    const hostProperties = hostElement.getElementsByTagName('HostProperties')[0];
    const reportItems = hostElement.getElementsByTagName('ReportItem');
    
    // Extract host information
    let ip = '';
    let fqdn = '';
    let hostname = '';
    let operatingSystem = '';
    let osVersion = '';
    let macAddress = '';
    let netbiosName = '';
    let credentialedScan = false;

    if (hostProperties) {
      const tags = hostProperties.getElementsByTagName('tag');
      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const name = tag.getAttribute('name');
        const value = tag.textContent || '';

        switch (name) {
          case 'host-ip':
            ip = value;
            break;
          case 'host-fqdn':
            fqdn = value;
            break;
          case 'hostname':
            hostname = value;
            break;
          case 'operating-system':
            operatingSystem = value;
            break;
          case 'os':
            osVersion = value;
            break;
          case 'mac-address':
            macAddress = value;
            break;
          case 'netbios-name':
            netbiosName = value;
            break;
          case 'Credentialed_Scan':
            credentialedScan = value === 'true';
            break;
        }
      }
    }

    if (!ip) {
      // Fallback to name attribute
      ip = hostElement.getAttribute('name') || '';
    }

    if (!ip) {
      return null; // Skip hosts without IP
    }

    // Filter by host if specified
    if (options.filterByHost && !options.filterByHost.includes(ip)) {
      return null;
    }

    // Parse vulnerabilities
    const vulnerabilities: ParsedVulnerability[] = [];
    
    for (let i = 0; i < reportItems.length; i++) {
      const vuln = this.parseVulnerability(reportItems[i], ip, options);
      if (vuln) {
        vulnerabilities.push(vuln);
      }
    }

    return {
      ip,
      fqdn: fqdn || undefined,
      hostname: hostname || undefined,
      operatingSystem: operatingSystem || undefined,
      osVersion: osVersion || undefined,
      macAddress: macAddress || undefined,
      netbiosName: netbiosName || undefined,
      vulnerabilities,
      credentialedScan
    };
  }

  private parseVulnerability(item: Element, hostIp: string, options: ParserOptions): ParsedVulnerability | null {
    const pluginId = item.getAttribute('pluginID') || '';
    const pluginName = item.getAttribute('pluginName') || '';
    const port = item.getAttribute('port') || '';
    const protocol = item.getAttribute('protocol') || '';
    const service = item.getAttribute('svc_name') || '';
    const severity = this.mapSeverity(item.getAttribute('severity') || '');

    // Filter by severity if specified
    if (options.filterBySeverity && !options.filterBySeverity.includes(severity)) {
      return null;
    }

    // Skip informational if not requested
    if (!options.includeInformational && severity === 'info') {
      return null;
    }

    // Extract vulnerability details
    const description = this.getTagValue(item, 'description') || '';
    const solution = this.getTagValue(item, 'solution') || '';
    const synopsis = this.getTagValue(item, 'synopsis') || '';
    const output = this.getTagValue(item, 'plugin_output') || '';
    const cvssScore = this.getTagValue(item, 'cvss_base_score');
    const cvssVector = this.getTagValue(item, 'cvss_vector');
    const riskFactor = this.getTagValue(item, 'risk_factor');

    // Extract CVE references
    const cveList: string[] = [];
    const cve = this.getTagValue(item, 'cve');
    if (cve) {
      cveList.push(...cve.split(',').map(c => c.trim()));
    }

    // Extract STIG/CCI references if available
    const stigId = this.getTagValue(item, 'stig_severity');
    const cci: string[] = [];
    const cciText = this.getTagValue(item, 'cci');
    if (cciText) {
      cci.push(...cciText.split(',').map(c => c.trim()));
    }

    // Detect JSIG vs STIG patterns
    const ruleType = this.detectRuleType(item, pluginName, description, options);

    return {
      id: `nessus-${pluginId}-${hostIp}-${port}`,
      title: pluginName,
      description,
      severity,
      cvssScore: cvssScore ? parseFloat(cvssScore) : undefined,
      cvssVector,
      riskFactor,
      host: hostIp,
      hostIp,
      port: port ? parseInt(port) : undefined,
      protocol: protocol || undefined,
      service: service || undefined,
      pluginId,
      cve: cveList.length > 0 ? cveList : undefined,
      cci: cci.length > 0 ? cci : undefined,
      stigId,
      ruleType,
      solution,
      synopsis,
      output,
      scanner: 'nessus',
      scanDate: new Date()
    };
  }

  private mapSeverity(nessusLevel: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    switch (nessusLevel) {
      case '4': return 'critical';
      case '3': return 'high';
      case '2': return 'medium';
      case '1': return 'low';
      case '0': return 'info';
      default: return 'info';
    }
  }

  private getTagValue(parent: Element, tagName: string): string | undefined {
    const elements = parent.getElementsByTagName(tagName);
    return elements[0]?.textContent || undefined;
  }

  private detectRuleType(item: Element, pluginName: string, description: string, options: ParserOptions): 'stig' | 'jsig' | undefined {
    // Check for explicit JSIG tags first
    const jsigId = this.getTagValue(item, 'jsig_id');
    const jsigSeverity = this.getTagValue(item, 'jsig_severity');
    const jsigVersion = this.getTagValue(item, 'jsig_version');
    
    // If explicit JSIG tags are found
    if (jsigId || jsigSeverity || jsigVersion) {
      return 'jsig';
    }

    // Check plugin name for JSIG patterns
    const namePatterns = /\b(jsig|joint\s*stig|joint\s*security\s*technical\s*implementation\s*guide)\b/i;
    if (namePatterns.test(pluginName)) {
      return 'jsig';
    }

    // Check description for JSIG patterns
    if (description && namePatterns.test(description)) {
      return 'jsig';
    }

    // Check for JSIG-specific identifiers in custom XML attributes
    const customFields = item.getElementsByTagName('*');
    for (let i = 0; i < customFields.length; i++) {
      const field = customFields[i];
      const tagName = field.tagName.toLowerCase();
      const content = field.textContent || '';
      
      // Check for JSIG in tag names or content
      if (tagName.includes('jsig') || /\b(joint\s*stig)\b/i.test(content)) {
        return 'jsig';
      }
    }

    // Check parser options for default behavior
    if (options.autoMapJsig && options.jsigVersion) {
      // If auto-mapping JSIG is enabled, look for version-specific patterns
      const versionPattern = new RegExp(`\\b${options.jsigVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (versionPattern.test(pluginName + ' ' + description)) {
        return 'jsig';
      }
    }

    // Check if there are any STIG-related indicators at all
    const stigId = this.getTagValue(item, 'stig_severity');
    const stigCheck = this.getTagValue(item, 'stig_check');
    const stigFix = this.getTagValue(item, 'stig_fix');
    
    // If any STIG-related fields are present, classify as STIG
    if (stigId || stigCheck || stigFix || /\bstig\b/i.test(pluginName + ' ' + description)) {
      return 'stig';
    }

    // Default to undefined if no clear patterns detected
    return undefined;
  }
}
