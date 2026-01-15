/**
 * PR Convention Bridge - Skill Generator
 * Claude Code skill 파일 생성
 */

import type { ParsedComment, Comment, Repository } from '../types';
import { summarizeComment } from './parser';

export interface SkillOptions {
  parsedComment: ParsedComment;
  originalComment: Comment;
  repository: Repository;
  existingContent?: string;
}

/**
 * Claude Code skill 파일 생성
 */
export function generateSkill(options: SkillOptions): string {
  const { existingContent } = options;

  // 기존 파일이 있으면 업데이트, 없으면 새로 생성
  if (existingContent) {
    return updateSkill(options, existingContent);
  } else {
    return createSkill(options);
  }
}

/**
 * 새 skill 파일 생성
 */
function createSkill(options: SkillOptions): string {
  const { parsedComment, originalComment, repository } = options;

  const title = generateTitle(parsedComment);
  const date = new Date().toISOString().split('T')[0];

  // YAML frontmatter
  const frontmatter = [
    '---',
    `title: "${title}"`,
    `keywords: [${parsedComment.keywords.map(k => `"${k}"`).join(', ')}]`,
    `category: "${parsedComment.category}"`,
    `created_from: "PR #${repository.prNumber}, Comment by ${originalComment.author}"`,
    `created_at: "${date}"`,
    `last_updated: "${date}"`,
    '---',
    ''
  ].join('\n');

  // Markdown 본문
  const body = [
    `# ${title}`,
    '',
    '## 설명',
    summarizeComment(originalComment.content),
    ''
  ];

  // 올바른 예시와 잘못된 예시 구분
  if (parsedComment.codeExamples.length > 0) {
    const hasGoodBad = originalComment.content.includes('✅') ||
                       originalComment.content.includes('❌') ||
                       originalComment.content.includes('좋은') ||
                       originalComment.content.includes('나쁜');

    if (hasGoodBad) {
      body.push('## 올바른 예시\n');
      const goodExamples = extractGoodExamples(originalComment.content, parsedComment.codeExamples);
      goodExamples.forEach(example => {
        body.push('```');
        body.push(example);
        body.push('```\n');
      });

      body.push('## 잘못된 예시\n');
      const badExamples = extractBadExamples(originalComment.content, parsedComment.codeExamples);
      badExamples.forEach(example => {
        body.push('```');
        body.push(example);
        body.push('```\n');
      });
    } else {
      body.push('## 예시\n');
      parsedComment.codeExamples.forEach(example => {
        body.push('```');
        body.push(example);
        body.push('```\n');
      });
    }
  }

  // 사용 시기
  body.push('## 사용 시기');
  body.push(generateUsageGuidance(parsedComment));
  body.push('');

  // 출처
  body.push('## 출처');
  body.push(`이 스킬은 [PR #${repository.prNumber}](${originalComment.url})의 리뷰 과정에서 확립되었습니다.`);
  body.push(`- 작성자: ${originalComment.author}`);
  body.push(`- 작성일: ${new Date(originalComment.createdAt).toLocaleDateString('ko-KR')}`);

  return frontmatter + body.join('\n') + '\n';
}

/**
 * 기존 skill 파일 업데이트
 */
function updateSkill(options: SkillOptions, existingContent: string): string {
  const { parsedComment, originalComment, repository } = options;

  // 기존 frontmatter 업데이트
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = existingContent.match(frontmatterRegex);

  if (!match) {
    // frontmatter가 없으면 새로 생성
    return createSkill(options);
  }

  const date = new Date().toISOString().split('T')[0];

  // frontmatter 업데이트
  let updatedFrontmatter = match[1];

  // last_updated 업데이트
  if (updatedFrontmatter.includes('last_updated:')) {
    updatedFrontmatter = updatedFrontmatter.replace(
      /last_updated: ".*"/,
      `last_updated: "${date}"`
    );
  } else {
    updatedFrontmatter += `\nlast_updated: "${date}"`;
  }

  // 키워드 병합
  const existingKeywords = extractKeywordsFromFrontmatter(updatedFrontmatter);
  const mergedKeywords = Array.from(new Set([...existingKeywords, ...parsedComment.keywords]));
  updatedFrontmatter = updatedFrontmatter.replace(
    /keywords: \[.*\]/,
    `keywords: [${mergedKeywords.map(k => `"${k}"`).join(', ')}]`
  );

  const newFrontmatter = `---\n${updatedFrontmatter}\n---`;

  // 기존 본문에 새 내용 추가
  const existingBody = existingContent.substring(match[0].length);

  const addendum = [
    '',
    `## 추가 사례 (${date})`,
    summarizeComment(originalComment.content),
    ''
  ];

  // 코드 예시 추가
  if (parsedComment.codeExamples.length > 0) {
    addendum.push('### 예시\n');
    parsedComment.codeExamples.forEach(example => {
      addendum.push('```');
      addendum.push(example);
      addendum.push('```\n');
    });
  }

  addendum.push(`출처: [PR #${repository.prNumber}](${originalComment.url}) - ${originalComment.author}`);

  return newFrontmatter + existingBody + addendum.join('\n') + '\n';
}

/**
 * 제목 생성
 */
function generateTitle(parsedComment: ParsedComment): string {
  const category = parsedComment.category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  if (parsedComment.keywords.length > 0) {
    const mainKeyword = parsedComment.keywords[0]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return `${mainKeyword} - ${category}`;
  }

  return category;
}

/**
 * 사용 시기 가이던스 생성
 */
function generateUsageGuidance(parsedComment: ParsedComment): string {
  const categoryGuidance: Record<string, string> = {
    'naming': '변수, 함수, 클래스 등의 이름을 지을 때 이 규칙을 따르세요.',
    'style': '코드 스타일을 통일할 때 이 규칙을 적용하세요.',
    'architecture': '시스템 설계나 구조를 결정할 때 이 원칙을 고려하세요.',
    'testing': '테스트 코드를 작성할 때 이 패턴을 사용하세요.',
    'security': '보안이 중요한 코드를 작성할 때 반드시 이 규칙을 준수하세요.',
    'performance': '성능이 중요한 부분에서 이 최적화 기법을 적용하세요.',
    'error-handling': '에러 처리 로직을 구현할 때 이 패턴을 사용하세요.',
    'documentation': '코드 문서화가 필요할 때 이 형식을 따르세요.'
  };

  return categoryGuidance[parsedComment.category] || '이 스킬이 필요한 상황에서 사용하세요.';
}

/**
 * 올바른 예시 추출
 */
function extractGoodExamples(content: string, codeExamples: string[]): string[] {
  // ✅나 "좋은" 키워드 다음에 나오는 코드 블록 찾기
  const goodMarkers = ['✅', '좋은', 'good', 'correct', '올바른'];

  return codeExamples.filter((_, index) => {
    const beforeCode = content.substring(0, content.indexOf(codeExamples[index]));
    return goodMarkers.some(marker =>
      beforeCode.toLowerCase().includes(marker.toLowerCase())
    );
  });
}

/**
 * 잘못된 예시 추출
 */
function extractBadExamples(content: string, codeExamples: string[]): string[] {
  // ❌나 "나쁜" 키워드 다음에 나오는 코드 블록 찾기
  const badMarkers = ['❌', '나쁜', 'bad', 'incorrect', '잘못된'];

  return codeExamples.filter((_, index) => {
    const beforeCode = content.substring(0, content.indexOf(codeExamples[index]));
    return badMarkers.some(marker =>
      beforeCode.toLowerCase().includes(marker.toLowerCase())
    );
  });
}

/**
 * Frontmatter에서 키워드 추출
 */
function extractKeywordsFromFrontmatter(frontmatter: string): string[] {
  const keywordsMatch = frontmatter.match(/keywords: \[(.*)\]/);
  if (!keywordsMatch) return [];

  return keywordsMatch[1]
    .split(',')
    .map(k => k.trim().replace(/['"]/g, ''))
    .filter(k => k.length > 0);
}
