/**
 * FileMatcher 단위 테스트
 * 파일 경로 생성 순수 함수 검증
 */

import { describe, it, expect } from 'vitest';
import { generateFilePath } from '../../src/core/file-matcher';

describe('generateFilePath', () => {
  it('skill 파일은 .claude/skills/ 경로를 반환해야 함', () => {
    const path = generateFilePath(true, 'my-skill');

    expect(path).toBe('.claude/skills/my-skill.md');
  });

  it('instruction 파일은 .claude/rules/ 경로를 반환해야 함', () => {
    const path = generateFilePath(false, 'naming-conventions');

    expect(path).toBe('.claude/rules/naming-conventions.md');
  });

  it('.md 확장자가 이미 있으면 중복 추가하지 않아야 함', () => {
    const path = generateFilePath(false, 'test-file.md');

    expect(path).toBe('.claude/rules/test-file.md');
    expect(path).not.toContain('.md.md');
  });

  it('.md 확장자가 없으면 자동 추가해야 함', () => {
    const path = generateFilePath(true, 'my-skill-name');

    expect(path).toBe('.claude/skills/my-skill-name.md');
  });
});
