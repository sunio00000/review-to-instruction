/**
 * Review to Instruction - Cursor Generator
 * Cursor .cursor/rules/*.md 파일 생성 (다중 파일 방식)
 */

import { BaseGenerator, type GeneratorOptions, type GenerationResult } from './base-generator';

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
  async generate(options: GeneratorOptions): Promise<GenerationResult> {
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
    const { parsedComment } = options;
    const sections: string[] = [];

    // YAML frontmatter (BaseGenerator 메서드 사용)
    sections.push(this.generateFrontmatter(options, 'yaml'));

    // 제목
    sections.push(`# ${this.generateTitle(parsedComment)}\n`);

    // 본문 내용
    sections.push(this.generateBodySection(options));
    sections.push('');

    // 코드 예시
    const examples = this.generateExamplesSection(parsedComment);
    if (examples) {
      sections.push(examples);
    }

    // 메타데이터 footer
    sections.push(this.generateMetadataFooter(options));

    return sections.join('\n');
  }

  /**
   * 새 섹션 생성 (업데이트 시 사용)
   */
  private generateNewSection(options: GeneratorOptions): string {
    const { parsedComment } = options;
    const date = new Date().toISOString().split('T')[0];

    const sections: string[] = [
      `## Update (${date})`,
      '',
      this.generateBodySection(options),
      ''
    ];

    const examples = this.generateExamplesSection(parsedComment);
    if (examples) {
      sections.push(examples);
    }

    sections.push(this.generateMetadataFooter(options, false));

    return sections.join('\n');
  }
}
