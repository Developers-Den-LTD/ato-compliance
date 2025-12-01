// Data Ingestion Parser Types
// Common interfaces for security scan data parsers

export interface ParsedVulnerability {
  // Core vulnerability identification
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  
  // Risk assessment
  cvssScore?: number;
  cvssVector?: string;
  riskFactor?: string;
  
  // System identification
  host: string;
  hostIp?: string;
  hostFqdn?: string;
  port?: number;
  protocol?: string;
  service?: string;
  
  // Vulnerability details
  pluginId?: string;
  cve?: string[];
  cce?: string[];
  cwe?: string[];
  
  // STIG mapping
  stigId?: string;
  vulnId?: string; // V-number
  cci?: string[];
  ruleType?: 'stig' | 'jsig'; // Type of rule detected
  
  // Evidence and remediation
  solution?: string;
  synopsis?: string;
  output?: string;
  evidence?: string;
  
  // Metadata
  scanner: 'nessus' | 'scap' | 'stig-viewer' | 'manual';
  scanDate: Date;
  lastSeen?: Date;
  firstSeen?: Date;
  
  // Additional context
  tags?: string[];
  references?: string[];
  affectedSoftware?: string[];
}

export interface ParsedHost {
  ip: string;
  fqdn?: string;
  hostname?: string;
  operatingSystem?: string;
  osVersion?: string;
  macAddress?: string;
  netbiosName?: string;
  vulnerabilities: ParsedVulnerability[];
  
  // Scan metadata
  scanStart?: Date;
  scanEnd?: Date;
  credentialedScan?: boolean;
}

export interface ParsedScanResult {
  // Scan metadata
  scanName: string;
  scanDate: Date;
  scanDuration?: number;
  scanner: 'nessus' | 'scap' | 'stig-viewer';
  scannerVersion?: string;
  
  // System information
  targetSystem?: string;
  scanPolicy?: string;
  
  // Results
  hosts: ParsedHost[];
  totalVulnerabilities: number;
  vulnerabilitySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  
  // Processing metadata
  fileName: string;
  fileSize: number;
  parseDate: Date;
  parsingErrors?: string[];
}

export interface ParserOptions {
  // Processing options
  includeInformational?: boolean;
  filterByHost?: string[];
  filterBySeverity?: string[];
  maxVulnerabilities?: number;
  
  // STIG mapping
  autoMapStig?: boolean;
  stigVersion?: string;
  
  // JSIG mapping
  autoMapJsig?: boolean;
  jsigVersion?: string;
  
  // Validation
  validateXml?: boolean;
  strictParsing?: boolean;
}

export interface ParsingError {
  type: 'warning' | 'error' | 'fatal';
  message: string;
  line?: number;
  column?: number;
  element?: string;
  code?: string;
}

export interface ParsingProgress {
  stage: 'parsing' | 'mapping' | 'storing' | 'complete';
  progress: number; // 0-100
  currentItem?: string;
  totalItems?: number;
  processedItems?: number;
  errors: ParsingError[];
  startTime: Date;
  estimatedCompletion?: Date;
}

// Base parser interface
export interface VulnerabilityParser {
  name: string;
  supportedFormats: string[];
  
  parse(content: string | Buffer, options?: ParserOptions): Promise<ParsedScanResult>;
  validate(content: string | Buffer): Promise<boolean>;
  getMetadata(content: string | Buffer): Promise<{
    scanner: string;
    version?: string;
    scanDate?: Date;
    targetCount?: number;
  }>;
}
