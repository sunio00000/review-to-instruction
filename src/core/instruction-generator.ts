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

  // YAML frontmatter (optional, simplified for Claude Code)
  // Only include paths for conditional rules if needed
  const frontmatter = '---\n# Optional: Scope this rule to specific files\n# paths:\n#   - "src/**/*.ts"\n---\n\n';

  // Markdown content
  const sections: string[] = [];

  // Title
  sections.push(`# ${title}\n`);

  // Rules section (compact, no redundant summary)
  sections.push('## Rules\n');

  if (enhanced?.detailedExplanation) {
    // Use LLM explanation (already compact from prompt)
    const rules = convertToMarkdownList(enhanced.detailedExplanation);
    sections.push(rules);
  } else {
    // Use original content as bullet points (compact)
    const rules = convertToCompactList(summarizeComment(originalComment.content));
    sections.push(rules);
  }
  sections.push('');

  // Examples section
  if (parsedComment.codeExamples.length > 0) {
    sections.push('## Examples\n');

    if (enhanced?.codeExplanations && enhanced.codeExplanations.length > 0) {
      // LLM explanations available
      enhanced.codeExplanations.forEach((explanation) => {
        const label = explanation.isGoodExample !== undefined
          ? (explanation.isGoodExample ? '### ✅ Correct' : '### ❌ Incorrect')
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

  // Metadata footer
  sections.push('---\n');
  sections.push(`**Source:** [PR #${repository.prNumber}](${originalComment.url}) by @${originalComment.author}`);
  sections.push(`**Keywords:** ${parsedComment.keywords.join(', ')}`);
  sections.push(`**Category:** ${parsedComment.category}`);

  return frontmatter + sections.join('\n') + '\n';
}

/**
 * 기존 instruction 파일 업데이트 (simplified)
 */
function updateInstruction(options: InstructionOptions, existingContent: string): string {
  const { parsedComment, originalComment, repository } = options;

  const date = new Date().toISOString().split('T')[0];

  // Add new section at the end
  const addendum: string[] = [
    '',
    '',
    `## Update (${date})`,
    '',
    convertToMarkdownList(summarizeComment(originalComment.content)),
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

  addendum.push(`**Source:** [PR #${repository.prNumber}](${originalComment.url}) by @${originalComment.author}`);

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
