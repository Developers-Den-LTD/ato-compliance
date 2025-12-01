// CKL (STIG Viewer Checklist) Parser
// Parses DISA STIG Viewer .ckl XML files into standardized vulnerability data

import { DOMParser } from '@xmldom/xmldom';
import type {
  VulnerabilityParser,
  ParsedScanResult,
  ParsedHost,
  ParsedVulnerability,
  ParserOptions,
  ParsingError
} from './types';

interface CKLAsset {
  role?: string;
  assetType?: string;
  hostName?: string;
  hostIP?: string;
  hostMAC?: string;
  hostFQDN?: string;
  targetComment?: string;
  techArea?: string;
  targetKey?: string;
  webOrDatabase?: string;
  webDBSite?: string;
  webDBInstance?: string;
}

interface CKLVuln {
  vulnNum: string;
  severity: string;
  groupTitle?: string;
  ruleID?: string;
  ruleVer?: string;
  ruleTitle?: string;
  vulnDiscuss?: string;
  iaControls?: string;
  checkContent?: string;
  fixText?: string;
  falsePositives?: string;
  falseNegatives?: string;
  documentable?: string;
  mitigations?: string;
  potentialImpact?: string;
  thirdPartyTools?: string;
  mitigationControl?: string;
  responsibility?: string;
  securityOverrideGuidance?: string;
  cciRef?: string[];
  status: 'Open' | 'NotAFinding' | 'Not_Reviewed' | 'Not_Applicable';
  findingDetails?: string;
  comments?: string;
  severityOverride?: string;
  severityJustification?: string;
}

export class CKLParser implements VulnerabilityParser {
  name = 'STIG Viewer CKL Parser';
  supportedFormats = ['.ckl', 'application/xml', 'text/xml'];

  async validate(content: string | Buffer): Promise<boolean> {
    try {
      const xmlContent = content.toString();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Check for CKL root element
      const root = doc.documentElement;
      return root.tagName === 'CHECKLIST' && 
             doc.getElementsByTagName('ASSET').length > 0 &&
             doc.getElementsByTagName('STIGS').length > 0;
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
    
    const stigs = doc.getElementsByTagName('iSTIG');
    const assets = doc.getElementsByTagName('ASSET');
    
    // Extract version from STIG_INFO if available
    let version: string | undefined;
    let releaseInfo: string | undefined;
    
    if (stigs.length > 0) {
      const stigInfo = stigs[0].getElementsByTagName('STIG_INFO')[0];
      if (stigInfo) {
        const siData = stigInfo.getElementsByTagName('SI_DATA');
        for (let i = 0; i < siData.length; i++) {
          const sidName = this.getElementText(siData[i], 'SID_NAME');
          if (sidName === 'version') {
            version = this.getElementText(siData[i], 'SID_DATA');
          } else if (sidName === 'releaseinfo') {
            releaseInfo = this.getElementText(siData[i], 'SID_DATA');
          }
        }
      }
    }
    
    // Try to extract date from releaseinfo
    let scanDate: Date | undefined;
    if (releaseInfo) {
      const dateMatch = releaseInfo.match(/Date:\s*(\d{1,2}\s+\w+\s+\d{4})/);
      if (dateMatch) {
        scanDate = new Date(dateMatch[1]);
      }
    }
    
    return {
      scanner: 'stig-viewer',
      version: version || 'Unknown',
      scanDate: scanDate || new Date(),
      targetCount: assets.length
    };
  }

  async parse(content: string | Buffer, options: ParserOptions = {}): Promise<ParsedScanResult> {
    const errors: ParsingError[] = [];
    const xmlContent = content.toString();
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Validate CKL format
      if (!await this.validate(content)) {
        throw new Error('Invalid CKL format');
      }

      // Parse asset information
      const assetElement = doc.getElementsByTagName('ASSET')[0];
      if (!assetElement) {
        throw new Error('No ASSET element found in CKL file');
      }
      
      const asset = this.parseAsset(assetElement);
      
      // Parse STIG information and vulnerabilities
      const stigsElement = doc.getElementsByTagName('STIGS')[0];
      if (!stigsElement) {
        throw new Error('No STIGS element found in CKL file');
      }
      
      const hosts: ParsedHost[] = [];
      const iSTIGs = stigsElement.getElementsByTagName('iSTIG');
      
      // Process each iSTIG (there may be multiple STIGs applied to one asset)
      const vulnerabilities: ParsedVulnerability[] = [];
      
      for (let i = 0; i < iSTIGs.length; i++) {
        const iSTIG = iSTIGs[i];
        const stigVulns = this.parseSTIG(iSTIG, asset, options);
        vulnerabilities.push(...stigVulns);
      }
      
      // Create host object
      const host: ParsedHost = {
        ip: asset.hostIP || asset.hostFQDN || asset.hostName || 'Unknown',
        hostname: asset.hostName || asset.hostFQDN || 'Unknown',
        vulnerabilities,
        scanStart: new Date(),
        scanEnd: new Date()
      };
      
      hosts.push(host);
      
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

      // Get scan name from STIG info
      let scanName = 'STIG Checklist';
      if (iSTIGs.length > 0) {
        const stigTitle = this.getSTIGTitle(iSTIGs[0]);
        if (stigTitle) {
          scanName = stigTitle;
        }
      }

      return {
        scanName,
        scanDate: new Date(),
        scanner: 'stig-viewer',
        scannerVersion: await this.getMetadata(content).then(m => m.version),
        hosts,
        totalVulnerabilities: vulnerabilities.length,
        vulnerabilitySummary,
        fileName: 'checklist.ckl',
        fileSize: xmlContent.length,
        parseDate: new Date(),
        parsingErrors: errors.length > 0 ? errors.map(e => e.message) : undefined
      };
    } catch (error) {
      throw new Error(`CKL parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseAsset(assetElement: Element): CKLAsset {
    return {
      role: this.getElementText(assetElement, 'ROLE'),
      assetType: this.getElementText(assetElement, 'ASSET_TYPE'),
      hostName: this.getElementText(assetElement, 'HOST_NAME'),
      hostIP: this.getElementText(assetElement, 'HOST_IP'),
      hostMAC: this.getElementText(assetElement, 'HOST_MAC'),
      hostFQDN: this.getElementText(assetElement, 'HOST_FQDN'),
      targetComment: this.getElementText(assetElement, 'TARGET_COMMENT'),
      techArea: this.getElementText(assetElement, 'TECH_AREA'),
      targetKey: this.getElementText(assetElement, 'TARGET_KEY'),
      webOrDatabase: this.getElementText(assetElement, 'WEB_OR_DATABASE'),
      webDBSite: this.getElementText(assetElement, 'WEB_DB_SITE'),
      webDBInstance: this.getElementText(assetElement, 'WEB_DB_INSTANCE')
    };
  }

  private parseSTIG(iSTIG: Element, asset: CKLAsset, options: ParserOptions): ParsedVulnerability[] {
    const vulnerabilities: ParsedVulnerability[] = [];
    
    // Get STIG info
    const stigInfo = this.parseSTIGInfo(iSTIG);
    
    // Parse each VULN element
    const vulns = iSTIG.getElementsByTagName('VULN');
    
    for (let i = 0; i < vulns.length; i++) {
      const vulnElement = vulns[i];
      const vuln = this.parseVuln(vulnElement);
      
      // Only include findings based on status
      if (vuln.status === 'Open' || 
          (options.includeInformational && vuln.status === 'Not_Reviewed')) {
        
        // Map severity
        const severity = this.mapSeverity(vuln.severity);
        
        // Filter by severity if specified
        if (options.filterBySeverity && !options.filterBySeverity.includes(severity)) {
          continue;
        }
        
        // Skip informational if not requested
        if (!options.includeInformational && severity === 'info') {
          continue;
        }
        
        const parsedVuln: ParsedVulnerability = {
          id: `ckl-${vuln.vulnNum}-${asset.hostName || 'unknown'}`,
          title: vuln.ruleTitle || vuln.groupTitle || vuln.vulnNum,
          description: vuln.vulnDiscuss || '',
          severity,
          host: asset.hostName || asset.hostIP || 'Unknown',
          hostIp: asset.hostIP || '',
          stigId: vuln.ruleID,
          vulnId: vuln.vulnNum,
          cci: vuln.cciRef,
          solution: vuln.fixText,
          evidence: vuln.findingDetails || vuln.comments || `Status: ${vuln.status}`,
          scanner: 'stig-viewer',
          scanDate: new Date(),
          ruleType: 'stig'
        };
        
        vulnerabilities.push(parsedVuln);
      }
    }
    
    return vulnerabilities;
  }

  private parseSTIGInfo(iSTIG: Element): Record<string, string> {
    const info: Record<string, string> = {};
    const stigInfo = iSTIG.getElementsByTagName('STIG_INFO')[0];
    
    if (stigInfo) {
      const siData = stigInfo.getElementsByTagName('SI_DATA');
      for (let i = 0; i < siData.length; i++) {
        const sidName = this.getElementText(siData[i], 'SID_NAME');
        const sidData = this.getElementText(siData[i], 'SID_DATA');
        if (sidName && sidData) {
          info[sidName] = sidData;
        }
      }
    }
    
    return info;
  }

  private getSTIGTitle(iSTIG: Element): string | undefined {
    const stigInfo = this.parseSTIGInfo(iSTIG);
    return stigInfo['title'] || stigInfo['stigid'];
  }

  private parseVuln(vulnElement: Element): CKLVuln {
    const stigData: Record<string, string> = {};
    const stigDataElements = vulnElement.getElementsByTagName('STIG_DATA');
    
    // Parse all STIG_DATA elements
    for (let i = 0; i < stigDataElements.length; i++) {
      const vulnAttr = this.getElementText(stigDataElements[i], 'VULN_ATTRIBUTE');
      const attrData = this.getElementText(stigDataElements[i], 'ATTRIBUTE_DATA');
      
      if (vulnAttr && attrData !== undefined) {
        stigData[vulnAttr] = attrData;
      }
    }
    
    // Extract CCI references (may be multiple)
    const cciRefs: string[] = [];
    for (const key in stigData) {
      if (key === 'CCI_REF' && stigData[key]) {
        cciRefs.push(stigData[key]);
      }
    }
    
    // Get status and other assessment data
    const status = this.getElementText(vulnElement, 'STATUS') || 'Not_Reviewed';
    
    return {
      vulnNum: stigData['Vuln_Num'] || '',
      severity: stigData['Severity'] || 'medium',
      groupTitle: stigData['Group_Title'],
      ruleID: stigData['Rule_ID'],
      ruleVer: stigData['Rule_Ver'],
      ruleTitle: stigData['Rule_Title'],
      vulnDiscuss: stigData['Vuln_Discuss'],
      iaControls: stigData['IA_Controls'],
      checkContent: stigData['Check_Content'],
      fixText: stigData['Fix_Text'],
      falsePositives: stigData['False_Positives'],
      falseNegatives: stigData['False_Negatives'],
      documentable: stigData['Documentable'],
      mitigations: stigData['Mitigations'],
      potentialImpact: stigData['Potential_Impact'],
      thirdPartyTools: stigData['Third_Party_Tools'],
      mitigationControl: stigData['Mitigation_Control'],
      responsibility: stigData['Responsibility'],
      securityOverrideGuidance: stigData['Security_Override_Guidance'],
      cciRef: cciRefs,
      status: this.mapStatus(status),
      findingDetails: this.getElementText(vulnElement, 'FINDING_DETAILS'),
      comments: this.getElementText(vulnElement, 'COMMENTS'),
      severityOverride: this.getElementText(vulnElement, 'SEVERITY_OVERRIDE'),
      severityJustification: this.getElementText(vulnElement, 'SEVERITY_JUSTIFICATION')
    };
  }

  private mapStatus(cklStatus: string): CKLVuln['status'] {
    switch (cklStatus.toLowerCase()) {
      case 'open':
        return 'Open';
      case 'notafinding':
      case 'not_a_finding':
        return 'NotAFinding';
      case 'not_reviewed':
        return 'Not_Reviewed';
      case 'not_applicable':
        return 'Not_Applicable';
      default:
        return 'Not_Reviewed';
    }
  }

  private mapSeverity(cklSeverity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    const lowerSeverity = cklSeverity.toLowerCase();
    
    // CKL uses CAT I, CAT II, CAT III or high, medium, low
    if (lowerSeverity.includes('cat i') || lowerSeverity === 'high') {
      return 'high';
    } else if (lowerSeverity.includes('cat ii') || lowerSeverity === 'medium') {
      return 'medium';
    } else if (lowerSeverity.includes('cat iii') || lowerSeverity === 'low') {
      return 'low';
    } else {
      return 'medium'; // Default
    }
  }

  private getElementText(parent: Element, tagName: string): string | undefined {
    const elements = parent.getElementsByTagName(tagName);
    return elements[0]?.textContent || undefined;
  }
}
