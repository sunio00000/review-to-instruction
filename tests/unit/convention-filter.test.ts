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

    it('30자 이상이면 불확실성 표현이 있어도 포함해야 함 (완화된 기준)', () => {
      const filter = new ConventionFilter();
      const comments = [
        createComment('I think this implementation is good but maybe we could discuss this in the next meeting to align with the team.'),
        createComment('Hmm I am not sure about this approach. What do you think? Should we try a different method or keep this one?')
      ];

      for (const c of comments) {
        expect(filter.isConventionComment(c)).toBe(true);
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

  describe('isConventionThreadComment (Thread 전용 완화 기준)', () => {
    it('10자 이상 짧은 코멘트도 컨벤션 키워드가 있으면 포함', () => {
      const filter = new ConventionFilter();
      const comments = [
        createComment('use camelCase'), // 14자, 컨벤션 키워드
        createComment('avoid var'), // 9자 - 제외 (10자 미만)
        createComment('should refactor') // 16자, 컨벤션 키워드
      ];

      expect(filter.isConventionThreadComment(comments[0])).toBe(true);
      expect(filter.isConventionThreadComment(comments[1])).toBe(false);
      expect(filter.isConventionThreadComment(comments[2])).toBe(true);
    });

    it('코드 예시가 있으면 길이 무관하게 포함', () => {
      const filter = new ConventionFilter();
      const comments = [
        createComment('`const x = 1`'), // 짧지만 코드 있음
        createComment('```js\ntest\n```') // 코드 블록
      ];

      for (const c of comments) {
        expect(filter.isConventionThreadComment(c)).toBe(true);
      }
    });

    it('우선순위 태그가 있으면 길이 무관하게 포함', () => {
      const filter = new ConventionFilter();
      const comments = [
        createComment('P1: Fix this'),
        createComment('P2: 수정 필요'),
        createComment('P3: Update'),
        createComment('P4: Change')
      ];

      for (const c of comments) {
        expect(filter.isConventionThreadComment(c)).toBe(true);
      }
    });

    it('의미 있는 질문도 포함 (20자 이상)', () => {
      const filter = new ConventionFilter();
      const questions = [
        createComment('How should we handle this case?'), // 의미 있는 질문
        createComment('Why do we need this pattern?'), // 의미 있는 질문
        createComment('이 경우에는 어떻게 해야 할까요?'), // 의미 있는 한글 질문
        createComment('What?') // 너무 짧음 - 제외
      ];

      expect(filter.isConventionThreadComment(questions[0])).toBe(true);
      expect(filter.isConventionThreadComment(questions[1])).toBe(true);
      expect(filter.isConventionThreadComment(questions[2])).toBe(true);
      expect(filter.isConventionThreadComment(questions[3])).toBe(false);
    });

    it('30자 이상이고 일반 패턴 설명하면 포함', () => {
      const filter = new ConventionFilter();
      const comment = createComment('When implementing this feature, we should consider edge cases');
      expect(filter.isConventionThreadComment(comment)).toBe(true);
    });

    it('감사 인사는 여전히 제외', () => {
      const filter = new ConventionFilter();
      const thanks = [
        createComment('Thanks for the suggestion!'),
        createComment('LGTM, great work!')
      ];

      for (const t of thanks) {
        expect(filter.isConventionThreadComment(t)).toBe(false);
      }
    });
  });

  describe('filterThreadComments', () => {
    it('Thread 논의를 적절히 필터링해야 함', () => {
      const filter = new ConventionFilter();
      const threadComments = [
        createComment('이 부분은 어떻게 해야 할까요?'), // 질문 - 포함 (20자 이상, 의미 있는 질문)
        createComment('use camelCase'), // 짧지만 컨벤션 키워드 - 포함
        createComment('네, 좋습니다'), // 너무 짧음 - 제외
        createComment('P1: 영어로 작성'), // 우선순위 태그 - 포함
        createComment('Thanks!') // 감사 인사 - 제외
      ];

      const filtered = filter.filterThreadComments(threadComments);

      expect(filtered.length).toBe(3);
      expect(filtered[0].content).toContain('어떻게');
      expect(filtered[1].content).toContain('camelCase');
      expect(filtered[2].content).toContain('P1');
    });

    it('모든 댓글이 의미 없으면 빈 배열 반환', () => {
      const filter = new ConventionFilter();
      const threadComments = [
        createComment('Thanks!'),
        createComment('LGTM'),
        createComment('👍'),
        createComment('OK') // 너무 짧음
      ];

      const filtered = filter.filterThreadComments(threadComments);
      expect(filtered.length).toBe(0);
    });
  });

  describe('isConventionComment - 커버리지 보완', () => {
    it('일회성 키워드가 3개 미만이면 필터링하지 않아야 함', () => {
      const filter = new ConventionFilter();
      // 'typo', 'fix' 2개 → 3개 미만이므로 일회성으로 판단하지 않음
      const comment = createComment('Please fix the typo in this variable naming convention');
      expect(filter.isConventionComment(comment)).toBe(true);
    });

    it('일회성 키워드가 3개 이상이면 필터링해야 함', () => {
      const filter = new ConventionFilter();
      // 'typo', 'fix', 'remove' 3개 → 일회성 판단
      const comment = createComment('fix the typo and remove this line');
      expect(filter.isConventionComment(comment)).toBe(false);
    });

    it('10자 이상 30자 미만이고 키워드 없으면 제외', () => {
      const filter = new ConventionFilter();
      const comment = createComment('hello world123');
      expect(filter.isConventionComment(comment)).toBe(false);
    });
  });

  describe('isConventionThreadComment - 커버리지 보완', () => {
    it('isGeneralPattern으로 30자 이상 일반 패턴이 포함되면 포함', () => {
      const filter = new ConventionFilter();
      // 'when' 포함, 30자 이상
      const comment = createComment('When deploying to production, all feature flags need to be reviewed first');
      expect(filter.isConventionThreadComment(comment)).toBe(true);
    });

    it('일반 패턴 키워드가 없고 30자 이상이어도 제외', () => {
      const filter = new ConventionFilter();
      // 일반화 키워드(when, if, always 등)도 없고 컨벤션 키워드도 없는 문장
      // 주의: "really"에 "all" 부분 문자열이 포함되므로 "really" 사용 회피
      const comment = createComment('The blue theme looks decent and the fonts were chosen fine for this project');
      expect(filter.isConventionThreadComment(comment)).toBe(false);
    });

    it('hasQuestionContext - 한글 질문 패턴', () => {
      const filter = new ConventionFilter();
      // 20자 이상이어야 hasQuestionContext에 도달
      const comment = createComment('이 로직은 왜 이렇게 구현했나요? 다른 방법은 없었나요?');
      expect(filter.isConventionThreadComment(comment)).toBe(true);
    });

    it('hasQuestionContext - 영문 질문 패턴', () => {
      const filter = new ConventionFilter();
      const comment = createComment('Should we consider using a different approach here?');
      // 'should' 컨벤션 키워드로 true
      expect(filter.isConventionThreadComment(comment)).toBe(true);
    });

    it('짧은 질문(20자 미만)은 제외', () => {
      const filter = new ConventionFilter();
      const comment = createComment('Why is this?');
      expect(filter.isConventionThreadComment(comment)).toBe(false);
    });

    it('이모지만 있으면 제외', () => {
      const filter = new ConventionFilter();
      const comment = createComment('🎉 🔥 ✨');
      expect(filter.isConventionThreadComment(comment)).toBe(false);
    });
  });
});
