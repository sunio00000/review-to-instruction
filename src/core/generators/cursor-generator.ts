/**
 * Review to Instruction - Cursor Generator
 * Cursor .cursor/rules/*.md 파일 생성 (다중 파일 방식)
 */

import { BaseGenerator, type GeneratorOptions, type GenerationResult } from './base-generator';
import type { ParsedComment, EnhancedComment } from '../../types';
import { summarizeComment } from '../parser';

/**
 * Cursor 파일 생성기
 * - .cursor/rules/ 디렉토리에 개별 Markdown 파일 생성
 * - YAML frontmatter 포함
 * - Claude Code와 유사한 구조
 */
export class CursorGenerator extends BaseGenerator {
  /**
   * 파일 생성
   */
  generate(options: GeneratorOptions): GenerationResult {
    const { parsedComment, existingContent, suggestedPath } = options;

    // 파일 경로 결정
    const filePath = suggestedPath || this.generateFilePath(parsedComment.suggestedFileName);

    // 콘텐츠 생성
    const content = existingContent
      ? this.updateExistingFile(options, existingContent)
      : this.createNewFile(options);

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
    return '.cursor/rules';
  }

  /**
   * 파일 확장자 반환
   */
  getFileExtension(): string {
    return '.md';
  }

  /**
   * 새 파일 생성
   */
  private createNewFile(options: GeneratorOptions): string {
    return this.generateRuleContent(options);
  }

  /**
   * 기존 파일 업데이트 (append)
   */
  private updateExistingFile(
    options: GeneratorOptions,
    existingContent: string
  ): string {
    const newSection = this.generateNewSection(options);
    return `${existingContent.trim()}\n\n---\n\n${newSection}`;
  }

  /**
   * 규칙 콘텐츠 생성 (YAML frontmatter 포함)
   */
  private generateRuleContent(options: GeneratorOptions): string {
    const { parsedComment, originalComment, repository } = options;

    const sections: string[] = [];

    // YAML frontmatter
    sections.push('---');
    sections.push(`title: "${this.generateTitle(parsedComment)}"`);
    sections.push(`category: "${parsedComment.category}"`);
    sections.push(`keywords: [${parsedComment.keywords.map(k => `"${k}"`).join(', ')}]`);
    sections.push(`source: "PR #${repository.prNumber}"`);
    sections.push(`author: "${originalComment.author}"`);
    sections.push('---\n');

    // 본문 내용 추가
    sections.push(this.generateNewSection(options));

    return sections.join('\n');
  }

  /**
   * 새 섹션 생성 (frontmatter 제외)
   */
  private generateNewSection(options: GeneratorOptions): string {
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
