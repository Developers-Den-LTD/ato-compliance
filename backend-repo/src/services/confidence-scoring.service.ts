import { db } from '../db';
import { mappingCriteria } from '../schema';
import { eq, and } from 'drizzle-orm';

export interface ConfidenceFactors {
  semanticSimilarity: number;
  keywordMatch: number;
  contextRelevance: number;
  documentType: number;
}

export interface ConfidenceWeights {
  semanticSimilarity: number;
  keywordMatch: number;
  contextRelevance: number;
  documentType: number;
}

export class ConfidenceScoringService {
  private defaultWeights: ConfidenceWeights = {
    semanticSimilarity: 0.4,
    keywordMatch: 0.3,
    contextRelevance: 0.2,
    documentType: 0.1
  };

  /**
   * Calculate confidence score based on multiple factors
   */
  async calculateConfidence(factors: ConfidenceFactors): Promise<number> {
    try {
      // Get current weights from database
      const weights = await this.getConfidenceWeights();
      
      // Calculate weighted score
      const score = 
        (factors.semanticSimilarity * weights.semanticSimilarity) +
        (factors.keywordMatch * weights.keywordMatch) +
        (factors.contextRelevance * weights.contextRelevance) +
        (factors.documentType * weights.documentType);

      // Apply confidence curve to emphasize high-confidence mappings
      const adjustedScore = this.applyConfidenceCurve(score);
      
      // Ensure score is within valid range
      return Math.max(0, Math.min(100, adjustedScore * 100));
    } catch (error) {
      console.error('Error calculating confidence score:', error);
      // Fallback to simple average
      const avgScore = Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.values(factors).length;
      return Math.max(0, Math.min(100, avgScore * 100));
    }
  }

  /**
   * Get confidence breakdown for a mapping
   */
  async getConfidenceBreakdown(factors: ConfidenceFactors): Promise<{
    overall: number;
    breakdown: {
      semanticSimilarity: { score: number; weight: number; contribution: number };
      keywordMatch: { score: number; weight: number; contribution: number };
      contextRelevance: { score: number; weight: number; contribution: number };
      documentType: { score: number; weight: number; contribution: number };
    };
  }> {
    const weights = await this.getConfidenceWeights();
    const overall = await this.calculateConfidence(factors);

    return {
      overall,
      breakdown: {
        semanticSimilarity: {
          score: factors.semanticSimilarity * 100,
          weight: weights.semanticSimilarity,
          contribution: factors.semanticSimilarity * weights.semanticSimilarity * 100
        },
        keywordMatch: {
          score: factors.keywordMatch * 100,
          weight: weights.keywordMatch,
          contribution: factors.keywordMatch * weights.keywordMatch * 100
        },
        contextRelevance: {
          score: factors.contextRelevance * 100,
          weight: weights.contextRelevance,
          contribution: factors.contextRelevance * weights.contextRelevance * 100
        },
        documentType: {
          score: factors.documentType * 100,
          weight: weights.documentType,
          contribution: factors.documentType * weights.documentType * 100
        }
      }
    };
  }

  /**
   * Update confidence weights
   */
  async updateConfidenceWeights(weights: Partial<ConfidenceWeights>): Promise<void> {
    try {
      for (const [criteriaName, weight] of Object.entries(weights)) {
        await db.update(mappingCriteria)
          .set({ 
            weight: weight,
            updatedAt: new Date()
          })
          .where(eq(mappingCriteria.criteriaName, criteriaName));
      }
    } catch (error) {
      console.error('Error updating confidence weights:', error);
      throw new Error(`Failed to update confidence weights: ${error.message}`);
    }
  }

  /**
   * Get confidence thresholds for different confidence levels
   */
  getConfidenceThresholds(): {
    high: number;
    medium: number;
    low: number;
  } {
    return {
      high: 80,
      medium: 60,
      low: 40
    };
  }

  /**
   * Classify confidence level
   */
  classifyConfidenceLevel(score: number): 'high' | 'medium' | 'low' | 'very_low' {
    const thresholds = this.getConfidenceThresholds();
    
    if (score >= thresholds.high) return 'high';
    if (score >= thresholds.medium) return 'medium';
    if (score >= thresholds.low) return 'low';
    return 'very_low';
  }

  /**
   * Get confidence statistics for a set of mappings
   */
  getConfidenceStatistics(scores: number[]): {
    count: number;
    average: number;
    median: number;
    min: number;
    max: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    veryLowConfidence: number;
  } {
    if (scores.length === 0) {
      return {
        count: 0,
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        veryLowConfidence: 0
      };
    }

    const sortedScores = [...scores].sort((a, b) => a - b);
    const thresholds = this.getConfidenceThresholds();
    
    const highConfidence = scores.filter(s => s >= thresholds.high).length;
    const mediumConfidence = scores.filter(s => s >= thresholds.medium && s < thresholds.high).length;
    const lowConfidence = scores.filter(s => s >= thresholds.low && s < thresholds.medium).length;
    const veryLowConfidence = scores.filter(s => s < thresholds.low).length;

    return {
      count: scores.length,
      average: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      median: sortedScores[Math.floor(sortedScores.length / 2)],
      min: Math.min(...scores),
      max: Math.max(...scores),
      highConfidence,
      mediumConfidence,
      lowConfidence,
      veryLowConfidence
    };
  }

  /**
   * Apply confidence curve to emphasize high-confidence mappings
   */
  private applyConfidenceCurve(score: number): number {
    // Use a power curve to emphasize high scores
    // This makes the difference between 0.8 and 0.9 more significant
    return Math.pow(score, 0.8);
  }

  /**
   * Get current confidence weights from database
   */
  private async getConfidenceWeights(): Promise<ConfidenceWeights> {
    try {
      const criteria = await db.select()
        .from(mappingCriteria)
        .where(eq(mappingCriteria.isActive, true));

      const weights: ConfidenceWeights = { ...this.defaultWeights };

      for (const criterion of criteria) {
        switch (criterion.criteriaName) {
          case 'semantic_similarity':
            weights.semanticSimilarity = parseFloat(criterion.weight.toString());
            break;
          case 'keyword_match':
            weights.keywordMatch = parseFloat(criterion.weight.toString());
            break;
          case 'context_relevance':
            weights.contextRelevance = parseFloat(criterion.weight.toString());
            break;
          case 'document_type':
            weights.documentType = parseFloat(criterion.weight.toString());
            break;
        }
      }

      return weights;
    } catch (error) {
      console.warn('Error loading confidence weights, using defaults:', error);
      return this.defaultWeights;
    }
  }

  /**
   * Validate confidence weights
   */
  validateWeights(weights: Partial<ConfidenceWeights>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const [key, value] of Object.entries(weights)) {
      if (value < 0 || value > 1) {
        errors.push(`${key} weight must be between 0 and 1, got ${value}`);
      }
    }

    // Check if weights sum to approximately 1
    const totalWeight = Object.values(weights).reduce((sum, val) => sum + (val || 0), 0);
    if (Math.abs(totalWeight - 1) > 0.01) {
      errors.push(`Total weight must be 1.0, got ${totalWeight}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get confidence score explanation
   */
  getConfidenceExplanation(score: number): string {
    const level = this.classifyConfidenceLevel(score);
    
    const explanations = {
      high: 'High confidence mapping with strong semantic similarity and keyword matches',
      medium: 'Medium confidence mapping with moderate similarity indicators',
      low: 'Low confidence mapping with weak similarity indicators',
      very_low: 'Very low confidence mapping, likely not a good match'
    };

    return explanations[level];
  }
}
