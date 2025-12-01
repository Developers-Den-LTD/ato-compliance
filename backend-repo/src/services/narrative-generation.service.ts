// Context-Aware Narrative Generation Service
// Generates control narratives based on uploaded evidence and system context

import { storage } from '../storage';
import { modelRouter } from '../llm/model-router';
import { semanticSearchEngine } from './semantic-search';
import { readFile } from 'fs/promises';
import {
  Control,
  System,
  Evidence,
  Artifact,
  Finding,
  SystemControl
} from "../schema";
import NarrativeFallbackGenerator from './narrative-generation-fallback';

interface NarrativeContext {
  system: System;
  control: Control;
  systemControl?: SystemControl;
  evidence: Evidence[];
  artifacts: Artifact[];
  findings: Finding[];
  documentContent?: string[];
  implementationDetails?: any;
  customPrompt?: string;
  includeGuidance?: boolean;
}

interface GeneratedNarrative {
  controlId: string;
  narrative: string;
  confidence: number;
  sources: string[];
  extractedDetails: any;
  status?: string;
  version?: number;
  generatedAt: Date;
  generationMethod: 'ai' | 'template' | 'hybrid';
  suggestedImprovements?: string[];
}

export class NarrativeGenerationService {
  /**
   * Generate context-aware narrative for a control
   */
  async generateContextAwareNarrative(context: NarrativeContext): Promise<GeneratedNarrative> {
    console.log(`Generating context-aware narrative for control ${context.control.id}`);
    
    // Extract implementation details from evidence
    const implementationDetails = await this.extractImplementationDetails(context);
    
    // Build enhanced prompt with context
    const prompt = this.buildContextAwarePrompt(context, implementationDetails);
    
    let narrative: string;
    let generationMethod: 'ai' | 'template' | 'hybrid' = 'ai';
    
    try {
      // Generate narrative using LLM
      const response = await modelRouter.generateText([
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt }
      ], {
        maxTokens: 2000,
        temperature: 0.3 // Lower temperature for more consistent narratives
      });
      
      // Parse and validate narrative
      narrative = this.cleanNarrative(response.content);
      
      // If narrative is too generic, enhance with template
      if (this.isGenericNarrative(narrative)) {
        const templateNarrative = NarrativeFallbackGenerator.generateFallbackNarrative(
          context.system,
          context.control,
          context.evidence,
          context.artifacts,
          implementationDetails
        );
        narrative = this.mergeNarratives(narrative, templateNarrative);
        generationMethod = 'hybrid';
      }
    } catch (error) {
      console.error('Error generating narrative with LLM:', error);
      // Fall back to template generation
      console.log('Falling back to template-based narrative generation');
      // Use fallback method when LLM is unavailable
      narrative = NarrativeFallbackGenerator.generateFallbackNarrative(
        context.system,
        context.control,
        context.evidence,
        context.artifacts,
        implementationDetails
      );
      generationMethod = 'template';
    }
    
    // Calculate confidence based on evidence
    const confidence = this.calculateConfidence(context);
    
    // Identify sources used
    const sources = this.identifySources(context);
    
    // Generate improvement suggestions
    const suggestedImprovements = this.generateImprovementSuggestions(context, confidence);
    
    // Get version number
    const version = context.systemControl?.lastUpdated ? 2 : 1; // Simple versioning
    
    return {
      controlId: context.control.id,
      narrative,
      confidence,
      sources,
      extractedDetails: implementationDetails,
      status: confidence > 70 ? 'implemented' : confidence > 40 ? 'in_progress' : 'planned',
      version,
      generatedAt: new Date(),
      generationMethod,
      suggestedImprovements
    };
  }
  
  /**
   * Use semantic search to find relevant document chunks for a control
   */
  private async findRelevantChunks(controlId: string, systemId: string): Promise<Array<{content: string, source: string, similarity: number}>> {
    try {
      console.log(`[Narrative] Finding relevant chunks for control ${controlId} using semantic search`);

      const searchResults = await semanticSearchEngine.findRelevantChunks(
        controlId,
        systemId,
        {
          limit: 10, // Get top 10 most relevant chunks
          minSimilarity: 0.6, // Only chunks with >60% similarity
          rerank: true // Use reranking for better results
        }
      );

      console.log(`[Narrative] Found ${searchResults.length} relevant chunks for control ${controlId}`);

      return searchResults.map(result => ({
        content: result.content,
        source: result.documentName,
        similarity: result.similarity
      }));
    } catch (error) {
      console.warn(`[Narrative] Semantic search failed for control ${controlId}:`, error);
      return [];
    }
  }

  /**
   * Extract implementation details from evidence and artifacts
   * Now enhanced with semantic search for better context
   */
  private async extractImplementationDetails(context: NarrativeContext): Promise<any> {
    const details = {
      technologies: [] as string[],
      processes: [] as string[],
      tools: [] as string[],
      policies: [] as string[],
      procedures: [] as string[],
      responsibleParties: [] as string[],
      frequencies: [] as string[],
      locations: [] as string[],
      semanticChunks: [] as Array<{content: string, source: string, similarity: number}>
    };

    // Use semantic search to find relevant document chunks
    console.log(`[Narrative] Using semantic search for control ${context.control.id}`);
    const relevantChunks = await this.findRelevantChunks(context.control.id, context.system.id);

    if (relevantChunks.length > 0) {
      details.semanticChunks = relevantChunks;
      console.log(`[Narrative] Found ${relevantChunks.length} relevant chunks via semantic search`);
    } else {
      console.log(`[Narrative] No semantic chunks found, falling back to full artifact processing`);
    }

    // Extract text from artifacts (fallback or supplemental to semantic search)
    const documentContents: string[] = [];

    // If we have semantic chunks, use them instead of processing all artifacts
    if (relevantChunks.length > 0) {
      documentContents.push(...relevantChunks.map(chunk => chunk.content));
    } else {
      // Fallback: process artifacts directly
      for (const artifact of context.artifacts.slice(0, 5)) { // Limit to 5 most relevant docs
        if (artifact.metadata && (artifact.metadata as any).extractedText) {
          const text = (artifact.metadata as any).extractedText;
          documentContents.push(text);
        } else if (artifact.filePath) {
          // Try to extract text from file if not already in metadata
          try {
            console.log(`Extracting content from artifact ${artifact.id}: ${artifact.name} (${artifact.mimeType})`);

            // Use DocumentExtractionService to handle all supported file types
            const { documentExtractionService } = await import('./document-extraction.service');
            const extractedContent = await documentExtractionService.extractContent(artifact);

            if (!extractedContent || !extractedContent.text) {
              console.log(`No text content extracted from ${artifact.name}`);
              continue;
            }

            if (extractedContent && extractedContent.text) {
              documentContents.push(extractedContent.text);
              // Update artifact metadata with extracted text for future use
              await storage.updateArtifact(artifact.id, {
                metadata: {
                  ...artifact.metadata,
                  extractedText: extractedContent.text,
                  extractedAt: new Date().toISOString()
                }
              });
            }
          } catch (error) {
            console.warn(`Failed to extract text from artifact ${artifact.id}:`, error);
            // Continue processing other artifacts even if one fails
          }
        }
      }
    }
    
    // Store document content in context
    if (documentContents.length > 0) {
      (context as any).documentContent = documentContents;
    }
    
    // Extract implementation details from all document contents
    const allText = documentContents.join('\n\n');
    if (allText) {
      details.technologies.push(...this.extractTechnologies(allText));
      details.processes.push(...this.extractProcesses(allText));
      details.tools.push(...this.extractTools(allText));
      details.policies.push(...this.extractPolicies(allText));
      details.procedures.push(...this.extractProcedures(allText));
      details.responsibleParties.push(...this.extractResponsibleParties(allText));
    }
    
    // Extract from evidence descriptions
    for (const evidence of context.evidence) {
      if (evidence.description) {
        details.technologies.push(...this.extractTechnologies(evidence.description));
        details.processes.push(...this.extractProcesses(evidence.description));
      }
    }
    
    // Remove duplicates and clean up
    Object.keys(details).forEach(key => {
      details[key] = [...new Set(details[key])].filter(item => item && item.length > 2);
    });
    
    return details;
  }
  
  /**
   * Build context-aware prompt for narrative generation
   */
  private buildContextAwarePrompt(
    context: NarrativeContext, 
    implementationDetails: any
  ): string {
    const { system, control } = context;
    
    let prompt = `Generate a detailed implementation narrative for the following NIST control in the context of a specific system.

### System Context
System Name: ${system.name}
System Type: ${system.category}
Impact Level: ${system.impactLevel}
System Description: ${system.description || 'No description provided'}

### Control Information
Control ID: ${control.id}
Control Title: ${control.title}
Control Family: ${control.family}
Control Objective: ${control.description}
`;

    // Add baseline information if available
    if (control.baseline && control.baseline.length > 0) {
      prompt += `Control Baselines: ${control.baseline.join(', ')}\n`;
    }
    
    // Add supplemental guidance if requested
    if (context.includeGuidance && control.supplementalGuidance) {
      prompt += `\nSupplemental Guidance: ${control.supplementalGuidance}\n`;
    }

    prompt += `\n### Implementation Context\n`;

    // Add semantic search results with source references
    if (implementationDetails.semanticChunks && implementationDetails.semanticChunks.length > 0) {
      prompt += `\n### Relevant Documentation (Semantic Search Results)\n`;
      prompt += `The following relevant excerpts were identified using semantic search:\n`;
      implementationDetails.semanticChunks.forEach((chunk: any, index: number) => {
        const preview = chunk.content.substring(0, 400).replace(/\n+/g, ' ');
        prompt += `\n[Source: ${chunk.source}] (Relevance: ${Math.round(chunk.similarity * 100)}%)\n`;
        prompt += `"${preview}..."\n`;
      });
      prompt += `\nUse these specific excerpts to create an evidence-based implementation narrative.\n`;
    }
    // Fallback: Add document content context if semantic search didn't yield results
    else if ((context as any).documentContent && (context as any).documentContent.length > 0) {
      prompt += `\n### Relevant Documentation\n`;
      prompt += `The following documentation has been provided for this system:\n`;
      (context as any).documentContent.forEach((content: string, index: number) => {
        const preview = content.substring(0, 500).replace(/\n+/g, ' ');
        prompt += `\nDocument ${index + 1} excerpt: "${preview}..."\n`;
      });
      prompt += `\nUse the information from these documents to create a specific implementation narrative.\n`;
    }
    
    // Add evidence if available
    if (context.evidence.length > 0) {
      prompt += `\n### Available Evidence\n`;
      context.evidence.forEach(e => {
        prompt += `- ${e.type}: ${e.description || 'No description'}\n`;
      });
    }
    
    // Add extracted implementation details
    if (implementationDetails.technologies.length > 0) {
      prompt += `\nDetected Technologies: ${implementationDetails.technologies.join(', ')}`;
    }
    if (implementationDetails.tools.length > 0) {
      prompt += `\nDetected Tools: ${implementationDetails.tools.join(', ')}`;
    }
    if (implementationDetails.processes.length > 0) {
      prompt += `\nDetected Processes: ${implementationDetails.processes.join(', ')}`;
    }
    if (implementationDetails.policies.length > 0) {
      prompt += `\nRelated Policies: ${implementationDetails.policies.join(', ')}`;
    }
    if (implementationDetails.procedures.length > 0) {
      prompt += `\nRelated Procedures: ${implementationDetails.procedures.join(', ')}`;
    }
    
    // Add custom prompt if provided
    if (context.customPrompt) {
      prompt += `\n### User Instructions\n${context.customPrompt}\n`;
    }
    
    // Add specific instructions
    prompt += `\n\nBased on the evidence and system context above, generate a comprehensive implementation narrative that:
1. Describes HOW the control is implemented in this specific system
2. References specific technologies, tools, and processes found in the evidence
3. Identifies the responsible parties and implementation frequency
4. Explains the implementation in context of the system's architecture and purpose
5. Uses active voice and present tense
6. Is specific to ${system.name} and not generic
7. Follows NIST SP 800-53 implementation guidance standards
8. Includes specific configuration details and procedures where available
9. References relevant policies and documentation
10. Describes monitoring and maintenance activities

IMPORTANT: 
- The narrative should be based on the actual evidence provided
- If evidence is limited, note what additional information would strengthen the implementation
- Ensure the narrative is audit-ready and defensible
- Include specific examples and avoid vague statements`;
    
    return prompt;
  }
  
  /**
   * Get system prompt for narrative generation
   */
  private getSystemPrompt(): string {
    return `You are an expert security control assessor helping to document NIST 800-53 control implementations. 
Your narratives should be:
- Specific and detailed, avoiding generic statements
- Based on actual evidence and documentation
- Written in active voice and present tense
- Audit-ready and defensible
- Compliant with federal security standards
- Clear about what is implemented vs planned
\nFocus on HOW controls are implemented, not just that they are implemented.`;
  }
  
  /**
   * Check if narrative is too generic
   */
  private isGenericNarrative(narrative: string): boolean {
    const genericPhrases = [
      'the organization implements',
      'standard procedures',
      'appropriate measures',
      'security best practices',
      'as required',
      'when necessary'
    ];
    
    const lowercaseNarrative = narrative.toLowerCase();
    const genericCount = genericPhrases.filter(phrase => 
      lowercaseNarrative.includes(phrase)
    ).length;
    
    return genericCount >= 3;
  }
  
  /**
   * Merge AI and template narratives
   */
  private mergeNarratives(aiNarrative: string, templateNarrative: string): string {
    // Extract specific details from template
    const templateDetails = templateNarrative.match(/(?:uses|implements|employs|configured)\s+[^.]+/gi) || [];
    
    // Append specific details to AI narrative if not already present
    let merged = aiNarrative;
    templateDetails.forEach(detail => {
      if (!merged.toLowerCase().includes(detail.toLowerCase().substring(0, 20))) {
        merged += `\n\n${detail}.`;
      }
    });
    
    return merged;
  }
  
  /**
   * Generate improvement suggestions
   */
  private generateImprovementSuggestions(context: NarrativeContext, confidence: number): string[] {
    const suggestions: string[] = [];
    
    if (context.evidence.length === 0) {
      suggestions.push('Upload evidence documents to support the implementation narrative');
    }
    
    if (context.artifacts.length === 0) {
      suggestions.push('Add system documentation, architecture diagrams, or configuration files');
    }
    
    if (!context.implementationDetails?.responsibleParties?.length) {
      suggestions.push('Identify and document responsible parties for this control');
    }
    
    if (!context.implementationDetails?.frequencies?.length) {
      suggestions.push('Specify implementation and review frequencies');
    }
    
    if (confidence < 50) {
      suggestions.push('Additional evidence needed to strengthen compliance posture');
    }
    
    const hasTestEvidence = context.evidence.some(e => 
      e.type === 'test_results' || e.description?.toLowerCase().includes('test')
    );
    if (!hasTestEvidence) {
      suggestions.push('Add testing evidence to demonstrate control effectiveness');
    }
    
    return suggestions;
  }
  
  /**
   * Clean and format the generated narrative
   */
  private cleanNarrative(narrative: string): string {
    // Remove any system prompts or metadata that might leak through
    narrative = narrative.replace(/^(Assistant:|AI:|System:)/gmi, '');
    
    // Ensure proper formatting
    narrative = narrative.trim();
    
    // Ensure it starts with the system name for context
    if (!narrative.toLowerCase().includes('implements') && !narrative.toLowerCase().includes('employs')) {
      narrative = `The system implements this control through the following measures:\n\n${narrative}`;
    }
    
    return narrative;
  }
  
  /**
   * Calculate confidence score based on available evidence
   */
  private calculateConfidence(context: NarrativeContext): number {
    let score = 0;
    const weights = {
      hasEvidence: 0.3,
      evidenceQuality: 0.3,
      hasArtifacts: 0.2,
      hasFindings: 0.1,
      hasImplementationStatus: 0.1
    };
    
    // Check if we have evidence
    if (context.evidence.length > 0) {
      score += weights.hasEvidence;
      
      // Check evidence quality
      const satisfyingEvidence = context.evidence.filter(e => 
        e.status === 'satisfies' || e.status === 'partially_satisfies'
      );
      score += weights.evidenceQuality * (satisfyingEvidence.length / context.evidence.length);
    }
    
    // Check if we have supporting artifacts
    if (context.artifacts.length > 0) {
      score += weights.hasArtifacts;
    }
    
    // Check if we have findings (inverse - fewer findings = higher confidence)
    // Note: findings don't have controlId directly, they're linked via STIG rules
    const relevantFindings = context.findings.filter(f => 
      (f.status === 'open' || f.severity === 'high' || f.severity === 'critical')
    );
    if (relevantFindings.length === 0) {
      score += weights.hasFindings;
    }
    
    // Check if we have implementation status
    if (context.systemControl && context.systemControl.status === 'implemented') {
      score += weights.hasImplementationStatus;
    }
    
    return Math.round(score * 100);
  }
  
  /**
   * Identify sources used for the narrative
   */
  private identifySources(context: NarrativeContext): string[] {
    const sources: string[] = [];

    // Add semantic search sources if available
    if (context.implementationDetails?.semanticChunks) {
      context.implementationDetails.semanticChunks.forEach((chunk: any) => {
        sources.push(`Document (Semantic): ${chunk.source} (${Math.round(chunk.similarity * 100)}% relevance)`);
      });
    }

    // Add evidence sources
    context.evidence.forEach(e => {
      sources.push(`Evidence: ${e.type} - ${e.description || 'No description'}`);
    });

    // Add artifact sources (only if semantic search wasn't used)
    if (!context.implementationDetails?.semanticChunks?.length) {
      context.artifacts.forEach(a => {
        sources.push(`Artifact: ${a.name} (${a.type})`);
      });
    }

    return sources;
  }
  
  /**
   * Generate narratives for all controls in a system with progress callback
   */
  async generateSystemNarrativesWithProgress(
    systemId: string,
    onProgress?: (current: number, total: number, controlId?: string) => void
  ): Promise<GeneratedNarrative[]> {
    console.log(`Generating narratives for all controls in system ${systemId}`);
    
    // Get system and its controls
    const system = await storage.getSystem(systemId);
    if (!system) {
      throw new Error(`System ${systemId} not found`);
    }
    
    const systemControls = await storage.getSystemControls(systemId);
    const narratives: GeneratedNarrative[] = [];
    
    // Get all evidence and artifacts for the system
    const allEvidence = await storage.getEvidenceBySystem(systemId);
    const allArtifacts = await storage.getArtifactsBySystem(systemId);
    const allFindings = await storage.getFindingsBySystem(systemId);
    
    let processedCount = 0;
    const totalCount = systemControls.length;
    
    // Generate narrative for each control
    for (const sc of systemControls) {
      const control = await storage.getControl(sc.controlId);
      if (!control) continue;
      
      // Report progress
      if (onProgress) {
        onProgress(processedCount, totalCount, control.id);
      }
      
      // Filter evidence and artifacts relevant to this control
      const controlEvidence = allEvidence.filter(e => e.controlId === control.id);
      // Include ALL artifacts for now - let the extraction process determine relevance
      const controlArtifacts = allArtifacts;
      
      const context: NarrativeContext = {
        system,
        control,
        systemControl: sc,
        evidence: controlEvidence,
        artifacts: controlArtifacts,
        findings: allFindings
      };
      
      try {
        const narrative = await this.generateContextAwareNarrative(context);
        narratives.push(narrative);
        
        // Save the narrative to the system control
        await storage.updateSystemControl(systemId, control.id, {
          implementationText: narrative.narrative,
          lastUpdated: new Date(),
          // Update status to implemented if narrative was generated successfully
          status: narrative.confidence > 50 ? 'implemented' : 'in_progress'
        });
        
        // Update the narrative object with the new status
        narrative.status = narrative.confidence > 50 ? 'implemented' : 'in_progress';
      } catch (error) {
        console.error(`Failed to generate narrative for control ${control.id}:`, error);
      }
      
      processedCount++;
      
      // Report progress after processing
      if (onProgress) {
        onProgress(processedCount, totalCount, control.id);
      }
    }
    
    return narratives;
  }
  
  /**
   * Generate narratives for all controls in a system
   */
  async generateSystemNarratives(systemId: string): Promise<GeneratedNarrative[]> {
    // Call the progress version without a callback for backward compatibility
    return this.generateSystemNarrativesWithProgress(systemId);
  }
  
  /**
   * Regenerate narrative for a specific control with updated evidence
   */
  async regenerateControlNarrative(
    systemId: string, 
    controlId: string
  ): Promise<GeneratedNarrative> {
    const system = await storage.getSystem(systemId);
    const control = await storage.getControl(controlId);
    
    if (!system || !control) {
      throw new Error('System or control not found');
    }
    
    const systemControl = await storage.getSystemControl(systemId, controlId);
    const evidence = await storage.getEvidenceByControl(controlId);
    const artifacts = await storage.getArtifactsBySystem(systemId);
    const findings = await storage.getFindingsBySystem(systemId);
    
    const context: NarrativeContext = {
      system,
      control,
      systemControl,
      evidence,
      // Include all artifacts - let extraction determine relevance
      artifacts,
      findings
    };
    
    const narrative = await this.generateContextAwareNarrative(context);
    
    // Update the system control implementation text
    await storage.updateSystemControl(systemId, controlId, {
      implementationText: narrative.narrative,
      lastUpdated: new Date(),
      // Update status to implemented if narrative was generated successfully
      status: narrative.confidence > 50 ? 'implemented' : 'in_progress'
    });
    
    // Update the narrative object with the new status
    narrative.status = narrative.confidence > 50 ? 'implemented' : 'in_progress';
    
    return narrative;
  }
  
  /**
   * Extract technologies mentioned in text
   */
  private extractTechnologies(text: string): string[] {
    const techPatterns = [
      /\b(AWS|Azure|GCP|Google Cloud|VMware|vSphere|Hyper-V|Docker|Kubernetes|OpenShift)\b/gi,
      /\b(Linux|Windows|Ubuntu|RHEL|CentOS|Windows Server \d+)\b/gi,
      /\b(PostgreSQL|MySQL|MongoDB|Oracle|SQL Server|Redis|Elasticsearch)\b/gi,
      /\b(nginx|Apache|IIS|Tomcat|Node\.js|Python|Java|\.NET)\b/gi,
      /\b(TLS|SSL|HTTPS|SSH|VPN|IPSec|OAuth|SAML|LDAP|Active Directory)\b/gi
    ];
    
    return this.extractMatches(text, techPatterns);
  }
  
  /**
   * Extract processes mentioned in text
   */
  private extractProcesses(text: string): string[] {
    const processPatterns = [
      /\b(\w+(?:\s+\w+)?)\s+process\b/gi,
      /process\s+(?:for|of)\s+(\w+(?:\s+\w+)?)/gi,
      /\b(backup|restore|monitoring|logging|auditing|scanning|patching|deployment)\s+(?:process|procedure)/gi,
      /\b(change management|incident response|disaster recovery|business continuity)\b/gi
    ];
    
    return this.extractMatches(text, processPatterns);
  }
  
  /**
   * Extract tools mentioned in text
   */
  private extractTools(text: string): string[] {
    const toolPatterns = [
      /using\s+(\w+(?:\s+\w+)?)\s+(?:tool|software|application|platform)/gi,
      /\b(Jenkins|GitLab|GitHub|Docker|Kubernetes|Ansible|Terraform|AWS|Azure|GCP|Splunk|ELK|Datadog|JIRA|ServiceNow|SharePoint)\b/gi,
      /\b(\w+)\s+(?:dashboard|console|portal|interface)\b/gi
    ];
    
    return this.extractMatches(text, toolPatterns);
  }
  
  /**
   * Extract policies mentioned in text
   */
  private extractPolicies(text: string): string[] {
    const policyPatterns = [
      /\b(\w+(?:\s+\w+)?)\s+[Pp]olicy\b/gi,
      /[Pp]olicy\s+(?:for|on|regarding)\s+(\w+(?:\s+\w+)?)/gi,
      /\b(Security|Access|Password|Backup|Incident|Change|Configuration)\s+[Pp]olicy\b/gi
    ];
    
    return this.extractMatches(text, policyPatterns);
  }
  
  /**
   * Extract procedures mentioned in text
   */
  private extractProcedures(text: string): string[] {
    const procedurePatterns = [
      /\b(\w+(?:\s+\w+)?)\s+[Pp]rocedure\b/gi,
      /[Pp]rocedure\s+(?:for|on|regarding)\s+(\w+(?:\s+\w+)?)/gi,
      /\b(Backup|Recovery|Incident Response|Change Management|Access Control)\s+[Pp]rocedure\b/gi,
      /SOP\s+(?:for|on|regarding)\s+(\w+(?:\s+\w+)?)/gi
    ];
    
    return this.extractMatches(text, procedurePatterns);
  }
  
  /**
   * Extract responsible parties from text
   */
  private extractResponsibleParties(text: string): string[] {
    const partyPatterns = [
      /\b(\w+(?:\s+\w+)?)\s+(?:is|are)\s+responsible\s+for/gi,
      /responsible\s+(?:party|parties|team|department|group):\s*(\w+(?:\s+\w+)?)/gi,
      /\b(System Administrator|Security Team|IT Department|Operations Team|DevOps Team|Development Team)\b/gi,
      /\b(ISSO|ISSM|AO|CIO|CISO)\b/g
    ];
    
    return this.extractMatches(text, partyPatterns);
  }
  
  /**
   * Extract unique matches from text using patterns
   */
  private extractMatches(text: string, patterns: RegExp[]): string[] {
    const matches = new Set<string>();
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        // Get the first capture group or the whole match
        const extracted = match[1] || match[0];
        if (extracted && extracted.length > 2) {
          matches.add(extracted.trim());
        }
      }
    }
    
    return Array.from(matches);
  }
}

// Export singleton instance
export const narrativeGenerationService = new NarrativeGenerationService();
