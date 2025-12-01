// Semantic Search Engine
// Provides vector-based similarity search with reranking

import { storage } from '../storage';
import { embeddingService } from './embedding-service';
import type { SemanticChunk, ControlEmbedding, Control } from "../schema";

export interface SearchOptions {
  limit?: number;
  minSimilarity?: number;
  includeMetadata?: boolean;
  chunkTypes?: string[];
  rerank?: boolean;
}

export interface SemanticSearchResult {
  chunkId: string;
  content: string;
  documentName: string;
  artifactId: string;
  similarity: number;
  relevanceScore: number;
  metadata: Record<string, any>;
  chunkType: string;
  surroundingContext?: {
    previous?: string;
    next?: string;
  };
}

export interface ControlSearchResult {
  controlId: string;
  title: string;
  similarity: number;
  relevanceScore: number;
  metadata: Record<string, any>;
}

export class SemanticSearchEngine {
  /**
   * Find relevant chunks for a control
   */
  async findRelevantChunks(
    controlId: string,
    systemId: string,
    options: SearchOptions = {}
  ): Promise<SemanticSearchResult[]> {
    const {
      limit = 10,
      minSimilarity = 0.7,
      includeMetadata = true,
      chunkTypes = [],
      rerank = true
    } = options;

    // Get control embedding
    const controlEmbedding = await this.getControlEmbedding(controlId);
    if (!controlEmbedding) {
      throw new Error(`Control ${controlId} not found or not embedded`);
    }

    // Perform vector similarity search
    const rawResults = await storage.findSimilarChunks(
      controlEmbedding,
      systemId,
      limit * 2, // Get more results for reranking
      minSimilarity
    );

    // Filter by chunk types if specified
    let filteredResults = rawResults;
    if (chunkTypes.length > 0) {
      filteredResults = rawResults.filter(result => 
        chunkTypes.includes(result.chunkType || '')
      );
    }

    // Convert to search results
    let searchResults = await this.convertToSearchResults(filteredResults, systemId);

    // Rerank results if requested
    if (rerank) {
      searchResults = await this.rerankResults(searchResults, controlId);
    }

    // Limit final results
    return searchResults.slice(0, limit);
  }

  /**
   * Find similar controls based on a query
   */
  async findSimilarControls(
    query: string,
    options: SearchOptions = {}
  ): Promise<ControlSearchResult[]> {
    const {
      limit = 10,
      minSimilarity = 0.7,
      rerank = true
    } = options;

    // Generate embedding for query
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // Search for similar controls
    const rawResults = await storage.findSimilarControls(
      queryEmbedding,
      limit * 2,
      minSimilarity
    );

    // Convert to search results
    let searchResults = this.convertToControlSearchResults(rawResults);

    // Rerank if requested
    if (rerank) {
      searchResults = await this.rerankControlResults(searchResults, query);
    }

    return searchResults.slice(0, limit);
  }

  /**
   * Search for chunks by text query
   */
  async searchChunks(
    query: string,
    systemId: string,
    options: SearchOptions = {}
  ): Promise<SemanticSearchResult[]> {
    const {
      limit = 10,
      minSimilarity = 0.7,
      includeMetadata = true,
      chunkTypes = [],
      rerank = true
    } = options;

    // Generate embedding for query
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // Search for similar chunks
    const rawResults = await storage.findSimilarChunks(
      queryEmbedding,
      systemId,
      limit * 2,
      minSimilarity
    );

    // Filter by chunk types if specified
    let filteredResults = rawResults;
    if (chunkTypes.length > 0) {
      filteredResults = rawResults.filter(result => 
        chunkTypes.includes(result.chunkType || '')
      );
    }

    // Convert to search results
    let searchResults = await this.convertToSearchResults(filteredResults, systemId);

    // Rerank results if requested
    if (rerank) {
      searchResults = await this.rerankResults(searchResults, query);
    }

    return searchResults.slice(0, limit);
  }

  /**
   * Get control embedding from database or generate if missing
   */
  private async getControlEmbedding(controlId: string): Promise<number[] | null> {
    // Try to get from database first
    const existing = await storage.getControlEmbedding(controlId);
    if (existing && existing.combinedEmbedding) {
      return this.parseEmbeddingString(existing.combinedEmbedding);
    }

    // Generate if missing
    const control = await storage.getControl(controlId);
    if (!control) {
      return null;
    }

    const embeddings = await embeddingService.embedControl(control);
    await embeddingService.storeControlEmbeddings(controlId, embeddings);
    
    return embeddings.combined_embedding;
  }

  /**
   * Convert database results to search results
   */
  private async convertToSearchResults(
    results: SemanticChunk[],
    systemId: string
  ): Promise<SemanticSearchResult[]> {
    const searchResults: SemanticSearchResult[] = [];

    for (const result of results) {
      // Get artifact information
      const artifact = await storage.getArtifact(result.artifactId);
      if (!artifact) continue;

      // Parse similarity from metadata if available
      const similarity = (result as any).similarity || 0.8;

      searchResults.push({
        chunkId: result.id,
        content: result.content,
        documentName: artifact.name,
        artifactId: result.artifactId,
        similarity,
        relevanceScore: similarity, // Will be updated by reranking
        metadata: result.metadata || {},
        chunkType: result.chunkType || 'paragraph'
      });
    }

    return searchResults;
  }

  /**
   * Convert control search results
   */
  private convertToControlSearchResults(results: ControlEmbedding[]): ControlSearchResult[] {
    return results.map(result => ({
      controlId: result.controlId,
      title: result.metadata?.title || result.controlId,
      similarity: (result as any).similarity || 0.8,
      relevanceScore: (result as any).similarity || 0.8,
      metadata: result.metadata || {}
    }));
  }

  /**
   * Rerank search results with additional scoring
   */
  private async rerankResults(
    results: SemanticSearchResult[],
    controlIdOrQuery: string
  ): Promise<SemanticSearchResult[]> {
    // Get control for keyword extraction if it's a control ID
    let control: Control | null = null;
    let isControlId = false;
    
    try {
      control = await storage.getControl(controlIdOrQuery);
      isControlId = !!control;
    } catch {
      // Not a control ID, treat as query
    }

    const keywords = isControlId && control 
      ? this.extractKeywords(control)
      : this.extractKeywordsFromText(controlIdOrQuery);

    return results.map(result => {
      const keywordScore = this.calculateKeywordScore(result.content, keywords);
      const metadataScore = this.calculateMetadataScore(result.metadata);
      const typeScore = this.calculateTypeScore(result.chunkType);
      
      // Weighted combination of scores
      const finalScore = (
        result.similarity * 0.5 +
        keywordScore * 0.3 +
        metadataScore * 0.1 +
        typeScore * 0.1
      );

      return {
        ...result,
        relevanceScore: Math.min(1.0, finalScore)
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Rerank control search results
   */
  private async rerankControlResults(
    results: ControlSearchResult[],
    query: string
  ): Promise<ControlSearchResult[]> {
    const keywords = this.extractKeywordsFromText(query);

    return results.map(result => {
      const keywordScore = this.calculateKeywordScore(result.title, keywords);
      const finalScore = result.similarity * 0.7 + keywordScore * 0.3;

      return {
        ...result,
        relevanceScore: Math.min(1.0, finalScore)
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Extract keywords from control
   */
  private extractKeywords(control: Control): string[] {
    const text = [
      control.id,
      control.title || '',
      control.description || '',
      control.family || ''
    ].join(' ').toLowerCase();

    return this.extractKeywordsFromText(text);
  }

  /**
   * Extract keywords from text
   */
  private extractKeywordsFromText(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Count frequency
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Return most frequent words
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Calculate keyword match score
   */
  private calculateKeywordScore(content: string, keywords: string[]): number {
    if (keywords.length === 0) return 0;

    const contentLower = content.toLowerCase();
    const matches = keywords.filter(keyword => 
      contentLower.includes(keyword.toLowerCase())
    ).length;

    return matches / keywords.length;
  }

  /**
   * Calculate metadata quality score
   */
  private calculateMetadataScore(metadata: Record<string, any>): number {
    let score = 0;
    
    if (metadata.section_title) score += 0.3;
    if (metadata.has_complete_context) score += 0.2;
    if (metadata.entities && metadata.entities.length > 0) score += 0.2;
    if (metadata.confidence) score += metadata.confidence * 0.3;
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate chunk type relevance score
   */
  private calculateTypeScore(chunkType: string): number {
    const typeScores: Record<string, number> = {
      'header': 0.9,
      'policy': 0.8,
      'procedure': 0.8,
      'table': 0.7,
      'list': 0.6,
      'paragraph': 0.5,
      'code': 0.4,
      'other': 0.3
    };

    return typeScores[chunkType] || 0.5;
  }

  /**
   * Parse embedding string from database
   */
  private parseEmbeddingString(str: string): number[] {
    if (!str || str === '') return [];
    
    try {
      const cleanStr = str.replace(/[\[\]]/g, '');
      return cleanStr.split(',').map(Number);
    } catch (error) {
      console.error('Error parsing embedding string:', error);
      return [];
    }
  }

  /**
   * Get search statistics
   */
  async getSearchStats(): Promise<{
    totalChunks: number;
    totalControls: number;
    averageChunkSize: number;
  }> {
    // This would require additional database queries
    // For now, return placeholder stats
    return {
      totalChunks: 0,
      totalControls: 0,
      averageChunkSize: 0
    };
  }
}

// Export singleton instance
export const semanticSearchEngine = new SemanticSearchEngine();
