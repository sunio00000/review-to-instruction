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
   * 규칙 콘텐츠 생성
   */
  private generateRuleContent(options: GeneratorOptions): string {
    const { parsedComment, originalComment, repository } = options;

    const title = this.generateTitle(parsedComment);
    const date = new Date().toISOString().split('T')[0];

    // LLM 강화 여부 확인
    const isEnhanced = 'llmEnhanced' in parsedComment && parsedComment.llmEnhanced;
    const enhanced = isEnhanced ? (parsedComment as EnhancedComment) : null;

    const sections: string[] = [];

    // 제목
    sections.push(`# ${title}\n`);

    // 메타데이터 (굵은 글씨로)
    sections.push(`**Category:** ${parsedComment.category}`);
    sections.push(`**Keywords:** ${parsedComment.keywords.join(', ')}`);
    sections.push(`**Source:** PR #${repository.prNumber}, Comment by ${originalComment.author}`);
    sections.push(`**Date:** ${date}`);
    if (isEnhanced) {
      sections.push(`**Enhanced by LLM:** Yes`);
    }
    sections.push('');

    // LLM 요약 (있으면)
    if (enhanced?.summary) {
      sections.push('## Summary\n');
      sections.push(enhanced.summary);
      sections.push('');
    }

    // 규칙
    sections.push('## Rules\n');
    if (enhanced?.detailedExplanation) {
      sections.push(enhanced.detailedExplanation);
    } else {
      sections.push(summarizeComment(originalComment.content));
    }
    sections.push('');

    // 코드 예시
    if (parsedComment.codeExamples.length > 0) {
      sections.push('## Examples\n');

      if (enhanced?.codeExplanations && enhanced.codeExplanations.length > 0) {
        // LLM 설명 있음
        enhanced.codeExplanations.forEach((explanation, index) => {
          if (enhanced.codeExplanations!.length > 1) {
            const label = explanation.isGoodExample !== undefined
              ? (explanation.isGoodExample ? 'Correct Example' : 'Incorrect Example')
              : `Example ${index + 1}`;
            sections.push(`### ${label}\n`);
          }
          sections.push('```');
          sections.push(explanation.code);
          sections.push('```\n');
          sections.push(`**Explanation:** ${explanation.explanation}`);
          sections.push('');
        });
      } else {
        // LLM 설명 없음
        parsedComment.codeExamples.forEach((example, index) => {
          if (parsedComment.codeExamples.length > 1) {
            sections.push(`### Example ${index + 1}\n`);
          }
          sections.push('```');
          sections.push(example);
          sections.push('```\n');
        });
      }
    }

    // 출처
    sections.push('## Source\n');
    sections.push(`This convention was established during the review of [PR #${repository.prNumber}](${originalComment.url}).`);
    sections.push(`- Author: ${originalComment.author}`);
    sections.push(`- Date: ${new Date(originalComment.createdAt).toLocaleDateString('en-US')}`);

    return sections.join('\n');
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
