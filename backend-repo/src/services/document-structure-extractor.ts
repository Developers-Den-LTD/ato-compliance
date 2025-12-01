export type SectionType =
  | 'document'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'code'
  | 'caption';

export interface StructuredSection {
  id?: string;
  parentId?: string;
  sectionIndex: number;
  level: number;
  type: SectionType;
  title?: string;
  content: string;
  metadata: Record<string, unknown>;
  children: StructuredSection[];
}

interface HeadingCandidate {
  level: number;
  title: string;
}


export interface ExtractionInput {
  text: string;
  metadata?: {
    wordCount?: number;
    [key: string]: unknown;
  };
}

export class DocumentStructureExtractor {
  private readonly headingPatterns: { regex: RegExp; level: number }[] = [
    { regex: /^#{1}\s+(.+)/, level: 1 },
    { regex: /^#{2}\s+(.+)/, level: 2 },
    { regex: /^#{3}\s+(.+)/, level: 3 },
    { regex: /^\d+\.\s+(.+)/, level: 2 },
    { regex: /^\d+\.\d+\.\s+(.+)/, level: 3 },
    { regex: /^[A-Z][A-Z\s]{3,}$/, level: 2 },
    { regex: /^[A-Z][a-zA-Z]+(\s+[A-Z][a-zA-Z]+){0,3}$/, level: 3 }
  ];

  extract(content: ExtractionInput): StructuredSection[] {
    const text = content.text || '';
    const lines = text.split(/\r?\n/);
    const root: StructuredSection = {
      sectionIndex: 0,
      level: 0,
      type: 'document',
      title: 'Document Root',
      content: '',
      metadata: {
        wordCount: content.metadata?.wordCount ?? 0,
        language: content.metadata?.language ?? 'unknown'
      },
      children: []
    };

    let currentParentStack: StructuredSection[] = [root];
    let paragraphBuffer: string[] = [];

    const flushParagraph = () => {
      if (paragraphBuffer.length === 0) return;
      const paragraphText = paragraphBuffer.join(' ');
      const parent = currentParentStack[currentParentStack.length - 1];
      parent.children.push({
        sectionIndex: parent.children.length,
        level: parent.level + 1,
        type: 'paragraph',
        content: paragraphText.trim(),
        metadata: {
          wordCount: this.countWords(paragraphText)
        },
        children: []
      });
      paragraphBuffer = [];
    };

    lines.forEach((rawLine, lineIndex) => {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        return;
      }

      const heading = this.detectHeading(line);
      if (heading) {
        flushParagraph();
        const parent = this.findParentForHeading(currentParentStack, heading.level);
        const newSection: StructuredSection = {
          sectionIndex: parent.children.length,
          level: heading.level,
          type: 'heading',
          title: heading.title,
          content: '',
          metadata: {
            sourceLine: lineIndex,
            headingLevel: heading.level
          },
          children: []
        };
        parent.children.push(newSection);
        currentParentStack = currentParentStack
          .slice(0, heading.level)
          .concat(newSection);
        return;
      }

      if (this.isListItem(line)) {
        flushParagraph();
        const parent = currentParentStack[currentParentStack.length - 1];
        const listSection = this.ensureListSection(parent);
        listSection.children.push({
          sectionIndex: listSection.children.length,
          level: listSection.level + 1,
          type: 'paragraph',
          content: line.replace(/^[-*+\d\.\)\(\s]+/, '').trim(),
          metadata: {
            originalLine: line
          },
          children: []
        });
        return;
      }

      if (this.isTableDelimiter(line)) {
        flushParagraph();
        const tableLines = [line];
        let nextIndex = lineIndex + 1;
        while (nextIndex < lines.length && this.isTableLine(lines[nextIndex])) {
          tableLines.push(lines[nextIndex]);
          nextIndex += 1;
        }
        const parent = currentParentStack[currentParentStack.length - 1];
        parent.children.push({
          sectionIndex: parent.children.length,
          level: parent.level + 1,
          type: 'table',
          content: tableLines.join('\n'),
          metadata: {
            rowCount: tableLines.length - 1
          },
          children: []
        });
        return;
      }

      paragraphBuffer.push(line);
    });

    flushParagraph();
    return root.children;
  }

  private detectHeading(line: string): HeadingCandidate | null {
    for (const pattern of this.headingPatterns) {
      const match = line.match(pattern.regex);
      if (match) {
        const title = match[1] ?? line;
        return { level: Math.max(1, Math.min(pattern.level, 4)), title: title.trim() };
      }
    }
    return null;
  }

  private findParentForHeading(stack: StructuredSection[], level: number): StructuredSection {
    const normalizedLevel = Math.max(1, level);
    return stack[Math.min(normalizedLevel - 1, stack.length - 1)];
  }

  private ensureListSection(parent: StructuredSection): StructuredSection {
    const lastChild = parent.children[parent.children.length - 1];
    if (lastChild && lastChild.type === 'list') {
      return lastChild;
    }
    const listSection: StructuredSection = {
      sectionIndex: parent.children.length,
      level: parent.level + 1,
      type: 'list',
      content: '',
      metadata: {},
      children: []
    };
    parent.children.push(listSection);
    return listSection;
  }

  private isListItem(line: string): boolean {
    return /^(\s*[\-\*\+•◦]\s+|\s*\d+[\.\)]\s+)/.test(line);
  }

  private isTableDelimiter(line: string): boolean {
    return /^\|.+\|$/.test(line) || /^\+-[-+]+-\+$/.test(line);
  }

  private isTableLine(line: string): boolean {
    return /^\|.+\|$/.test(line) || /^\+-[-+]+-\+$/.test(line);
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }
}

export const documentStructureExtractor = new DocumentStructureExtractor();
