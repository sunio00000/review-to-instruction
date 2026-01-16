/**
 * Review to Instruction - Windsurf Generator
 * Windsurf rules/ 디렉토리 파일 생성
 */

import { BaseGenerator, type GeneratorOptions, type GenerationResult } from './base-generator';
import type { ParsedComment, EnhancedComment } from '../../types';
import { summarizeComment } from '../parser';

/**
 * Windsurf 파일 생성기
 * - rules/ 디렉토리에 파일 생성
 * - YAML frontmatter 없이 순수 Markdown
 * - 메타데이터를 blockquote로 표시
 */
export class WindsurfGenerator extends BaseGenerator {
  /**
   * 파일 생성
   */
  generate(options: GeneratorOptions): GenerationResult {
    const { parsedComment, existingContent } = options;

    // 기존 파일이 있으면 업데이트, 없으면 새로 생성
    const content = existingContent
      ? this.updateWindsurfRule(options, existingContent)
      : this.createWindsurfRule(options);

    // 파일 경로 생성
    const filePath = this.generateFilePath(parsedComment.suggestedFileName);

    return {
      content,
      filePath,
      isUpdate: !!existingContent
    };
  }

  /**
   * 대상 디렉토리 반환
   */
  getTargetDirectory(): string {
    return 'rules';
  }

  /**
   * 파일 확장자 반환
   */
  getFileExtension(): string {
    return '.md';
  }

  /**
   * 새 Windsurf rule 파일 생성
   */
  private createWindsurfRule(options: GeneratorOptions): string {
    const { parsedComment, originalComment, repository } = options;

    const title = this.generateTitle(parsedComment);
    const date = new Date().toISOString().split('T')[0];

    // LLM 강화 여부 확인
    const isEnhanced = 'llmEnhanced' in parsedComment && parsedComment.llmEnhanced;
    const enhanced = isEnhanced ? (parsedComment as EnhancedComment) : null;

    const sections: string[] = [];

    // 제목
    sections.push(`# ${title}\n`);

    // 메타데이터 (blockquote)
    sections.push(`> **Category:** ${parsedComment.category}`);
    sections.push(`> **Keywords:** ${parsedComment.keywords.join(', ')}`);
    sections.push(`> **Source:** PR #${repository.prNumber}, Comment by ${originalComment.author}`);
    sections.push(`> **Date:** ${date}`);
    if (isEnhanced) {
      sections.push(`> **Enhanced by LLM:** Yes`);
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

    return sections.join('\n') + '\n';
  }

  /**
   * 기존 Windsurf rule 파일 업데이트
   */
  private updateWindsurfRule(
    options: GeneratorOptions,
    existingContent: string
  ): string {
    const { parsedComment, originalComment, repository } = options;

    const date = new Date().toISOString().split('T')[0];

    // 메타데이터 업데이트
    let updatedContent = existingContent;

    // Date 업데이트 (blockquote 형식)
    if (updatedContent.includes('> **Date:**')) {
      updatedContent = updatedContent.replace(
        /> \*\*Date:\*\* .*/,
        `> **Date:** ${date} (updated)`
      );
    }

    // Keywords 병합
    const existingKeywords = this.extractKeywordsFromBlockquote(existingContent);
    const mergedKeywords = Array.from(new Set([...existingKeywords, ...parsedComment.keywords]));
    if (updatedContent.includes('> **Keywords:**')) {
      updatedContent = updatedContent.replace(
        /> \*\*Keywords:\*\* .*/,
        `> **Keywords:** ${mergedKeywords.join(', ')}`
      );
    }

    // 새 내용 추가
    const addendum = [
      '',
      `## Update (${date})\n`,
      summarizeComment(originalComment.content),
      ''
    ];

    // 코드 예시 추가
    if (parsedComment.codeExamples.length > 0) {
      addendum.push('### Examples\n');
      parsedComment.codeExamples.forEach(example => {
        addendum.push('```');
        addendum.push(example);
        addendum.push('```\n');
      });
    }

    addendum.push(`Source: [PR #${repository.prNumber}](${originalComment.url}) - ${originalComment.author}`);

    return updatedContent + addendum.join('\n') + '\n';
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

  /**
   * Blockquote에서 키워드 추출
   */
  private extractKeywordsFromBlockquote(content: string): string[] {
    const keywordsMatch = content.match(/> \*\*Keywords:\*\* (.*)/);
    if (!keywordsMatch) return [];

    return keywordsMatch[1]
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
  }
}
