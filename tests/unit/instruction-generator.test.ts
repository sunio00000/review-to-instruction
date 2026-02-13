/**
 * InstructionGenerator 단위 테스트
 * Claude Code instruction 파일 생성 로직 검증
 */

import { describe, it, expect } from 'vitest';
import { generateInstruction } from '../../src/core/instruction-generator';
import type { ParsedComment, EnhancedComment, Comment, Repository } from '../../src/types';

const createComment = (content: string, overrides?: Partial<Comment>): Comment => ({
  id: 'test-id',
  author: 'reviewer1',
  content,
  htmlContent: '',
  url: 'https://github.com/test/repo/pull/42#comment-1',
  createdAt: '2025-02-13T00:00:00Z',
  platform: 'github',
  ...overrides
});

const createRepository = (overrides?: Partial<Repository>): Repository => ({
  owner: 'test',
  name: 'repo',
  branch: 'feature-branch',
  baseBranch: 'main',
  prNumber: 42,
  platform: 'github',
  ...overrides
});

const createParsedComment = (overrides?: Partial<ParsedComment>): ParsedComment => ({
  content: 'You should always use PascalCase for React components',
  keywords: ['PascalCase', 'naming'],
  category: 'naming',
  codeExamples: [],
  suggestedFileName: 'naming-conventions.md',
  ...overrides
});

describe('generateInstruction', () => {
  describe('새 instruction 생성', () => {
    it('YAML frontmatter에 source 정보가 구조화되어야 함', () => {
      const result = generateInstruction({
        parsedComment: createParsedComment(),
        originalComment: createComment('You should always use PascalCase for components'),
        repository: createRepository()
      });

      // YAML frontmatter 확인
      expect(result).toMatch(/^---\n/);
      expect(result).toContain('source:');
      expect(result).toContain('pr: 42');
      expect(result).toContain('author: "reviewer1"');
      expect(result).toContain('category: naming');
      expect(result).toContain('keywords:');
    });

    it('본문에 메타데이터 footer가 없어야 함', () => {
      const result = generateInstruction({
        parsedComment: createParsedComment(),
        originalComment: createComment('You should always use PascalCase for components'),
        repository: createRepository()
      });

      // 이전 형태의 footer가 없어야 함
      expect(result).not.toContain('**Source:**');
      expect(result).not.toContain('**Keywords:**');
      expect(result).not.toContain('**Category:**');
    });

    it('제목이 올바르게 생성되어야 함', () => {
      const result = generateInstruction({
        parsedComment: createParsedComment({ keywords: ['PascalCase'], category: 'naming' }),
        originalComment: createComment('content'),
        repository: createRepository()
      });

      // generateTitle: keyword 'PascalCase' + category 'Naming'
      expect(result).toContain('# PascalCase Naming');
    });

    it('Rules 섹션이 포함되어야 함', () => {
      const result = generateInstruction({
        parsedComment: createParsedComment(),
        originalComment: createComment('You should always use PascalCase'),
        repository: createRepository()
      });

      expect(result).toContain('## Rules');
    });

    it('코드 예시가 있으면 Examples 섹션이 포함되어야 함', () => {
      const result = generateInstruction({
        parsedComment: createParsedComment({
          codeExamples: ['const Foo = () => {}']
        }),
        originalComment: createComment('content'),
        repository: createRepository()
      });

      expect(result).toContain('## Examples');
      expect(result).toContain('const Foo = () => {}');
    });

    it('코드 예시가 없으면 Examples 섹션이 없어야 함', () => {
      const result = generateInstruction({
        parsedComment: createParsedComment({ codeExamples: [] }),
        originalComment: createComment('content'),
        repository: createRepository()
      });

      expect(result).not.toContain('## Examples');
    });

    it('리뷰 맥락이 제거되어야 함 (영문)', () => {
      const result = generateInstruction({
        parsedComment: createParsedComment(),
        originalComment: createComment(
          'I noticed that you should use const. Please fix the variable.'
        ),
        repository: createRepository()
      });

      // 리뷰 구문이 제거되고 규칙 내용만 남아야 함
      expect(result).not.toContain('I noticed');
      expect(result).not.toContain('Please fix');
      expect(result).toContain('const');
    });

    it('리뷰 맥락이 제거되어야 함 (한글)', () => {
      const result = generateInstruction({
        parsedComment: createParsedComment(),
        originalComment: createComment(
          '여기서는 const를 사용해야 합니다. 수정해 주세요.'
        ),
        repository: createRepository()
      });

      expect(result).not.toContain('여기서는');
      expect(result).not.toContain('수정해 주세요');
      expect(result).toContain('const를 사용해야 합니다');
    });

    it('코드 컨텍스트가 있으면 Reviewed Code 섹션 포함', () => {
      const result = generateInstruction({
        parsedComment: createParsedComment(),
        originalComment: createComment('content', {
          codeContext: {
            filePath: 'src/utils.ts',
            lines: 'const x = 1;',
            startLine: 10,
            endLine: 12
          }
        }),
        repository: createRepository()
      });

      expect(result).toContain('## Reviewed Code');
      expect(result).toContain('src/utils.ts');
      expect(result).toContain('const x = 1;');
    });
  });

  describe('LLM 강화 instruction 생성', () => {
    it('LLM detailedExplanation을 Rules에 사용해야 함', () => {
      const enhanced: EnhancedComment = {
        content: 'original content',
        keywords: ['naming'],
        category: 'naming',
        codeExamples: [],
        suggestedFileName: 'naming.md',
        llmEnhanced: true,
        summary: 'Use PascalCase',
        detailedExplanation: 'Always use PascalCase for React component names',
        codeExplanations: [],
        relatedPatterns: [],
        confidenceScore: 90
      };

      const result = generateInstruction({
        parsedComment: enhanced,
        originalComment: createComment('original'),
        repository: createRepository()
      });

      expect(result).toContain('Always use PascalCase for React component names');
    });

    it('LLM codeExplanations가 있으면 Examples에 Correct/Incorrect 표시', () => {
      const enhanced: EnhancedComment = {
        content: 'content',
        keywords: ['naming'],
        category: 'naming',
        codeExamples: ['const Foo = () => {}'],
        suggestedFileName: 'naming.md',
        llmEnhanced: true,
        summary: 'summary',
        detailedExplanation: 'explanation',
        codeExplanations: [
          { code: 'const Foo = () => {}', explanation: 'PascalCase', isGoodExample: true },
          { code: 'const foo = () => {}', explanation: 'camelCase', isGoodExample: false }
        ],
        relatedPatterns: [],
        confidenceScore: 85
      };

      const result = generateInstruction({
        parsedComment: enhanced,
        originalComment: createComment('content'),
        repository: createRepository()
      });

      expect(result).toContain('### Correct');
      expect(result).toContain('### Incorrect');
    });
  });

  describe('기존 instruction 업데이트', () => {
    it('기존 내용 뒤에 Update 섹션을 추가해야 함', () => {
      const existingContent = '# Naming\n\n## Rules\n\n- Use PascalCase\n';

      const result = generateInstruction({
        parsedComment: createParsedComment(),
        originalComment: createComment('Also use kebab-case for files'),
        repository: createRepository(),
        existingContent
      });

      expect(result).toContain('# Naming');
      expect(result).toContain('## Update');
    });

    it('업데이트에도 리뷰 맥락이 제거되어야 함', () => {
      const existingContent = '# Naming\n\n## Rules\n\n- Use PascalCase\n';

      const result = generateInstruction({
        parsedComment: createParsedComment(),
        originalComment: createComment('I noticed that camelCase should be avoided for components. Please update the naming.'),
        repository: createRepository(),
        existingContent
      });

      expect(result).not.toContain('I noticed');
      expect(result).not.toContain('Please update');
      expect(result).toContain('camelCase');
    });

    it('업데이트에 Source footer가 없어야 함', () => {
      const existingContent = '# Naming\n\n## Rules\n\n- Use PascalCase\n';

      const result = generateInstruction({
        parsedComment: createParsedComment(),
        originalComment: createComment('content'),
        repository: createRepository(),
        existingContent
      });

      expect(result).not.toContain('**Source:**');
    });
  });
});
