// NLP Analysis Service
// Analyzes document content using natural language processing

import { modelRouter } from '../llm/model-router';
import { ExtractedContent, DocumentSection } from './document-extraction.service';
import { Control } from "../schema";
import NLPFallbackAnalyzer from './nlp-analysis-fallback';

export interface NLPAnalysisResult {
  summary: string;
  keyTopics: string[];
  securityControls: string[];
  implementationDetails: {
    technologies: string[];
    processes: string[];
    policies: string[];
    procedures: string[];
    tools: string[];
    responsibleParties: string[];
  };
  complianceRelevance: {
    controlId: string;
    relevanceScore: number;
    relevantSections: string[];
    implementationEvidence: string[];
  }[];
  confidence: number;
}

export interface ControlRelevance {
  controlId: string;
  controlTitle: string;
  relevanceScore: number;
  relevantSections: DocumentSection[];
  implementationEvidence: string[];
  gaps: string[];
  recommendations: string[];
}

export class NLPAnalysisService {
  /**
   * Analyze document content for compliance and security information
   */
  async analyzeDocument(
    content: ExtractedContent,
    controls: Control[],
    systemContext?: any
  ): Promise<NLPAnalysisResult> {
    console.log(`Analyzing document with ${content.metadata.wordCount} words`);

    // Step 1: Generate document summary
    const summary = await this.generateDocumentSummary(content);

    // Step 2: Extract key topics and security controls
    const keyTopics = await this.extractKeyTopics(content);
    const securityControls = await this.extractSecurityControls(content, controls);

    // Step 3: Extract implementation details
    const implementationDetails = await this.extractImplementationDetails(content);

    // Step 4: Analyze compliance relevance for each control
    const complianceRelevance = await this.analyzeComplianceRelevance(
      content,
      controls,
      systemContext
    );

    // Step 5: Calculate overall confidence
    const confidence = this.calculateConfidence(content, complianceRelevance);

    return {
      summary,
      keyTopics,
      securityControls,
      implementationDetails,
      complianceRelevance,
      confidence
    };
  }

  /**
   * Generate a summary of the document
   */
  private async generateDocumentSummary(content: ExtractedContent): Promise<string> {
    const prompt = `Analyze the following document and provide a concise summary focusing on security, compliance, and implementation details:

Document Content:
${content.text.substring(0, 4000)} // Limit to avoid token limits

Provide a 2-3 sentence summary that captures:
1. The main purpose and scope of the document
2. Key security and compliance information
3. Implementation details or procedures mentioned

Summary:`;

    try {
      const response = await modelRouter.generateText([
        { role: 'user', content: prompt }
      ], {
        maxTokens: 200,
        temperature: 0.3
      });

      return response.content.trim();
    } catch (error) {
      console.error('Error generating document summary:', error);
      console.log('Falling back to basic summary generation');
      // Use fallback method when LLM is unavailable
      return NLPFallbackAnalyzer.generateBasicSummary(content);
    }
  }

  /**
   * Extract key topics from the document
   */
  private async extractKeyTopics(content: ExtractedContent): Promise<string[]> {
    const prompt = `Extract the key topics and themes from this document, focusing on security, compliance, and implementation:

Document Content:
${content.text.substring(0, 3000)}

Return a JSON array of key topics (maximum 10 topics). Each topic should be a short phrase (2-4 words) that captures a main theme.

Example: ["Access Control", "Data Encryption", "Incident Response", "Security Monitoring"]

Key Topics:`;

    try {
      const response = await modelRouter.generateText([
        { role: 'user', content: prompt }
      ], {
        maxTokens: 300,
        temperature: 0.2
      });

      // Try to parse JSON response
      const jsonMatch = response.content.match(/\[.*\]/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: extract topics from text
      return this.extractTopicsFromText(response.content);
    } catch (error) {
      console.error('Error extracting key topics:', error);
      console.log('Falling back to keyword extraction');
      // Use fallback method when LLM is unavailable
      const keywords = NLPFallbackAnalyzer.extractSecurityKeywords(content.text);
      return keywords.slice(0, 10);
    }
  }

  /**
   * Extract security controls mentioned in the document
   */
  private async extractSecurityControls(
    content: ExtractedContent,
    controls: Control[]
  ): Promise<string[]> {
    // Use fallback analyzer to find control references
    return NLPFallbackAnalyzer.findControlReferences(content.text, controls);
  }

  /**
   * Extract implementation details from the document
   */
  private async extractImplementationDetails(content: ExtractedContent): Promise<any> {
    const prompt = `Extract implementation details from this document and return as JSON:

Document Content:
${content.text.substring(0, 3000)}

Extract and categorize the following information:
- technologies: List of technologies, tools, platforms mentioned
- processes: List of processes, procedures, workflows mentioned
- policies: List of policies, standards, guidelines mentioned
- procedures: List of specific procedures, steps, protocols
- tools: List of security tools, monitoring systems, software
- responsibleParties: List of roles, teams, departments responsible

Return JSON format:
{
  "technologies": ["AWS", "Docker", "Kubernetes"],
  "processes": ["vulnerability scanning", "incident response"],
  "policies": ["password policy", "data classification"],
  "procedures": ["access review process", "backup procedures"],
  "tools": ["Splunk", "CrowdStrike", "Nessus"],
  "responsibleParties": ["IT Security Team", "System Administrators"]
}`;

    try {
      const response = await modelRouter.generateText([
        { role: 'user', content: prompt }
      ], {
        maxTokens: 500,
        temperature: 0.2
      });

      // Try to parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: extract using regex patterns
      return NLPFallbackAnalyzer.extractImplementationDetails(content.text);
    } catch (error) {
      console.error('Error extracting implementation details:', error);
      console.log('Falling back to pattern-based extraction');
      // Use fallback method when LLM is unavailable
      return NLPFallbackAnalyzer.extractImplementationDetails(content.text);
    }
  }

  /**
   * Analyze compliance relevance for each control
   */
  private async analyzeComplianceRelevance(
    content: ExtractedContent,
    controls: Control[],
    systemContext?: any
  ): Promise<any[]> {
    const relevanceResults = [];

    // Analyze first 10 controls to avoid token limits
    const controlsToAnalyze = controls.slice(0, 10);

    for (const control of controlsToAnalyze) {
      try {
        const relevance = await this.analyzeControlRelevance(content, control, systemContext);
        relevanceResults.push(relevance);
      } catch (error) {
        console.error(`Error analyzing relevance for control ${control.id}:`, error);
        relevanceResults.push({
          controlId: control.id,
          relevanceScore: 0,
          relevantSections: [],
          implementationEvidence: []
        });
      }
    }

    return relevanceResults;
  }

  /**
   * Analyze relevance of a specific control
   */
  private async analyzeControlRelevance(
    content: ExtractedContent,
    control: Control,
    systemContext?: any
  ): Promise<any> {
    const prompt = `Analyze how relevant this document is to NIST control ${control.id} - ${control.title}:

Control Description:
${control.description}

Document Content:
${content.text.substring(0, 2000)}

System Context:
${systemContext ? JSON.stringify(systemContext, null, 2) : 'Not provided'}

Analyze and return JSON with:
- relevanceScore: 0-100 (how relevant is this document to the control)
- relevantSections: Array of section titles that are most relevant
- implementationEvidence: Array of specific evidence found in the document
- gaps: Array of gaps or missing information
- recommendations: Array of recommendations for improvement

Return JSON format:
{
  "relevanceScore": 85,
  "relevantSections": ["Access Control Policy", "User Management Procedures"],
  "implementationEvidence": ["Multi-factor authentication implemented", "Regular access reviews conducted"],
  "gaps": ["No mention of privileged access management"],
  "recommendations": ["Implement privileged access management", "Document access review procedures"]
}`;

    try {
      const response = await modelRouter.generateText([
        { role: 'user', content: prompt }
      ], {
        maxTokens: 400,
        temperature: 0.3
      });

      // Try to parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: basic relevance scoring
      return this.calculateBasicRelevance(content, control);
    } catch (error) {
      console.error(`Error analyzing control relevance for ${control.id}:`, error);
      console.log('Falling back to pattern-based relevance analysis');
      // Use fallback method when LLM is unavailable
      return this.calculateBasicRelevance(content, control);
    }
  }

  /**
   * Calculate basic relevance score using keyword matching
   */
  private calculateBasicRelevance(content: ExtractedContent, control: Control): any {
    // Use fallback analyzer for relevance calculation
    const relevanceScore = NLPFallbackAnalyzer.calculateRelevanceScore(content.text, control);
    const relevantSentences = NLPFallbackAnalyzer.extractRelevantSentences(content.text, control, 3);
    
    const relevantSections: string[] = [];
    
    // Check sections for relevance
    content.metadata.sections?.forEach(section => {
      const sectionScore = NLPFallbackAnalyzer.calculateRelevanceScore(section.content, control);
      if (sectionScore > 20) {
        relevantSections.push(section.title);
      }
    });

    return {
      controlId: control.id,
      relevanceScore,
      relevantSections,
      implementationEvidence: relevantSentences,
      gaps: [],
      recommendations: []
    };
  }

  /**
   * Extract topics from text response
   */
  private extractTopicsFromText(text: string): string[] {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    return lines.slice(0, 10).map(line => line.trim().replace(/^[-•*]\s*/, ''));
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(content: ExtractedContent, complianceRelevance: any[]): number {
    const avgRelevance = complianceRelevance.reduce((sum, r) => sum + r.relevanceScore, 0) / complianceRelevance.length;
    const wordCountScore = Math.min(content.metadata.wordCount / 1000, 1) * 20; // Max 20 points for word count
    const sectionScore = Math.min((content.metadata.sections?.length || 0) * 5, 20); // Max 20 points for sections
    
    return Math.min(avgRelevance * 0.6 + wordCountScore + sectionScore, 100);
  }
}

// Export singleton instance
export const nlpAnalysisService = new NLPAnalysisService();

