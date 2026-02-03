/**
 * Review to Instruction - Windsurf Generator
 * Windsurf .windsurf/rules/ 디렉토리 파일 생성
 */

import { BaseGenerator, type GeneratorOptions, type GenerationResult } from './base-generator';

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
  async generate(options: GeneratorOptions): Promise<GenerationResult> {
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
   * 새 Windsurf rule 파일 생성
   */
  private createWindsurfRule(options: GeneratorOptions): string {
    const { parsedComment } = options;
    const sections: string[] = [];

    // 제목
    sections.push(`# ${this.generateTitle(parsedComment)}\n`);

    // 본문 내용 (BaseGenerator 메서드 사용)
    sections.push(this.generateBodySection(options));
    sections.push('');

    // 코드 예시 (BaseGenerator 메서드 사용)
    const examples = this.generateExamplesSection(parsedComment);
    if (examples) {
      sections.push(examples);
    }

    // 메타데이터 footer (BaseGenerator 메서드 사용)
    sections.push('---');
    sections.push(this.generateMetadataFooter(options));

    return sections.join('\n');
  }

  /**
   * 기존 Windsurf rule 업데이트
   */
  private updateWindsurfRule(
    options: GeneratorOptions,
    existingContent: string
  ): string {
    const { parsedComment } = options;
    const date = new Date().toISOString().split('T')[0];

    const addendum: string[] = [
      '',
      `## Update (${date})`,
      '',
      this.generateBodySection(options),
      ''
    ];

    const examples = this.generateExamplesSection(parsedComment);
    if (examples) {
      addendum.push(examples);
    }

    addendum.push('---');
    addendum.push(this.generateMetadataFooter(options, false));

    return `${existingContent.trim()}\n\n${addendum.join('\n')}`;
  }
}
