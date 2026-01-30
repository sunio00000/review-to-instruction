/**
 * Review to Instruction - Generator Factory
 * 프로젝트 타입에 따라 적절한 Generator 생성
 */

import type { ProjectType } from '../../types';
import type { BaseGenerator } from './base-generator';
import { ClaudeCodeGenerator } from './claude-code-generator';
import { CursorGenerator } from './cursor-generator';
import { WindsurfGenerator } from './windsurf-generator';
import { CodexGenerator } from './codex-generator';

/**
 * Generator Factory
 * - ProjectType 배열을 받아 해당하는 Generator 인스턴스 배열 생성
 */
export class GeneratorFactory {
  /**
   * 여러 프로젝트 타입에 대한 Generator 생성
   */
  static createGenerators(detectedTypes: ProjectType[]): Map<ProjectType, BaseGenerator> {
    const generators = new Map<ProjectType, BaseGenerator>();

    for (const type of detectedTypes) {
      const generator = this.createGenerator(type);
      if (generator) {
        generators.set(type, generator);
      }
    }

    return generators;
  }

  /**
   * 단일 프로젝트 타입에 대한 Generator 생성
   */
  private static createGenerator(type: ProjectType): BaseGenerator | null {
    switch (type) {
      case 'claude-code':
        return new ClaudeCodeGenerator();
      case 'cursor':
        return new CursorGenerator();
      case 'windsurf':
        return new WindsurfGenerator();
      case 'codex':
        return new CodexGenerator();
      default:
        return null;
    }
  }
}
