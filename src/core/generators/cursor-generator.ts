/**
 * Review to Instruction - Cursor Generator
 * Cursor .cursorrules 파일 생성 (단일 파일 append 방식)
 */

import { BaseGenerator, type GeneratorOptions, type GenerationResult } from './base-generator';
import type { ParsedComment, EnhancedComment } from '../../types';
import { summarizeComment } from '../parser';

/**
 * Cursor 파일 생성기
 * - .cursorrules 단일 파일에 append
 * - YAML frontmatter 없이 순수 Markdown
 * - 구분자(---)로 각 규칙 분리
 */
export class CursorGenerator extends BaseGenerator {
  /**
   * 파일 생성
   */
  generate(options: GeneratorOptions): GenerationResult {
    const { existingContent } = options;

    // 기존 파일이 있으면 append, 없으면 새로 생성
    const content = existingContent
      ? this.appendToCursorrules(options, existingContent)
      : this.createCursorrules(options);

    return {
      content,
      filePath: '.cursorrules',
      isUpdate: !!existingContent
    };
  }

  /**
   * 대상 디렉토리 반환 (루트)
   */
  getTargetDirectory(): string {
    return '.';
  }

  /**
   * 파일 확장자 반환 (확장자 없음)
   */
  getFileExtension(): string {
    return '';
  }

  /**
   * 새 .cursorrules 파일 생성
   */
  private createCursorrules(options: GeneratorOptions): string {
    return this.generateRuleContent(options);
  }

  /**
   * 기존 .cursorrules 파일에 append
   */
  private appendToCursorrules(
    options: GeneratorOptions,
    existingContent: string
  ): string {
    const newRule = this.generateRuleContent(options);

    // 기존 내용 + 구분자 + 새 규칙
    return `${existingContent.trim()}\n\n---\n\n${newRule}`;
  }

  /**
   * 규칙 콘텐츠 생성 (Cursor best practices: concise, bullet points)
   */
  private generateRuleContent(options: GeneratorOptions): string {
    const { parsedComment, originalComment, repository } = options;

    const title = this.generateTitle(parsedComment);

    // LLM 강화 여부 확인
    const isEnhanced = 'llmEnhanced' in parsedComment && parsedComment.llmEnhanced;
    const enhanced = isEnhanced ? (parsedComment as EnhancedComment) : null;

    const sections: string[] = [];

    // 제목
    sections.push(`# ${title}\n`);

    // LLM 요약 (있으면)
    if (enhanced?.summary) {
      sections.push(enhanced.summary);
      sections.push('');
    }

    // 규칙 (bullet points preferred)
    if (enhanced?.detailedExplanation) {
      sections.push(this.convertToMarkdownList(enhanced.detailedExplanation));
    } else {
      sections.push(this.convertToMarkdownList(summarizeComment(originalComment.content)));
    }
    sections.push('');

    // 코드 예시
    if (parsedComment.codeExamples.length > 0) {
      sections.push('## Examples\n');

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
          sections.push(explanation.explanation);
          sections.push('');
        });
      } else {
        // LLM 설명 없음
        parsedComment.codeExamples.forEach((example) => {
          sections.push('```');
          sections.push(example);
          sections.push('```\n');
        });
      }
    }

    // 메타데이터 (footer)
    sections.push(`**Source:** [PR #${repository.prNumber}](${originalComment.url}) by @${originalComment.author}`);
    sections.push(`**Keywords:** ${parsedComment.keywords.join(', ')}`);

    return sections.join('\n');
  }

  /**
   * 텍스트를 Markdown 리스트로 변환
   */
  private convertToMarkdownList(text: string): string {
    // If already in bullet format, return as is
    if (text.trim().startsWith('-') || text.trim().startsWith('*')) {
      return text;
    }

    // Split by paragraphs or sentences
    const lines = text.split(/\n+/).filter(line => line.trim().length > 0);

    // Convert to bullet points
    return lines.map(line => `- ${line.trim()}`).join('\n');
  }

  /**
   * 제목 생성
   */
  private generateTitle(parsedComment: ParsedComment): string {
    const category = parsedComment.category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    if (parsedComment.keywords.length > 0) {
      const mainKeyword = parsedComment.keywords[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `${mainKeyword} ${category}`;
    }

    return category;
  }
}
