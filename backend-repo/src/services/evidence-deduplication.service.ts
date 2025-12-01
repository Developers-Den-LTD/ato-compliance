// Evidence Deduplication Service
// Detects and removes duplicate evidence items

import { EvidenceItem } from "../schema";

export interface DeduplicationOptions {
  similarityThreshold?: number;
  preserveHighestQuality?: boolean;
  mergeSimilarItems?: boolean;
  maxSimilarityGroups?: number;
}

export interface SimilarityGroup {
  representative: EvidenceItem;
  similar: EvidenceItem[];
  similarityScore: number;
}

export class EvidenceDeduplicationService {
  /**
   * Deduplicate evidence items
   */
  async deduplicateEvidence(
    evidenceItems: EvidenceItem[],
    options: DeduplicationOptions = {}
  ): Promise<EvidenceItem[]> {
    try {
      console.log(`Starting deduplication of ${evidenceItems.length} evidence items`);

      const {
        similarityThreshold = 0.8,
        preserveHighestQuality = true,
        mergeSimilarItems = false,
        maxSimilarityGroups = 50
      } = options;

      // Group similar evidence items
      const similarityGroups = this.groupSimilarEvidence(evidenceItems, similarityThreshold);

      console.log(`Found ${similarityGroups.length} similarity groups`);

      // Process each group
      const deduplicatedItems: EvidenceItem[] = [];

      for (const group of similarityGroups.slice(0, maxSimilarityGroups)) {
        if (mergeSimilarItems) {
          // Merge similar items into one
          const mergedItem = this.mergeSimilarItems(group);
          deduplicatedItems.push(mergedItem);
        } else {
          // Keep only the best item from each group
          const bestItem = this.selectBestItem(group, preserveHighestQuality);
          deduplicatedItems.push(bestItem);
        }
      }

      // Add items that don't belong to any similarity group
      const processedIds = new Set(
        similarityGroups.flatMap(group => 
          [group.representative.id, ...group.similar.map(item => item.id)]
        )
      );

      const ungroupedItems = evidenceItems.filter(item => !processedIds.has(item.id));
      deduplicatedItems.push(...ungroupedItems);

      console.log(`Deduplication completed: ${evidenceItems.length} -> ${deduplicatedItems.length} items`);
      return deduplicatedItems;

    } catch (error) {
      console.error('Error deduplicating evidence:', error);
      throw new Error(`Failed to deduplicate evidence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Group similar evidence items
   */
  private groupSimilarEvidence(
    evidenceItems: EvidenceItem[], 
    similarityThreshold: number
  ): SimilarityGroup[] {
    const groups: SimilarityGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < evidenceItems.length; i++) {
      const item1 = evidenceItems[i];
      
      if (processed.has(item1.id)) {
        continue;
      }

      const similar: EvidenceItem[] = [];
      let maxSimilarity = 0;

      for (let j = i + 1; j < evidenceItems.length; j++) {
        const item2 = evidenceItems[j];
        
        if (processed.has(item2.id)) {
          continue;
        }

        const similarity = this.calculateSimilarity(item1, item2);
        
        if (similarity >= similarityThreshold) {
          similar.push(item2);
          maxSimilarity = Math.max(maxSimilarity, similarity);
          processed.add(item2.id);
        }
      }

      if (similar.length > 0) {
        groups.push({
          representative: item1,
          similar,
          similarityScore: maxSimilarity
        });
        processed.add(item1.id);
      }
    }

    return groups;
  }

  /**
   * Calculate similarity between two evidence items
   */
  private calculateSimilarity(item1: EvidenceItem, item2: EvidenceItem): number {
    // Text similarity (primary factor)
    const textSimilarity = this.calculateTextSimilarity(
      item1.evidenceText, 
      item2.evidenceText
    );

    // Type similarity
    const typeSimilarity = item1.evidenceType === item2.evidenceType ? 1.0 : 0.0;

    // Control similarity (should be the same for items being compared)
    const controlSimilarity = item1.controlId === item2.controlId ? 1.0 : 0.0;

    // Source location similarity
    const locationSimilarity = this.calculateLocationSimilarity(
      item1.sourceLocation, 
      item2.sourceLocation
    );

    // Weighted average
    const similarity = (
      textSimilarity * 0.6 +
      typeSimilarity * 0.2 +
      controlSimilarity * 0.1 +
      locationSimilarity * 0.1
    );

    return similarity;
  }

  /**
   * Calculate text similarity using multiple methods
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Normalize texts
    const normalized1 = this.normalizeText(text1);
    const normalized2 = this.normalizeText(text2);

    // Jaccard similarity
    const jaccardSimilarity = this.calculateJaccardSimilarity(normalized1, normalized2);

    // Cosine similarity (simplified)
    const cosineSimilarity = this.calculateCosineSimilarity(normalized1, normalized2);

    // Levenshtein distance similarity
    const levenshteinSimilarity = this.calculateLevenshteinSimilarity(normalized1, normalized2);

    // Weighted average of different similarity measures
    return (
      jaccardSimilarity * 0.4 +
      cosineSimilarity * 0.4 +
      levenshteinSimilarity * 0.2
    );
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Calculate Jaccard similarity
   */
  private calculateJaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate cosine similarity (simplified)
   */
  private calculateCosineSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');
    
    const allWords = new Set([...words1, ...words2]);
    const vector1 = Array.from(allWords).map(word => words1.filter(w => w === word).length);
    const vector2 = Array.from(allWords).map(word => words2.filter(w => w === word).length);
    
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Calculate Levenshtein distance similarity
   */
  private calculateLevenshteinSimilarity(text1: string, text2: string): number {
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    
    if (maxLength === 0) {
      return 1;
    }
    
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,      // deletion
          matrix[j - 1][i] + 1,      // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate location similarity
   */
  private calculateLocationSimilarity(location1: any, location2: any): number {
    if (!location1 || !location2) {
      return 0;
    }

    let similarity = 0;
    let factors = 0;

    // Chunk type similarity
    if (location1.chunkType && location2.chunkType) {
      similarity += location1.chunkType === location2.chunkType ? 1 : 0;
      factors++;
    }

    // Section title similarity
    if (location1.sectionTitle && location2.sectionTitle) {
      const sectionSimilarity = this.calculateTextSimilarity(
        location1.sectionTitle, 
        location2.sectionTitle
      );
      similarity += sectionSimilarity;
      factors++;
    }

    // Page number proximity
    if (location1.pageNumber && location2.pageNumber) {
      const pageDiff = Math.abs(location1.pageNumber - location2.pageNumber);
      const pageSimilarity = Math.max(0, 1 - (pageDiff / 10)); // Within 10 pages
      similarity += pageSimilarity;
      factors++;
    }

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Select the best item from a similarity group
   */
  private selectBestItem(group: SimilarityGroup, preserveHighestQuality: boolean): EvidenceItem {
    const allItems = [group.representative, ...group.similar];
    
    if (preserveHighestQuality) {
      // Sort by quality score (descending)
      return allItems.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))[0];
    } else {
      // Sort by relevance score (descending)
      return allItems.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))[0];
    }
  }

  /**
   * Merge similar items into one
   */
  private mergeSimilarItems(group: SimilarityGroup): EvidenceItem {
    const allItems = [group.representative, ...group.similar];
    
    // Use the highest quality item as base
    const baseItem = allItems.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))[0];
    
    // Merge evidence text
    const mergedText = allItems
      .map(item => item.evidenceText)
      .filter((text, index, array) => array.indexOf(text) === index) // Remove duplicates
      .join('\n\n---\n\n');
    
    // Calculate merged scores
    const avgQuality = allItems.reduce((sum, item) => sum + (item.qualityScore || 0.5), 0) / allItems.length;
    const avgRelevance = allItems.reduce((sum, item) => sum + (item.relevanceScore || 0.5), 0) / allItems.length;
    
    // Merge source locations
    const mergedLocation = {
      ...(typeof baseItem.sourceLocation === 'object' && baseItem.sourceLocation !== null ? baseItem.sourceLocation : {}),
      mergedFrom: allItems.map(item => ({
        id: item.id,
        documentId: item.documentId,
        chunkId: (item.sourceLocation as any)?.chunkId
      }))
    };

    return {
      ...baseItem,
      evidenceText: mergedText,
      qualityScore: avgQuality,
      relevanceScore: avgRelevance,
      sourceLocation: mergedLocation
    };
  }

  /**
   * Find potential duplicates in a list of evidence items
   */
  async findPotentialDuplicates(
    evidenceItems: EvidenceItem[],
    similarityThreshold: number = 0.7
  ): Promise<Array<{ item1: EvidenceItem; item2: EvidenceItem; similarity: number }>> {
    const duplicates: Array<{ item1: EvidenceItem; item2: EvidenceItem; similarity: number }> = [];

    for (let i = 0; i < evidenceItems.length; i++) {
      for (let j = i + 1; j < evidenceItems.length; j++) {
        const similarity = this.calculateSimilarity(evidenceItems[i], evidenceItems[j]);
        
        if (similarity >= similarityThreshold) {
          duplicates.push({
            item1: evidenceItems[i],
            item2: evidenceItems[j],
            similarity
          });
        }
      }
    }

    return duplicates.sort((a, b) => b.similarity - a.similarity);
  }
}

export const evidenceDeduplicationService = new EvidenceDeduplicationService();
