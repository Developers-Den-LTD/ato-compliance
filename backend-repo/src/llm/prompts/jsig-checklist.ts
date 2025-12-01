// JSIG (Joint SIG) Checklist Generation Templates
// Creates standardized Joint Service STIG compliance checklists for multi-service environments

import { PromptTemplate, BASE_SYSTEM_PROMPTS } from './base-templates';

export const JSIG_CHECKLIST_TEMPLATE: PromptTemplate = {
  name: 'jsig_checklist',
  description: 'Generate Joint SIG compliance checklist entries with detailed multi-service check procedures and findings',
  systemPrompt: `${BASE_SYSTEM_PROMPTS.audit}

You are generating Joint SIG (JSIG) compliance checklist entries for multi-service environments. Each entry must follow the standardized Joint SIG checklist format with:

1. **Joint Vulnerability ID**: The JSIG rule identifier (e.g., JS-230221)
2. **Status**: Open, NotAFinding, Not_Applicable, or Not_Reviewed
3. **Service Applicability**: Which service branches this rule applies to
4. **Finding Details**: Specific evidence and reasoning for joint service compliance
5. **Service-Specific Comments**: Implementation notes for different service branches

CRITICAL REQUIREMENTS:
- Use ONLY provided JSIG rule data - never fabricate joint service rule details
- Base findings on actual system evidence from joint service environments
- Use precise Joint SIG compliance terminology and multi-service standards
- Account for service-specific implementation variations where applicable
- Provide specific file paths, configurations, or commands for joint environments
- Reference exact NIST control mappings and joint service compliance requirements
- Consider cross-service interoperability and shared infrastructure implications`,

  userPromptTemplate: `Generate a Joint SIG checklist entry for the following:

**System Information:**
- System Name: {{systemName}}
- System Type: {{systemType}}
- Service Environment: {{serviceEnvironment}}
- Assessment Date: {{assessmentDate}}
- Joint Service Context: {{jointServiceContext}}

**JSIG Rule Details:**
- Joint Rule ID: {{jsigRuleId}}
- Rule Title: {{jsigRuleTitle}}
- Severity: {{jsigSeverity}}
- Service Applicability: {{serviceApplicability}}
- Rule Text: {{jsigRuleText}}
- Check Text: {{jsigCheckText}}
- Fix Text: {{jsigFixText}}
- Cross-Service Requirements: {{crossServiceRequirements}}

**Related NIST Controls:**
{{#nistControls}}
- {{controlId}}: {{controlTitle}}
{{/nistControls}}

**Joint Service Evidence:**
{{#evidenceItems}}
- {{type}}: {{description}} (Service: {{serviceContext}})
{{/evidenceItems}}

**Implementation Status by Service:**
{{#serviceImplementations}}
- {{serviceBranch}}: {{implementationStatus}} - {{details}}
{{/serviceImplementations}}

**Multi-Service Context:**
{{additionalNotes}}

Generate a complete Joint SIG checklist entry in the following JSON format:

{
  "jointVulnerabilityId": "JS-XXXXXX",
  "jsigId": "JSIG-XXXX-XXXXXX",
  "title": "Joint rule title",
  "severity": "high|medium|low",
  "serviceApplicability": ["Army", "Navy", "Air Force", "Marines", "Space Force"],
  "status": "Open|NotAFinding|Not_Applicable|Not_Reviewed",
  "findingDetails": "Detailed analysis of joint service compliance status based on evidence",
  "serviceSpecificComments": {
    "Army": "Army-specific implementation notes",
    "Navy": "Navy-specific implementation notes",
    "Air Force": "Air Force-specific implementation notes"
  },
  "comments": "Overall joint service implementation notes and context",
  "evidence": ["List of evidence items supporting the joint service finding"],
  "nistControlMappings": ["AC-2", "AC-3"],
  "crossServiceRequirements": "Joint service interoperability and shared infrastructure requirements",
  "recommendedAction": "Specific remediation steps if status is Open, considering all applicable services",
  "serviceComplianceMatrix": {
    "Army": "Compliant|Non-Compliant|Not_Applicable",
    "Navy": "Compliant|Non-Compliant|Not_Applicable",
    "Air Force": "Compliant|Non-Compliant|Not_Applicable"
  },
  "assessorNotes": "Additional notes for joint service security assessors"
}`,

  outputFormat: 'json',
  requiredVariables: [
    'systemName', 'systemType', 'serviceEnvironment', 'assessmentDate', 'jointServiceContext',
    'jsigRuleId', 'jsigRuleTitle', 'jsigSeverity', 'serviceApplicability', 'jsigRuleText', 
    'jsigCheckText', 'jsigFixText', 'crossServiceRequirements', 'nistControls', 'evidenceItems',
    'serviceImplementations'
  ],
  
  exampleOutput: `{
  "jointVulnerabilityId": "JS-230221",
  "jsigId": "JSIG-2024-010030",
  "title": "Joint Service Systems must display the Standard Mandatory DoD Notice and Consent Banner",
  "severity": "medium",
  "serviceApplicability": ["Army", "Navy", "Air Force", "Marines"],
  "status": "NotAFinding",
  "findingDetails": "All joint service systems display the required DoD Notice and Consent Banner before logon across all service environments. Banner text matches DoD 8500.01 requirements and is consistently implemented via standardized /etc/issue configuration across all service branches.",
  "serviceSpecificComments": {
    "Army": "Banner implemented per Army Regulation 25-2 with additional TRADOC requirements",
    "Navy": "Implementation follows SECNAVINST 5510.30 with fleet-specific modifications",
    "Air Force": "Complies with AFI 17-101 and includes Space Force requirements"
  },
  "comments": "Joint service banner implementation verified across all applicable service environments. Consistent text content complies with DoDI 8500.01 mandatory warning language with service-specific additions as authorized.",
  "evidence": [
    "Standardized /etc/issue file contains compliant banner text across all services",
    "Console login displays banner before authentication prompt on all service systems",
    "Banner text matches DoD 8500.01 Section 4.5.1 requirements with approved service modifications",
    "Cross-service authentication testing confirms consistent banner display"
  ],
  "nistControlMappings": ["AC-8"],
  "crossServiceRequirements": "Banner must be consistent across joint service environments while allowing for service-specific regulatory additions as approved by each service's cybersecurity authority",
  "recommendedAction": "None - control is properly implemented across all applicable services",
  "serviceComplianceMatrix": {
    "Army": "Compliant",
    "Navy": "Compliant", 
    "Air Force": "Compliant",
    "Marines": "Compliant"
  },
  "assessorNotes": "Verified banner display on both console and SSH connections across all service environments. Joint service implementation is complete and compliant with unified DoD standards while respecting service-specific requirements."
}`
};

export const JSIG_BATCH_CHECKLIST_TEMPLATE: PromptTemplate = {
  name: 'jsig_batch_checklist',
  description: 'Generate multiple Joint SIG checklist entries for a complete joint service system assessment',
  systemPrompt: `${BASE_SYSTEM_PROMPTS.audit}

You are generating a complete Joint SIG checklist assessment for a multi-service system environment. Process multiple JSIG rules efficiently while maintaining detailed analysis for each entry across all applicable service branches.

Focus on:
- Consistent joint service assessment methodology across all rules
- Proper risk prioritization based on severity and cross-service impact
- Clear traceability between findings and evidence across service environments
- Comprehensive coverage of all provided Joint SIG requirements
- Service-specific implementation variations and interoperability considerations
- Cross-service security implications and shared infrastructure compliance`,

  userPromptTemplate: `Generate a complete Joint SIG checklist assessment for:

**System Information:**
- System Name: {{systemName}}
- System Description: {{systemDescription}}
- System Type: {{systemType}}
- Security Level: {{securityLevel}}
- Service Environment: {{serviceEnvironment}}
- Joint Service Context: {{jointServiceContext}}
- Assessment Date: {{assessmentDate}}
- Assessor: {{assessorName}}
- Assessing Organization: {{assessingOrganization}}

**Joint SIG Information:**
- JSIG Title: {{jsigTitle}}
- Version: {{jsigVersion}}
- Release: {{jsigRelease}}
- Applicable Services: {{applicableServices}}

**JSIG Rules to Assess:**
{{#jsigRules}}
- {{ruleId}}: {{title}} ({{severity}}) [{{serviceApplicability}}]
{{/jsigRules}}

**Joint Service Evidence Collection:**
{{#evidenceItems}}
- {{type}}: {{description}} ({{status}}) [Service: {{serviceContext}}]
{{/evidenceItems}}

**Service-Specific Implementation Context:**
{{#serviceContexts}}
- {{serviceBranch}}: {{implementationNotes}}
{{/serviceContexts}}

**Cross-Service Considerations:**
{{crossServiceNotes}}

Generate a comprehensive Joint SIG checklist assessment with the following JSON structure:

{
  "checklistMetadata": {
    "systemName": "System name",
    "jsigTitle": "Joint SIG title and version",
    "assessmentDate": "Date",
    "assessor": "Assessor name",
    "assessingOrganization": "Organization conducting assessment",
    "serviceEnvironment": "Joint service environment details",
    "applicableServices": ["Array of applicable service branches"],
    "totalRules": "Number of joint rules assessed",
    "summaryStats": {
      "open": "Number of open findings",
      "notAFinding": "Number of compliant items",
      "notApplicable": "Number of N/A items",
      "notReviewed": "Number of items not yet reviewed"
    },
    "serviceComplianceSummary": {
      "Army": {"compliant": 0, "nonCompliant": 0, "notApplicable": 0},
      "Navy": {"compliant": 0, "nonCompliant": 0, "notApplicable": 0},
      "Air Force": {"compliant": 0, "nonCompliant": 0, "notApplicable": 0}
    }
  },
  "findings": [
    // Array of Joint SIG checklist entries using the single entry format
  ],
  "crossServiceAnalysis": {
    "interoperabilityIssues": ["Cross-service compatibility concerns"],
    "sharedInfrastructureFindings": ["Shared infrastructure compliance issues"],
    "serviceSpecificVariations": ["Documented service-specific implementation differences"]
  },
  "riskSummary": "Overall joint service risk assessment and key cross-service findings",
  "recommendations": {
    "immediate": ["Priority remediation actions affecting all services"],
    "serviceSpecific": {
      "Army": ["Army-specific recommendations"],
      "Navy": ["Navy-specific recommendations"],
      "Air Force": ["Air Force-specific recommendations"]
    },
    "crossService": ["Joint service coordination and standardization recommendations"]
  },
  "assessorNotes": "Overall joint service assessment notes, methodology, and cross-service coordination observations"
}`,

  outputFormat: 'json',
  requiredVariables: [
    'systemName', 'systemDescription', 'systemType', 'securityLevel', 'serviceEnvironment',
    'jointServiceContext', 'assessmentDate', 'assessorName', 'assessingOrganization',
    'jsigTitle', 'jsigVersion', 'applicableServices', 'jsigRules', 'evidenceItems',
    'serviceContexts'
  ]
};
