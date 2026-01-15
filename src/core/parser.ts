/**
 * Review to Instruction - Comment Parser
 * 코멘트 내용을 파싱하여 키워드, 카테고리, 코드 예시 추출
 */

import type { ParsedComment } from '../types';

// 컨벤션 관련 키워드
const CONVENTION_KEYWORDS = [
  'convention', 'pattern', 'rule', 'guideline', 'standard',
  'best practice', 'should', 'must', 'always', 'never',
  '컨벤션', '규칙', '패턴', '가이드라인', '표준',
  'p1', 'p2', 'p3', 'p4', 'p5'  // 우선순위 레벨
];

// 카테고리별 키워드 매핑
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'naming': ['naming', 'name', 'variable', 'function', '네이밍', '이름', '변수', '함수명'],
  'style': ['style', 'format', 'indent', 'spacing', '스타일', '포맷', '들여쓰기'],
  'architecture': ['architecture', 'structure', 'design', 'pattern', '아키텍처', '구조', '설계'],
  'testing': ['test', 'testing', 'unit test', 'e2e', '테스트', '단위 테스트'],
  'security': ['security', 'auth', 'permission', 'vulnerability', '보안', '인증', '권한'],
  'performance': ['performance', 'optimization', 'cache', 'lazy', '성능', '최적화', '캐시'],
  'documentation': ['documentation', 'comment', 'docs', 'readme', '문서', '주석'],
  'error-handling': ['error', 'exception', 'try-catch', 'handling', '에러', '예외', '처리']
};

// 프로그래밍 언어 및 프레임워크 키워드
const TECH_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c++', 'c#', 'php', 'ruby', 'swift', 'kotlin',
  'react', 'vue', 'angular', 'next.js', 'nuxt', 'svelte', 'express', 'fastify', 'nestjs',
  'spring', 'django', 'flask', 'rails', 'laravel',
  'component', 'hook', 'class', 'interface', 'type', 'enum', 'struct',
  '컴포넌트', '훅', '클래스', '인터페이스', '타입', '열거형', '구조체'
];

/**
 * 코멘트 파싱
 */
export function parseComment(content: string): ParsedComment {
  const lowercaseContent = content.toLowerCase();

  // 1. 키워드 추출
  const keywords = extractKeywords(content, lowercaseContent);

  // 2. 카테고리 분류
  const category = classifyCategory(lowercaseContent, keywords);

  // 3. 코드 예시 추출
  const codeExamples = extractCodeExamples(content);

  // 4. 파일명 제안
  const suggestedFileName = generateFileName(category, keywords);

  return {
    content,
    keywords,
    category,
    codeExamples,
    suggestedFileName
  };
}

/**
 * 키워드 추출
 */
function extractKeywords(content: string, lowercaseContent: string): string[] {
  const keywords = new Set<string>();

  // 1. 컨벤션 키워드 확인
  const hasConventionKeyword = CONVENTION_KEYWORDS.some(keyword =>
    lowercaseContent.includes(keyword.toLowerCase())
  );

  if (!hasConventionKeyword) {
    // 컨벤션 관련 키워드가 없으면 일반 코멘트로 간주
    return [];
  }

  // 2. 카테고리별 키워드 추출
  for (const [category, categoryKeywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of categoryKeywords) {
      if (lowercaseContent.includes(keyword.toLowerCase())) {
        keywords.add(category);
        keywords.add(keyword.toLowerCase());
      }
    }
  }

  // 3. 기술 스택 키워드 추출
  for (const tech of TECH_KEYWORDS) {
    if (lowercaseContent.includes(tech.toLowerCase())) {
      keywords.add(tech.toLowerCase());
    }
  }

  // 4. 파일명/경로에서 키워드 추출
  const filePathMatches = content.match(/[\w-]+\.(ts|js|tsx|jsx|py|java|go|rs)/gi);
  if (filePathMatches) {
    filePathMatches.forEach(match => {
      const fileName = match.split('.')[0];
      if (fileName && fileName.length > 2) {
        keywords.add(fileName.toLowerCase());
      }
    });
  }

  // 5. 중요 단어 추출 (CamelCase, snake_case)
  const camelCaseMatches = content.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g);
  if (camelCaseMatches) {
    camelCaseMatches.forEach(match => {
      if (match.length > 3) {
        keywords.add(match.toLowerCase());
      }
    });
  }

  return Array.from(keywords).slice(0, 10); // 최대 10개
}

/**
 * 카테고리 분류
 */
function classifyCategory(lowercaseContent: string, keywords: string[]): string {
  const categoryScores: Record<string, number> = {};

  // 1. 키워드 기반 스코어링
  for (const keyword of keywords) {
    for (const [category, categoryKeywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (categoryKeywords.some(ck => ck.toLowerCase() === keyword)) {
        categoryScores[category] = (categoryScores[category] || 0) + 2;
      }
    }
  }

  // 2. 전체 내용에서 카테고리 키워드 빈도 체크
  for (const [category, categoryKeywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of categoryKeywords) {
      const regex = new RegExp(keyword.toLowerCase(), 'g');
      const matches = lowercaseContent.match(regex);
      if (matches) {
        categoryScores[category] = (categoryScores[category] || 0) + matches.length;
      }
    }
  }

  // 3. 가장 높은 스코어의 카테고리 선택
  let maxScore = 0;
  let bestCategory = 'conventions';  // 기본값

  for (const [category, score] of Object.entries(categoryScores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

/**
 * 코드 예시 추출
 */
function extractCodeExamples(content: string): string[] {
  const codeBlocks: string[] = [];

  // 1. Markdown 코드 블록 (```)
  const markdownCodeRegex = /```[\w]*\n([\s\S]*?)```/g;
  let match;

  while ((match = markdownCodeRegex.exec(content)) !== null) {
    const code = match[1].trim();
    if (code.length > 0) {
      codeBlocks.push(code);
    }
  }

  // 2. 인라인 코드 (`)
  const inlineCodeRegex = /`([^`]+)`/g;
  const inlineCodes: string[] = [];

  while ((match = inlineCodeRegex.exec(content)) !== null) {
    const code = match[1].trim();
    // 인라인 코드가 충분히 길면 (변수명 이상) 추가
    if (code.length > 5 && !codeBlocks.some(block => block.includes(code))) {
      inlineCodes.push(code);
    }
  }

  // 인라인 코드를 하나로 합치기 (최대 3개)
  if (inlineCodes.length > 0) {
    codeBlocks.push(inlineCodes.slice(0, 3).join(', '));
  }

  return codeBlocks;
}

/**
 * 파일명 생성
 */
function generateFileName(category: string, keywords: string[]): string {
  // 카테고리를 파일명 베이스로 사용
  let baseName = category;

  // 주요 키워드 추가 (카테고리 제외, 최대 2개)
  const relevantKeywords = keywords
    .filter(k => k !== category && k.length > 2 && !k.includes(' '))
    .filter(k => !TECH_KEYWORDS.map(t => t.toLowerCase()).includes(k))  // 기술 스택 제외
    .slice(0, 2);

  if (relevantKeywords.length > 0) {
    baseName = `${relevantKeywords.join('-')}-${category}`;
  }

  // 파일명 정규화 (kebab-case)
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 컨벤션 관련 코멘트인지 확인
 */
export function isConventionComment(content: string): boolean {
  const lowercaseContent = content.toLowerCase();

  return CONVENTION_KEYWORDS.some(keyword =>
    lowercaseContent.includes(keyword.toLowerCase())
  );
}

/**
 * 코멘트 요약 생성 (첫 문장 또는 첫 50자)
 */
export function summarizeComment(content: string): string {
  // 첫 문장 추출 (마침표, 느낌표, 물음표로 구분)
  const firstSentence = content.match(/^[^.!?]+[.!?]/);
  if (firstSentence) {
    return firstSentence[0].trim();
  }

  // 또는 첫 50자
  if (content.length > 50) {
    return content.substring(0, 50) + '...';
  }

  return content.trim();
}
