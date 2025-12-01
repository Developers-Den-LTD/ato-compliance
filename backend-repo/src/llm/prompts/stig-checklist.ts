// STIG Checklist Generation Templates
// Creates standardized DISA STIG compliance checklists

import { PromptTemplate, BASE_SYSTEM_PROMPTS } from './base-templates';

export const STIG_CHECKLIST_TEMPLATE: PromptTemplate = {
  name: 'stig_checklist',
  description: 'Generate DISA STIG compliance checklist entries with detailed check procedures and findings',
  systemPrompt: `${BASE_SYSTEM_PROMPTS.audit}

You are generating DISA STIG compliance checklist entries. Each entry must follow the standardized STIG checklist format with:

1. **Vulnerability ID**: The STIG rule identifier (e.g., V-230221)
2. **Status**: Open, NotAFinding, or Not_Applicable
3. **Finding Details**: Specific evidence and reasoning
4. **Comments**: Additional context and implementation notes

CRITICAL REQUIREMENTS:
- Use ONLY provided STIG rule data - never fabricate rule details
- Base findings on actual system evidence provided
- Use precise STIG compliance terminology
- Provide specific file paths, configurations, or commands when applicable
- Reference exact NIST control mappings where relevant`,

  userPromptTemplate: `Generate a STIG checklist entry for the following:

**System Information:**
- System Name: {{systemName}}
- System Type: {{systemType}}
- Assessment Date: {{assessmentDate}}

**STIG Rule Details:**
- Rule ID: {{stigRuleId}}
- Title: {{stigRuleTitle}}
- Severity: {{stigSeverity}}
- Rule Text: {{stigRuleText}}
- Check Text: {{stigCheckText}}
- Fix Text: {{stigFixText}}

**Related NIST Controls:**
{{#nisControls}}
- {{controlId}}: {{controlTitle}}
{{/nisControls}}

**System Evidence:**
{{#evidenceItems}}
- {{type}}: {{description}}
{{/evidenceItems}}

**Implementation Status:**
{{implementationStatus}}

**Additional Context:**
{{additionalNotes}}

Generate a complete STIG checklist entry in the following JSON format:

{
  "vulnerabilityId": "V-XXXXXX",
  "stigId": "RHEL-08-XXXXXX",
  "title": "Rule title",
  "severity": "high|medium|low",
  "status": "Open|NotAFinding|Not_Applicable",
  "findingDetails": "Detailed analysis of compliance status based on evidence",
  "comments": "Implementation notes and additional context",
  "evidence": ["List of evidence items that support the finding"],
  "nisControlMappings": ["AC-2", "AC-3"],
  "recommendedAction": "Specific remediation steps if status is Open",
  "assessorNotes": "Additional notes for security assessors"
}`,

  outputFormat: 'json',
  requiredVariables: [
    'systemName', 'systemType', 'assessmentDate',
    'stigRuleId', 'stigRuleTitle', 'stigSeverity', 'stigRuleText', 
    'stigCheckText', 'stigFixText', 'nisControls', 'evidenceItems',
    'implementationStatus'
  ],
  
  exampleOutput: `{
  "vulnerabilityId": "V-230221",
  "stigId": "RHEL-08-010030",
  "title": "RHEL 8 must display the Standard Mandatory DoD Notice and Consent Banner",
  "severity": "medium",
  "status": "NotAFinding",
  "findingDetails": "System displays the required DoD Notice and Consent Banner before logon. Banner text matches DoD 8500.01 requirements and is displayed via /etc/issue configuration.",
  "comments": "Banner implementation verified through /etc/issue file analysis and console login testing. Text content complies with DoDI 8500.01 mandatory warning language.",
  "evidence": [
    "/etc/issue file contains compliant banner text",
    "Console login displays banner before authentication prompt",
    "Banner text matches DoD 8500.01 Section 4.5.1 requirements"
  ],
  "nisControlMappings": ["AC-8"],
  "recommendedAction": "None - control is properly implemented",
  "assessorNotes": "Verified banner display on both console and SSH connections. Implementation is complete and compliant."
}`
};

export const STIG_BATCH_CHECKLIST_TEMPLATE: PromptTemplate = {
  name: 'stig_batch_checklist',
  description: 'Generate multiple STIG checklist entries for a complete system assessment',
  systemPrompt: `${BASE_SYSTEM_PROMPTS.audit}

You are generating a complete STIG checklist assessment for a system. Process multiple STIG rules efficiently while maintaining detailed analysis for each entry.

Focus on:
- Consistent assessment methodology across all rules
- Proper risk prioritization based on severity
- Clear traceability between findings and evidence
- Comprehensive coverage of all provided STIG requirements`,

  userPromptTemplate: `Generate a complete STIG checklist assessment for:

**System Information:**
- System Name: {{systemName}}
- System Description: {{systemDescription}}
- System Type: {{systemType}}
- Security Level: {{securityLevel}}
- Assessment Date: {{assessmentDate}}
- Assessor: {{assessorName}}

**STIG Information:**
- STIG Title: {{stigTitle}}
- Version: {{stigVersion}}
- Release: {{stigRelease}}

**STIG Rules to Assess:**
{{#stigRules}}
- {{ruleId}}: {{title}} ({{severity}})
{{/stigRules}}

**System Evidence Collection:**
{{#evidenceItems}}
- {{type}}: {{description}} ({{status}})
{{/evidenceItems}}

**Implementation Context:**
{{implementationNotes}}

Generate a comprehensive STIG checklist assessment with the following JSON structure:

{
  "checklistMetadata": {
    "systemName": "System name",
    "stigTitle": "STIG title and version",
    "assessmentDate": "Date",
    "assessor": "Assessor name",
    "totalRules": "Number of rules assessed",
    "summaryStats": {
      "open": "Number of open findings",
      "notAFinding": "Number of compliant items",
      "notApplicable": "Number of N/A items"
    }
  },
  "findings": [
    // Array of STIG checklist entries using the single entry format
  ],
  "riskSummary": "Overall risk assessment and key findings",
  "recommendations": ["Priority remediation actions"],
  "assessorNotes": "Overall assessment notes and methodology"
}`,

  outputFormat: 'json',
  requiredVariables: [
    'systemName', 'systemDescription', 'systemType', 'securityLevel',
    'assessmentDate', 'assessorName', 'stigTitle', 'stigVersion',
    'stigRules', 'evidenceItems'
  ]
};
