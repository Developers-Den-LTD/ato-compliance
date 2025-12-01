// Intelligent Document Chunking Service
// Chunks documents into semantic units for vector embedding

import { ExtractedContent, DocumentSection } from './document-extraction.service';
import type { InsertSemanticChunk } from "../schema";

export interface DocumentChunk {
  content: string;
  type: ChunkType;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  section_title?: string;
  section_level?: number;
  chunk_position?: number;
  has_complete_context?: boolean;
  page_number?: number;
  word_count?: number;
  entities?: string[];
  confidence?: number;
  previous_chunk_title?: string;
  next_chunk_title?: string;
  chunk_sequence?: string;
}

export type ChunkType = 'header' | 'paragraph' | 'list' | 'table' | 'policy' | 'procedure' | 'code' | 'other';

export class IntelligentDocumentChunker {
  private readonly config = {
    maxChunkSize: 1000,      // tokens (roughly 750 words)
    minChunkSize: 200,       // tokens (roughly 150 words)
    overlapSize: 100,        // tokens for context preservation
    semanticBreakpoints: true,
    preserveStructure: true
  };

  /**
   * Chunk a document into semantic units
   */
  async chunkDocument(content: ExtractedContent, artifactId: string): Promise<InsertSemanticChunk[]> {
    const chunks: DocumentChunk[] = [];
    
    // Process structured sections first
    if (content.metadata.structuredSections && content.metadata.structuredSections.length > 0) {
      for (const section of content.metadata.structuredSections) {
        const sectionChunks = await this.chunkStructuredSection(section, artifactId);
        chunks.push(...sectionChunks);
      }
    }
    
    // Process legacy sections if available
    if (content.metadata.sections && content.metadata.sections.length > 0) {
      for (const section of content.metadata.sections) {
        const sectionChunks = await this.chunkLegacySection(section);
        chunks.push(...sectionChunks);
      }
    }
    
    // Handle orphan content (content not in sections)
    const orphanContent = this.extractOrphanContent(content);
    if (orphanContent) {
      const orphanChunks = await this.chunkText(orphanContent, 'other');
      chunks.push(...orphanChunks);
    }
    
    // Add context to chunks and convert to database format
    const contextualChunks = this.addContextToChunks(chunks);
    return this.convertToDatabaseFormat(contextualChunks, artifactId);
  }

  /**
   * Chunk a structured section (from document-structure-extractor)
   */
  private async chunkStructuredSection(section: any, artifactId: string): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    
    // If section is small enough, keep it as one chunk
    if (this.isSmallEnough(section.content)) {
      chunks.push({
        content: section.content,
        type: this.classifyContent(section.content, section.type),
        metadata: {
          section_title: section.title,
          section_level: section.level,
          has_complete_context: true,
          word_count: this.countWords(section.content),
          entities: this.extractEntities(section.content),
          confidence: this.calculateConfidence(section)
        }
      });
    } else {
      // Split large sections at semantic boundaries
      const splits = await this.semanticSplit(section.content, section.type);
      for (let i = 0; i < splits.length; i++) {
        const split = splits[i];
        chunks.push({
          content: split.text,
          type: split.type,
          metadata: {
            section_title: section.title,
            section_level: section.level,
            chunk_position: i,
            has_complete_context: split.isComplete,
            word_count: this.countWords(split.text),
            entities: this.extractEntities(split.text),
            confidence: this.calculateConfidence(section)
          }
        });
      }
    }
    
    return chunks;
  }

  /**
   * Chunk a legacy section (from old extraction)
   */
  private async chunkLegacySection(section: DocumentSection): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    
    if (this.isSmallEnough(section.content)) {
      chunks.push({
        content: section.content,
        type: this.classifyContent(section.content),
        metadata: {
          section_title: section.title,
          page_number: section.pageNumber,
          has_complete_context: true,
          word_count: this.countWords(section.content),
          entities: this.extractEntities(section.content),
          confidence: section.relevanceScore || 0.8
        }
      });
    } else {
      const splits = await this.semanticSplit(section.content);
      for (let i = 0; i < splits.length; i++) {
        const split = splits[i];
        chunks.push({
          content: split.text,
          type: split.type,
          metadata: {
            section_title: section.title,
            page_number: section.pageNumber,
            chunk_position: i,
            has_complete_context: split.isComplete,
            word_count: this.countWords(split.text),
            entities: this.extractEntities(split.text),
            confidence: section.relevanceScore || 0.8
          }
        });
      }
    }
    
    return chunks;
  }

  /**
   * Chunk plain text content
   */
  private async chunkText(text: string, defaultType: ChunkType = 'other'): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    
    if (this.isSmallEnough(text)) {
      chunks.push({
        content: text,
        type: this.classifyContent(text, defaultType),
        metadata: {
          has_complete_context: true,
          word_count: this.countWords(text),
          entities: this.extractEntities(text),
          confidence: 0.7
        }
      });
    } else {
      const splits = await this.semanticSplit(text, defaultType);
      for (let i = 0; i < splits.length; i++) {
        const split = splits[i];
        chunks.push({
          content: split.text,
          type: split.type,
          metadata: {
            chunk_position: i,
            has_complete_context: split.isComplete,
            word_count: this.countWords(split.text),
            entities: this.extractEntities(split.text),
            confidence: 0.7
          }
        });
      }
    }
    
    return chunks;
  }

  /**
   * Check if content is small enough to be one chunk
   */
  private isSmallEnough(content: string): boolean {
    const wordCount = this.countWords(content);
    return wordCount <= this.config.maxChunkSize;
  }

  /**
   * Classify content type based on patterns
   */
  private classifyContent(content: string, hint?: string): ChunkType {
    const text = content.toLowerCase().trim();
    
    // Use hint if provided
    if (hint) {
      const hintLower = hint.toLowerCase();
      if (hintLower.includes('heading') || hintLower.includes('header')) return 'header';
      if (hintLower.includes('list')) return 'list';
      if (hintLower.includes('table')) return 'table';
      if (hintLower.includes('policy')) return 'policy';
      if (hintLower.includes('procedure')) return 'procedure';
    }
    
    // Pattern-based classification
    if (text.length < 100 && /^[A-Z\s\d\.\-]+$/.test(content)) return 'header';
    if (text.includes('•') || text.includes('- ') || text.includes('1.') || text.includes('* ')) return 'list';
    if (text.includes('|') || text.includes('\t')) return 'table';
    if (text.includes('policy') || text.includes('shall') || text.includes('must')) return 'policy';
    if (text.includes('procedure') || text.includes('step') || text.includes('process')) return 'procedure';
    if (text.includes('function') || text.includes('class') || text.includes('import')) return 'code';
    
    return 'paragraph';
  }

  /**
   * Split content at semantic boundaries
   */
  private async semanticSplit(content: string, type?: string): Promise<Array<{text: string, type: ChunkType, isComplete: boolean}>> {
    const splits: Array<{text: string, type: ChunkType, isComplete: boolean}> = [];
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    let currentWords = 0;
    
    for (const paragraph of paragraphs) {
      const paragraphWords = this.countWords(paragraph);
      
      // If adding this paragraph would exceed max size, start a new chunk
      if (currentWords + paragraphWords > this.config.maxChunkSize && currentChunk.length > 0) {
        splits.push({
          text: currentChunk.trim(),
          type: this.classifyContent(currentChunk, type),
          isComplete: currentWords >= this.config.minChunkSize
        });
        
        // Start new chunk with overlap
        currentChunk = this.getOverlapText(currentChunk) + '\n\n' + paragraph;
        currentWords = this.countWords(currentChunk);
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentWords += paragraphWords;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      splits.push({
        text: currentChunk.trim(),
        type: this.classifyContent(currentChunk, type),
        isComplete: currentWords >= this.config.minChunkSize
      });
    }
    
    return splits;
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(chunk: string): string {
    const sentences = chunk.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const overlapSentences = sentences.slice(-2); // Last 2 sentences
    return overlapSentences.join('. ').trim();
  }

  /**
   * Add context to chunks (surrounding information)
   */
  private addContextToChunks(chunks: DocumentChunk[]): DocumentChunk[] {
    return chunks.map((chunk, index) => {
      const enhancedMetadata = { ...chunk.metadata };
      
      // Add context from previous/next chunks
      if (index > 0) {
        enhancedMetadata.previous_chunk_title = chunks[index - 1].metadata.section_title;
      }
      if (index < chunks.length - 1) {
        enhancedMetadata.next_chunk_title = chunks[index + 1].metadata.section_title;
      }
      
      // Add chunk sequence information
      enhancedMetadata.chunk_sequence = `${index + 1}/${chunks.length}`;
      
      return {
        ...chunk,
        metadata: enhancedMetadata
      };
    });
  }

  /**
   * Convert chunks to database format
   */
  private convertToDatabaseFormat(chunks: DocumentChunk[], artifactId: string): InsertSemanticChunk[] {
    return chunks.map((chunk, index) => ({
      artifactId,
      chunkIndex: index,
      content: chunk.content,
      chunkType: chunk.type,
      metadata: chunk.metadata
    }));
  }

  /**
   * Extract orphan content (not in sections)
   */
  private extractOrphanContent(content: ExtractedContent): string | null {
    // This would extract content that wasn't captured in sections
    // For now, return null as we're using structured sections
    return null;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Extract entities from text
   */
  private extractEntities(text: string): string[] {
    const entities: string[] = [];
    
    // Extract common security and compliance entities
    const entityPatterns = [
      /\b[A-Z]{2,}-\d+\b/g,  // Control IDs like "AC-1", "SC-7"
      /\b[A-Z]{2,}\d+\b/g,   // Other IDs like "NIST800-53"
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, // Proper nouns
      /\b(?:AWS|Azure|GCP|Docker|Kubernetes|Jenkins|Splunk|CrowdStrike|Tanium)\b/gi,
      /\b(?:firewall|IDS|IPS|WAF|VPN|DMZ|SIEM|SOAR)\b/gi
    ];

    entityPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        entities.push(...matches.map(m => m.trim()));
      }
    });

    return [...new Set(entities)]; // Remove duplicates
  }

  /**
   * Calculate confidence score for a chunk
   */
  private calculateConfidence(section: any): number {
    // Base confidence on section structure and content quality
    let confidence = 0.7;
    
    if (section.title && section.title.length > 0) confidence += 0.1;
    if (section.level && section.level > 0) confidence += 0.1;
    if (section.content && section.content.length > 100) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }
}

// Export singleton instance
export const documentChunker = new IntelligentDocumentChunker();
