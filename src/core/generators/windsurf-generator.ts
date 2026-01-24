/**
 * Review to Instruction - Windsurf Generator
 * Windsurf .windsurf/rules/ 디렉토리 파일 생성
 */

import { BaseGenerator, type GeneratorOptions, type GenerationResult } from './base-generator';
import type { ParsedComment, EnhancedComment } from '../../types';
import { summarizeComment } from '../parser';

/**
 * Windsurf 파일 생성기
 * - .windsurf/rules/ 디렉토리에 파일 생성
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
    return '.windsurf/rules';
  }

  /**
   * 파일 확장자 반환
   */
  getFileExtension(): string {
    return '.md';
  }

  /**
   * 새 Windsurf rule 파일 생성 (Official format: simple, concise, bullet points)
   */
  private createWindsurfRule(options: GeneratorOptions): string {
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

    // 규칙 (bullet points or numbered lists)
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
    sections.push('---\n');
    sections.push(`**Source:** [PR #${repository.prNumber}](${originalComment.url}) by @${originalComment.author}`);
    sections.push(`**Keywords:** ${parsedComment.keywords.join(', ')}`);

    return sections.join('\n') + '\n';
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
   * 기존 Windsurf rule 파일 업데이트 (simplified)
   */
  private updateWindsurfRule(
    options: GeneratorOptions,
    existingContent: string
  ): string {
    const { parsedComment, originalComment, repository } = options;

    const date = new Date().toISOString().split('T')[0];

    // 새 내용 추가
    const addendum: string[] = [
      '',
      '',
      `## Update (${date})`,
      '',
      this.convertToMarkdownList(summarizeComment(originalComment.content)),
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

    addendum.push(`**Source:** [PR #${repository.prNumber}](${originalComment.url}) by @${originalComment.author}`);

    return existingContent.trim() + addendum.join('\n') + '\n';
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
