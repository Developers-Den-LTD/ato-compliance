// Mock LLM Provider for Testing Without API Keys
import { LLMProvider, LLMMessage, LLMResponse, LLMGenerationOptions } from '../types';

export class MockAdapter implements LLMProvider {
  public readonly name = 'mock';
  
  async isAvailable(): Promise<boolean> {
    return true; // Always available for testing
  }

  async generateText(messages: LLMMessage[], options: LLMGenerationOptions = {}): Promise<LLMResponse> {
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    
    // Check if this is a chat assistant with tools (indicated by system message mentioning tools)
    const hasChatTools = systemMessage.includes('Available tools:') && systemMessage.includes('TOOL:');
    
    // If previous message is a tool result, format it nicely
    if (userMessage.startsWith('Tool result:')) {
      const toolData = userMessage.replace('Tool result:', '').replace('Please format this nicely for the user.', '').trim();
      try {
        const data = JSON.parse(toolData);
        
        // Format system details
        if (data.system) {
          const sys = data.system;
          return {
            content: `The system **${sys.name}** has the following details:

**STIG Profiles**: ${sys.stigProfiles && sys.stigProfiles.length > 0 ? sys.stigProfiles.join(', ') : 'None configured'}
**Operating System**: ${sys.operatingSystem || 'Not specified'}
**Compliance Status**: ${sys.complianceStatus || 'Unknown'}
**System Type**: ${sys.systemType || 'Not specified'}
**Impact Level**: ${sys.impactLevel || 'Not specified'}
**Total Assessments**: ${sys.assessmentCount || 0}

${sys.description ? `**Description**: ${sys.description}` : ''}`,
            model: 'mock-model-v1',
            provider: this.name,
            usage: { inputTokens: 50, outputTokens: 150, totalTokens: 200 }
          };
        }
        
        // Format search results
        if (data.systems) {
          let response = `Found ${data.count} system(s):\n\n`;
          data.systems.forEach((s: any) => {
            response += `**${s.name}**\n`;
            response += `- Status: ${s.status}\n`;
            response += `- Type: ${s.system_type}\n\n`;
          });
          return {
            content: response,
            model: 'mock-model-v1',
            provider: this.name,
            usage: { inputTokens: 30, outputTokens: 100, totalTokens: 130 }
          };
        }
      } catch (e) {
        // Not JSON, just return a generic formatted response
      }
    }
    
    // Intelligent tool selection for chat assistant
    if (hasChatTools) {
      const lowerMsg = userMessage.toLowerCase();
      
      // Questions about specific systems
      if ((lowerMsg.includes('what') || lowerMsg.includes('which')) && 
          (lowerMsg.includes('stig') || lowerMsg.includes('profile')) &&
          (lowerMsg.includes('system') || lowerMsg.includes('using'))) {
        // Extract system name (simple heuristic - get capitalized word)
        const words = userMessage.split(' ');
        const systemName = words.find(w => /^[A-Z][A-Z]+$/.test(w)) || 'ACCESS';
        
        return {
          content: `TOOL: get_system_details\nARGS: {"system_name":"${systemName}"}`,
          model: 'mock-model-v1',
          provider: this.name,
          usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 }
        };
      }
      
      // Questions about systems needing assessment
      if (lowerMsg.includes('system') && lowerMsg.includes('need') && lowerMsg.includes('assessment')) {
        return {
          content: `TOOL: search_systems\nARGS: {"status":"pending"}`,
          model: 'mock-model-v1',
          provider: this.name,
          usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 }
        };
      }
      
      // Control searches
      if (lowerMsg.includes('control') && (lowerMsg.includes('search') || lowerMsg.includes('find') || lowerMsg.includes('encryption'))) {
        return {
          content: `TOOL: search_controls\nARGS: {"query":"encryption","limit":10}`,
          model: 'mock-model-v1',
          provider: this.name,
          usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 }
        };
      }
      
      // General questions - provide direct answers
      return {
        content: `I can help you with ATO compliance questions. You can ask me about systems, controls, assessments, or artifacts in the database.`,
        model: 'mock-model-v1',
        provider: this.name,
        usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 }
      };
    }
    
    // Generate mock SSP content
    if (userMessage.toLowerCase().includes('system security plan') || userMessage.toLowerCase().includes('ssp')) {
      return {
        content: this.generateMockSSP(userMessage),
        model: 'mock-model-v1',
        provider: this.name,
        usage: {
          inputTokens: 100,
          outputTokens: 500,
          totalTokens: 600
        }
      };
    }

    // Generate mock POA&M content
    if (userMessage.toLowerCase().includes('poam')) {
      return {
        content: this.generateMockPoam(),
        model: 'mock-model-v1',
        provider: this.name,
        usage: {
          inputTokens: 50,
          outputTokens: 200,
          totalTokens: 250
        }
      };
    }

    // Default response
    return {
      content: `Mock response for: ${userMessage.substring(0, 100)}...`,
      model: 'mock-model-v1',
      provider: this.name,
      usage: {
        inputTokens: 10,
        outputTokens: 50,
        totalTokens: 60
      }
    };
  }

  async generateJSON<T = any>(messages: LLMMessage[], options: LLMGenerationOptions = {}): Promise<T> {
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    // Generate mock STIG checklist
    if (userMessage.toLowerCase().includes('stig') && userMessage.toLowerCase().includes('checklist')) {
      return this.generateMockStigChecklist() as T;
    }

    // Generate mock POA&M item
    if (userMessage.toLowerCase().includes('poam')) {
      return {
        weakness: "Security control not fully implemented",
        riskStatement: "This poses a moderate risk to system security",
        description: "Mock finding description",
        remediation: "Implement the required security control",
        mitigation: "Apply compensating controls in the interim"
      } as T;
    }

    // Default JSON response
    return {
      status: 'success',
      message: 'Mock JSON response',
      data: {}
    } as T;
  }

  private generateMockSSP(prompt: string): string {
    // Extract system name from prompt if possible
    const systemNameMatch = prompt.match(/Name:\s*([^\n]+)/);
    const systemName = systemNameMatch ? systemNameMatch[1] : 'Test System';

    return `# System Security Plan (SSP)
## ${systemName}

### 1. EXECUTIVE SUMMARY

This System Security Plan (SSP) provides a comprehensive overview of the security requirements for ${systemName} and describes the controls in place or planned for implementation to provide adequate security.

### 2. SYSTEM OVERVIEW AND ARCHITECTURE

${systemName} is designed to provide secure processing and storage of sensitive information. The system employs a multi-tier architecture with the following components:

- **Presentation Layer**: Web-based user interface with secure authentication
- **Application Layer**: Business logic processing with role-based access control
- **Data Layer**: Encrypted database storage with audit logging

### 3. SECURITY CONTROLS IMPLEMENTATION

The system implements security controls based on NIST SP 800-53 Rev 5:

#### Access Control (AC)
- AC-2: Account Management - Fully implemented with automated provisioning
- AC-3: Access Enforcement - Role-based access control implemented
- AC-7: Unsuccessful Login Attempts - Account lockout after 3 failed attempts

#### Audit and Accountability (AU)
- AU-2: Audit Events - All security-relevant events logged
- AU-3: Content of Audit Records - Comprehensive audit trail maintained
- AU-4: Audit Storage Capacity - 90-day online retention, 7-year archive

#### System and Communications Protection (SC)
- SC-8: Transmission Confidentiality - TLS 1.3 for all communications
- SC-13: Cryptographic Protection - AES-256 encryption at rest
- SC-28: Protection of Information at Rest - Full disk encryption

### 4. RISK ASSESSMENT AND FINDINGS

Current risk posture: MODERATE

Key risks identified:
1. Legacy component integration (MEDIUM) - Mitigation in progress
2. Supply chain dependencies (LOW) - Vendor assessments completed
3. Insider threat potential (LOW) - Monitoring controls implemented

### 5. EVIDENCE AND DOCUMENTATION

Supporting evidence includes:
- Network architecture diagrams
- Security control test results
- Vulnerability scan reports
- Penetration test findings

### 6. COMPLIANCE STATUS

The system maintains compliance with:
- NIST 800-53 Rev 5 (Moderate baseline)
- Organizational security policies
- Applicable regulatory requirements

### 7. RECOMMENDATIONS

1. Complete migration from legacy components by Q2 2024
2. Implement enhanced monitoring for privileged accounts
3. Conduct quarterly security control assessments
4. Update incident response procedures

### APPROVAL

This SSP has been reviewed and approved for implementation.

Generated: ${new Date().toISOString()}
Classification: For Official Use Only`;
  }

  private generateMockPoam(): string {
    return `# Plan of Action and Milestones (POA&M)

## Executive Summary

This POA&M identifies and documents security weaknesses found during the assessment of the system and delineates tasks to mitigate those weaknesses.

## Open Items

### 1. Legacy Authentication Module
- **Severity**: High
- **Weakness**: Outdated authentication mechanism
- **Planned Completion**: 90 days
- **Resources Required**: Development team, 160 hours

### 2. Incomplete Audit Logging
- **Severity**: Medium  
- **Weakness**: Some user actions not logged
- **Planned Completion**: 60 days
- **Resources Required**: Configuration update, 40 hours

### 3. Missing Security Headers
- **Severity**: Low
- **Weakness**: HTTP security headers not configured
- **Planned Completion**: 30 days
- **Resources Required**: Web server configuration, 8 hours

## Milestones

- Month 1: Complete low severity items
- Month 2: Address medium severity items
- Month 3: Resolve high severity items
- Month 4: Validation and closeout

Generated: ${new Date().toISOString()}`;
  }

  private generateMockStigChecklist(): any {
    return {
      checklistMetadata: {
        systemName: "Test System",
        assessmentDate: new Date().toISOString().split('T')[0],
        totalRules: 3,
        summaryStats: {
          open: 1,
          notAFinding: 2,
          notApplicable: 0
        }
      },
      findings: [
        {
          vulnerabilityId: "V-12345",
          stigId: "TEST-001",
          title: "Ensure secure authentication",
          severity: "medium",
          status: "NotAFinding",
          findingDetails: "System uses multi-factor authentication",
          comments: "Compliant with security requirements",
          evidence: ["MFA configuration verified"],
          nisControlMappings: ["IA-2"],
          recommendedAction: "Continue monitoring"
        },
        {
          vulnerabilityId: "V-12346",
          stigId: "TEST-002",
          title: "Implement audit logging",
          severity: "high",
          status: "Open",
          findingDetails: "Partial audit logging implemented",
          comments: "Additional logging required",
          evidence: ["Current log configuration"],
          nisControlMappings: ["AU-2", "AU-3"],
          recommendedAction: "Enable comprehensive audit logging"
        }
      ],
      riskSummary: "System has moderate security posture with 1 open finding",
      recommendations: ["Address open findings", "Maintain security controls"]
    };
  }
}
