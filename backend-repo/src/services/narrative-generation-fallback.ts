// Fallback Narrative Generation Functions
// Provides template-based narrative generation when LLM is unavailable

import { 
  Control, 
  System, 
  Evidence, 
  Artifact, 
  SystemControl 
} from "../schema";

export class NarrativeFallbackGenerator {
  /**
   * Generate a basic narrative using templates when LLM is unavailable
   */
  static generateFallbackNarrative(
    system: System,
    control: Control,
    evidence: Evidence[],
    artifacts: Artifact[],
    implementationDetails: any
  ): string {
    let narrative = '';
    
    // Start with system implementation statement
    narrative += `${system.name} implements ${control.id} - ${control.title} through the following measures:\n\n`;
    
    // Add control context
    if (control.description) {
      narrative += `Control Requirement: ${control.description}\n\n`;
    }
    
    // Describe implementation based on evidence
    if (evidence.length > 0) {
      narrative += 'Implementation Evidence:\n';
      evidence.forEach((e, index) => {
        narrative += `${index + 1}. ${this.describeEvidence(e)}\n`;
      });
      narrative += '\n';
    }
    
    // Add technology and process details
    if (implementationDetails.technologies.length > 0) {
      narrative += `Technologies Used: The system leverages ${implementationDetails.technologies.join(', ')} `;
      narrative += `to support ${control.family} requirements.\n\n`;
    }
    
    if (implementationDetails.processes.length > 0) {
      narrative += `Processes: The following processes are implemented: ${implementationDetails.processes.join(', ')}.\n\n`;
    }
    
    if (implementationDetails.policies.length > 0) {
      narrative += `Related Policies: Implementation is governed by: ${implementationDetails.policies.join(', ')}.\n\n`;
    }
    
    // Add implementation status
    narrative += this.generateImplementationSummary(system, control, evidence);
    
    return narrative;
  }

  /**
   * Describe evidence in narrative form
   */
  private static describeEvidence(evidence: Evidence): string {
    let description = `${evidence.type} evidence`;
    
    if (evidence.description) {
      description += `: ${evidence.description}`;
    }
    
    switch (evidence.status) {
      case 'satisfies':
        description += ' (Fully satisfies control requirements)';
        break;
      case 'partially_satisfies':
        description += ' (Partially satisfies control requirements)';
        break;
      case 'does_not_satisfy':
        description += ' (Does not satisfy control requirements - gap identified)';
        break;
    }
    
    return description;
  }

  /**
   * Generate implementation summary
   */
  private static generateImplementationSummary(
    system: System,
    control: Control,
    evidence: Evidence[]
  ): string {
    const satisfyingEvidence = evidence.filter(e => 
      e.status === 'satisfies' || e.status === 'partially_satisfies'
    );
    
    if (satisfyingEvidence.length === evidence.length && evidence.length > 0) {
      return `Overall Assessment: ${system.name} fully implements ${control.id} based on the documented evidence. ` +
             `The implementation aligns with the ${system.impactLevel} impact level requirements.`;
    } else if (satisfyingEvidence.length > 0) {
      return `Overall Assessment: ${system.name} partially implements ${control.id}. ` +
             `${satisfyingEvidence.length} of ${evidence.length} evidence items demonstrate compliance, ` +
             `but additional implementation or documentation may be required for full compliance.`;
    } else if (evidence.length === 0) {
      return `Overall Assessment: No evidence has been provided for ${control.id} implementation. ` +
             `Documentation and evidence collection is required to assess compliance status.`;
    } else {
      return `Overall Assessment: Current evidence indicates ${system.name} does not fully implement ${control.id}. ` +
             `Remediation actions are required to meet the control requirements.`;
    }
  }

  /**
   * Generate control-specific narrative templates
   */
  static getControlTemplate(control: Control, system: System): string {
    const templates: Record<string, string> = {
      'AC': `${system.name} implements access control through defined policies and technical mechanisms. `,
      'AU': `${system.name} maintains audit logging and accountability through comprehensive monitoring. `,
      'CM': `${system.name} manages configuration through documented baselines and change control processes. `,
      'IA': `${system.name} implements identification and authentication controls to verify user identity. `,
      'SC': `${system.name} protects system and communications through security controls and encryption. `,
      'SI': `${system.name} maintains system and information integrity through monitoring and protection mechanisms. `
    };
    
    const family = control.family?.substring(0, 2) || control.id.substring(0, 2);
    return templates[family] || `${system.name} implements ${control.title} through defined controls and processes. `;
  }

  /**
   * Extract key implementation points from text
   */
  static extractImplementationPoints(text: string): string[] {
    const points: string[] = [];
    
    // Look for implementation indicators
    const implementationPatterns = [
      /(?:implements?|employs?|uses?|utilizes?|leverages?)\s+([^.]+)/gi,
      /(?:configured to|designed to|set up to)\s+([^.]+)/gi,
      /(?:ensures?|provides?|maintains?|supports?)\s+([^.]+)/gi
    ];
    
    for (const pattern of implementationPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length < 200) {
          points.push(match[1].trim());
        }
      }
    }
    
    return points.slice(0, 5); // Limit to 5 key points
  }
}

export default NarrativeFallbackGenerator;
