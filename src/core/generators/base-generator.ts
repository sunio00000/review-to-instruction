/**
 * Review to Instruction - Base Generator
 * Generator 패턴의 추상 베이스 클래스
 */

import type { ParsedComment, EnhancedComment, Comment, Repository } from '../../types';

// Generator 옵션
export interface GeneratorOptions {
  parsedComment: ParsedComment | EnhancedComment;
  originalComment: Comment;
  repository: Repository;
  existingContent?: string;
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
   * 파일 생성 (추상 메서드)
   */
  abstract generate(options: GeneratorOptions): GenerationResult;

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
}
