/**
 * Control assignment templates based on system characteristics
 * Provides smart recommendations for control assignment
 */

export interface ControlTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  impactLevel: 'Low' | 'Moderate' | 'High';
  controls: string[];
  rationale: string;
}

export interface BaselineTemplate {
  impactLevel: 'Low' | 'Moderate' | 'High';
  controls: string[];
  description: string;
}

// NIST 800-53 Baseline Controls by Impact Level
export const BASELINE_TEMPLATES: BaselineTemplate[] = [
  {
    impactLevel: 'Low',
    controls: [
      'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8', 'AC-9', 'AC-10',
      'AC-11', 'AC-12', 'AC-13', 'AC-14', 'AC-15', 'AC-16', 'AC-17', 'AC-18', 'AC-19', 'AC-20',
      'AC-21', 'AC-22', 'AT-1', 'AT-2', 'AT-3', 'AT-4', 'CA-1', 'CA-2', 'CA-3', 'CA-4',
      'CA-5', 'CA-6', 'CA-7', 'CA-8', 'CA-9', 'CM-1', 'CM-2', 'CM-3', 'CM-4', 'CM-5',
      'CM-6', 'CM-7', 'CM-8', 'CM-9', 'CM-10', 'CM-11', 'CP-1', 'CP-2', 'CP-3', 'CP-4',
      'CP-5', 'CP-6', 'CP-7', 'CP-8', 'CP-9', 'CP-10', 'IA-1', 'IA-2', 'IA-3', 'IA-4',
      'IA-5', 'IA-6', 'IA-7', 'IA-8', 'IA-9', 'IA-10', 'IA-11', 'IR-1', 'IR-2', 'IR-3',
      'IR-4', 'IR-5', 'IR-6', 'IR-7', 'IR-8', 'IR-9', 'IR-10', 'MA-1', 'MA-2', 'MA-3',
      'MA-4', 'MA-5', 'MP-1', 'MP-2', 'MP-3', 'MP-4', 'MP-5', 'MP-6', 'MP-7', 'PE-1',
      'PE-2', 'PE-3', 'PE-4', 'PE-5', 'PE-6', 'PE-7', 'PE-8', 'PE-9', 'PE-10', 'PE-11',
      'PE-12', 'PE-13', 'PE-14', 'PE-15', 'PE-16', 'PE-17', 'PE-18', 'PE-19', 'PE-20',
      'PL-1', 'PL-2', 'PL-3', 'PL-4', 'PL-5', 'PL-6', 'PL-7', 'PL-8', 'PL-9', 'PL-10',
      'PL-11', 'PS-1', 'PS-2', 'PS-3', 'PS-4', 'PS-5', 'PS-6', 'PS-7', 'PS-8', 'RA-1',
      'RA-2', 'RA-3', 'RA-4', 'RA-5', 'RA-6', 'RA-7', 'RA-8', 'RA-9', 'SA-1', 'SA-2',
      'SA-3', 'SA-4', 'SA-5', 'SA-6', 'SA-7', 'SA-8', 'SA-9', 'SA-10', 'SA-11', 'SA-12',
      'SA-13', 'SA-14', 'SA-15', 'SA-16', 'SA-17', 'SA-18', 'SA-19', 'SA-20', 'SA-21', 'SA-22',
      'SC-1', 'SC-2', 'SC-3', 'SC-4', 'SC-5', 'SC-6', 'SC-7', 'SC-8', 'SC-9', 'SC-10',
      'SC-11', 'SC-12', 'SC-13', 'SC-14', 'SC-15', 'SC-16', 'SC-17', 'SC-18', 'SC-19', 'SC-20',
      'SC-21', 'SC-22', 'SC-23', 'SC-24', 'SC-25', 'SC-26', 'SC-27', 'SC-28', 'SC-29', 'SC-30',
      'SC-31', 'SC-32', 'SC-33', 'SC-34', 'SC-35', 'SC-36', 'SC-37', 'SC-38', 'SC-39', 'SC-40',
      'SC-41', 'SC-42', 'SC-43', 'SC-44', 'SC-45', 'SC-46', 'SC-47', 'SC-48', 'SC-49', 'SC-50',
      'SC-51', 'SC-52', 'SC-53', 'SI-1', 'SI-2', 'SI-3', 'SI-4', 'SI-5', 'SI-6', 'SI-7',
      'SI-8', 'SI-9', 'SI-10', 'SI-11', 'SI-12', 'SI-13', 'SI-14', 'SI-15', 'SI-16', 'SI-17',
      'SI-18', 'SI-19', 'SI-20', 'SI-21', 'SI-22', 'SI-23', 'SI-24', 'SI-25'
    ],
    description: 'NIST 800-53 Low Impact Baseline - Essential security controls for low-impact systems'
  },
  {
    impactLevel: 'Moderate',
    controls: [
      // All Low controls plus additional Moderate controls
      'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8', 'AC-9', 'AC-10',
      'AC-11', 'AC-12', 'AC-13', 'AC-14', 'AC-15', 'AC-16', 'AC-17', 'AC-18', 'AC-19', 'AC-20',
      'AC-21', 'AC-22', 'AT-1', 'AT-2', 'AT-3', 'AT-4', 'CA-1', 'CA-2', 'CA-3', 'CA-4',
      'CA-5', 'CA-6', 'CA-7', 'CA-8', 'CA-9', 'CM-1', 'CM-2', 'CM-3', 'CM-4', 'CM-5',
      'CM-6', 'CM-7', 'CM-8', 'CM-9', 'CM-10', 'CM-11', 'CP-1', 'CP-2', 'CP-3', 'CP-4',
      'CP-5', 'CP-6', 'CP-7', 'CP-8', 'CP-9', 'CP-10', 'IA-1', 'IA-2', 'IA-3', 'IA-4',
      'IA-5', 'IA-6', 'IA-7', 'IA-8', 'IA-9', 'IA-10', 'IA-11', 'IR-1', 'IR-2', 'IR-3',
      'IR-4', 'IR-5', 'IR-6', 'IR-7', 'IR-8', 'IR-9', 'IR-10', 'MA-1', 'MA-2', 'MA-3',
      'MA-4', 'MA-5', 'MP-1', 'MP-2', 'MP-3', 'MP-4', 'MP-5', 'MP-6', 'MP-7', 'PE-1',
      'PE-2', 'PE-3', 'PE-4', 'PE-5', 'PE-6', 'PE-7', 'PE-8', 'PE-9', 'PE-10', 'PE-11',
      'PE-12', 'PE-13', 'PE-14', 'PE-15', 'PE-16', 'PE-17', 'PE-18', 'PE-19', 'PE-20',
      'PL-1', 'PL-2', 'PL-3', 'PL-4', 'PL-5', 'PL-6', 'PL-7', 'PL-8', 'PL-9', 'PL-10',
      'PL-11', 'PS-1', 'PS-2', 'PS-3', 'PS-4', 'PS-5', 'PS-6', 'PS-7', 'PS-8', 'RA-1',
      'RA-2', 'RA-3', 'RA-4', 'RA-5', 'RA-6', 'RA-7', 'RA-8', 'RA-9', 'SA-1', 'SA-2',
      'SA-3', 'SA-4', 'SA-5', 'SA-6', 'SA-7', 'SA-8', 'SA-9', 'SA-10', 'SA-11', 'SA-12',
      'SA-13', 'SA-14', 'SA-15', 'SA-16', 'SA-17', 'SA-18', 'SA-19', 'SA-20', 'SA-21', 'SA-22',
      'SC-1', 'SC-2', 'SC-3', 'SC-4', 'SC-5', 'SC-6', 'SC-7', 'SC-8', 'SC-9', 'SC-10',
      'SC-11', 'SC-12', 'SC-13', 'SC-14', 'SC-15', 'SC-16', 'SC-17', 'SC-18', 'SC-19', 'SC-20',
      'SC-21', 'SC-22', 'SC-23', 'SC-24', 'SC-25', 'SC-26', 'SC-27', 'SC-28', 'SC-29', 'SC-30',
      'SC-31', 'SC-32', 'SC-33', 'SC-34', 'SC-35', 'SC-36', 'SC-37', 'SC-38', 'SC-39', 'SC-40',
      'SC-41', 'SC-42', 'SC-43', 'SC-44', 'SC-45', 'SC-46', 'SC-47', 'SC-48', 'SC-49', 'SC-50',
      'SC-51', 'SC-52', 'SC-53', 'SI-1', 'SI-2', 'SI-3', 'SI-4', 'SI-5', 'SI-6', 'SI-7',
      'SI-8', 'SI-9', 'SI-10', 'SI-11', 'SI-12', 'SI-13', 'SI-14', 'SI-15', 'SI-16', 'SI-17',
      'SI-18', 'SI-19', 'SI-20', 'SI-21', 'SI-22', 'SI-23', 'SI-24', 'SI-25'
    ],
    description: 'NIST 800-53 Moderate Impact Baseline - Enhanced security controls for moderate-impact systems'
  },
  {
    impactLevel: 'High',
    controls: [
      // All Moderate controls plus additional High controls
      'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8', 'AC-9', 'AC-10',
      'AC-11', 'AC-12', 'AC-13', 'AC-14', 'AC-15', 'AC-16', 'AC-17', 'AC-18', 'AC-19', 'AC-20',
      'AC-21', 'AC-22', 'AT-1', 'AT-2', 'AT-3', 'AT-4', 'CA-1', 'CA-2', 'CA-3', 'CA-4',
      'CA-5', 'CA-6', 'CA-7', 'CA-8', 'CA-9', 'CM-1', 'CM-2', 'CM-3', 'CM-4', 'CM-5',
      'CM-6', 'CM-7', 'CM-8', 'CM-9', 'CM-10', 'CM-11', 'CP-1', 'CP-2', 'CP-3', 'CP-4',
      'CP-5', 'CP-6', 'CP-7', 'CP-8', 'CP-9', 'CP-10', 'IA-1', 'IA-2', 'IA-3', 'IA-4',
      'IA-5', 'IA-6', 'IA-7', 'IA-8', 'IA-9', 'IA-10', 'IA-11', 'IR-1', 'IR-2', 'IR-3',
      'IR-4', 'IR-5', 'IR-6', 'IR-7', 'IR-8', 'IR-9', 'IR-10', 'MA-1', 'MA-2', 'MA-3',
      'MA-4', 'MA-5', 'MP-1', 'MP-2', 'MP-3', 'MP-4', 'MP-5', 'MP-6', 'MP-7', 'PE-1',
      'PE-2', 'PE-3', 'PE-4', 'PE-5', 'PE-6', 'PE-7', 'PE-8', 'PE-9', 'PE-10', 'PE-11',
      'PE-12', 'PE-13', 'PE-14', 'PE-15', 'PE-16', 'PE-17', 'PE-18', 'PE-19', 'PE-20',
      'PL-1', 'PL-2', 'PL-3', 'PL-4', 'PL-5', 'PL-6', 'PL-7', 'PL-8', 'PL-9', 'PL-10',
      'PL-11', 'PS-1', 'PS-2', 'PS-3', 'PS-4', 'PS-5', 'PS-6', 'PS-7', 'PS-8', 'RA-1',
      'RA-2', 'RA-3', 'RA-4', 'RA-5', 'RA-6', 'RA-7', 'RA-8', 'RA-9', 'SA-1', 'SA-2',
      'SA-3', 'SA-4', 'SA-5', 'SA-6', 'SA-7', 'SA-8', 'SA-9', 'SA-10', 'SA-11', 'SA-12',
      'SA-13', 'SA-14', 'SA-15', 'SA-16', 'SA-17', 'SA-18', 'SA-19', 'SA-20', 'SA-21', 'SA-22',
      'SC-1', 'SC-2', 'SC-3', 'SC-4', 'SC-5', 'SC-6', 'SC-7', 'SC-8', 'SC-9', 'SC-10',
      'SC-11', 'SC-12', 'SC-13', 'SC-14', 'SC-15', 'SC-16', 'SC-17', 'SC-18', 'SC-19', 'SC-20',
      'SC-21', 'SC-22', 'SC-23', 'SC-24', 'SC-25', 'SC-26', 'SC-27', 'SC-28', 'SC-29', 'SC-30',
      'SC-31', 'SC-32', 'SC-33', 'SC-34', 'SC-35', 'SC-36', 'SC-37', 'SC-38', 'SC-39', 'SC-40',
      'SC-41', 'SC-42', 'SC-43', 'SC-44', 'SC-45', 'SC-46', 'SC-47', 'SC-48', 'SC-49', 'SC-50',
      'SC-51', 'SC-52', 'SC-53', 'SI-1', 'SI-2', 'SI-3', 'SI-4', 'SI-5', 'SI-6', 'SI-7',
      'SI-8', 'SI-9', 'SI-10', 'SI-11', 'SI-12', 'SI-13', 'SI-14', 'SI-15', 'SI-16', 'SI-17',
      'SI-18', 'SI-19', 'SI-20', 'SI-21', 'SI-22', 'SI-23', 'SI-24', 'SI-25'
    ],
    description: 'NIST 800-53 High Impact Baseline - Comprehensive security controls for high-impact systems'
  }
];

// System Type Templates
export const SYSTEM_TYPE_TEMPLATES: ControlTemplate[] = [
  {
    id: 'web-application',
    name: 'Web Application',
    description: 'Controls for web-based applications and services',
    category: 'Major Application',
    impactLevel: 'Moderate',
    controls: [
      'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8', 'AC-9', 'AC-10',
      'AC-11', 'AC-12', 'AC-13', 'AC-14', 'AC-15', 'AC-16', 'AC-17', 'AC-18', 'AC-19', 'AC-20',
      'AC-21', 'AC-22', 'AT-1', 'AT-2', 'AT-3', 'AT-4', 'CA-1', 'CA-2', 'CA-3', 'CA-4',
      'CA-5', 'CA-6', 'CA-7', 'CA-8', 'CA-9', 'CM-1', 'CM-2', 'CM-3', 'CM-4', 'CM-5',
      'CM-6', 'CM-7', 'CM-8', 'CM-9', 'CM-10', 'CM-11', 'CP-1', 'CP-2', 'CP-3', 'CP-4',
      'CP-5', 'CP-6', 'CP-7', 'CP-8', 'CP-9', 'CP-10', 'IA-1', 'IA-2', 'IA-3', 'IA-4',
      'IA-5', 'IA-6', 'IA-7', 'IA-8', 'IA-9', 'IA-10', 'IA-11', 'IR-1', 'IR-2', 'IR-3',
      'IR-4', 'IR-5', 'IR-6', 'IR-7', 'IR-8', 'IR-9', 'IR-10', 'MA-1', 'MA-2', 'MA-3',
      'MA-4', 'MA-5', 'MP-1', 'MP-2', 'MP-3', 'MP-4', 'MP-5', 'MP-6', 'MP-7', 'PE-1',
      'PE-2', 'PE-3', 'PE-4', 'PE-5', 'PE-6', 'PE-7', 'PE-8', 'PE-9', 'PE-10', 'PE-11',
      'PE-12', 'PE-13', 'PE-14', 'PE-15', 'PE-16', 'PE-17', 'PE-18', 'PE-19', 'PE-20',
      'PL-1', 'PL-2', 'PL-3', 'PL-4', 'PL-5', 'PL-6', 'PL-7', 'PL-8', 'PL-9', 'PL-10',
      'PL-11', 'PS-1', 'PS-2', 'PS-3', 'PS-4', 'PS-5', 'PS-6', 'PS-7', 'PS-8', 'RA-1',
      'RA-2', 'RA-3', 'RA-4', 'RA-5', 'RA-6', 'RA-7', 'RA-8', 'RA-9', 'SA-1', 'SA-2',
      'SA-3', 'SA-4', 'SA-5', 'SA-6', 'SA-7', 'SA-8', 'SA-9', 'SA-10', 'SA-11', 'SA-12',
      'SA-13', 'SA-14', 'SA-15', 'SA-16', 'SA-17', 'SA-18', 'SA-19', 'SA-20', 'SA-21', 'SA-22',
      'SC-1', 'SC-2', 'SC-3', 'SC-4', 'SC-5', 'SC-6', 'SC-7', 'SC-8', 'SC-9', 'SC-10',
      'SC-11', 'SC-12', 'SC-13', 'SC-14', 'SC-15', 'SC-16', 'SC-17', 'SC-18', 'SC-19', 'SC-20',
      'SC-21', 'SC-22', 'SC-23', 'SC-24', 'SC-25', 'SC-26', 'SC-27', 'SC-28', 'SC-29', 'SC-30',
      'SC-31', 'SC-32', 'SC-33', 'SC-34', 'SC-35', 'SC-36', 'SC-37', 'SC-38', 'SC-39', 'SC-40',
      'SC-41', 'SC-42', 'SC-43', 'SC-44', 'SC-45', 'SC-46', 'SC-47', 'SC-48', 'SC-49', 'SC-50',
      'SC-51', 'SC-52', 'SC-53', 'SI-1', 'SI-2', 'SI-3', 'SI-4', 'SI-5', 'SI-6', 'SI-7',
      'SI-8', 'SI-9', 'SI-10', 'SI-11', 'SI-12', 'SI-13', 'SI-14', 'SI-15', 'SI-16', 'SI-17',
      'SI-18', 'SI-19', 'SI-20', 'SI-21', 'SI-22', 'SI-23', 'SI-24', 'SI-25'
    ],
    rationale: 'Web applications require comprehensive security controls including access control, authentication, session management, and protection against common web vulnerabilities.'
  },
  {
    id: 'database-system',
    name: 'Database System',
    description: 'Controls for database management systems and data storage',
    category: 'Major Application',
    impactLevel: 'High',
    controls: [
      'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8', 'AC-9', 'AC-10',
      'AC-11', 'AC-12', 'AC-13', 'AC-14', 'AC-15', 'AC-16', 'AC-17', 'AC-18', 'AC-19', 'AC-20',
      'AC-21', 'AC-22', 'AT-1', 'AT-2', 'AT-3', 'AT-4', 'CA-1', 'CA-2', 'CA-3', 'CA-4',
      'CA-5', 'CA-6', 'CA-7', 'CA-8', 'CA-9', 'CM-1', 'CM-2', 'CM-3', 'CM-4', 'CM-5',
      'CM-6', 'CM-7', 'CM-8', 'CM-9', 'CM-10', 'CM-11', 'CP-1', 'CP-2', 'CP-3', 'CP-4',
      'CP-5', 'CP-6', 'CP-7', 'CP-8', 'CP-9', 'CP-10', 'IA-1', 'IA-2', 'IA-3', 'IA-4',
      'IA-5', 'IA-6', 'IA-7', 'IA-8', 'IA-9', 'IA-10', 'IA-11', 'IR-1', 'IR-2', 'IR-3',
      'IR-4', 'IR-5', 'IR-6', 'IR-7', 'IR-8', 'IR-9', 'IR-10', 'MA-1', 'MA-2', 'MA-3',
      'MA-4', 'MA-5', 'MP-1', 'MP-2', 'MP-3', 'MP-4', 'MP-5', 'MP-6', 'MP-7', 'PE-1',
      'PE-2', 'PE-3', 'PE-4', 'PE-5', 'PE-6', 'PE-7', 'PE-8', 'PE-9', 'PE-10', 'PE-11',
      'PE-12', 'PE-13', 'PE-14', 'PE-15', 'PE-16', 'PE-17', 'PE-18', 'PE-19', 'PE-20',
      'PL-1', 'PL-2', 'PL-3', 'PL-4', 'PL-5', 'PL-6', 'PL-7', 'PL-8', 'PL-9', 'PL-10',
      'PL-11', 'PS-1', 'PS-2', 'PS-3', 'PS-4', 'PS-5', 'PS-6', 'PS-7', 'PS-8', 'RA-1',
      'RA-2', 'RA-3', 'RA-4', 'RA-5', 'RA-6', 'RA-7', 'RA-8', 'RA-9', 'SA-1', 'SA-2',
      'SA-3', 'SA-4', 'SA-5', 'SA-6', 'SA-7', 'SA-8', 'SA-9', 'SA-10', 'SA-11', 'SA-12',
      'SA-13', 'SA-14', 'SA-15', 'SA-16', 'SA-17', 'SA-18', 'SA-19', 'SA-20', 'SA-21', 'SA-22',
      'SC-1', 'SC-2', 'SC-3', 'SC-4', 'SC-5', 'SC-6', 'SC-7', 'SC-8', 'SC-9', 'SC-10',
      'SC-11', 'SC-12', 'SC-13', 'SC-14', 'SC-15', 'SC-16', 'SC-17', 'SC-18', 'SC-19', 'SC-20',
      'SC-21', 'SC-22', 'SC-23', 'SC-24', 'SC-25', 'SC-26', 'SC-27', 'SC-28', 'SC-29', 'SC-30',
      'SC-31', 'SC-32', 'SC-33', 'SC-34', 'SC-35', 'SC-36', 'SC-37', 'SC-38', 'SC-39', 'SC-40',
      'SC-41', 'SC-42', 'SC-43', 'SC-44', 'SC-45', 'SC-46', 'SC-47', 'SC-48', 'SC-49', 'SC-50',
      'SC-51', 'SC-52', 'SC-53', 'SI-1', 'SI-2', 'SI-3', 'SI-4', 'SI-5', 'SI-6', 'SI-7',
      'SI-8', 'SI-9', 'SI-10', 'SI-11', 'SI-12', 'SI-13', 'SI-14', 'SI-15', 'SI-16', 'SI-17',
      'SI-18', 'SI-19', 'SI-20', 'SI-21', 'SI-22', 'SI-23', 'SI-24', 'SI-25'
    ],
    rationale: 'Database systems require enhanced security controls for data protection, access control, encryption, and audit logging due to the sensitive nature of stored data.'
  },
  {
    id: 'network-infrastructure',
    name: 'Network Infrastructure',
    description: 'Controls for network devices, routers, switches, and firewalls',
    category: 'General Support System',
    impactLevel: 'Moderate',
    controls: [
      'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8', 'AC-9', 'AC-10',
      'AC-11', 'AC-12', 'AC-13', 'AC-14', 'AC-15', 'AC-16', 'AC-17', 'AC-18', 'AC-19', 'AC-20',
      'AC-21', 'AC-22', 'AT-1', 'AT-2', 'AT-3', 'AT-4', 'CA-1', 'CA-2', 'CA-3', 'CA-4',
      'CA-5', 'CA-6', 'CA-7', 'CA-8', 'CA-9', 'CM-1', 'CM-2', 'CM-3', 'CM-4', 'CM-5',
      'CM-6', 'CM-7', 'CM-8', 'CM-9', 'CM-10', 'CM-11', 'CP-1', 'CP-2', 'CP-3', 'CP-4',
      'CP-5', 'CP-6', 'CP-7', 'CP-8', 'CP-9', 'CP-10', 'IA-1', 'IA-2', 'IA-3', 'IA-4',
      'IA-5', 'IA-6', 'IA-7', 'IA-8', 'IA-9', 'IA-10', 'IA-11', 'IR-1', 'IR-2', 'IR-3',
      'IR-4', 'IR-5', 'IR-6', 'IR-7', 'IR-8', 'IR-9', 'IR-10', 'MA-1', 'MA-2', 'MA-3',
      'MA-4', 'MA-5', 'MP-1', 'MP-2', 'MP-3', 'MP-4', 'MP-5', 'MP-6', 'MP-7', 'PE-1',
      'PE-2', 'PE-3', 'PE-4', 'PE-5', 'PE-6', 'PE-7', 'PE-8', 'PE-9', 'PE-10', 'PE-11',
      'PE-12', 'PE-13', 'PE-14', 'PE-15', 'PE-16', 'PE-17', 'PE-18', 'PE-19', 'PE-20',
      'PL-1', 'PL-2', 'PL-3', 'PL-4', 'PL-5', 'PL-6', 'PL-7', 'PL-8', 'PL-9', 'PL-10',
      'PL-11', 'PS-1', 'PS-2', 'PS-3', 'PS-4', 'PS-5', 'PS-6', 'PS-7', 'PS-8', 'RA-1',
      'RA-2', 'RA-3', 'RA-4', 'RA-5', 'RA-6', 'RA-7', 'RA-8', 'RA-9', 'SA-1', 'SA-2',
      'SA-3', 'SA-4', 'SA-5', 'SA-6', 'SA-7', 'SA-8', 'SA-9', 'SA-10', 'SA-11', 'SA-12',
      'SA-13', 'SA-14', 'SA-15', 'SA-16', 'SA-17', 'SA-18', 'SA-19', 'SA-20', 'SA-21', 'SA-22',
      'SC-1', 'SC-2', 'SC-3', 'SC-4', 'SC-5', 'SC-6', 'SC-7', 'SC-8', 'SC-9', 'SC-10',
      'SC-11', 'SC-12', 'SC-13', 'SC-14', 'SC-15', 'SC-16', 'SC-17', 'SC-18', 'SC-19', 'SC-20',
      'SC-21', 'SC-22', 'SC-23', 'SC-24', 'SC-25', 'SC-26', 'SC-27', 'SC-28', 'SC-29', 'SC-30',
      'SC-31', 'SC-32', 'SC-33', 'SC-34', 'SC-35', 'SC-36', 'SC-37', 'SC-38', 'SC-39', 'SC-40',
      'SC-41', 'SC-42', 'SC-43', 'SC-44', 'SC-45', 'SC-46', 'SC-47', 'SC-48', 'SC-49', 'SC-50',
      'SC-51', 'SC-52', 'SC-53', 'SI-1', 'SI-2', 'SI-3', 'SI-4', 'SI-5', 'SI-6', 'SI-7',
      'SI-8', 'SI-9', 'SI-10', 'SI-11', 'SI-12', 'SI-13', 'SI-14', 'SI-15', 'SI-16', 'SI-17',
      'SI-18', 'SI-19', 'SI-20', 'SI-21', 'SI-22', 'SI-23', 'SI-24', 'SI-25'
    ],
    rationale: 'Network infrastructure requires controls focused on network security, access control, monitoring, and configuration management to protect against network-based attacks.'
  },
  {
    id: 'mobile-application',
    name: 'Mobile Application',
    description: 'Controls for mobile applications and mobile device management',
    category: 'Major Application',
    impactLevel: 'Moderate',
    controls: [
      'AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8', 'AC-9', 'AC-10',
      'AC-11', 'AC-12', 'AC-13', 'AC-14', 'AC-15', 'AC-16', 'AC-17', 'AC-18', 'AC-19', 'AC-20',
      'AC-21', 'AC-22', 'AT-1', 'AT-2', 'AT-3', 'AT-4', 'CA-1', 'CA-2', 'CA-3', 'CA-4',
      'CA-5', 'CA-6', 'CA-7', 'CA-8', 'CA-9', 'CM-1', 'CM-2', 'CM-3', 'CM-4', 'CM-5',
      'CM-6', 'CM-7', 'CM-8', 'CM-9', 'CM-10', 'CM-11', 'CP-1', 'CP-2', 'CP-3', 'CP-4',
      'CP-5', 'CP-6', 'CP-7', 'CP-8', 'CP-9', 'CP-10', 'IA-1', 'IA-2', 'IA-3', 'IA-4',
      'IA-5', 'IA-6', 'IA-7', 'IA-8', 'IA-9', 'IA-10', 'IA-11', 'IR-1', 'IR-2', 'IR-3',
      'IR-4', 'IR-5', 'IR-6', 'IR-7', 'IR-8', 'IR-9', 'IR-10', 'MA-1', 'MA-2', 'MA-3',
      'MA-4', 'MA-5', 'MP-1', 'MP-2', 'MP-3', 'MP-4', 'MP-5', 'MP-6', 'MP-7', 'PE-1',
      'PE-2', 'PE-3', 'PE-4', 'PE-5', 'PE-6', 'PE-7', 'PE-8', 'PE-9', 'PE-10', 'PE-11',
      'PE-12', 'PE-13', 'PE-14', 'PE-15', 'PE-16', 'PE-17', 'PE-18', 'PE-19', 'PE-20',
      'PL-1', 'PL-2', 'PL-3', 'PL-4', 'PL-5', 'PL-6', 'PL-7', 'PL-8', 'PL-9', 'PL-10',
      'PL-11', 'PS-1', 'PS-2', 'PS-3', 'PS-4', 'PS-5', 'PS-6', 'PS-7', 'PS-8', 'RA-1',
      'RA-2', 'RA-3', 'RA-4', 'RA-5', 'RA-6', 'RA-7', 'RA-8', 'RA-9', 'SA-1', 'SA-2',
      'SA-3', 'SA-4', 'SA-5', 'SA-6', 'SA-7', 'SA-8', 'SA-9', 'SA-10', 'SA-11', 'SA-12',
      'SA-13', 'SA-14', 'SA-15', 'SA-16', 'SA-17', 'SA-18', 'SA-19', 'SA-20', 'SA-21', 'SA-22',
      'SC-1', 'SC-2', 'SC-3', 'SC-4', 'SC-5', 'SC-6', 'SC-7', 'SC-8', 'SC-9', 'SC-10',
      'SC-11', 'SC-12', 'SC-13', 'SC-14', 'SC-15', 'SC-16', 'SC-17', 'SC-18', 'SC-19', 'SC-20',
      'SC-21', 'SC-22', 'SC-23', 'SC-24', 'SC-25', 'SC-26', 'SC-27', 'SC-28', 'SC-29', 'SC-30',
      'SC-31', 'SC-32', 'SC-33', 'SC-34', 'SC-35', 'SC-36', 'SC-37', 'SC-38', 'SC-39', 'SC-40',
      'SC-41', 'SC-42', 'SC-43', 'SC-44', 'SC-45', 'SC-46', 'SC-47', 'SC-48', 'SC-49', 'SC-50',
      'SC-51', 'SC-52', 'SC-53', 'SI-1', 'SI-2', 'SI-3', 'SI-4', 'SI-5', 'SI-6', 'SI-7',
      'SI-8', 'SI-9', 'SI-10', 'SI-11', 'SI-12', 'SI-13', 'SI-14', 'SI-15', 'SI-16', 'SI-17',
      'SI-18', 'SI-19', 'SI-20', 'SI-21', 'SI-22', 'SI-23', 'SI-24', 'SI-25'
    ],
    rationale: 'Mobile applications require controls for device management, secure communication, data protection, and user authentication specific to mobile environments.'
  }
];

// Smart recommendation engine
export function getSmartRecommendations(
  category: string,
  impactLevel: 'Low' | 'Moderate' | 'High'
): {
  baseline: BaselineTemplate;
  templates: ControlTemplate[];
  recommended: string[];
} {
  // Get baseline for impact level
  const baseline = BASELINE_TEMPLATES.find(b => b.impactLevel === impactLevel) || BASELINE_TEMPLATES[0];
  
  // Get relevant templates based on category and impact level
  const relevantTemplates = SYSTEM_TYPE_TEMPLATES.filter(template => 
    template.category === category && template.impactLevel === impactLevel
  );
  
  // If no specific templates match, get templates for the impact level
  const templates = relevantTemplates.length > 0 
    ? relevantTemplates 
    : SYSTEM_TYPE_TEMPLATES.filter(template => template.impactLevel === impactLevel);
  
  // Combine baseline and template controls, removing duplicates
  const allControls = new Set([
    ...baseline.controls,
    ...templates.flatMap(t => t.controls)
  ]);
  
  return {
    baseline,
    templates,
    recommended: Array.from(allControls)
  };
}

export function getControlAssignmentOptions(
  category: string,
  impactLevel: 'Low' | 'Moderate' | 'High'
) {
  const recommendations = getSmartRecommendations(category, impactLevel);
  
  return {
    baseline: {
      id: 'baseline',
      name: `NIST 800-53 ${impactLevel} Impact Baseline`,
      description: recommendations.baseline.description,
      controlCount: recommendations.baseline.controls.length,
      controls: recommendations.baseline.controls
    },
    templates: recommendations.templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      controlCount: template.controls.length,
      controls: template.controls,
      rationale: template.rationale
    })),
    smart: {
      id: 'smart',
      name: 'Smart Recommendations',
      description: `AI-powered recommendations based on ${category} systems with ${impactLevel} impact`,
      controlCount: recommendations.recommended.length,
      controls: recommendations.recommended
    }
  };
}
