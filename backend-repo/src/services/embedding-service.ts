// Embedding Generation Service
// Generates and caches vector embeddings for semantic search

import { storage } from '../storage';
import { modelRouter } from '../llm/model-router';
import type { Control } from "../schema";
import type { InsertControlEmbedding } from "../schema";

export interface EmbeddingRequest {
  text: string;
  type: 'chunk' | 'control_requirement' | 'control_title' | 'combined';
  metadata?: Record<string, any>;
}

export interface ControlEmbeddings {
  requirement_embedding: number[];
  title_embedding: number[];
  combined_embedding: number[];
}

export class EmbeddingService {
  private embeddingCache = new Map<string, number[]>();
  private batchQueue: EmbeddingRequest[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private cacheTimestamps = new Map<string, number>();

  /**
   * Generate embeddings for multiple texts efficiently
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache first
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const hash = this.hashText(text);
      const cached = this.embeddingCache.get(hash);
      
      if (cached && this.isCacheValid(hash)) {
        embeddings[i] = cached;
      } else {
        uncachedTexts.push(text);
        uncachedIndices.push(i);
      }
    }

    // Generate embeddings for uncached texts
    if (uncachedTexts.length > 0) {
      const newEmbeddings = await this.batchEmbed(uncachedTexts);
      
      // Cache new embeddings
      for (let i = 0; i < uncachedTexts.length; i++) {
        const text = uncachedTexts[i];
        const hash = this.hashText(text);
        const embedding = newEmbeddings[i];
        
        this.embeddingCache.set(hash, embedding);
        this.cacheTimestamps.set(hash, Date.now());
        
        const originalIndex = uncachedIndices[i];
        embeddings[originalIndex] = embedding;
      }
    }

    return embeddings;
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  /**
   * Generate embeddings for a control
   */
  async embedControl(control: Control): Promise<ControlEmbeddings> {
    // Create rich representation of control
    const texts = {
      requirement: this.extractRequirementText(control),
      title: control.title || control.id,
      combined: this.createCombinedText(control)
    };
    
    const embeddings = await this.generateEmbeddings(Object.values(texts));
    
    return {
      requirement_embedding: embeddings[0],
      title_embedding: embeddings[1],
      combined_embedding: embeddings[2]
    };
  }

  /**
   * Store control embeddings in database
   */
  async storeControlEmbeddings(controlId: string, embeddings: ControlEmbeddings): Promise<void> {
    const embeddingRecord: InsertControlEmbedding = {
      controlId,
      requirementEmbedding: this.vectorToString(embeddings.requirement_embedding),
      titleEmbedding: this.vectorToString(embeddings.title_embedding),
      combinedEmbedding: this.vectorToString(embeddings.combined_embedding),
      metadata: {
        generated_at: new Date().toISOString(),
        model: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
        dimensions: embeddings.combined_embedding.length
      }
    };

    await storage.createControlEmbedding(embeddingRecord);
  }

  /**
   * Get control embeddings from database or generate if missing
   */
  async getControlEmbeddings(controlId: string): Promise<ControlEmbeddings | null> {
    const existing = await storage.getControlEmbedding(controlId);
    
    if (existing) {
      return {
        requirement_embedding: this.stringToVector(existing.requirementEmbedding || ''),
        title_embedding: this.stringToVector(existing.titleEmbedding || ''),
        combined_embedding: this.stringToVector(existing.combinedEmbedding || '')
      };
    }

    return null;
  }

  /**
   * Batch embed texts using model router with automatic provider fallback
   * Prefers Ollama (local) -> OpenAI -> fallback
   */
  private async batchEmbed(texts: string[]): Promise<number[][]> {
    try {
      console.log(`[EmbeddingService] Generating embeddings for ${texts.length} texts`);

      // Use model router which will try Ollama first, then OpenAI
      const embeddings = await modelRouter.generateEmbeddings(texts);

      console.log(`[EmbeddingService] Successfully generated ${embeddings.length} embeddings`);
      return embeddings;

    } catch (error) {
      console.error('[EmbeddingService] Error generating embeddings with model router:', error);
      console.warn('[EmbeddingService] Falling back to simple hash-based embeddings');

      // Fallback: generate simple hash-based embeddings
      return texts.map(text => this.generateFallbackEmbedding(text));
    }
  }

  /**
   * Generate fallback embedding when all providers fail
   * Uses 768 dimensions to match Ollama's nomic-embed-text
   */
  private generateFallbackEmbedding(text: string): number[] {
    // Simple hash-based embedding for fallback (768 dims for Ollama compatibility)
    const hash = this.hashText(text);
    const embedding = new Array(768).fill(0);

    for (let i = 0; i < hash.length && i < 768; i++) {
      embedding[i] = (hash.charCodeAt(i) - 128) / 128;
    }

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  /**
   * Extract requirement text from control
   */
  private extractRequirementText(control: Control): string {
    let text = control.title || control.id;
    
    if (control.description) {
      text += ' ' + control.description;
    }
    
    // Add additional context if available (metadata not in schema)
    // Metadata would be added here if the control type supported it
    
    return text.trim();
  }

  /**
   * Create combined text representation of control
   */
  private createCombinedText(control: Control): string {
    const parts = [
      control.id,
      control.title || '',
      control.description || '',
      control.family || '',
      Array.isArray(control.baseline) ? control.baseline.join(' ') : (control.baseline || '')
    ];

    // Add metadata context (metadata not in schema)
    // Metadata would be added here if the control type supported it

    return parts.filter(part => part && typeof part === 'string' && part.trim().length > 0).join(' ');
  }

  /**
   * Hash text for cache key
   */
  private hashText(text: string): string {
    // Simple hash function for cache keys (not cryptographic)
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(hash: string): boolean {
    const timestamp = this.cacheTimestamps.get(hash);
    if (!timestamp) return false;
    
    return (Date.now() - timestamp) < this.CACHE_TTL;
  }

  /**
   * Convert vector array to string for database storage
   */
  private vectorToString(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }

  /**
   * Convert string back to vector array
   */
  private stringToVector(str: string): number[] {
    if (!str || str === '') return [];
    
    try {
      // Remove brackets and split by comma
      const cleanStr = str.replace(/[\[\]]/g, '');
      return cleanStr.split(',').map(Number);
    } catch (error) {
      console.error('Error parsing vector string:', error);
      return [];
    }
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.embeddingCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.embeddingCache.size,
      hitRate: 0 // Would need to track hits/misses for accurate rate
    };
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
