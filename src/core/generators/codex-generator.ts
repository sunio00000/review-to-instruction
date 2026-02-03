/**
 * Review to Instruction - Codex Generator
 * Codex AGENTS.md 파일 생성 (단일 파일, append 방식)
 */

import { BaseGenerator, type GeneratorOptions, type GenerationResult } from './base-generator';
import type { EnhancedComment } from '../../types';
import { summarizeComment } from '../parser';

/**
 * Codex 파일 생성기
 * - 프로젝트 루트에 AGENTS.md 단일 파일 생성
 * - 새로운 규칙은 파일 끝에 append
 * - Markdown 형식, 섹션 단위로 구분
 */
export class CodexGenerator extends BaseGenerator {
  /**
   * 파일 생성
   */
  async generate(options: GeneratorOptions): Promise<GenerationResult> {
    const { existingContent } = options;

    // 기존 파일이 있으면 append, 없으면 새로 생성
    const content = existingContent
      ? this.appendToAgentsFile(options, existingContent)
      : this.createAgentsFile(options);

    // Codex는 항상 AGENTS.md 파일 사용
    const filePath = 'AGENTS.md';

    return {
      content,
      filePath,
      isUpdate: !!existingContent
    };
  }

  /**
   * 대상 디렉토리 반환 (루트)
   */
  getTargetDirectory(): string {
    return '.'; // 프로젝트 루트
  }

  /**
   * 파일 확장자 반환
   */
  getFileExtension(): string {
    return '.md';
  }

  /**
   * 새 AGENTS.md 파일 생성
   */
  private createAgentsFile(options: GeneratorOptions): string {
    const sections: string[] = [];

    // 헤더
    sections.push('# Project Guidelines\n');
    sections.push('This file contains coding conventions and best practices extracted from code reviews.\n');
    sections.push('---\n');

    // 첫 번째 규칙 추가
    sections.push(this.generateRuleSection(options));

    return sections.join('\n');
  }

  /**
   * 기존 AGENTS.md 파일에 규칙 추가 (append)
   */
  private appendToAgentsFile(
    options: GeneratorOptions,
    existingContent: string
  ): string {
    // 새 규칙 섹션 생성
    const newSection = this.generateRuleSection(options);

    // 기존 내용에 구분선과 함께 추가
    return `${existingContent.trim()}\n\n---\n\n${newSection}`;
  }

  /**
   * 규칙 섹션 생성
   */
  private generateRuleSection(options: GeneratorOptions): string {
    const { parsedComment, originalComment, repository } = options;

    const title = this.generateTitle(parsedComment);

    // LLM 강화 여부 확인
    const isEnhanced = 'llmEnhanced' in parsedComment && parsedComment.llmEnhanced;
    const enhanced = isEnhanced ? (parsedComment as EnhancedComment) : null;

    const sections: string[] = [];

    // 제목
    sections.push(`## ${title}\n`);

    // LLM 요약 (있으면)
    if (enhanced?.summary) {
      sections.push(enhanced.summary);
      sections.push('');
    }

    // 규칙 내용
    if (enhanced?.detailedExplanation) {
      sections.push(enhanced.detailedExplanation);
    } else {
      sections.push(summarizeComment(originalComment.content));
    }
    sections.push('');

    // 코드 예시
    if (parsedComment.codeExamples.length > 0) {
      sections.push('**Examples:**\n');

      if (enhanced?.codeExplanations && enhanced.codeExplanations.length > 0) {
        // LLM 설명 있음
        enhanced.codeExplanations.forEach((explanation) => {
          const label = explanation.isGoodExample !== undefined
            ? (explanation.isGoodExample ? '✅ Good:' : '❌ Bad:')
            : 'Example:';
          sections.push(`${label}\n`);
          sections.push('```');
          sections.push(explanation.code);
          sections.push('```');
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

    // 메타데이터
    sections.push(`*Source: [PR #${repository.prNumber}](${originalComment.url}) by @${originalComment.author}*`);
    sections.push(`*Keywords: ${parsedComment.keywords.join(', ')}*`);

    return sections.join('\n');
  }

}
