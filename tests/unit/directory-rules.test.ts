/**
 * DirectoryRules 단위 테스트
 * 키워드/카테고리 → 디렉토리 매핑 규칙 검증
 */

import { describe, it, expect } from 'vitest';
import { DirectoryRules } from '../../src/core/directory-rules';

describe('DirectoryRules', () => {
  describe('getCategoryDirectory', () => {
    it('알려진 카테고리를 올바른 디렉토리로 매핑해야 함', () => {
      const rules = new DirectoryRules();

      expect(rules.getCategoryDirectory('api')).toBe('api');
      expect(rules.getCategoryDirectory('database')).toBe('database');
      expect(rules.getCategoryDirectory('security')).toBe('auth');
      expect(rules.getCategoryDirectory('testing')).toBe('testing');
      expect(rules.getCategoryDirectory('documentation')).toBe('docs');
      expect(rules.getCategoryDirectory('infrastructure')).toBe('infra');
      expect(rules.getCategoryDirectory('architecture')).toBe('architecture');
      expect(rules.getCategoryDirectory('performance')).toBe('performance');
      expect(rules.getCategoryDirectory('error')).toBe('error-handling');
      expect(rules.getCategoryDirectory('config')).toBe('config');
    });

    it('동의어 카테고리도 올바르게 매핑해야 함', () => {
      const rules = new DirectoryRules();

      expect(rules.getCategoryDirectory('frontend')).toBe('ui');
      expect(rules.getCategoryDirectory('backend')).toBe('api');
      expect(rules.getCategoryDirectory('db')).toBe('database');
      expect(rules.getCategoryDirectory('authentication')).toBe('auth');
      expect(rules.getCategoryDirectory('authorization')).toBe('auth');
      expect(rules.getCategoryDirectory('test')).toBe('testing');
      expect(rules.getCategoryDirectory('devops')).toBe('infra');
      expect(rules.getCategoryDirectory('deployment')).toBe('infra');
      expect(rules.getCategoryDirectory('design')).toBe('architecture');
      expect(rules.getCategoryDirectory('optimization')).toBe('performance');
      expect(rules.getCategoryDirectory('logging')).toBe('error-handling');
      expect(rules.getCategoryDirectory('configuration')).toBe('config');
    });

    it('루트 매핑 카테고리(convention, general)는 null 반환', () => {
      const rules = new DirectoryRules();

      expect(rules.getCategoryDirectory('convention')).toBeNull();
      expect(rules.getCategoryDirectory('general')).toBeNull();
    });

    it('알 수 없는 카테고리는 null 반환', () => {
      const rules = new DirectoryRules();

      expect(rules.getCategoryDirectory('unknown')).toBeNull();
      expect(rules.getCategoryDirectory('random')).toBeNull();
    });

    it('대소문자와 공백을 정규화해야 함', () => {
      const rules = new DirectoryRules();

      expect(rules.getCategoryDirectory('API')).toBe('api');
      expect(rules.getCategoryDirectory(' testing ')).toBe('testing');
      expect(rules.getCategoryDirectory('SECURITY')).toBe('auth');
    });
  });

  describe('matchKeywordsToDirectory', () => {
    it('API 관련 키워드를 api 디렉토리로 매핑해야 함', () => {
      const rules = new DirectoryRules();

      const result = rules.matchKeywordsToDirectory(['rest', 'endpoint', 'http']);
      expect(result).not.toBeNull();
      expect(result!.directory).toBe('api');
      expect(result!.matchedKeywords.length).toBeGreaterThan(0);
    });

    it('UI 관련 키워드를 ui 디렉토리로 매핑해야 함', () => {
      const rules = new DirectoryRules();

      const result = rules.matchKeywordsToDirectory(['component', 'react', 'style']);
      expect(result).not.toBeNull();
      expect(result!.directory).toBe('ui');
    });

    it('테스팅 관련 키워드를 testing 디렉토리로 매핑해야 함', () => {
      const rules = new DirectoryRules();

      const result = rules.matchKeywordsToDirectory(['jest', 'mock', 'assertion']);
      expect(result).not.toBeNull();
      expect(result!.directory).toBe('testing');
    });

    it('빈 키워드 배열은 null 반환', () => {
      const rules = new DirectoryRules();

      expect(rules.matchKeywordsToDirectory([])).toBeNull();
    });

    it('매칭 없는 키워드는 null 반환', () => {
      const rules = new DirectoryRules();

      expect(rules.matchKeywordsToDirectory(['xyz', 'abc'])).toBeNull();
    });

    it('부분 매칭도 인식해야 함', () => {
      const rules = new DirectoryRules();

      // 'authentication'은 'auth' 규칙의 키워드와 부분 일치
      const result = rules.matchKeywordsToDirectory(['authentication']);
      expect(result).not.toBeNull();
      expect(result!.directory).toBe('auth');
    });

    it('가장 높은 점수의 디렉토리를 반환해야 함', () => {
      const rules = new DirectoryRules();

      // 'test', 'mock' → testing에 2개 매칭
      const result = rules.matchKeywordsToDirectory(['test', 'mock', 'unrelated']);
      expect(result).not.toBeNull();
      expect(result!.directory).toBe('testing');
      expect(result!.score).toBeGreaterThan(0);
    });
  });

  describe('getAllMatchingDirectories', () => {
    it('여러 디렉토리 후보를 점수 순으로 반환해야 함', () => {
      const rules = new DirectoryRules();

      // 'error', 'logging' → error-handling에 매칭
      const results = rules.getAllMatchingDirectories(['error', 'logging', 'monitoring']);
      expect(results.length).toBeGreaterThan(0);
      // 첫 번째가 가장 높은 점수
      if (results.length > 1) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });

    it('topN 제한이 적용되어야 함', () => {
      const rules = new DirectoryRules();

      const results = rules.getAllMatchingDirectories(['api', 'test', 'error'], 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('빈 키워드는 빈 배열 반환', () => {
      const rules = new DirectoryRules();

      expect(rules.getAllMatchingDirectories([])).toEqual([]);
    });
  });

  describe('addCustomRule / addCategoryMapping', () => {
    it('커스텀 규칙을 추가하고 매칭할 수 있어야 함', () => {
      const rules = new DirectoryRules();

      rules.addCustomRule('ml', ['machine-learning', 'ai', 'model', 'training']);

      const result = rules.matchKeywordsToDirectory(['machine-learning', 'model']);
      expect(result).not.toBeNull();
      expect(result!.directory).toBe('ml');
    });

    it('커스텀 카테고리 매핑을 추가할 수 있어야 함', () => {
      const rules = new DirectoryRules();

      rules.addCategoryMapping('machine-learning', 'ml');

      expect(rules.getCategoryDirectory('machine-learning')).toBe('ml');
    });
  });

  describe('getRules / getCategoryMappings', () => {
    it('모든 규칙을 반환해야 함', () => {
      const rules = new DirectoryRules();
      const allRules = rules.getRules();

      expect(Object.keys(allRules).length).toBeGreaterThan(0);
      expect(allRules).toHaveProperty('api');
      expect(allRules).toHaveProperty('testing');
    });

    it('모든 카테고리 매핑을 반환해야 함', () => {
      const rules = new DirectoryRules();
      const mappings = rules.getCategoryMappings();

      expect(Object.keys(mappings).length).toBeGreaterThan(0);
      expect(mappings).toHaveProperty('api');
      expect(mappings).toHaveProperty('convention');
    });

    it('반환된 객체는 원본의 복사본이어야 함 (불변성)', () => {
      const rules = new DirectoryRules();
      const allRules = rules.getRules();

      // 복사본 수정해도 원본에 영향 없어야 함
      allRules['new-dir'] = ['test'];
      const allRules2 = rules.getRules();
      expect(allRules2).not.toHaveProperty('new-dir');
    });
  });
});
