/**
 * Review to Instruction - Instruction Generator
 * Claude Code instruction 파일 생성
 */

import type { ParsedComment, EnhancedComment, Comment, Repository } from '../types';
import { summarizeComment } from './parser';

export interface InstructionOptions {
  parsedComment: ParsedComment | EnhancedComment; // EnhancedComment 허용
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
 * 새 instruction 파일 생성 (Official Claude Code Rules format)
 */
function createInstruction(options: InstructionOptions): string {
  const { parsedComment, originalComment, repository } = options;

  const title = generateTitle(parsedComment);

  // LLM 강화 여부 확인
  const isEnhanced = 'llmEnhanced' in parsedComment && parsedComment.llmEnhanced;
  const enhanced = isEnhanced ? (parsedComment as EnhancedComment) : null;

  // YAML frontmatter (source 정보를 구조화하여 본문에서 분리)
  const date = new Date().toISOString().split('T')[0];
  const frontmatter = [
    '---',
    `source:`,
    `  pr: ${repository.prNumber}`,
    `  url: "${originalComment.url}"`,
    `  author: "${originalComment.author}"`,
    `  date: "${date}"`,
    `category: ${parsedComment.category}`,
    `keywords: [${parsedComment.keywords.slice(0, 5).join(', ')}]`,
    '---',
    '',
    ''
  ].join('\n');

  // Markdown content
  const sections: string[] = [];

  // Title
  sections.push(`# ${title}\n`);

  // Rules section (compact, no redundant summary)
  sections.push('## Rules\n');

  if (enhanced?.detailedExplanation) {
    // LLM이 생성한 설명 사용 (이미 정제됨)
    const rules = convertToMarkdownList(enhanced.detailedExplanation);
    sections.push(rules);
  } else {
    // 원본 코멘트에서 리뷰 맥락을 제거한 규칙만 추출
    const cleanedContent = stripReviewContext(originalComment.content);
    const rules = convertToCompactList(cleanedContent);
    sections.push(rules);
  }
  sections.push('');

  // Reviewed Code section (인라인 리뷰의 코드 컨텍스트)
  if (originalComment.codeContext && originalComment.codeContext.lines) {
    const ctx = originalComment.codeContext;
    sections.push('## Reviewed Code\n');
    sections.push(`File: \`${ctx.filePath}\`${ctx.startLine ? ` (lines ${ctx.startLine}-${ctx.endLine})` : ''}\n`);
    sections.push('```');
    sections.push(ctx.lines);
    sections.push('```\n');
  }

  // Examples section
  if (parsedComment.codeExamples.length > 0) {
    sections.push('## Examples\n');

    if (enhanced?.codeExplanations && enhanced.codeExplanations.length > 0) {
      // LLM explanations available
      enhanced.codeExplanations.forEach((explanation) => {
        const label = explanation.isGoodExample !== undefined
          ? (explanation.isGoodExample ? '### Correct' : '### Incorrect')
          : '### Example';
        sections.push(`${label}\n`);
        sections.push('```');
        sections.push(explanation.code);
        sections.push('```\n');
        sections.push(explanation.explanation);
        sections.push('');
      });
    } else {
      // No LLM explanations
      parsedComment.codeExamples.forEach((example) => {
        sections.push('```');
        sections.push(example);
        sections.push('```\n');
      });
    }
  }

  return frontmatter + sections.join('\n') + '\n';
}

/**
 * 기존 instruction 파일 업데이트 (simplified)
 */
function updateInstruction(options: InstructionOptions, existingContent: string): string {
  const { parsedComment, originalComment } = options;

  const date = new Date().toISOString().split('T')[0];

  // 리뷰 맥락을 제거한 내용으로 업데이트
  const cleanedContent = stripReviewContext(originalComment.content);

  // Add new section at the end
  const addendum: string[] = [
    '',
    '',
    `## Update (${date})`,
    '',
    convertToMarkdownList(cleanedContent),
    ''
  ];

  // Add code examples if present
  if (parsedComment.codeExamples.length > 0) {
    addendum.push('### Examples\n');
    parsedComment.codeExamples.forEach(example => {
      addendum.push('```');
      addendum.push(example);
      addendum.push('```\n');
    });
  }

  return existingContent.trim() + addendum.join('\n') + '\n';
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
 * 텍스트를 Markdown 리스트로 변환
 */
function convertToMarkdownList(text: string): string {
  // If already in bullet format, return as is
  if (text.trim().startsWith('-') || text.trim().startsWith('*')) {
    return text;
  }

  // Split by paragraphs or sentences
  const lines = text.split(/\n+/).filter(line => line.trim().length > 0);

  // Convert to bullet points
  return lines.map(line => `- ${line.trim()}`).join('\n');
}

/**
 * 리뷰 코멘트에서 리뷰 특정 맥락(구문)만 제거하여 범용 규칙으로 변환
 * - "여기서는", "이 코드에서", "please fix this" 등의 리뷰 맥락 구문만 제거
 * - 코드 블록은 보존, 규칙/지시 내용은 유지
 */
function stripReviewContext(content: string): string {
  // 코드 블록 보존을 위해 임시 치환
  const codeBlocks: string[] = [];
  let processed = content.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // 리뷰 특정 구문만 제거 (문장 전체가 아닌 구문만)
  const reviewPhrases = [
    /\bI noticed\s*(that\s*)?/gi,
    /\bI see\s*(that\s*)?/gi,
    /\bI think you\s*/gi,
    /\bI found\s*(that\s*)?/gi,
    /\blooking at\s*(this[,]?\s*)?/gi,
    /\bplease fix\s*/gi,
    /\bplease change\s*/gi,
    /\bplease update\s*/gi,
    /\bcan you\s*/gi,
    /\bcould you\s*/gi,
    /\bwould you\s*/gi,
    /\bin this PR\b/gi,
    /\bin this MR\b/gi,
    /\bin this file\b/gi,
    /\bthis line\b/gi,
    /\bnit:\s*/gi,
    /\bnitpick:\s*/gi,
  ];

  // 한글 리뷰 구문 제거
  const reviewPhrasesKr = [
    /여기서는\s*/g,
    /이 코드에서\s*/g,
    /이 부분에서\s*/g,
    /이 파일에서\s*/g,
    /이 PR에서\s*/g,
    /이 MR에서\s*/g,
    /수정해 ?주세요\.?/g,
    /변경해 ?주세요\.?/g,
    /고쳐 ?주세요\.?/g,
    /바꿔 ?주세요\.?/g,
    /보니까\s*/g,
    /봤는데\s*/g,
    /확인해 보면\s*/g,
    /살펴보면\s*/g,
  ];

  for (const pattern of [...reviewPhrases, ...reviewPhrasesKr]) {
    processed = processed.replace(pattern, '');
  }

  // 빈 문장("." 만 남은 경우) 제거 및 다중 공백 정리
  processed = processed
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 코드 블록 복원
  processed = processed.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
    return codeBlocks[parseInt(index, 10)];
  });

  // 내용이 너무 짧아지면 원본 요약 사용
  if (processed.length < 10) {
    return summarizeComment(content);
  }

  return processed;
}

/**
 * 텍스트를 간결한 Markdown 리스트로 변환 (최대 3개 항목)
 */
function convertToCompactList(text: string): string {
  // If already in bullet format, limit to 3 items
  if (text.trim().startsWith('-') || text.trim().startsWith('*')) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    return lines.slice(0, 3).join('\n');
  }

  // Split by paragraphs or sentences, limit to 3
  const lines = text.split(/\n+/).filter(line => line.trim().length > 0);
  const compactLines = lines.slice(0, 3);

  // Convert to bullet points
  return compactLines.map(line => {
    const trimmed = line.trim();
    // Truncate if too long (over 100 chars)
    return trimmed.length > 100
      ? `- ${trimmed.substring(0, 97)}...`
      : `- ${trimmed}`;
  }).join('\n');
}
