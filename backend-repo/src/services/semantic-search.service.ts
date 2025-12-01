// Semantic Search Service
// Finds relevant document sections for specific controls using semantic similarity

import { modelRouter } from '../llm/model-router';
import { DocumentSection, ExtractedContent } from './document-extraction.service';
import { Control } from "../schema";
import { NLPAnalysisResult } from './nlp-analysis.service';

export interface SemanticSearchResult {
  controlId: string;
  controlTitle: string;
  relevantSections: {
    section: DocumentSection;
    relevanceScore: number;
    semanticMatch: string;
    implementationEvidence: string[];
  }[];
  overallRelevance: number;
  implementationSummary: string;
  gaps: string[];
  recommendations: string[];
}

export interface SearchQuery {
  controlId: string;
  controlTitle: string;
  controlDescription: string;
  controlRequirements?: string;
  systemContext?: any;
}

export class SemanticSearchService {
  /**
   * Find relevant document sections for a specific control
   */
  async findRelevantSections(
    content: ExtractedContent,
    query: SearchQuery,
    nlpAnalysis?: NLPAnalysisResult
  ): Promise<SemanticSearchResult> {
    console.log(`Finding relevant sections for control ${query.controlId}`);

    // Step 1: Generate semantic search query
    const searchQuery = await this.generateSearchQuery(query);

    // Step 2: Find relevant sections using semantic similarity
    const relevantSections = await this.findSemanticMatches(
      content.metadata.sections || [],
      searchQuery,
      query
    );

    // Step 3: Analyze implementation evidence
    const implementationEvidence = await this.extractImplementationEvidence(
      relevantSections,
      query
    );

    // Step 4: Generate implementation summary
    const implementationSummary = await this.generateImplementationSummary(
      relevantSections,
      query,
      implementationEvidence
    );

    // Step 5: Identify gaps and recommendations
    const { gaps, recommendations } = await this.identifyGapsAndRecommendations(
      relevantSections,
      query,
      implementationEvidence
    );

    // Step 6: Calculate overall relevance
    const overallRelevance = this.calculateOverallRelevance(relevantSections);

    return {
      controlId: query.controlId,
      controlTitle: query.controlTitle,
      relevantSections,
      overallRelevance,
      implementationSummary,
      gaps,
      recommendations
    };
  }

  /**
   * Generate a semantic search query for the control
   */
  private async generateSearchQuery(query: SearchQuery): Promise<string> {
    const prompt = `Generate a semantic search query to find relevant sections in documents that would contain implementation details for NIST control ${query.controlId} - ${query.controlTitle}.

Control Description: ${query.controlDescription}
Control Requirements: ${query.controlRequirements || 'Not specified'}

Generate 5-10 key phrases or concepts that would likely appear in documents that implement this control. Focus on:
1. Implementation-specific terms
2. Technical details
3. Process descriptions
4. Policy references
5. Tool and technology mentions

Return as a JSON array of search terms:
["access control implementation", "user authentication procedures", "multi-factor authentication", "privileged access management", "access review process"]`;

    try {
      const response = await modelRouter.generateText([
        { role: 'user', content: prompt }
      ], {
        maxTokens: 300,
        temperature: 0.3
      });

      // Try to parse JSON response
      const jsonMatch = response.content.match(/\[.*\]/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]).join(' ');
      }

      // Fallback: use control title and description
      return `${query.controlTitle} ${query.controlDescription}`;
    } catch (error) {
      console.error('Error generating search query:', error);
      return `${query.controlTitle} ${query.controlDescription}`;
    }
  }

  /**
   * Find semantic matches between sections and search query
   */
  private async findSemanticMatches(
    sections: DocumentSection[],
    searchQuery: string,
    query: SearchQuery
  ): Promise<{
    section: DocumentSection;
    relevanceScore: number;
    semanticMatch: string;
    implementationEvidence: string[];
  }[]> {
    const results = [];

    for (const section of sections) {
      try {
        const relevance = await this.calculateSemanticRelevance(
          section,
          searchQuery,
          query
        );

        if (relevance.score > 30) { // Only include sections with reasonable relevance
          results.push({
            section,
            relevanceScore: relevance.score,
            semanticMatch: relevance.match,
            implementationEvidence: relevance.evidence
          });
        }
      } catch (error) {
        console.error(`Error calculating relevance for section "${section.title}":`, error);
      }
    }

    // Sort by relevance score (highest first)
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate semantic relevance between a section and search query
   */
  private async calculateSemanticRelevance(
    section: DocumentSection,
    searchQuery: string,
    query: SearchQuery
  ): Promise<{
    score: number;
    match: string;
    evidence: string[];
  }> {
    const prompt = `Analyze the semantic relevance between this document section and the search query for NIST control ${query.controlId}:

Search Query: ${searchQuery}

Document Section:
Title: ${section.title}
Content: ${section.content.substring(0, 1000)}

Control Context:
Title: ${query.controlTitle}
Description: ${query.controlDescription}

Analyze and return JSON with:
- score: 0-100 (semantic relevance score)
- match: Brief explanation of why this section is relevant
- evidence: Array of specific evidence found in this section

Return JSON format:
{
  "score": 75,
  "match": "This section describes access control procedures which directly relates to the control requirements",
  "evidence": ["Multi-factor authentication is implemented", "Regular access reviews are conducted"]
}`;

    try {
      const response = await modelRouter.generateText([
        { role: 'user', content: prompt }
      ], {
        maxTokens: 300,
        temperature: 0.2
      });

      // Try to parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: basic keyword matching
      return this.calculateBasicRelevance(section, searchQuery, query);
    } catch (error) {
      console.error('Error calculating semantic relevance:', error);
      return this.calculateBasicRelevance(section, searchQuery, query);
    }
  }

  /**
   * Calculate basic relevance using keyword matching
   */
  private calculateBasicRelevance(
    section: DocumentSection,
    searchQuery: string,
    query: SearchQuery
  ): {
    score: number;
    match: string;
    evidence: string[];
  } {
    const sectionText = `${section.title} ${section.content}`.toLowerCase();
    const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    
    let score = 0;
    const evidence: string[] = [];

    // Check for keyword matches
    queryWords.forEach(word => {
      if (sectionText.includes(word)) {
        score += 10;
      }
    });

    // Check for control-specific terms
    const controlTerms = [
      query.controlTitle.toLowerCase(),
      ...query.controlDescription.toLowerCase().split(/\s+/).filter(word => word.length > 3)
    ];

    controlTerms.forEach(term => {
      if (sectionText.includes(term)) {
        score += 15;
        evidence.push(`Mentions "${term}"`);
      }
    });

    // Cap score at 100
    score = Math.min(score, 100);

    return {
      score,
      match: score > 50 ? 'Relevant content found' : 'Limited relevance',
      evidence
    };
  }

  /**
   * Extract implementation evidence from relevant sections
   */
  private async extractImplementationEvidence(
    relevantSections: any[],
    query: SearchQuery
  ): Promise<string[]> {
    const evidence: string[] = [];

    for (const result of relevantSections) {
      if (result.implementationEvidence && result.implementationEvidence.length > 0) {
        evidence.push(...result.implementationEvidence);
      }
    }

    // Remove duplicates and return
    return [...new Set(evidence)];
  }

  /**
   * Generate implementation summary
   */
  private async generateImplementationSummary(
    relevantSections: any[],
    query: SearchQuery,
    implementationEvidence: string[]
  ): Promise<string> {
    if (relevantSections.length === 0) {
      return 'No relevant implementation details found in the analyzed documents.';
    }

    const prompt = `Generate a concise implementation summary for NIST control ${query.controlId} based on the following evidence:

Control: ${query.controlTitle}
Description: ${query.controlDescription}

Relevant Sections Found: ${relevantSections.length}
Implementation Evidence: ${implementationEvidence.join(', ')}

Generate a 2-3 sentence summary that describes:
1. How this control is implemented based on the evidence
2. Key implementation details or procedures found
3. Overall compliance status

Implementation Summary:`;

    try {
      const response = await modelRouter.generateText([
        { role: 'user', content: prompt }
      ], {
        maxTokens: 200,
        temperature: 0.3
      });

      return response.content.trim();
    } catch (error) {
      console.error('Error generating implementation summary:', error);
      return `Implementation details found in ${relevantSections.length} document sections. Evidence includes: ${implementationEvidence.slice(0, 3).join(', ')}.`;
    }
  }

  /**
   * Identify gaps and recommendations
   */
  private async identifyGapsAndRecommendations(
    relevantSections: any[],
    query: SearchQuery,
    implementationEvidence: string[]
  ): Promise<{
    gaps: string[];
    recommendations: string[];
  }> {
    const prompt = `Analyze the implementation evidence for NIST control ${query.controlId} and identify gaps and recommendations:

Control: ${query.controlTitle}
Description: ${query.controlDescription}

Implementation Evidence Found: ${implementationEvidence.join(', ')}

Based on the control requirements and the evidence found, identify:
1. Gaps: What implementation details are missing or insufficient
2. Recommendations: What should be implemented or improved

Return JSON format:
{
  "gaps": ["No mention of privileged access management", "Missing access review procedures"],
  "recommendations": ["Implement privileged access management", "Document access review procedures", "Establish regular access audits"]
}`;

    try {
      const response = await modelRouter.generateText([
        { role: 'user', content: prompt }
      ], {
        maxTokens: 300,
        temperature: 0.3
      });

      // Try to parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: basic gap analysis
      return this.identifyBasicGaps(query, implementationEvidence);
    } catch (error) {
      console.error('Error identifying gaps and recommendations:', error);
      return this.identifyBasicGaps(query, implementationEvidence);
    }
  }

  /**
   * Identify basic gaps using keyword analysis
   */
  private identifyBasicGaps(query: SearchQuery, evidence: string[]): {
    gaps: string[];
    recommendations: string[];
  } {
    const gaps: string[] = [];
    const recommendations: string[] = [];

    // Basic gap analysis based on common control requirements
    const commonRequirements = [
      'policy', 'procedure', 'documentation', 'training', 'monitoring', 'review', 'audit'
    ];

    const evidenceText = evidence.join(' ').toLowerCase();
    
    commonRequirements.forEach(req => {
      if (!evidenceText.includes(req)) {
        gaps.push(`Missing ${req} documentation`);
        recommendations.push(`Develop and document ${req} procedures`);
      }
    });

    return { gaps, recommendations };
  }

  /**
   * Calculate overall relevance score
   */
  private calculateOverallRelevance(relevantSections: any[]): number {
    if (relevantSections.length === 0) return 0;
    
    const avgScore = relevantSections.reduce((sum, section) => sum + section.relevanceScore, 0) / relevantSections.length;
    const sectionCountBonus = Math.min(relevantSections.length * 5, 20); // Max 20 points for multiple sections
    
    return Math.min(avgScore + sectionCountBonus, 100);
  }
}

// Export singleton instance
export const semanticSearchService = new SemanticSearchService();

