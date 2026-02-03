/**
 * FileMerger 단위 테스트
 * 중복 파일 감지 및 병합 로직 검증
 */

import { describe, it, expect } from 'vitest';
import { FileMerger } from '../../src/core/file-merger';
import type { FileGenerationResult } from '../../src/types';

describe('FileMerger', () => {
  describe('detectDuplicates', () => {
    it('중복 파일 경로를 감지해야 함', () => {
      const files: FileGenerationResult[] = [
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/naming-conventions.md',
          content: 'Content A',
          isUpdate: false
        },
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/error-handling.md',
          content: 'Content B',
          isUpdate: false
        },
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/naming-conventions.md',
          content: 'Content C',
          isUpdate: false
        }
      ];

      const merger = new FileMerger();
      const duplicates = merger.detectDuplicates(files);

      expect(duplicates.size).toBe(1);
      expect(duplicates.has('.claude/rules/naming-conventions.md')).toBe(true);
      expect(duplicates.get('.claude/rules/naming-conventions.md')?.length).toBe(2);
    });

    it('중복이 없으면 빈 Map을 반환해야 함', () => {
      const files: FileGenerationResult[] = [
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/naming-conventions.md',
          content: 'Content A',
          isUpdate: false
        },
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/error-handling.md',
          content: 'Content B',
          isUpdate: false
        }
      ];

      const merger = new FileMerger();
      const duplicates = merger.detectDuplicates(files);

      expect(duplicates.size).toBe(0);
    });
  });

  describe('mergeFiles', () => {
    it('중복 파일을 하나로 병합해야 함', () => {
      const files: FileGenerationResult[] = [
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/naming-conventions.md',
          content: '# Naming Conventions\n\n## Rule 1\nUse PascalCase',
          isUpdate: false
        },
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/naming-conventions.md',
          content: '# Naming Conventions\n\n## Rule 2\nUse kebab-case',
          isUpdate: false
        }
      ];

      const merger = new FileMerger();
      const merged = merger.mergeFiles(files);

      expect(merged.length).toBe(1);
      expect(merged[0].filePath).toBe('.claude/rules/naming-conventions.md');
      expect(merged[0].content).toContain('Rule 1');
      expect(merged[0].content).toContain('Rule 2');
      expect(merged[0].content).toContain('PascalCase');
      expect(merged[0].content).toContain('kebab-case');
    });

    it('다른 경로의 파일은 그대로 유지해야 함', () => {
      const files: FileGenerationResult[] = [
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/naming-conventions.md',
          content: 'Content A',
          isUpdate: false
        },
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/error-handling.md',
          content: 'Content B',
          isUpdate: false
        }
      ];

      const merger = new FileMerger();
      const merged = merger.mergeFiles(files);

      expect(merged.length).toBe(2);
      expect(merged.map(f => f.filePath)).toContain('.claude/rules/naming-conventions.md');
      expect(merged.map(f => f.filePath)).toContain('.claude/rules/error-handling.md');
    });

    it('3개 이상의 중복 파일도 병합해야 함', () => {
      const files: FileGenerationResult[] = [
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/testing.md',
          content: '# Testing\n\n## Rule 1\nWrite unit tests',
          isUpdate: false
        },
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/testing.md',
          content: '# Testing\n\n## Rule 2\nWrite integration tests',
          isUpdate: false
        },
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/testing.md',
          content: '# Testing\n\n## Rule 3\nWrite E2E tests',
          isUpdate: false
        }
      ];

      const merger = new FileMerger();
      const merged = merger.mergeFiles(files);

      expect(merged.length).toBe(1);
      expect(merged[0].content).toContain('Rule 1');
      expect(merged[0].content).toContain('Rule 2');
      expect(merged[0].content).toContain('Rule 3');
    });
  });

  describe('mergeMarkdownContent', () => {
    it('제목은 첫 번째 파일의 것을 사용해야 함', () => {
      const contents = [
        '# Naming Conventions\n\n## Rule 1\nContent A',
        '# Naming Rules\n\n## Rule 2\nContent B'
      ];

      const merger = new FileMerger();
      const merged = merger.mergeMarkdownContent(contents);

      expect(merged).toMatch(/^# Naming Conventions/);
      expect(merged).not.toMatch(/# Naming Rules/);
    });

    it('본문 섹션들을 모두 포함해야 함', () => {
      const contents = [
        '# Title\n\n## Section 1\nContent A\n\n## Section 2\nContent B',
        '# Title\n\n## Section 3\nContent C'
      ];

      const merger = new FileMerger();
      const merged = merger.mergeMarkdownContent(contents);

      expect(merged).toContain('Section 1');
      expect(merged).toContain('Section 2');
      expect(merged).toContain('Section 3');
      expect(merged).toContain('Content A');
      expect(merged).toContain('Content B');
      expect(merged).toContain('Content C');
    });

    it('중복 섹션은 제거해야 함', () => {
      const contents = [
        '# Title\n\n## Examples\n```ts\nconst a = 1;\n```',
        '# Title\n\n## Examples\n```ts\nconst b = 2;\n```'
      ];

      const merger = new FileMerger();
      const merged = merger.mergeMarkdownContent(contents);

      // Examples 섹션이 한 번만 나타나야 함 (제목으로)
      const examplesCount = (merged.match(/## Examples/g) || []).length;
      expect(examplesCount).toBe(1);

      // 두 코드 블록 내용은 모두 포함되어야 함
      expect(merged).toContain('const a = 1');
      expect(merged).toContain('const b = 2');
    });

    it('메타데이터 섹션을 병합해야 함', () => {
      const contents = [
        '# Title\n\n## Metadata\n- Category: naming\n- Keywords: PascalCase\n\n## Content\nRule 1',
        '# Title\n\n## Metadata\n- Category: naming\n- Keywords: kebab-case\n\n## Content\nRule 2'
      ];

      const merger = new FileMerger();
      const merged = merger.mergeMarkdownContent(contents);

      expect(merged).toContain('PascalCase');
      expect(merged).toContain('kebab-case');
    });

    it('빈 내용을 처리해야 함', () => {
      const contents = [
        '# Title\n\n## Section 1\nContent',
        '',
        '# Title\n\n## Section 2\nContent'
      ];

      const merger = new FileMerger();
      const merged = merger.mergeMarkdownContent(contents);

      expect(merged).toContain('Section 1');
      expect(merged).toContain('Section 2');
    });
  });

  describe('isUpdate 플래그 처리', () => {
    it('병합된 파일의 isUpdate는 하나라도 true면 true여야 함', () => {
      const files: FileGenerationResult[] = [
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/naming.md',
          content: 'Content A',
          isUpdate: false
        },
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/naming.md',
          content: 'Content B',
          isUpdate: true
        }
      ];

      const merger = new FileMerger();
      const merged = merger.mergeFiles(files);

      expect(merged[0].isUpdate).toBe(true);
    });

    it('모든 파일이 isUpdate false면 병합 파일도 false여야 함', () => {
      const files: FileGenerationResult[] = [
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/naming.md',
          content: 'Content A',
          isUpdate: false
        },
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/naming.md',
          content: 'Content B',
          isUpdate: false
        }
      ];

      const merger = new FileMerger();
      const merged = merger.mergeFiles(files);

      expect(merged[0].isUpdate).toBe(false);
    });
  });

  describe('프로젝트 타입 처리', () => {
    it('같은 경로지만 다른 프로젝트 타입은 별도로 처리해야 함', () => {
      const files: FileGenerationResult[] = [
        {
          projectType: 'claude-code',
          filePath: '.claude/rules/naming.md',
          content: 'Content A',
          isUpdate: false
        },
        {
          projectType: 'cursor',
          filePath: '.cursor/rules/naming.md',
          content: 'Content B',
          isUpdate: false
        }
      ];

      const merger = new FileMerger();
      const merged = merger.mergeFiles(files);

      // 경로가 다르므로 병합되지 않아야 함
      expect(merged.length).toBe(2);
    });
  });
});
