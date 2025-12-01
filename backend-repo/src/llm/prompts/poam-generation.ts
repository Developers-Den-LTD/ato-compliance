// Plan of Action & Milestones (POA&M) Generation Templates
// Creates standardized POA&M entries for compliance gap remediation

import { PromptTemplate, BASE_SYSTEM_PROMPTS } from './base-templates';

export const POAM_ITEM_TEMPLATE: PromptTemplate = {
  name: 'poam_item',
  description: 'Generate Plan of Action & Milestones (POA&M) items for compliance gaps and vulnerabilities',
  systemPrompt: `${BASE_SYSTEM_PROMPTS.technical}

You are generating Plan of Action & Milestones (POA&M) items for federal compliance documentation. POA&M items track remediation of security control gaps, vulnerabilities, and compliance findings.

Each POA&M item must include:
1. **Clear Problem Statement**: Specific description of the security gap or finding
2. **Risk Assessment**: Business and technical impact analysis
3. **Remediation Plan**: Detailed steps to address the issue
4. **Timeline**: Realistic milestones and completion dates
5. **Resource Requirements**: Personnel, tools, and budget needs
6. **Success Criteria**: Measurable outcomes for closure

Use precise technical language and provide actionable remediation guidance. Reference specific controls, configurations, and implementation requirements.`,

  userPromptTemplate: `Generate a POA&M item for the following security finding:

**Finding Information:**
- Finding ID: {{findingId}}
- Source: {{findingSource}} (STIG, Manual Assessment, Automated Scan, etc.)
- Title: {{findingTitle}}
- Description: {{findingDescription}}
- Impact Level: {{impactLevel}}
- Likelihood: {{likelihood}}

**System Context:**
- System Name: {{systemName}}
- System Component: {{systemComponent}}
- Operating System: {{operatingSystem}}
- Application/Service: {{applicationService}}

**Technical Details:**
- Current Configuration: {{currentConfiguration}}
- Required Configuration: {{requiredConfiguration}}
- Gap Analysis: {{gapAnalysis}}

**Related Controls:**
{{#relatedControls}}
- {{controlId}}: {{controlTitle}} ({{status}})
{{/relatedControls}}

**STIG Rule Reference:**
{{#stigReference}}
- Rule ID: {{stigRuleId}}
- Check Text: {{stigCheckText}}
- Fix Text: {{stigFixText}}
{{/stigReference}}

**Business Context:**
- System Criticality: {{systemCriticality}}
- Data Sensitivity: {{dataSensitivity}}
- User Impact: {{userImpact}}
- Operational Dependencies: {{operationalDependencies}}

**Available Resources:**
- Technical Team: {{technicalTeam}}
- Budget Constraints: {{budgetConstraints}}
- Timeline Constraints: {{timelineConstraints}}

Generate a comprehensive POA&M item using this structure:

{
  "poamId": "Unique identifier",
  "findingSource": "Source of the finding",
  "title": "Concise problem statement",
  "description": "Detailed description of the security gap",
  "riskAssessment": {
    "impactLevel": "High|Medium|Low",
    "likelihood": "High|Medium|Low",
    "riskScore": "Calculated risk score",
    "businessImpact": "Description of business impact",
    "technicalImpact": "Description of technical impact"
  },
  "securityControls": [
    {
      "controlId": "NIST control ID",
      "status": "Gap status for this control"
    }
  ],
  "stigReferences": ["Related STIG rule IDs"],
  "currentState": "Current implementation status",
  "targetState": "Desired end state after remediation",
  "remediationPlan": {
    "approach": "High-level remediation strategy",
    "detailedSteps": [
      {
        "step": "Step number",
        "description": "Detailed step description",
        "responsible": "Role responsible for execution",
        "estimatedEffort": "Time estimate",
        "dependencies": ["Other steps or external dependencies"]
      }
    ],
    "acceptanceCriteria": ["Specific criteria for completion"],
    "testingRequirements": ["Testing needed to validate fix"]
  },
  "timeline": {
    "estimatedStartDate": "Planned start date",
    "estimatedCompletionDate": "Target completion date",
    "milestones": [
      {
        "milestone": "Milestone description",
        "targetDate": "Target date",
        "status": "Not Started|In Progress|Completed|Delayed"
      }
    ]
  },
  "resourceRequirements": {
    "personnel": ["Required team members and skills"],
    "tools": ["Required tools or software"],
    "budget": "Estimated budget requirement",
    "externalSupport": ["Vendor or contractor needs"]
  },
  "alternativeActions": "Alternative approaches if primary plan fails",
  "justification": "Business justification for remediation approach",
  "status": "Open|In Progress|Completed|Risk Accepted|Delayed",
  "assignedTo": "Person responsible for execution",
  "lastUpdated": "Last update date",
  "estimatedClosure": "Projected closure date"
}`,

  outputFormat: 'json',
  requiredVariables: [
    'findingId', 'findingSource', 'findingTitle', 'findingDescription',
    'systemName', 'impactLevel', 'relatedControls'
  ],

  exampleOutput: `{
  "poamId": "POAM-2024-001",
  "findingSource": "DISA STIG Assessment",
  "title": "RHEL 8 System Audit Configuration Non-Compliance",
  "description": "The system does not audit all uses of chown, fchown, fchownat, and lchown system calls as required by RHEL-08-030180. Current auditd configuration is missing required audit rules for file ownership change monitoring.",
  "riskAssessment": {
    "impactLevel": "Medium",
    "likelihood": "High", 
    "riskScore": "6.0",
    "businessImpact": "Reduced ability to detect unauthorized file ownership changes, potential compliance violations",
    "technicalImpact": "Insufficient audit trail for file system modifications, reduced forensic capabilities"
  },
  "securityControls": [
    {
      "controlId": "AU-12",
      "status": "Partially Implemented - missing specific syscall auditing"
    }
  ],
  "stigReferences": ["RHEL-08-030180"],
  "currentState": "Auditd service enabled but missing file ownership change audit rules",
  "targetState": "Complete audit coverage of chown family system calls with proper log retention",
  "remediationPlan": {
    "approach": "Add required audit rules to auditd configuration and validate logging functionality",
    "detailedSteps": [
      {
        "step": "1",
        "description": "Add audit rules for chown system calls to /etc/audit/rules.d/audit.rules",
        "responsible": "System Administrator",
        "estimatedEffort": "2 hours",
        "dependencies": ["System maintenance window approval"]
      },
      {
        "step": "2", 
        "description": "Restart auditd service and verify rule loading",
        "responsible": "System Administrator",
        "estimatedEffort": "30 minutes",
        "dependencies": ["Step 1 completion"]
      },
      {
        "step": "3",
        "description": "Test audit logging with file ownership changes",
        "responsible": "Security Analyst",
        "estimatedEffort": "1 hour",
        "dependencies": ["Step 2 completion"]
      }
    ],
    "acceptanceCriteria": [
      "Audit rules successfully loaded in auditd",
      "File ownership changes generate audit log entries",
      "STIG check passes validation"
    ],
    "testingRequirements": ["Functional testing of chown operations", "Log analysis validation"]
  },
  "timeline": {
    "estimatedStartDate": "2024-09-15",
    "estimatedCompletionDate": "2024-09-20",
    "milestones": [
      {
        "milestone": "Audit rules configured",
        "targetDate": "2024-09-16",
        "status": "Not Started"
      },
      {
        "milestone": "Testing completed",
        "targetDate": "2024-09-19",
        "status": "Not Started"
      }
    ]
  },
  "resourceRequirements": {
    "personnel": ["Linux System Administrator (2 hours)", "Security Analyst (1 hour)"],
    "tools": ["System access", "Audit analysis tools"],
    "budget": "No additional budget required",
    "externalSupport": ["None required"]
  },
  "alternativeActions": "If auditd performance impact is unacceptable, implement alternative file integrity monitoring solution",
  "justification": "Required for STIG compliance and security monitoring effectiveness",
  "status": "Open",
  "assignedTo": "John Smith, System Administrator",
  "lastUpdated": "2024-09-12",
  "estimatedClosure": "2024-09-20"
}`
};

export const POAM_SUMMARY_TEMPLATE: PromptTemplate = {
  name: 'poam_summary',
  description: 'Generate POA&M summary dashboard and tracking report',
  systemPrompt: `${BASE_SYSTEM_PROMPTS.compliance}

You are generating a Plan of Action & Milestones (POA&M) summary report for executive oversight and compliance tracking. This report provides a high-level view of remediation progress and risk management status.

Focus on:
- Overall remediation progress and trends
- Risk prioritization and resource allocation
- Timeline adherence and milestone tracking
- Executive-level metrics and insights`,

  userPromptTemplate: `Generate a POA&M summary report for:

**System Information:**
- System Name: {{systemName}}
- Assessment Period: {{assessmentPeriod}}
- Report Date: {{reportDate}}
- System Owner: {{systemOwner}}

**POA&M Items Overview:**
{{#poamItems}}
- {{poamId}}: {{title}} ({{status}}, {{riskLevel}})
{{/poamItems}}

**Risk Distribution:**
- High Risk Items: {{highRiskCount}}
- Medium Risk Items: {{mediumRiskCount}}
- Low Risk Items: {{lowRiskCount}}

**Status Distribution:**
- Open: {{openCount}}
- In Progress: {{inProgressCount}}
- Completed: {{completedCount}}
- Risk Accepted: {{riskAcceptedCount}}

**Timeline Analysis:**
- On Track: {{onTrackCount}}
- At Risk: {{atRiskCount}}
- Overdue: {{overdueCount}}

**Resource Utilization:**
{{resourceSummary}}

Generate a comprehensive POA&M summary:

{
  "summaryMetrics": {
    "totalItems": "Total POA&M items",
    "completionRate": "Percentage completed",
    "averageAge": "Average days open",
    "riskReduction": "Risk score improvement"
  },
  "statusBreakdown": {
    "open": "Number of open items",
    "inProgress": "Number in progress", 
    "completed": "Number completed",
    "riskAccepted": "Number with accepted risk"
  },
  "riskAnalysis": {
    "highRiskItems": "Count and details of high-risk items",
    "mediumRiskItems": "Count and details of medium-risk items",
    "lowRiskItems": "Count and details of low-risk items",
    "trendAnalysis": "Risk trend over time"
  },
  "timelinePerformance": {
    "onSchedule": "Items meeting timeline",
    "atRisk": "Items at risk of delay",
    "overdue": "Items past due date",
    "projectedCompletion": "Estimated completion timeline"
  },
  "topPriorities": [
    {
      "poamId": "High-priority item ID",
      "title": "Brief title",
      "riskLevel": "Risk level",
      "daysOpen": "Days since opened",
      "targetCompletion": "Target date"
    }
  ],
  "resourceNeeds": "Summary of resource requirements",
  "executiveRecommendations": ["Key recommendations for leadership"],
  "nextReviewDate": "Next scheduled review"
}`,

  outputFormat: 'json',
  requiredVariables: [
    'systemName', 'assessmentPeriod', 'poamItems', 'highRiskCount',
    'openCount', 'inProgressCount'
  ]
};
