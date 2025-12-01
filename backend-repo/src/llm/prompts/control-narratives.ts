// Control Narrative Generation Templates
// Creates detailed NIST 800-53 control implementation descriptions

import { PromptTemplate, BASE_SYSTEM_PROMPTS } from './base-templates';

export const CONTROL_IMPLEMENTATION_TEMPLATE: PromptTemplate = {
  name: 'control_implementation',
  description: 'Generate detailed NIST 800-53 control implementation narratives with technical specifics',
  systemPrompt: `${BASE_SYSTEM_PROMPTS.technical}

You are generating detailed NIST 800-53 control implementation narratives that demonstrate how security controls are implemented in real systems. These narratives must be technically accurate, specific, and provide clear evidence of control effectiveness.

Each narrative should address:
1. **Implementation Approach**: How the control is technically implemented
2. **Technical Components**: Specific systems, tools, and configurations
3. **Operational Procedures**: Day-to-day operational processes
4. **Monitoring and Measurement**: How control effectiveness is measured
5. **Evidence and Artifacts**: Specific documentation and proof points

Be technical and specific. Reference actual system components, configurations, procedures, and monitoring mechanisms. Avoid generic or high-level statements.`,

  userPromptTemplate: `Generate a detailed control implementation narrative for:

**Control Details:**
- Control Identifier: {{controlId}}
- Control Title: {{controlTitle}}
- Control Family: {{controlFamily}}
- Control Text: {{controlText}}
- Supplemental Guidance: {{supplementalGuidance}}
- Control Enhancements: {{controlEnhancements}}

**System Architecture:**
- System Name: {{systemName}}
- System Tier: {{systemTier}}
- Technology Stack: {{technologyStack}}
- Network Architecture: {{networkArchitecture}}
- Data Flow: {{dataFlow}}

**Implementation Components:**
{{#implementationComponents}}
- Component: {{componentName}}
- Type: {{componentType}}
- Function: {{componentFunction}}
- Configuration: {{configuration}}
- Monitoring: {{monitoringMethod}}
{{/implementationComponents}}

**Operational Procedures:**
{{#procedures}}
- Procedure: {{procedureName}}
- Frequency: {{frequency}}
- Responsible Party: {{responsibleParty}}
- Documentation: {{documentation}}
{{/procedures}}

**Technical Configurations:**
{{#configurations}}
- System: {{systemName}}
- Setting: {{settingName}}
- Value: {{settingValue}}
- Justification: {{justification}}
{{/configurations}}

**Monitoring and Metrics:**
{{#monitoringDetails}}
- Metric: {{metricName}}
- Collection Method: {{collectionMethod}}
- Frequency: {{frequency}}
- Thresholds: {{thresholds}}
- Reporting: {{reporting}}
{{/monitoringDetails}}

**Integration Points:**
{{#integrations}}
- System A: {{systemA}}
- System B: {{systemB}}
- Integration Type: {{integrationType}}
- Security Mechanism: {{securityMechanism}}
{{/integrations}}

Generate a comprehensive implementation narrative:

{
  "controlId": "{{controlId}}",
  "implementationNarrative": {
    "overview": "High-level implementation approach",
    "technicalImplementation": {
      "primaryMechanisms": ["Core technical implementations"],
      "supportingSystems": ["Supporting systems and tools"],
      "configurations": ["Key security configurations"],
      "integrationPoints": ["How systems work together"]
    },
    "operationalImplementation": {
      "procedures": ["Key operational procedures"],
      "roles": ["Roles and responsibilities"],
      "workflows": ["Operational workflows"],
      "maintenance": ["Ongoing maintenance activities"]
    },
    "monitoringAndMeasurement": {
      "metrics": ["Key performance indicators"],
      "monitoring": ["Monitoring mechanisms"],
      "reporting": ["Reporting procedures"],
      "analysis": ["Analysis and review processes"]
    },
    "evidenceAndDocumentation": {
      "policies": ["Relevant policies"],
      "procedures": ["Documented procedures"], 
      "configurations": ["Configuration documentation"],
      "assessments": ["Assessment reports"],
      "logs": ["Log sources and analysis"]
    }
  },
  "implementationStatus": "Implemented|Partially Implemented|Planned|Not Applicable",
  "effectivenessAssessment": {
    "strengths": ["Implementation strengths"],
    "gaps": ["Identified gaps or weaknesses"],
    "riskMitigation": ["How risks are mitigated"],
    "improvements": ["Recommended improvements"]
  },
  "complianceMapping": {
    "stigRequirements": ["Related STIG requirements"],
    "otherFrameworks": ["Other compliance frameworks"],
    "assessmentResults": ["Recent assessment outcomes"]
  },
  "maintenanceRequirements": {
    "periodicReviews": ["Required periodic reviews"],
    "updates": ["Update and patching requirements"],
    "testing": ["Required testing procedures"],
    "training": ["Training requirements"]
  }
}`,

  outputFormat: 'json',
  requiredVariables: [
    'controlId', 'controlTitle', 'controlFamily', 'controlText',
    'systemName', 'implementationComponents'
  ],

  exampleOutput: `{
  "controlId": "SC-7",
  "implementationNarrative": {
    "overview": "Boundary protection is implemented through a layered defense architecture utilizing next-generation firewalls, network segmentation, and application-level gateways to control communications at organizational system boundaries.",
    "technicalImplementation": {
      "primaryMechanisms": [
        "Palo Alto Networks PA-5220 firewalls with threat prevention subscriptions",
        "Cisco ASA 5516-X for VPN termination and additional perimeter security",
        "F5 BIG-IP Application Delivery Controllers for application-layer filtering"
      ],
      "supportingSystems": [
        "Splunk SIEM for security event correlation and analysis",
        "Nessus vulnerability scanner for boundary device assessment",
        "SolarWinds NPM for network traffic monitoring and baseline establishment"
      ],
      "configurations": [
        "Default-deny firewall rules with explicit allow statements for authorized traffic",
        "DMZ network segmentation separating public-facing services from internal networks",
        "Application-layer inspection and threat prevention enabled on all external interfaces"
      ],
      "integrationPoints": [
        "Firewall logs forwarded to Splunk SIEM for real-time monitoring",
        "Identity management integration for user-based firewall policies",
        "Network access control integration for device identification and policy enforcement"
      ]
    },
    "operationalImplementation": {
      "procedures": [
        "Monthly firewall rule reviews and cleanup procedures",
        "Quarterly penetration testing of boundary protections",
        "Annual boundary protection architecture assessment"
      ],
      "roles": [
        "Network Security Engineer: Daily monitoring and rule management",
        "Security Architect: Boundary protection design and policy development",
        "SOC Analyst: 24/7 monitoring and incident response"
      ],
      "workflows": [
        "Firewall change management process with approval workflow",
        "Incident response procedures for boundary protection alerts",
        "Capacity planning and performance monitoring workflows"
      ],
      "maintenance": [
        "Weekly signature updates for threat prevention systems",
        "Monthly firmware updates following security advisories",
        "Quarterly configuration backup and disaster recovery testing"
      ]
    },
    "monitoringAndMeasurement": {
      "metrics": [
        "Blocked connection attempts per day",
        "Firewall rule utilization and effectiveness",
        "Network latency and throughput performance",
        "Threat detection and prevention rates"
      ],
      "monitoring": [
        "Real-time dashboard showing firewall status and traffic flows",
        "Automated alerting for policy violations and security events",
        "Continuous vulnerability scanning of boundary devices"
      ],
      "reporting": [
        "Weekly boundary protection status reports",
        "Monthly security metrics and trend analysis",
        "Quarterly boundary protection effectiveness assessment"
      ],
      "analysis": [
        "Traffic pattern analysis for anomaly detection",
        "Firewall log analysis for attack trend identification",
        "Performance analysis for capacity planning"
      ]
    },
    "evidenceAndDocumentation": {
      "policies": [
        "Network Security Policy v3.2",
        "Firewall Management Standard v2.1"
      ],
      "procedures": [
        "Firewall Configuration Management Procedure",
        "Network Boundary Monitoring Procedure"
      ],
      "configurations": [
        "Firewall configuration files with security settings",
        "Network topology diagrams showing boundary protections"
      ],
      "assessments": [
        "Annual penetration test results",
        "Quarterly vulnerability assessment reports"
      ],
      "logs": [
        "Firewall access logs and connection summaries",
        "SIEM correlation rules and alert histories"
      ]
    }
  },
  "implementationStatus": "Implemented",
  "effectivenessAssessment": {
    "strengths": [
      "Multi-layered defense provides comprehensive boundary protection",
      "Real-time monitoring and alerting enables rapid threat response",
      "Regular testing validates control effectiveness"
    ],
    "gaps": [
      "Limited application-layer inspection for encrypted traffic",
      "Manual firewall rule review process could be automated"
    ],
    "riskMitigation": [
      "Redundant firewall configurations prevent single points of failure",
      "Continuous monitoring detects and responds to threats quickly"
    ],
    "improvements": [
      "Implement SSL/TLS inspection capabilities",
      "Automate firewall rule optimization and cleanup"
    ]
  },
  "complianceMapping": {
    "stigRequirements": [
      "Network Device Security STIG",
      "Firewall Security Requirements Guide"
    ],
    "otherFrameworks": [
      "NIST Cybersecurity Framework PR.AC",
      "ISO 27001 A.13.1.1"
    ],
    "assessmentResults": [
      "Recent penetration test: No boundary bypasses identified",
      "Vulnerability scan: All boundary devices patched and secure"
    ]
  },
  "maintenanceRequirements": {
    "periodicReviews": [
      "Monthly firewall rule review and optimization",
      "Quarterly boundary protection architecture review"
    ],
    "updates": [
      "Weekly threat prevention signature updates",
      "Monthly security patches for boundary devices"
    ],
    "testing": [
      "Annual penetration testing of all boundary protections",
      "Quarterly disaster recovery testing"
    ],
    "training": [
      "Annual firewall management training for network engineers",
      "Semi-annual security awareness for all IT staff"
    ]
  }
}`
};
