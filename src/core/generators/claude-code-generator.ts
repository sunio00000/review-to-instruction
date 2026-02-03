/**
 * Review to Instruction - Claude Code Generator
 * Claude Code instruction/skill 파일 생성 (Generator 패턴 구현)
 */

import { BaseGenerator, type GeneratorOptions, type GenerationResult } from './base-generator';
import { generateInstruction } from '../instruction-generator';
import { generateSkill } from '../skill-generator';
import { buildClassificationPrompt } from '../../background/llm/prompts';
import { ClaudeClient } from '../../background/llm/claude-client';

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
   * 파일 생성 (async로 변경)
   */
  async generate(options: GeneratorOptions): Promise<GenerationResult> {
    const { parsedComment, originalComment, suggestedPath, llmConfig } = options;

    // 코멘트 내용 분석하여 instruction vs skill 결정 (LLM 사용)
    this.fileType = await this.determineFileType(
      originalComment.content,
      parsedComment.keywords,
      llmConfig
    );

    // 적절한 생성기 호출
    const content = this.fileType === 'instruction'
      ? generateInstruction(options)
      : generateSkill(options);

    // 파일 경로 생성
    // 1. suggestedPath가 있으면 사용 (SmartFileNaming에서 제안된 경로)
    // 2. 없으면 기존 로직 사용
    const filePath = suggestedPath || this.generateFilePath(parsedComment.suggestedFileName);

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
      ? '.claude/rules'
      : '.claude/skills';
  }

  /**
   * 파일 확장자 반환
   */
  getFileExtension(): string {
    return '.md';
  }

  /**
   * instruction vs skill 결정 (LLM 기반)
   *
   * Instruction: 규칙, 컨벤션, 가이드라인, 표준
   * Skill: 단계별 방법, 기법, 하우투 가이드
   *
   * LLM이 없거나 실패하면 기본값(instruction) 반환
   */
  private async determineFileType(
    content: string,
    keywords: string[],
    llmConfig?: any
  ): Promise<'instruction' | 'skill'> {
    // LLM이 없으면 기본값(instruction) 반환
    if (!llmConfig?.apiKey) {
      return 'instruction';
    }

    try {
      // LLM 클라이언트 생성
      const client = new ClaudeClient(llmConfig.apiKey);

      // 분류 프롬프트 생성
      const prompt = buildClassificationPrompt(content, keywords);

      // LLM 호출 (generateText 사용)
      const response = await client.generateText(prompt, {
        max_tokens: 10,
        temperature: 0,
        system: 'You are a classification assistant. Answer with only one word.'
      });

      // 응답 파싱 (소문자로 변환하여 "instruction" 또는 "skill" 확인)
      const normalized = response.trim().toLowerCase();

      if (normalized.includes('skill')) {
        return 'skill';
      }

      // 기본값: instruction
      return 'instruction';

    } catch (error) {
      console.error('[ClaudeCodeGenerator] LLM 분류 실패, 기본값(instruction) 사용:', error);
      return 'instruction';
    }
  }
}
