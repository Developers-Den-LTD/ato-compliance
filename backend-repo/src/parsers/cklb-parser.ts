// CKLB (STIG Viewer Binary Checklist) Parser
// Parses DISA STIG Viewer .cklb JSON files into standardized vulnerability data

import type {
  VulnerabilityParser,
  ParsedScanResult,
  ParsedHost,
  ParsedVulnerability,
  ParserOptions,
  ParsingError
} from './types';

interface CKLBFormat {
  stigs: Array<{
    display_name: string;
    stig_name: string;
    stig_title: string;
    version: string;
    release_date: string;
    uuid: string;
    reference_identifier: string;
    size: number;
    rules: CKLBRule[];
  }>;
  target_data: {
    role?: string;
    target_type: string;
    hostname: string;
    ip_address?: string[];
    mac_address?: string[];
    fqdn?: string;
    comments?: string;
    technology_area?: string;
    web_or_database?: boolean;
    web_db_site?: string;
    web_db_instance?: string;
  };
}

interface CKLBRule {
  uuid: string;
  stig_uuid: string;
  rule_id_src: string;
  group_id: string;
  group_id_src: string;
  rule_id: string;
  desired_result: string;
  rule_result: 'pass' | 'fail' | 'notapplicable' | 'notreviewed';
  result_comment?: string;
  classification: string;
  severity?: string;
  rule_title: string;
  discussion: string;
  check_content: string;
  fix_text: string;
  ccis: string[];
}

export class CKLBParser implements VulnerabilityParser {
  name = 'STIG Viewer CKLB Parser';
  supportedFormats = ['.cklb', 'application/json', 'application/octet-stream'];

  async validate(content: string | Buffer): Promise<boolean> {
    try {
      const jsonContent = content.toString();
      const data = JSON.parse(jsonContent);
      
      // Validate CKLB structure
      return (
        data &&
        Array.isArray(data.stigs) &&
        data.target_data &&
        typeof data.target_data === 'object' &&
        data.stigs.length > 0 &&
        data.stigs.every((stig: any) => 
          stig.rules && Array.isArray(stig.rules)
        )
      );
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
    const jsonContent = content.toString();
    const data: CKLBFormat = JSON.parse(jsonContent);
    
    // Extract version and date from first STIG if available
    let version: string | undefined;
    let scanDate: Date | undefined;
    
    if (data.stigs.length > 0) {
      const firstStig = data.stigs[0];
      version = firstStig.version;
      
      if (firstStig.release_date) {
        scanDate = new Date(firstStig.release_date);
      }
    }
    
    return {
      scanner: 'stig-viewer',
      version: version || 'Unknown',
      scanDate: scanDate || new Date(),
      targetCount: 1 // CKLB files typically contain data for one target
    };
  }

  async parse(content: string | Buffer, options: ParserOptions = {}): Promise<ParsedScanResult> {
    const errors: ParsingError[] = [];
    const jsonContent = content.toString();
    
    try {
      // Validate CKLB format
      if (!await this.validate(content)) {
        throw new Error('Invalid CKLB format');
      }
      
      const data: CKLBFormat = JSON.parse(jsonContent);
      const vulnerabilities: ParsedVulnerability[] = [];
      
      // Process each STIG and its rules
      for (const stig of data.stigs) {
        for (const rule of stig.rules) {
          // Only include findings based on rule result and options
          if (this.shouldIncludeRule(rule, options)) {
            const severity = this.mapSeverity(rule.severity || rule.classification);
            
            // Filter by severity if specified
            if (options.filterBySeverity && !options.filterBySeverity.includes(severity)) {
              continue;
            }
            
            // Skip informational if not requested
            if (!options.includeInformational && severity === 'info') {
              continue;
            }
            
            const parsedVuln: ParsedVulnerability = {
              id: `cklb-${rule.rule_id}-${data.target_data.hostname || 'unknown'}`,
              title: rule.rule_title,
              description: rule.discussion || '',
              severity,
              host: data.target_data.hostname || data.target_data.fqdn || 'Unknown',
              hostIp: data.target_data.ip_address?.join(', ') || '',
              stigId: rule.rule_id,
              vulnId: rule.group_id,
              cci: rule.ccis,
              solution: rule.fix_text,
              evidence: rule.result_comment || `Status: ${this.mapRuleResult(rule.rule_result)}`,
              scanner: 'stig-viewer',
              scanDate: new Date(),
              ruleType: 'stig'
            };
            
            vulnerabilities.push(parsedVuln);
          }
        }
      }
      
      // Create host object
      const targetData = data.target_data;
      const host: ParsedHost = {
        ip: targetData.ip_address?.[0] || targetData.fqdn || targetData.hostname || 'Unknown',
        hostname: targetData.hostname || targetData.fqdn || 'Unknown',
        fqdn: targetData.fqdn,
        macAddress: targetData.mac_address?.join(', '),
        vulnerabilities,
        scanStart: new Date(),
        scanEnd: new Date()
      };
      
      // Calculate vulnerability summary
      const vulnerabilitySummary = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      };

      vulnerabilities.forEach(vuln => {
        vulnerabilitySummary[vuln.severity]++;
      });

      // Generate scan name from STIG titles
      const scanName = data.stigs.length > 0 
        ? data.stigs.map(s => s.stig_title).join(', ')
        : 'STIG Checklist';

      return {
        scanName,
        scanDate: new Date(),
        scanner: 'stig-viewer',
        scannerVersion: await this.getMetadata(content).then(m => m.version),
        hosts: [host],
        totalVulnerabilities: vulnerabilities.length,
        vulnerabilitySummary,
        fileName: 'checklist.cklb',
        fileSize: jsonContent.length,
        parseDate: new Date(),
        parsingErrors: errors.length > 0 ? errors.map(e => e.message) : undefined
      };
    } catch (error) {
      throw new Error(`CKLB parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private shouldIncludeRule(rule: CKLBRule, options: ParserOptions): boolean {
    // Include based on rule result
    switch (rule.rule_result) {
      case 'fail':
        return true; // Always include failures
      case 'notreviewed':
        return options.includeInformational || false;
      case 'pass':
      case 'notapplicable':
        return false; // Don't include passing or N/A rules
      default:
        return false;
    }
  }

  private mapRuleResult(result: CKLBRule['rule_result']): string {
    switch (result) {
      case 'pass':
        return 'Pass';
      case 'fail':
        return 'Fail';
      case 'notapplicable':
        return 'Not Applicable';
      case 'notreviewed':
        return 'Not Reviewed';
      default:
        return 'Unknown';
    }
  }

  private mapSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    const lowerSeverity = severity.toLowerCase();
    
    // CKLB uses severity values like 'high', 'medium', 'low'
    // or classification like 'CAT I', 'CAT II', 'CAT III'
    if (lowerSeverity.includes('critical')) {
      return 'critical';
    } else if (lowerSeverity.includes('high') || lowerSeverity.includes('cat i')) {
      return 'high';
    } else if (lowerSeverity.includes('medium') || lowerSeverity.includes('cat ii')) {
      return 'medium';
    } else if (lowerSeverity.includes('low') || lowerSeverity.includes('cat iii')) {
      return 'low';
    } else {
      return 'medium'; // Default
    }
  }
}
