// Sample NIST 800-53 controls for MVP
// Full 1,222 controls can be loaded later
export const NIST_CONTROLS = [
  // Access Control Family (AC)
  { id: 'AC-1', family: 'Access Control', title: 'Policy and Procedures', description: 'Develop, document, and disseminate access control policy and procedures.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'AC-2', family: 'Access Control', title: 'Account Management', description: 'Manage system accounts including creation, enabling, modification, review, and removal.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'AC-2(1)', family: 'Access Control', title: 'Account Management | Automated System Account Management', description: 'Support the management of system accounts using automated mechanisms.', baseline: ['Moderate', 'High'], priority: 'P2', enhancement: '(1)', parentControlId: 'AC-2' },
  { id: 'AC-3', family: 'Access Control', title: 'Access Enforcement', description: 'Enforce approved authorizations for logical access.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'AC-4', family: 'Access Control', title: 'Information Flow Enforcement', description: 'Enforce approved authorizations for controlling information flow.', baseline: ['Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'AC-5', family: 'Access Control', title: 'Separation of Duties', description: 'Separate duties of individuals to prevent malevolent activity.', baseline: ['Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'AC-6', family: 'Access Control', title: 'Least Privilege', description: 'Employ the principle of least privilege.', baseline: ['Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'AC-7', family: 'Access Control', title: 'Unsuccessful Logon Attempts', description: 'Enforce a limit on consecutive invalid logon attempts.', baseline: ['Low', 'Moderate', 'High'], priority: 'P2', enhancement: null, parentControlId: null },
  
  // Audit and Accountability (AU)
  { id: 'AU-1', family: 'Audit and Accountability', title: 'Policy and Procedures', description: 'Develop, document, and disseminate audit and accountability policy.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'AU-2', family: 'Audit and Accountability', title: 'Event Logging', description: 'Identify the types of events that the system is capable of logging.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'AU-3', family: 'Audit and Accountability', title: 'Content of Audit Records', description: 'Ensure audit records contain information to establish what, when, where, and who.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'AU-4', family: 'Audit and Accountability', title: 'Audit Log Storage Capacity', description: 'Allocate audit log storage capacity to accommodate audit log retention requirements.', baseline: ['Low', 'Moderate', 'High'], priority: 'P2', enhancement: null, parentControlId: null },
  { id: 'AU-5', family: 'Audit and Accountability', title: 'Response to Audit Logging Process Failures', description: 'Alert personnel and take additional actions in the event of an audit logging process failure.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'AU-6', family: 'Audit and Accountability', title: 'Audit Record Review, Analysis, and Reporting', description: 'Review and analyze system audit records for indications of inappropriate activity.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  
  // Identification and Authentication (IA)
  { id: 'IA-1', family: 'Identification and Authentication', title: 'Policy and Procedures', description: 'Develop, document, and disseminate identification and authentication policy.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'IA-2', family: 'Identification and Authentication', title: 'Identification and Authentication', description: 'Uniquely identify and authenticate organizational users.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'IA-2(1)', family: 'Identification and Authentication', title: 'Multi-Factor Authentication', description: 'Implement multi-factor authentication for access to privileged accounts.', baseline: ['Moderate', 'High'], priority: 'P1', enhancement: '(1)', parentControlId: 'IA-2' },
  { id: 'IA-3', family: 'Identification and Authentication', title: 'Device Identification and Authentication', description: 'Uniquely identify and authenticate devices before establishing a connection.', baseline: ['Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'IA-4', family: 'Identification and Authentication', title: 'Identifier Management', description: 'Manage system identifiers.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'IA-5', family: 'Identification and Authentication', title: 'Authenticator Management', description: 'Manage system authenticators.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  
  // System and Communications Protection (SC)
  { id: 'SC-1', family: 'System and Communications Protection', title: 'Policy and Procedures', description: 'Develop, document, and disseminate system and communications protection policy.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'SC-2', family: 'System and Communications Protection', title: 'Separation of System and User Functionality', description: 'Separate user functionality from system management functionality.', baseline: ['Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'SC-7', family: 'System and Communications Protection', title: 'Boundary Protection', description: 'Monitor and control communications at external and key internal system boundaries.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'SC-8', family: 'System and Communications Protection', title: 'Transmission Confidentiality and Integrity', description: 'Protect the confidentiality and integrity of transmitted information.', baseline: ['Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
  { id: 'SC-12', family: 'System and Communications Protection', title: 'Cryptographic Key Establishment and Management', description: 'Establish and manage cryptographic keys.', baseline: ['Low', 'Moderate', 'High'], priority: 'P1', enhancement: null, parentControlId: null },
];

// Baseline mappings
export const BASELINE_CONTROLS = {
  Low: NIST_CONTROLS.filter(c => c.baseline.includes('Low')).map(c => c.id),
  Moderate: NIST_CONTROLS.filter(c => c.baseline.includes('Moderate')).map(c => c.id),
  High: NIST_CONTROLS.filter(c => c.baseline.includes('High')).map(c => c.id),
};
