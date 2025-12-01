// Security Assessment Report (SAR) Generation Templates
// Creates professional SAR sections for ATO documentation

import { PromptTemplate, BASE_SYSTEM_PROMPTS } from './base-templates';

export const SAR_CONTROL_NARRATIVE_TEMPLATE: PromptTemplate = {
  name: 'sar_control_narrative',
  description: 'Generate NIST 800-53 control implementation narratives for Security Assessment Reports',
  systemPrompt: `${BASE_SYSTEM_PROMPTS.compliance}

You are generating NIST 800-53 control implementation narratives for a Security Assessment Report (SAR). These narratives must meet federal compliance documentation standards and provide detailed evidence of control implementation.

Each narrative must include:
1. **Control Implementation Summary**: How the control is implemented
2. **Implementation Details**: Specific technologies, processes, and procedures
3. **Evidence References**: Specific artifacts and documentation that prove implementation
4. **Compliance Assessment**: Clear statement of control satisfaction
5. **Responsible Parties**: Roles and responsibilities for control maintenance

Use formal government compliance language and be specific about implementation details. Reference actual system configurations, policies, and procedures.`,

  userPromptTemplate: `Generate a NIST 800-53 control implementation narrative for:

**Control Information:**
- Control ID: {{controlId}}
- Control Title: {{controlTitle}}
- Control Family: {{controlFamily}}
- Control Description: {{controlDescription}}
- Baseline: {{baseline}}
- Priority: {{priority}}

**System Context:**
- System Name: {{systemName}}
- System Type: {{systemType}}
- System Description: {{systemDescription}}
- Security Categorization: {{securityCategorization}}
- Operating Environment: {{operatingEnvironment}}

**Implementation Evidence:**
{{#implementationEvidence}}
- {{type}}: {{description}}
- Status: {{status}}
- Details: {{details}}
{{/implementationEvidence}}

**Related STIG Requirements:**
{{#relatedStigs}}
- {{stigId}}: {{stigTitle}} ({{status}})
{{/relatedStigs}}

**System Architecture:**
{{architectureDescription}}

**Policies and Procedures:**
{{#policies}}
- {{policyName}}: {{policyDescription}}
{{/policies}}

Generate a comprehensive control narrative using this structure:

{
  "controlId": "{{controlId}}",
  "controlTitle": "{{controlTitle}}",
  "implementationStatus": "Implemented|Partially Implemented|Planned|Alternative Implementation|Not Applicable",
  "implementationNarrative": "Detailed description of how the control is implemented",
  "implementationDetails": {
    "technologies": ["List of technologies used"],
    "processes": ["Key processes and procedures"],
    "responsibilities": ["Roles and responsibilities"],
    "configurations": ["Specific system configurations"]
  },
  "evidenceArtifacts": [
    {
      "type": "Policy|Procedure|Configuration|Log|Assessment",
      "description": "Description of evidence",
      "location": "File path or document reference"
    }
  ],
  "complianceAssessment": {
    "satisfactionLevel": "Fully Satisfied|Mostly Satisfied|Partially Satisfied|Not Satisfied",
    "strengths": ["Control implementation strengths"],
    "weaknesses": ["Areas for improvement"],
    "recommendations": ["Specific improvement recommendations"]
  },
  "stigMappings": [
    {
      "stigId": "STIG rule ID",
      "relationship": "Directly implements|Supports|Related to",
      "status": "Compliant|Non-compliant|Not Applicable"
    }
  ],
  "lastAssessment": "{{assessmentDate}}",
  "nextReview": "Next scheduled review date"
}`,

  outputFormat: 'json',
  requiredVariables: [
    'controlId', 'controlTitle', 'controlFamily', 'controlDescription',
    'systemName', 'systemType', 'implementationEvidence'
  ],

  exampleOutput: `{
  "controlId": "AC-2",
  "controlTitle": "Account Management",
  "implementationStatus": "Implemented",
  "implementationNarrative": "The system implements comprehensive account management through centralized Active Directory integration with automated provisioning workflows. User accounts are created through a formal request process with manager approval, assigned appropriate group memberships based on role requirements, and regularly reviewed for continued need. Account lifecycle management includes automated deprovisioning upon employment termination and periodic access reviews.",
  "implementationDetails": {
    "technologies": ["Microsoft Active Directory", "SIEM logging", "Automated provisioning system"],
    "processes": ["HR onboarding workflow", "Quarterly access reviews", "Automated deprovisioning"],
    "responsibilities": ["IT Security: Account creation and monitoring", "HR: Employment status updates", "Managers: Access approval and reviews"],
    "configurations": ["Password policy enforcement", "Account lockout settings", "Audit logging enabled"]
  },
  "evidenceArtifacts": [
    {
      "type": "Policy",
      "description": "Account Management Policy v2.1",
      "location": "SEC-POL-001_Account_Management.pdf"
    },
    {
      "type": "Configuration",
      "description": "Active Directory security settings",
      "location": "/docs/AD_Security_Configuration.docx"
    }
  ],
  "complianceAssessment": {
    "satisfactionLevel": "Fully Satisfied",
    "strengths": ["Automated workflows reduce human error", "Comprehensive audit logging", "Regular access reviews"],
    "weaknesses": ["Manual emergency access process needs documentation"],
    "recommendations": ["Document emergency access procedures", "Implement privileged access management solution"]
  },
  "stigMappings": [
    {
      "stigId": "WN22-AC-000020",
      "relationship": "Directly implements",
      "status": "Compliant"
    }
  ],
  "lastAssessment": "2024-09-12",
  "nextReview": "2024-12-12"
}`
};

export const SAR_EXECUTIVE_SUMMARY_TEMPLATE: PromptTemplate = {
  name: 'sar_executive_summary',
  description: 'Generate executive summary section for Security Assessment Reports',
  systemPrompt: `${BASE_SYSTEM_PROMPTS.compliance}

You are generating an executive summary for a Security Assessment Report (SAR). This summary will be read by senior leadership and decision-makers who need a clear, concise overview of the system's security posture and compliance status.

The executive summary must:
- Provide a high-level overview of assessment results
- Highlight key security strengths and risk areas
- Present findings in business terms that executives can understand
- Include clear recommendations and risk prioritization
- Be concise but comprehensive (1-2 pages)`,

  userPromptTemplate: `Generate an executive summary for the Security Assessment Report:

**System Information:**
- System Name: {{systemName}}
- System Description: {{systemDescription}}
- Mission/Business Purpose: {{businessPurpose}}
- Data Classification: {{dataClassification}}
- User Base: {{userBase}}
- Assessment Period: {{assessmentPeriod}}

**Assessment Scope:**
- Controls Assessed: {{totalControlsAssessed}}
- STIG Rules Evaluated: {{totalStigRules}}
- Assessment Methodology: {{assessmentMethodology}}

**Key Findings Summary:**
{{#controlSummary}}
- {{family}}: {{implemented}}/{{total}} controls implemented
{{/controlSummary}}

**Risk Assessment Results:**
- High Risk Issues: {{highRiskCount}}
- Medium Risk Issues: {{mediumRiskCount}}
- Low Risk Issues: {{lowRiskCount}}

**Major Strengths:**
{{#strengths}}
- {{description}}
{{/strengths}}

**Key Concerns:**
{{#concerns}}
- {{description}}
- Risk Level: {{riskLevel}}
- Business Impact: {{businessImpact}}
{{/concerns}}

**Previous Assessment Comparison:**
{{previousAssessmentComparison}}

Generate a comprehensive executive summary in this format:

{
  "executiveSummary": {
    "overallAssessment": "High-level assessment conclusion",
    "systemOverview": "Brief system description and business purpose",
    "assessmentScope": "What was assessed and methodology used",
    "keyFindings": {
      "securityPosture": "Overall security posture rating",
      "complianceStatus": "Compliance framework adherence status",
      "riskSummary": "Risk profile and key areas of concern"
    },
    "majorStrengths": ["List of significant security strengths"],
    "criticalGaps": [
      {
        "area": "Security area with gap",
        "riskLevel": "High|Medium|Low",
        "businessImpact": "Potential business impact",
        "priority": "Immediate|Near-term|Long-term"
      }
    ],
    "recommendations": {
      "immediate": ["Actions requiring immediate attention"],
      "nearTerm": ["Actions for next 3-6 months"],
      "longTerm": ["Strategic improvements for 6+ months"]
    },
    "resourceRequirements": "Estimated resources needed for remediation",
    "timeline": "Recommended remediation timeline",
    "atoRecommendation": "Recommendation for ATO decision",
    "executiveSignoff": "Summary conclusion for leadership"
  }
}`,

  outputFormat: 'json',
  requiredVariables: [
    'systemName', 'systemDescription', 'businessPurpose', 'assessmentPeriod',
    'totalControlsAssessed', 'controlSummary', 'highRiskCount', 'mediumRiskCount'
  ]
};
