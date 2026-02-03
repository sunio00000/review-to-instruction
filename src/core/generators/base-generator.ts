/**
 * Review to Instruction - Base Generator
 * Generator 패턴의 추상 베이스 클래스
 */

import type { ParsedComment, EnhancedComment, Comment, Repository, LLMConfig } from '../../types';
import { summarizeComment } from '../parser';

// Generator 옵션
export interface GeneratorOptions {
  parsedComment: ParsedComment | EnhancedComment;
  originalComment: Comment;
  repository: Repository;
  existingContent?: string;
  suggestedPath?: string;  // SmartFileNaming에서 제안된 전체 경로 (선택적)
  llmConfig?: LLMConfig;  // LLM 설정 (분류 등에 사용)
}

// 파일 생성 결과
export interface GenerationResult {
  content: string;
  filePath: string;
  isUpdate: boolean;
}

/**
 * 파일 생성기 베이스 클래스
 *
 * 각 AI 도구별 Generator는 이 클래스를 상속받아 구현
 */
export abstract class BaseGenerator {
  /**
   * 파일 생성 (추상 메서드, async로 변경)
   */
  abstract generate(options: GeneratorOptions): Promise<GenerationResult>;

  /**
   * 대상 디렉토리 반환 (추상 메서드)
   */
  abstract getTargetDirectory(): string;

  /**
   * 파일 확장자 반환 (추상 메서드)
   */
  abstract getFileExtension(): string;

  /**
   * 파일 경로 생성 (공통 로직)
   */
  protected generateFilePath(fileName: string): string {
    const dir = this.getTargetDirectory();
    const ext = this.getFileExtension();

    const normalizedFileName = fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;
    return `${dir}/${normalizedFileName}`;
  }

  /**
   * 제목 생성 (공통 로직)
   */
  protected generateTitle(parsedComment: ParsedComment | EnhancedComment): string {
    const category = this.capitalizeWords(parsedComment.category);

    if (parsedComment.keywords.length > 0) {
      const mainKeyword = this.capitalizeWords(parsedComment.keywords[0]);
      return `${mainKeyword} ${category}`;
    }

    return category;
  }

  /**
   * 단어 첫 글자 대문자 (kebab-case → Title Case)
   */
  protected capitalizeWords(text: string): string {
    return text
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Markdown 리스트 변환 (공통 로직)
   */
  protected convertToMarkdownList(text: string): string {
    if (text.trim().startsWith('-') || text.trim().startsWith('*')) {
      return text;
    }

    const lines = text.split(/\n+/).filter(line => line.trim().length > 0);
    return lines.map(line => `- ${line.trim()}`).join('\n');
  }

  /**
   * 메타데이터 Footer 생성 (공통 로직)
   */
  protected generateMetadataFooter(
    options: GeneratorOptions,
    includeKeywords: boolean = true,
    includeCategory: boolean = false
  ): string {
    const { parsedComment, originalComment, repository } = options;

    const sections: string[] = [
      `**Source:** [PR #${repository.prNumber}](${originalComment.url}) by @${originalComment.author}`
    ];

    if (includeKeywords && includeCategory) {
      sections.push(`**Tags:** ${parsedComment.keywords.join(', ')}, ${parsedComment.category}`);
    } else if (includeKeywords) {
      sections.push(`**Keywords:** ${parsedComment.keywords.join(', ')}`);
    }

    return sections.join('\n');
  }

  /**
   * Frontmatter 생성 (공통 로직)
   */
  protected generateFrontmatter(
    options: GeneratorOptions,
    style: 'yaml' | 'comment' | 'none'
  ): string {
    const { parsedComment, originalComment, repository } = options;

    switch (style) {
      case 'yaml':
        return [
          '---',
          `title: "${this.generateTitle(parsedComment)}"`,
          `category: "${parsedComment.category}"`,
          `keywords: [${parsedComment.keywords.map(k => `"${k}"`).join(', ')}]`,
          `source: "PR #${repository.prNumber}"`,
          `author: "${originalComment.author}"`,
          '---\n'
        ].join('\n');

      case 'comment':
        return [
          '<!--',
          `Category: ${parsedComment.category}`,
          `Source: PR #${repository.prNumber}`,
          '-->\n'
        ].join('\n');

      case 'none':
      default:
        return '';
    }
  }

  /**
   * 본문 섹션 생성 (공통 로직)
   */
  protected generateBodySection(options: GeneratorOptions): string {
    const { parsedComment, originalComment } = options;

    const isEnhanced = 'llmEnhanced' in parsedComment && parsedComment.llmEnhanced;
    const enhanced = isEnhanced ? (parsedComment as EnhancedComment) : null;

    const sections: string[] = [];

    // LLM 요약 (있으면)
    if (enhanced?.summary) {
      sections.push(enhanced.summary);
      sections.push('');
    }

    // 규칙 설명
    if (enhanced?.detailedExplanation) {
      sections.push(this.convertToMarkdownList(enhanced.detailedExplanation));
    } else {
      sections.push(this.convertToMarkdownList(summarizeComment(originalComment.content)));
    }

    return sections.join('\n');
  }

  /**
   * 코드 예시 섹션 생성 (공통 로직)
   */
  protected generateExamplesSection(parsedComment: ParsedComment | EnhancedComment): string {
    if (parsedComment.codeExamples.length === 0) {
      return '';
    }

    const isEnhanced = 'llmEnhanced' in parsedComment && parsedComment.llmEnhanced;
    const enhanced = isEnhanced ? (parsedComment as EnhancedComment) : null;

    const sections: string[] = ['## Examples\n'];

    if (enhanced?.codeExplanations && enhanced.codeExplanations.length > 0) {
      // LLM 설명 있음
      enhanced.codeExplanations.forEach((explanation) => {
        const label = explanation.isGoodExample !== undefined
          ? (explanation.isGoodExample ? '### ✅ Correct' : '### ❌ Incorrect')
          : '### Example';
        sections.push(`${label}\n`);
        sections.push('```');
        sections.push(explanation.code);
        sections.push('```\n');
        if (explanation.explanation) {
          sections.push(explanation.explanation);
          sections.push('');
        }
      });
    } else {
      // LLM 설명 없음
      parsedComment.codeExamples.forEach((example) => {
        sections.push('```');
        sections.push(example);
        sections.push('```\n');
      });
    }

    return sections.join('\n');
  }
}
