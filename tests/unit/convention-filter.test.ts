/**
 * ConventionFilter 단위 테스트
 * 컨벤션이 아닌 코멘트를 필터링하는 로직 검증
 */

import { describe, it, expect } from 'vitest';
import { ConventionFilter } from '../../src/core/convention-filter';
import type { Comment } from '../../src/types';

describe('ConventionFilter', () => {
  const createComment = (content: string): Comment => ({
    id: 'test-id',
    author: 'testuser',
    content,
    htmlContent: '',
    url: 'https://github.com/test/repo/pull/1#comment-1',
    createdAt: new Date().toISOString(),
    platform: 'github'
  });

  describe('isConventionComment', () => {
    it('짧은 코멘트는 필터링해야 함 (20자 이하)', () => {
      const filter = new ConventionFilter();
      const comment = createComment('Short text');

      expect(filter.isConventionComment(comment)).toBe(false);
    });

    it('단순 질문은 필터링해야 함', () => {
      const filter = new ConventionFilter();
      const questions = [
        createComment('Why?'),
        createComment('How does this work?'),
        createComment('What is this?'),
        createComment('이거 왜 이렇게 했어요?'),
        createComment('Can you explain?')
      ];

      for (const q of questions) {
        expect(filter.isConventionComment(q)).toBe(false);
      }
    });

    it('감사 인사는 필터링해야 함', () => {
      const filter = new ConventionFilter();
      const thanks = [
        createComment('Thanks!'),
        createComment('Thank you!'),
        createComment('LGTM'),
        createComment('Looks good to me'),
        createComment('감사합니다'),
        createComment('고마워요'),
        createComment('Nice work!'),
        createComment('Great job!')
      ];

      for (const t of thanks) {
        expect(filter.isConventionComment(t)).toBe(false);
      }
    });

    it('이모지만 있는 코멘트는 필터링해야 함', () => {
      const filter = new ConventionFilter();
      const emojis = [
        createComment('👍'),
        createComment('🎉'),
        createComment('✅'),
        createComment('👍 👍'),
        createComment('🔥🔥🔥')
      ];

      for (const e of emojis) {
        expect(filter.isConventionComment(e)).toBe(false);
      }
    });

    it('일회성 버그 지적은 필터링해야 함', () => {
      const filter = new ConventionFilter();
      const bugs = [
        createComment('This line has a typo'),
        createComment('Fix the indentation here'),
        createComment('Remove console.log'),
        createComment('이 변수 이름 오타 있어요')
      ];

      for (const b of bugs) {
        expect(filter.isConventionComment(b)).toBe(false);
      }
    });

    it('컨벤션 키워드가 있으면 포함해야 함', () => {
      const filter = new ConventionFilter();
      const conventions = [
        createComment('You should always use PascalCase for React components. This is a standard convention that improves code readability.'),
        createComment('We must handle errors in all async functions to prevent unhandled promise rejections.'),
        createComment('Avoid using var keyword. Prefer const or let for variable declarations.'),
        createComment('Always add proper error handling when making API calls to handle network failures gracefully.')
      ];

      for (const c of conventions) {
        expect(filter.isConventionComment(c)).toBe(true);
      }
    });

    it('한글 명령형 표현이 있으면 포함해야 함 - P1 with 해주세요', () => {
      const filter = new ConventionFilter();
      const comment = createComment('P1: 소스 파일의 주석은 모두 한글이 아닌 영어로 작성되도록 해주세요');
      expect(filter.isConventionComment(comment)).toBe(true);
    });

    it('한글 명령형 표현이 있으면 포함해야 함 - 하세요', () => {
      const filter = new ConventionFilter();
      const comment = createComment('함수명은 camelCase를 사용하세요');
      expect(filter.isConventionComment(comment)).toBe(true);
    });

    it('한글 명령형 표현이 있으면 포함해야 함 - 합시다', () => {
      const filter = new ConventionFilter();
      const comment = createComment('모든 비동기 함수에는 에러 처리를 반드시 추가합시다');
      expect(filter.isConventionComment(comment)).toBe(true);
    });

    it('한글 명령형 표현이 있으면 포함해야 함 - P2 with 해주세요', () => {
      const filter = new ConventionFilter();
      const comment = createComment('P2: 타입 정의는 interface를 사용해주세요');
      expect(filter.isConventionComment(comment)).toBe(true);
    });

    it('코드 예시가 있으면 포함해야 함', () => {
      const filter = new ConventionFilter();
      const withCode = [
        createComment('Use arrow functions for callbacks:\n```js\nconst fn = () => {}\n```'),
        createComment('Here is the correct pattern: `const value = getValue()`'),
        createComment('You can do this:\n\n```typescript\ninterface User { name: string }\n```')
      ];

      for (const c of withCode) {
        expect(filter.isConventionComment(c)).toBe(true);
      }
    });

    it('일반적인 규칙/패턴은 포함해야 함', () => {
      const filter = new ConventionFilter();
      const patterns = [
        createComment('When writing React components, always extract reusable logic into custom hooks. This promotes code reuse and testability.'),
        createComment('Database queries should be wrapped in transactions when modifying multiple tables to maintain data consistency.'),
        createComment('API responses should follow consistent error format with status code, message, and optional details field.')
      ];

      for (const p of patterns) {
        expect(filter.isConventionComment(p)).toBe(true);
      }
    });

    it('50자 이상이지만 컨벤션이 아니면 필터링해야 함', () => {
      const filter = new ConventionFilter();
      const nonConventions = [
        createComment('I think this implementation is good but maybe we could discuss this in the next meeting to align with the team.'),
        createComment('Hmm I am not sure about this approach. What do you think? Should we try a different method or keep this one?')
      ];

      for (const n of nonConventions) {
        expect(filter.isConventionComment(n)).toBe(false);
      }
    });
  });

  describe('filterConventionComments', () => {
    it('여러 코멘트 중 컨벤션만 필터링해야 함', () => {
      const filter = new ConventionFilter();
      const comments = [
        createComment('Thanks!'), // 제외
        createComment('You should always validate user input to prevent security vulnerabilities like SQL injection.'), // 포함
        createComment('Fix typo here'), // 제외
        createComment('When handling errors, always provide meaningful error messages:\n```ts\nthrow new Error("Invalid input")\n```'), // 포함
        createComment('👍'), // 제외
      ];

      const filtered = filter.filterConventionComments(comments);

      expect(filtered.length).toBe(2);
      expect(filtered[0].content).toContain('validate user input');
      expect(filtered[1].content).toContain('handling errors');
    });

    it('모든 코멘트가 컨벤션이 아니면 빈 배열 반환', () => {
      const filter = new ConventionFilter();
      const comments = [
        createComment('Thanks!'),
        createComment('LGTM'),
        createComment('👍')
      ];

      const filtered = filter.filterConventionComments(comments);

      expect(filtered.length).toBe(0);
    });

    it('모든 코멘트가 컨벤션이면 그대로 반환', () => {
      const filter = new ConventionFilter();
      const comments = [
        createComment('Always use const for immutable values. This prevents accidental reassignment and makes code more predictable.'),
        createComment('Error handling must include proper logging for debugging:\n```js\ncatch(err) { logger.error(err) }\n```')
      ];

      const filtered = filter.filterConventionComments(comments);

      expect(filtered.length).toBe(2);
    });
  });

  describe('getFilteredCount', () => {
    it('필터링된 코멘트 수를 반환해야 함', () => {
      const filter = new ConventionFilter();
      const comments = [
        createComment('Thanks!'),
        createComment('You should use TypeScript for better type safety'),
        createComment('LGTM'),
        createComment('Always handle promise rejections')
      ];

      const filtered = filter.filterConventionComments(comments);
      const filteredCount = comments.length - filtered.length;

      expect(filteredCount).toBe(2);
      expect(filtered.length).toBe(2);
    });
  });
});
