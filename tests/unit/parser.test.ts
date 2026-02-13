/**
 * Parser 단위 테스트
 * 키워드 추출, 카테고리 분류, 코드 예시 추출, 파일명 생성 검증
 */

import { describe, it, expect } from 'vitest';
import { parseComment, isConventionComment, summarizeComment } from '../../src/core/parser';

describe('parseComment', () => {
  it('컨벤션 키워드가 포함된 코멘트에서 키워드를 추출해야 함', () => {
    const result = parseComment('You should always use PascalCase for React components');

    expect(result.keywords.length).toBeGreaterThan(0);
    expect(result.content).toBe('You should always use PascalCase for React components');
  });

  it('카테고리를 올바르게 분류해야 함 - naming', () => {
    const result = parseComment('Always use camelCase for variable naming conventions');

    expect(result.category).toBe('naming');
  });

  it('카테고리를 올바르게 분류해야 함 - testing', () => {
    const result = parseComment('You should write unit tests for all new functions using jest');

    expect(result.category).toBe('testing');
  });

  it('카테고리를 올바르게 분류해야 함 - error-handling', () => {
    const result = parseComment('Always use try-catch for error handling in async functions');

    expect(result.category).toBe('error-handling');
  });

  it('카테고리를 올바르게 분류해야 함 - security', () => {
    const result = parseComment('You must sanitize user input to prevent XSS and SQL injection vulnerabilities');

    expect(result.category).toBe('security');
  });

  it('카테고리를 올바르게 분류해야 함 - performance', () => {
    const result = parseComment('Use memoize and caching to optimize performance of expensive operations');

    expect(result.category).toBe('performance');
  });

  it('카테고리를 올바르게 분류해야 함 - architecture', () => {
    const result = parseComment('Follow SOLID principles and separation of concerns in architecture design');

    expect(result.category).toBe('architecture');
  });

  it('카테고리를 올바르게 분류해야 함 - api', () => {
    const result = parseComment('REST API endpoints should follow RESTful conventions with proper HTTP methods and status codes');

    expect(result.category).toBe('api');
  });

  it('코드 블록 예시를 추출해야 함', () => {
    const content = 'Use arrow functions:\n```js\nconst fn = () => {}\n```\nThis is better.';
    const result = parseComment(content);

    expect(result.codeExamples.length).toBeGreaterThan(0);
    expect(result.codeExamples[0]).toContain('const fn');
  });

  it('인라인 코드 예시를 추출해야 함', () => {
    const content = 'You should use `const value = getValue()` instead of `var value = getValue()`';
    const result = parseComment(content);

    expect(result.codeExamples.length).toBeGreaterThan(0);
  });

  it('파일명을 생성해야 함', () => {
    const result = parseComment('Always use PascalCase naming for React components');

    expect(result.suggestedFileName).toBeTruthy();
    expect(result.suggestedFileName).not.toContain(' ');
  });

  it('컨벤션 키워드가 없으면 키워드 빈 배열 반환', () => {
    const result = parseComment('hello world this is a normal comment');

    expect(result.keywords).toEqual([]);
  });

  it('여러 코드 블록을 모두 추출해야 함', () => {
    const content = 'Bad:\n```js\nvar x = 1;\n```\nGood:\n```js\nconst x = 1;\n```';
    const result = parseComment(content);

    expect(result.codeExamples.length).toBe(2);
  });

  it('한글 컨벤션 키워드도 인식해야 함', () => {
    const result = parseComment('컴포넌트 네이밍 컨벤션은 PascalCase 규칙을 따라야 합니다');

    expect(result.keywords.length).toBeGreaterThan(0);
    expect(result.category).toBe('naming');
  });

  it('기술 키워드(프레임워크, 언어)를 추출해야 함', () => {
    const result = parseComment('You should use TypeScript with React for better type safety');

    expect(result.keywords).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/typescript|react/)
      ])
    );
  });

  it('camelCase/PascalCase 식별자를 중요 키워드로 추출해야 함', () => {
    const result = parseComment('Always use PascalCase for component names and camelCase for functions');

    const lowerKeywords = result.keywords.map(k => k.toLowerCase());
    expect(lowerKeywords).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/pascalcase|camelcase/)
      ])
    );
  });

  it('파일명이 카테고리 수준으로 추상화되어야 함', () => {
    const result = parseComment('You should always use PascalCase for React component naming conventions');

    // 파일명에 과도하게 구체적인 키워드가 포함되지 않아야 함
    expect(result.suggestedFileName).not.toContain('pascalcase');
    expect(result.suggestedFileName).not.toContain('react');
  });
});

describe('isConventionComment', () => {
  it('50자 이상이면 무조건 true 반환', () => {
    const longContent = 'This is a very long comment that exceeds fifty characters for sure and should pass.';
    expect(isConventionComment(longContent)).toBe(true);
  });

  it('50자 미만이라도 컨벤션 키워드가 있으면 true 반환', () => {
    expect(isConventionComment('you should use const')).toBe(true);
    expect(isConventionComment('must validate input')).toBe(true);
    expect(isConventionComment('avoid using var')).toBe(true);
    expect(isConventionComment('always prefer const')).toBe(true);
  });

  it('코드 예시가 있으면 true 반환', () => {
    expect(isConventionComment('use `const x = 1`')).toBe(true);
    expect(isConventionComment('```\ncode\n```')).toBe(true);
  });

  it('이모지 패턴이 있으면 true 반환', () => {
    expect(isConventionComment('✅ good')).toBe(true);
    expect(isConventionComment('❌ bad')).toBe(true);
  });

  it('아무 조건도 만족하지 않으면 false 반환', () => {
    expect(isConventionComment('hello')).toBe(false);
    expect(isConventionComment('ok fine')).toBe(false);
  });

  it('우선순위 태그(P1~P4)가 있으면 true 반환', () => {
    expect(isConventionComment('P1: fix this')).toBe(true);
    expect(isConventionComment('p2: update')).toBe(true);
  });

  it('한글 컨벤션 키워드도 인식해야 함', () => {
    expect(isConventionComment('컨벤션을 따르세요')).toBe(true);
    expect(isConventionComment('패턴을 사용하세요')).toBe(true);
  });
});

describe('summarizeComment', () => {
  it('첫 문장을 추출해야 함', () => {
    const content = 'Always use const. It prevents bugs. Here is why.';
    const summary = summarizeComment(content);

    expect(summary).toBe('Always use const.');
  });

  it('코드 블록을 제거하고 요약해야 함', () => {
    const content = '```js\nconst x = 1;\n```\nUse const for immutability.';
    const summary = summarizeComment(content);

    expect(summary).not.toContain('```');
    expect(summary).toContain('const');
  });

  it('인라인 코드를 제거하고 요약해야 함', () => {
    const content = 'Use `const` instead of `var` for variable declarations.';
    const summary = summarizeComment(content);

    expect(summary).not.toContain('`');
  });

  it('50자 이상이면 잘라야 함', () => {
    const content = 'This is a very long comment without any punctuation so it should be truncated at some reasonable point for readability';
    const summary = summarizeComment(content);

    expect(summary.length).toBeLessThanOrEqual(55); // 50 + "..."
  });

  it('빈 문자열 처리', () => {
    const summary = summarizeComment('');
    expect(summary).toBe('');
  });

  it('코드 블록만 있는 경우', () => {
    const content = '```js\nconst x = 1;\n```';
    const summary = summarizeComment(content);

    expect(summary).toBeDefined();
  });
});
