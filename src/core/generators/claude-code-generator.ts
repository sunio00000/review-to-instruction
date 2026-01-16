/**
 * Review to Instruction - Claude Code Generator
 * Claude Code instruction/skill 파일 생성 (Generator 패턴 구현)
 */

import { BaseGenerator, type GeneratorOptions, type GenerationResult } from './base-generator';
import { generateInstruction } from '../instruction-generator';
import { generateSkill } from '../skill-generator';

/**
 * Claude Code 파일 생성기
 * - instruction 또는 skill 파일 생성
 * - 코멘트 내용에 따라 자동 분류
 */
export class ClaudeCodeGenerator extends BaseGenerator {
  private fileType: 'instruction' | 'skill';

  constructor() {
    super();
    this.fileType = 'instruction'; // 기본값
  }

  /**
   * 파일 생성
   */
  generate(options: GeneratorOptions): GenerationResult {
    const { parsedComment, originalComment } = options;

    // 코멘트 내용 분석하여 instruction vs skill 결정
    this.fileType = this.determineFileType(originalComment.content, parsedComment.keywords);

    // 적절한 생성기 호출
    const content = this.fileType === 'instruction'
      ? generateInstruction(options)
      : generateSkill(options);

    // 파일 경로 생성
    const filePath = this.generateFilePath(parsedComment.suggestedFileName);

    return {
      content,
      filePath,
      isUpdate: !!options.existingContent
    };
  }

  /**
   * 대상 디렉토리 반환
   */
  getTargetDirectory(): string {
    return this.fileType === 'instruction'
      ? '.claude/instructions'
      : '.claude/skills';
  }

  /**
   * 파일 확장자 반환
   */
  getFileExtension(): string {
    return '.md';
  }

  /**
   * instruction vs skill 결정
   *
   * Skill 기준:
   * - "how to", "pattern", "technique", "method", "approach" 등의 키워드
   * - "방법", "패턴", "기법", "테크닉" 등의 한글 키워드
   * - 반복 가능한 작업 수행 방법을 설명하는 내용
   *
   * Instruction 기준 (기본값):
   * - "rule", "convention", "guideline", "standard" 등의 키워드
   * - "규칙", "컨벤션", "가이드라인", "표준" 등의 한글 키워드
   * - 일반적인 규칙이나 원칙을 설명하는 내용
   */
  private determineFileType(
    content: string,
    keywords: string[]
  ): 'instruction' | 'skill' {
    const lowerContent = content.toLowerCase();
    const lowerKeywords = keywords.map(k => k.toLowerCase());

    // Skill 키워드
    const skillKeywords = [
      'how to', 'pattern', 'technique', 'method', 'approach',
      '방법', '패턴', '기법', '테크닉', '어떻게'
    ];

    // Skill 키워드가 있으면 skill로 분류
    const hasSkillKeyword =
      skillKeywords.some(keyword => lowerContent.includes(keyword)) ||
      lowerKeywords.some(keyword => skillKeywords.some(sk => keyword.includes(sk)));

    return hasSkillKeyword ? 'skill' : 'instruction';
  }
}
