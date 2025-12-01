// Fallback NLP Analysis Functions
// Provides basic text analysis when LLM is unavailable

import { ExtractedContent, DocumentSection } from './document-extraction.service';
import { Control } from "../schema";

export class NLPFallbackAnalyzer {
  /**
   * Extract security-related keywords from text without LLM
   */
  static extractSecurityKeywords(text: string): string[] {
    const securityKeywords = [
      // Security Controls
      'access control', 'authentication', 'authorization', 'encryption', 'audit',
      'monitoring', 'logging', 'incident response', 'vulnerability', 'patch',
      'firewall', 'intrusion detection', 'antivirus', 'backup', 'recovery',
      'disaster recovery', 'business continuity', 'risk assessment', 'security policy',
      
      // Compliance
      'compliance', 'regulation', 'standard', 'framework', 'requirement',
      'nist', 'iso', 'sox', 'hipaa', 'pci-dss', 'gdpr', 'fedramp',
      
      // Technologies
      'siem', 'ids', 'ips', 'waf', 'vpn', 'mfa', '2fa', 'sso',
      'azure', 'aws', 'gcp', 'active directory', 'ldap', 'kubernetes',
      'docker', 'vmware', 'citrix', 'splunk', 'crowdstrike', 'palo alto'
    ];
    
    const normalizedText = text.toLowerCase();
    const foundKeywords = new Set<string>();
    
    for (const keyword of securityKeywords) {
      if (normalizedText.includes(keyword)) {
        foundKeywords.add(keyword);
      }
    }
    
    return Array.from(foundKeywords);
  }

  /**
   * Find control references in text using pattern matching
   */
  static findControlReferences(text: string, controls: Control[]): string[] {
    const foundControls = new Set<string>();
    const normalizedText = text.toLowerCase();
    
    for (const control of controls) {
      // Check for control ID (e.g., AC-1, AU-2)
      const idPattern = new RegExp(`\\b${control.id}\\b`, 'i');
      if (idPattern.test(text)) {
        foundControls.add(control.id);
        continue;
      }
      
      // Check for control family mention
      if (control.family && normalizedText.includes(control.family.toLowerCase())) {
        foundControls.add(control.id);
        continue;
      }
      
      // Check for key terms from control title
      const titleWords = control.title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const matchedWords = titleWords.filter(word => normalizedText.includes(word));
      if (matchedWords.length >= Math.min(2, titleWords.length)) {
        foundControls.add(control.id);
      }
    }
    
    return Array.from(foundControls);
  }

  /**
   * Extract implementation details using regex patterns
   */
  static extractImplementationDetails(text: string) {
    const details = {
      technologies: [] as string[],
      processes: [] as string[],
      policies: [] as string[],
      procedures: [] as string[],
      tools: [] as string[],
      responsibleParties: [] as string[]
    };
    
    // Technology patterns
    const techPattern = /(?:using|deployed|implemented with|utilizes?|leverages?)\s+([A-Z][A-Za-z0-9\s]+)/g;
    const techMatches = text.matchAll(techPattern);
    for (const match of techMatches) {
      if (match[1] && match[1].length < 50) {
        details.technologies.push(match[1].trim());
      }
    }
    
    // Process patterns
    const processPattern = /(?:process|procedure|workflow|method)(?:\s+(?:for|to|of))?\s+([a-zA-Z\s]+)/gi;
    const processMatches = text.matchAll(processPattern);
    for (const match of processMatches) {
      if (match[1] && match[1].length < 50) {
        details.processes.push(match[1].trim());
      }
    }
    
    // Policy patterns
    const policyPattern = /([A-Za-z\s]+)\s+(?:policy|standard|guideline)/gi;
    const policyMatches = text.matchAll(policyPattern);
    for (const match of policyMatches) {
      if (match[1] && match[1].length < 50) {
        details.policies.push(match[1].trim());
      }
    }
    
    // Tool patterns
    const toolPattern = /(?:tool|software|application|system)(?:\s+(?:such as|like|including))?\s+([A-Z][A-Za-z0-9\s]+)/g;
    const toolMatches = text.matchAll(toolPattern);
    for (const match of toolMatches) {
      if (match[1] && match[1].length < 50) {
        details.tools.push(match[1].trim());
      }
    }
    
    // Responsible party patterns
    const rolePattern = /(?:responsible|managed by|administered by|owned by)\s+(?:the\s+)?([A-Z][A-Za-z\s]+(?:team|group|department|administrator)?)/gi;
    const roleMatches = text.matchAll(rolePattern);
    for (const match of roleMatches) {
      if (match[1] && match[1].length < 50) {
        details.responsibleParties.push(match[1].trim());
      }
    }
    
    // Deduplicate and clean
    Object.keys(details).forEach(key => {
      details[key as keyof typeof details] = [...new Set(details[key as keyof typeof details])]
        .filter(item => item.length > 2)
        .slice(0, 10); // Limit to 10 items per category
    });
    
    return details;
  }

  /**
   * Calculate relevance score between text and control
   */
  static calculateRelevanceScore(text: string, control: Control): number {
    const normalizedText = text.toLowerCase();
    let score = 0;
    
    // Check for control ID mention (highest weight)
    if (new RegExp(`\\b${control.id}\\b`, 'i').test(text)) {
      score += 40;
    }
    
    // Check for family mention
    if (control.family && normalizedText.includes(control.family.toLowerCase())) {
      score += 20;
    }
    
    // Check for title keywords
    const titleWords = control.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const titleMatches = titleWords.filter(word => normalizedText.includes(word));
    score += (titleMatches.length / titleWords.length) * 30;
    
    // Check for description keywords if available
    if (control.description) {
      const descWords = control.description.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const descMatches = descWords.filter(word => normalizedText.includes(word));
      score += Math.min(10, (descMatches.length / descWords.length) * 10);
    }
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Extract relevant sentences for a control
   */
  static extractRelevantSentences(text: string, control: Control, maxSentences: number = 3): string[] {
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    const scoredSentences = sentences.map(sentence => ({
      sentence,
      score: this.calculateRelevanceScore(sentence, control)
    }));
    
    // Sort by score and return top sentences
    return scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .filter(s => s.score > 10)
      .map(s => s.sentence);
  }

  /**
   * Generate a basic summary without LLM
   */
  static generateBasicSummary(content: ExtractedContent): string {
    const text = content.text;
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
    
    if (sentences.length === 0) {
      return 'Document contains limited text content.';
    }
    
    // Try to find introductory sentences
    const introPatterns = [
      /^this\s+document/i,
      /^the\s+purpose/i,
      /^this\s+(?:policy|procedure|guide)/i,
      /describes/i,
      /provides/i,
      /establishes/i
    ];
    
    const introSentence = sentences.find(s => 
      introPatterns.some(pattern => pattern.test(s))
    );
    
    const keywords = this.extractSecurityKeywords(text);
    const keywordSummary = keywords.length > 0 
      ? `Key topics include: ${keywords.slice(0, 5).join(', ')}.`
      : '';
    
    const firstSentence = introSentence || sentences[0];
    const wordCount = content.metadata.wordCount;
    
    return `${firstSentence} This document contains ${wordCount} words. ${keywordSummary}`.trim();
  }
}

export default NLPFallbackAnalyzer;
