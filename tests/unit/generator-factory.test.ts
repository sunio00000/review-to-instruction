/**
 * GeneratorFactory 단위 테스트
 * 프로젝트 타입별 Generator 생성 검증
 */

import { describe, it, expect } from 'vitest';
import { GeneratorFactory } from '../../src/core/generators/generator-factory';
import { ClaudeCodeGenerator } from '../../src/core/generators/claude-code-generator';
import { CursorGenerator } from '../../src/core/generators/cursor-generator';
import { WindsurfGenerator } from '../../src/core/generators/windsurf-generator';
import { CodexGenerator } from '../../src/core/generators/codex-generator';
import type { ProjectType } from '../../src/types';

describe('GeneratorFactory', () => {
  describe('createGenerators', () => {
    it('claude-code 타입에 대해 ClaudeCodeGenerator를 생성해야 함', () => {
      const generators = GeneratorFactory.createGenerators(['claude-code']);

      expect(generators.size).toBe(1);
      expect(generators.get('claude-code')).toBeInstanceOf(ClaudeCodeGenerator);
    });

    it('cursor 타입에 대해 CursorGenerator를 생성해야 함', () => {
      const generators = GeneratorFactory.createGenerators(['cursor']);

      expect(generators.size).toBe(1);
      expect(generators.get('cursor')).toBeInstanceOf(CursorGenerator);
    });

    it('windsurf 타입에 대해 WindsurfGenerator를 생성해야 함', () => {
      const generators = GeneratorFactory.createGenerators(['windsurf']);

      expect(generators.size).toBe(1);
      expect(generators.get('windsurf')).toBeInstanceOf(WindsurfGenerator);
    });

    it('codex 타입에 대해 CodexGenerator를 생성해야 함', () => {
      const generators = GeneratorFactory.createGenerators(['codex']);

      expect(generators.size).toBe(1);
      expect(generators.get('codex')).toBeInstanceOf(CodexGenerator);
    });

    it('여러 프로젝트 타입을 동시에 생성해야 함', () => {
      const generators = GeneratorFactory.createGenerators([
        'claude-code', 'cursor', 'windsurf', 'codex'
      ]);

      expect(generators.size).toBe(4);
      expect(generators.has('claude-code')).toBe(true);
      expect(generators.has('cursor')).toBe(true);
      expect(generators.has('windsurf')).toBe(true);
      expect(generators.has('codex')).toBe(true);
    });

    it('빈 배열에 대해 빈 Map을 반환해야 함', () => {
      const generators = GeneratorFactory.createGenerators([]);

      expect(generators.size).toBe(0);
    });

    it('알 수 없는 프로젝트 타입은 건너뛰어야 함', () => {
      const generators = GeneratorFactory.createGenerators([
        'claude-code',
        'unknown-type' as ProjectType
      ]);

      expect(generators.size).toBe(1);
      expect(generators.has('claude-code')).toBe(true);
    });
  });
});
