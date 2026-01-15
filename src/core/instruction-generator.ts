/**
 * Review to Instruction - Instruction Generator
 * Claude Code instruction 파일 생성
 */

import type { ParsedComment, Comment, Repository } from '../types';
import { summarizeComment } from './parser';

export interface InstructionOptions {
  parsedComment: ParsedComment;
  originalComment: Comment;
  repository: Repository;
  existingContent?: string;
}

/**
 * Claude Code instruction 파일 생성
 */
export function generateInstruction(options: InstructionOptions): string {
  const { existingContent } = options;

  // 기존 파일이 있으면 업데이트, 없으면 새로 생성
  if (existingContent) {
    return updateInstruction(options, existingContent);
  } else {
    return createInstruction(options);
  }
}

/**
 * 새 instruction 파일 생성
 */
function createInstruction(options: InstructionOptions): string {
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

  // 주석 추가 (새 범주인 경우)
  const note = generateNote(parsedComment);

  // Markdown 본문
  const body = [
    note ? `${note}\n` : '',
    `# ${title}`,
    '',
    '## 규칙',
    summarizeComment(originalComment.content),
    ''
  ];

  // 코드 예시 추가
  if (parsedComment.codeExamples.length > 0) {
    body.push('## 예시\n');
    parsedComment.codeExamples.forEach((example, index) => {
      if (parsedComment.codeExamples.length > 1) {
        body.push(`### 예시 ${index + 1}\n`);
      }
      body.push('```');
      body.push(example);
      body.push('```\n');
    });
  }

  // 출처
  body.push('## 출처');
  body.push(`이 컨벤션은 [PR #${repository.prNumber}](${originalComment.url})의 리뷰 과정에서 확립되었습니다.`);
  body.push(`- 작성자: ${originalComment.author}`);
  body.push(`- 작성일: ${new Date(originalComment.createdAt).toLocaleDateString('ko-KR')}`);

  return frontmatter + body.join('\n') + '\n';
}

/**
 * 기존 instruction 파일 업데이트
 */
function updateInstruction(options: InstructionOptions, existingContent: string): string {
  const { parsedComment, originalComment, repository } = options;

  // 기존 frontmatter 업데이트
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = existingContent.match(frontmatterRegex);

  if (!match) {
    // frontmatter가 없으면 새로 생성
    return createInstruction(options);
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
    `## 업데이트 (${date})`,
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
    return `${mainKeyword} ${category}`;
  }

  return category;
}

/**
 * 주석 생성 (새 범주인 경우)
 */
function generateNote(parsedComment: ParsedComment): string {
  // 특정 카테고리에 대한 주석
  const categoryNotes: Record<string, string> = {
    'security': '<!-- NOTE: 이 규칙은 보안 관련 중요 사항입니다. 반드시 준수해야 합니다. -->',
    'performance': '<!-- NOTE: 이 규칙은 성능 최적화를 위한 권장사항입니다. -->',
    'architecture': '<!-- NOTE: 이 규칙은 아키텍처 설계 원칙입니다. 프로젝트 전반에 적용됩니다. -->'
  };

  return categoryNotes[parsedComment.category] || '';
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
