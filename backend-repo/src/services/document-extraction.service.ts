// Document Content Extraction Service
// Extracts text content from various document formats (PDF, Word, etc.)

import { promises as fs } from 'fs';
import path from 'path';
import { Artifact } from "../schema";
import { documentStructureExtractor } from './document-structure-extractor';
import type { StructuredSection } from './document-structure-extractor';
import { storage } from '../storage';
import type { InsertDocumentSection } from "../schema";
import crypto from 'crypto';
// Lazy-load heavy parsers within methods to avoid module side-effects during import

export interface ExtractedContent {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    language?: string;
    sections?: DocumentSection[];
    structuredSections?: StructuredSection[];
    entities?: string[];
    keywords?: string[];
    confidence?: number;
  };
}

export interface DocumentSection {
  title: string;
  content: string;
  pageNumber?: number;
  relevanceScore?: number;
}

export class DocumentExtractionService {
  private readonly SUPPORTED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'text/x-yaml',
    'application/x-yaml',
    'text/yaml',
    'application/json',
    'text/csv',
    'text/html',
    'text/xml',
    'application/xml',
    'application/octet-stream'
  ];

  /**
   * Normalize bullets and simple table-like rows to help structure extraction.
   */
  private preprocessForStructure(rawText: string): string {
    const lines = rawText.split(/\r?\n/);
    const normalized: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i] ?? '';
      // Normalize common bullet characters to '- '
      line = line.replace(/^[\t\s]*[•◦▪‣►▶]\s+/u, '- ');
      // If the line appears to have multiple columns separated by tabs or 2+ spaces, convert to a pipe row
      const columns = line.trim().split(/\t+|\s{2,}/).filter(Boolean);
      if (columns.length >= 3) {
        line = `| ${columns.join(' | ')} |`;
      }
      normalized.push(line);
    }
    return normalized.join('\n');
  }

  private computeConfidence(text: string, sections: StructuredSection[]): number {
    // Heuristic: base on proportion of non-paragraph structural nodes
    const total = sections.length;
    const structural = sections.filter(s => s.type === 'heading' || s.type === 'list' || s.type === 'table').length;
    const ratio = total > 0 ? structural / total : 0;
    return Math.round(Math.min(100, Math.max(40, 60 + ratio * 40)));
  }

  private async resolveExistingPath(artifact: Artifact): Promise<string> {
    const candidates: string[] = [];
    if (artifact.filePath) candidates.push(artifact.filePath);
    const uploaded = (artifact.metadata as any)?.uploadedFileName as string | undefined;
    if (uploaded) {
      candidates.push(`/app/server/storage/public/${uploaded}`);
      candidates.push(`/app/server/storage/private/${uploaded}`);
      candidates.push(`/tmp/artifacts/public/${uploaded}`);
      candidates.push(`/tmp/artifacts/private/${uploaded}`);
    }
    for (const p of candidates) {
      try {
        await fs.access(p);
        return p;
      } catch {}
    }
    throw new Error('ENOENT: Artifact file not found on disk');
  }

  /**
   * Extract content from an artifact file
   */
  async extractContent(artifact: Artifact): Promise<ExtractedContent> {
    if (!artifact.filePath) {
      throw new Error('No file path provided for artifact');
    }

    const filePath = await this.resolveExistingPath(artifact);
    const mimeType = artifact.mimeType || 'text/plain';

    if (!this.SUPPORTED_TYPES.includes(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractPDFContent(filePath, artifact.id);
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractWordContent(filePath, artifact.id);
        // Route common text-like formats to the plain text extractor
        case 'text/plain':
        case 'text/markdown':
        case 'text/x-markdown':
        case 'text/x-yaml':
        case 'application/x-yaml':
        case 'text/yaml':
        case 'application/json':
        case 'text/csv':
        case 'text/xml':
        case 'application/xml':
        case 'application/octet-stream':
          return await this.extractTextContent(filePath, artifact.id);
        // Only actual HTML goes to the HTML extractor
        case 'text/html':
          return await this.extractHtmlContent(filePath, artifact.id);
        default:
          return await this.extractTextContent(filePath, artifact.id);
      }
    } catch (error) {
      console.error(`Error extracting content from ${filePath}:`, error);
      throw new Error(`Failed to extract content: ${error.message}`);
    }
  }

  /**
   * Extract content from PDF files
   */
  private async extractPDFContent(filePath: string, artifactId: string): Promise<ExtractedContent> {
    try {
      const buffer = await fs.readFile(filePath);
      const pdfParse = await import('pdf-parse');
      const pdf = pdfParse.default || pdfParse;
      const parsed = await (pdf as any)(buffer).catch(async () => {
        // one quick retry for transient errors
        return await (pdf as any)(buffer);
      });
      const text = this.cleanText(parsed.text || '');
      const pre = this.preprocessForStructure(text);
      const legacySections = this.extractSections(pre);
      const structuredSections = documentStructureExtractor.extract({ text: pre, metadata: { wordCount: this.countWords(pre) } });
      await this.persistStructuredSections(artifactId, structuredSections);

      return {
        text: pre,
        metadata: {
          pageCount: typeof parsed.numpages === 'number' ? parsed.numpages : this.estimatePageCount(pre),
          wordCount: this.countWords(pre),
          language: this.detectLanguage(pre),
          sections: legacySections,
          structuredSections,
          entities: this.extractEntities(text),
          keywords: this.extractKeywords(text),
          confidence: this.computeConfidence(pre, structuredSections)
        }
      };
    } catch (err) {
      // Defensive fallback: treat as UTF-8 text if PDF parsing fails
      const content = await fs.readFile(filePath, 'utf-8').catch(() => Buffer.alloc(0).toString());
      const text = this.cleanText(content || '');
      const pre = this.preprocessForStructure(text);
      const legacySections = this.extractSections(pre);
      const structuredSections = documentStructureExtractor.extract({ text: pre, metadata: { wordCount: this.countWords(pre) } });
      await this.persistStructuredSections(artifactId, structuredSections);
      return {
        text: pre,
        metadata: {
          pageCount: this.estimatePageCount(pre),
          wordCount: this.countWords(pre),
          language: this.detectLanguage(pre),
          sections: legacySections,
          structuredSections,
          entities: this.extractEntities(pre),
          keywords: this.extractKeywords(pre),
          confidence: this.computeConfidence(pre, structuredSections)
        }
      };
    }
  }

  /**
   * Extract content from Word documents
   */
  private async extractWordContent(filePath: string, artifactId: string): Promise<ExtractedContent> {
    try {
      const buffer = await fs.readFile(filePath);
      const { default: mammoth } = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer }).catch(async () => {
        // one quick retry
        return await mammoth.extractRawText({ buffer });
      });
      const text = this.cleanText(result.value || '');
      const pre = this.preprocessForStructure(text);
      const legacySections = this.extractSections(pre);
      const structuredSections = documentStructureExtractor.extract({ text: pre, metadata: { wordCount: this.countWords(pre) } });
      await this.persistStructuredSections(artifactId, structuredSections);
      return {
        text: pre,
        metadata: {
          wordCount: this.countWords(pre),
          language: this.detectLanguage(pre),
          sections: legacySections,
          structuredSections,
          entities: this.extractEntities(pre),
          keywords: this.extractKeywords(pre),
          confidence: this.computeConfidence(pre, structuredSections)
        }
      };
    } catch (err) {
      // Defensive fallback: treat as UTF-8 text if DOCX parsing fails
      const content = await fs.readFile(filePath, 'utf-8').catch(() => Buffer.alloc(0).toString());
      const text = this.cleanText(content || '');
      const pre = this.preprocessForStructure(text);
      const legacySections = this.extractSections(pre);
      const structuredSections = documentStructureExtractor.extract({ text: pre, metadata: { wordCount: this.countWords(pre) } });
      await this.persistStructuredSections(artifactId, structuredSections);
      return {
        text: pre,
        metadata: {
          wordCount: this.countWords(pre),
          language: this.detectLanguage(pre),
          sections: legacySections,
          structuredSections,
          entities: this.extractEntities(pre),
          keywords: this.extractKeywords(pre),
          confidence: this.computeConfidence(pre, structuredSections)
        }
      };
    }
  }

  /**
   * Extract content from text files
   */
  private async extractTextContent(filePath: string, artifactId: string): Promise<ExtractedContent> {
    const content = await fs.readFile(filePath, 'utf-8');
    const text = this.cleanText(content);
    const pre = this.preprocessForStructure(text);
    const legacySections = this.extractSections(pre);
    const structuredSections = documentStructureExtractor.extract({ text: pre, metadata: { wordCount: this.countWords(pre) } });
    await this.persistStructuredSections(artifactId, structuredSections);
    
    return {
      text: pre,
      metadata: {
        wordCount: this.countWords(pre),
        language: this.detectLanguage(pre),
        sections: legacySections,
        structuredSections,
        entities: this.extractEntities(pre),
        keywords: this.extractKeywords(pre),
        confidence: this.computeConfidence(pre, structuredSections)
      }
    };
  }

  /**
   * Extract content from HTML files
   */
  private async extractHtmlContent(filePath: string, artifactId: string): Promise<ExtractedContent> {
    const content = await fs.readFile(filePath, 'utf-8');
    const { parse } = await import('node-html-parser');
    const root = parse(content);

    // Compose a text representation that includes headings, lists, and tables
    const lines: string[] = [];
    root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      lines.push(h.text.trim());
    });
    root.querySelectorAll('ul li, ol li').forEach(li => {
      lines.push('- ' + li.text.trim());
    });
    root.querySelectorAll('table').forEach(table => {
      table.querySelectorAll('tr').forEach(tr => {
        const cells = tr.querySelectorAll('th, td').map(c => c.text.trim());
        if (cells.length) lines.push(cells.join(' | '));
      });
    });
    const body = root.querySelector('body');
    const bodyText = (body?.text || '').replace(/\s+/g, ' ').trim();
    if (bodyText) lines.push(bodyText);

    const text = this.cleanText(lines.join('\n'));
    const legacySections = this.extractSections(text);
    const structuredSections = documentStructureExtractor.extract({ text, metadata: { wordCount: this.countWords(text) } });
    await this.persistStructuredSections(artifactId, structuredSections);

    return {
      text,
      metadata: {
        wordCount: this.countWords(text),
        language: this.detectLanguage(text),
        sections: legacySections,
        structuredSections,
        entities: this.extractEntities(text),
        keywords: this.extractKeywords(text)
      }
    };
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Extract document sections based on headings
   */
  private extractSections(text: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = text.split('\n');
    let currentSection: DocumentSection | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for section headers (lines that are all caps, start with numbers, or are short)
      if (this.isSectionHeader(line)) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          title: line,
          content: '',
          pageNumber: Math.floor(i / 50) + 1 // Rough page estimation
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    // Add the last section
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Check if a line is likely a section header
   */
  private isSectionHeader(line: string): boolean {
    if (line.length < 3 || line.length > 100) return false;
    
    // Check for common header patterns
    const headerPatterns = [
      /^\d+\.?\s+[A-Z]/,  // "1. INTRODUCTION" or "1 INTRODUCTION"
      /^[A-Z\s]{3,}$/,    // "INTRODUCTION" or "SYSTEM OVERVIEW"
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/, // "System Overview" or "Security Controls"
      /^#{1,6}\s+/,       // Markdown headers
      /^[A-Z][A-Z\s]{2,}$/ // All caps headers
    ];

    return headerPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Extract named entities from text
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
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Count word frequency
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Return most frequent words
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }

  /**
   * Detect document language
   */

private async persistStructuredSections(artifactId: string, sections: StructuredSection[]): Promise<void> {
  await storage.deleteDocumentSectionsByArtifact(artifactId);
  if (!sections || sections.length === 0) {
    return;
  }

  const records: InsertDocumentSection[] = [];
  const stack: Array<{ parentId?: string; node: StructuredSection; index: number }> = [];

  sections.forEach((section, index) => stack.push({ parentId: undefined, node: section, index }));

  while (stack.length > 0) {
    const { parentId, node, index } = stack.pop()!;
    const id = crypto.randomUUID();

    records.push({
      id,
      artifactId,
      parentSectionId: parentId,
      sectionIndex: index,
      sectionLevel: node.level,
      sectionType: node.type,
      title: node.title,
      content: node.content,
      metadata: node.metadata ?? {}
    });

    if (node.children && node.children.length > 0) {
      node.children.forEach((child, childIndex) => {
        stack.push({ parentId: id, node: child, index: childIndex });
      });
    }
  }

  await storage.createDocumentSections(records);
}

  private detectLanguage(text: string): string {
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const englishCount = englishWords.reduce((count, word) => {
      return count + (text.toLowerCase().split(word).length - 1);
    }, 0);

    return englishCount > 10 ? 'en' : 'unknown';
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Estimate page count based on text length
   */
  private estimatePageCount(text: string): number {
    const wordsPerPage = 250; // Average words per page
    return Math.ceil(this.countWords(text) / wordsPerPage);
  }

  /**
   * Get document by ID (stub method)
   */
  async getDocumentById(documentId: string): Promise<any> {
    // This would query the documents table
    return { id: documentId, name: 'Document' };
  }

  /**
   * Get document chunks (stub method)
   */
  async getDocumentChunks(documentId: string): Promise<any[]> {
    // This would query the semantic_chunks table
    return [];
  }
}

// Export singleton instance
export const documentExtractionService = new DocumentExtractionService();

