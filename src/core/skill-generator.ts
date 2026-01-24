/**
 * Review to Instruction - Skill Generator
 * Claude Code skill 파일 생성
 */

import type { ParsedComment, EnhancedComment, Comment, Repository } from '../types';
import { summarizeComment } from './parser';

export interface SkillOptions {
  parsedComment: ParsedComment | EnhancedComment; // EnhancedComment 허용
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
 * 새 skill 파일 생성 (Official Claude Code Skills format)
 */
function createSkill(options: SkillOptions): string {
  const { parsedComment, originalComment, repository } = options;

  // LLM 강화 여부 확인
  const isEnhanced = 'llmEnhanced' in parsedComment && parsedComment.llmEnhanced;
  const enhanced = isEnhanced ? (parsedComment as EnhancedComment) : null;

  // Generate skill name (kebab-case)
  const skillName = generateSkillName(parsedComment);

  // Generate description (triggers when to use this skill)
  const description = generateSkillDescription(parsedComment);

  // YAML frontmatter (name and description are required)
  const frontmatter = [
    '---',
    `name: ${skillName}`,
    `description: ${description}`,
    '---',
    ''
  ].join('\n');

  // Markdown content
  const sections: string[] = [];

  // Main instructions
  if (enhanced?.detailedExplanation) {
    sections.push(enhanced.detailedExplanation);
  } else {
    sections.push(summarizeComment(originalComment.content));
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
      // No LLM explanations - check for good/bad examples
      const hasGoodBad = originalComment.content.includes('✅') || originalComment.content.includes('❌');

      if (hasGoodBad) {
        const goodExamples = extractGoodExamples(originalComment.content, parsedComment.codeExamples);
        const badExamples = extractBadExamples(originalComment.content, parsedComment.codeExamples);

        if (goodExamples.length > 0) {
          sections.push('### ✅ Correct\n');
          goodExamples.forEach(example => {
            sections.push('```');
            sections.push(example);
            sections.push('```\n');
          });
        }

        if (badExamples.length > 0) {
          sections.push('### ❌ Incorrect\n');
          badExamples.forEach(example => {
            sections.push('```');
            sections.push(example);
            sections.push('```\n');
          });
        }
      } else {
        parsedComment.codeExamples.forEach(example => {
          sections.push('```');
          sections.push(example);
          sections.push('```\n');
        });
      }
    }
  }

  // Metadata footer
  sections.push('---\n');
  sections.push(`**Source:** [PR #${repository.prNumber}](${originalComment.url}) by @${originalComment.author}`);

  return frontmatter + sections.join('\n') + '\n';
}

/**
 * 기존 skill 파일 업데이트 (simplified)
 */
function updateSkill(options: SkillOptions, existingContent: string): string {
  const { parsedComment, originalComment, repository } = options;

  const date = new Date().toISOString().split('T')[0];

  // Add new section at the end
  const addendum: string[] = [
    '',
    '',
    `## Additional Case (${date})`,
    '',
    summarizeComment(originalComment.content),
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
 * Skill 이름 생성 (kebab-case)
 */
function generateSkillName(parsedComment: ParsedComment): string {
  if (parsedComment.keywords.length > 0) {
    return parsedComment.keywords[0].toLowerCase();
  }
  return parsedComment.category.toLowerCase();
}

/**
 * Skill description 생성 (트리거 메커니즘)
 */
function generateSkillDescription(parsedComment: ParsedComment): string {
  const categoryDescriptions: Record<string, string> = {
    'naming': 'Use when naming variables, functions, or classes. Applies naming conventions.',
    'style': 'Use when formatting code or applying code style rules.',
    'architecture': 'Use when making architectural decisions or designing system structure.',
    'testing': 'Use when writing tests or implementing test patterns.',
    'security': 'Use when implementing security-critical code. Must be followed.',
    'performance': 'Use when optimizing performance or implementing efficient code.',
    'error-handling': 'Use when implementing error handling or exception management.',
    'documentation': 'Use when writing code documentation or comments.'
  };

  const baseDescription = categoryDescriptions[parsedComment.category] || 'Use when implementing this pattern.';

  if (parsedComment.keywords.length > 0) {
    const keyword = parsedComment.keywords[0].replace('-', ' ');
    return `${baseDescription} Focus on ${keyword}.`;
  }

  return baseDescription;
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

