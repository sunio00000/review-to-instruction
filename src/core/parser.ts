/**
 * Review to Instruction - Comment Parser
 * Intelligent keyword extraction with NLP-inspired techniques
 */

import type { ParsedComment } from '../types';

// ============================================================================
// KEYWORD DICTIONARIES (Expanded Coverage)
// ============================================================================

// Convention detection keywords
const CONVENTION_KEYWORDS = [
  // English
  'convention', 'pattern', 'rule', 'guideline', 'standard', 'principle',
  'best practice', 'good practice', 'coding style', 'approach',
  'should', 'must', 'always', 'never', 'prefer', 'avoid', 'recommend',
  'required', 'mandatory', 'forbidden', 'deprecated',
  // Korean
  '컨벤션', '규칙', '패턴', '가이드라인', '표준', '원칙',
  '좋은 방법', '코딩 스타일', '접근법',
  // Priority indicators
  'p0', 'p1', 'p2', 'p3', 'p4', 'p5',
  'critical', 'important', 'nice to have'
];

// Stop words to filter out (common words with no semantic value)
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'can', 'could', 'may', 'might', 'this', 'that', 'these', 'those',
  'it', 'its', 'we', 'our', 'you', 'your', 'they', 'their',
  // Korean stop words
  '이', '그', '저', '것', '수', '등', '및', '또는', '하나', '두', '세',
  '있다', '없다', '이다', '아니다'
]);

// Emoji patterns for good/bad examples
const EMOJI_PATTERNS = {
  good: ['✅', '✓', '👍', '🟢', '⭐', '💚', '좋은', 'good', 'correct', 'right', 'yes'],
  bad: ['❌', '✗', '👎', '🔴', '⛔', '❤️', '나쁜', 'bad', 'wrong', 'incorrect', 'no', 'avoid']
};

// Action verbs (what to do/avoid) - Reserved for future use
// const ACTION_VERBS = {
//   positive: ['use', 'apply', 'follow', 'implement', 'adopt', 'prefer', 'choose', 'write', 'create'],
//   negative: ['avoid', 'don\'t', 'never', 'stop', 'remove', 'delete', 'prevent', 'skip']
// };

// Category keywords (significantly expanded)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'naming': [
    'naming', 'name', 'variable', 'function', 'class', 'identifier',
    'camelCase', 'PascalCase', 'snake_case', 'kebab-case',
    'prefix', 'suffix', 'abbreviation',
    '네이밍', '이름', '변수명', '함수명', '클래스명', '식별자'
  ],
  'style': [
    'style', 'format', 'formatting', 'indent', 'indentation', 'spacing',
    'whitespace', 'newline', 'linebreak', 'semicolon', 'comma', 'bracket',
    'quote', 'single quote', 'double quote', 'prettier', 'eslint',
    '스타일', '포맷', '들여쓰기', '공백', '줄바꿈'
  ],
  'architecture': [
    'architecture', 'structure', 'design', 'pattern', 'layer', 'module',
    'component', 'service', 'controller', 'model', 'view',
    'separation', 'coupling', 'cohesion', 'dependency', 'injection',
    'solid', 'dry', 'kiss', 'yagni', 'mvc', 'mvvm',
    '아키텍처', '구조', '설계', '패턴', '계층', '모듈'
  ],
  'testing': [
    'test', 'testing', 'unit test', 'integration test', 'e2e', 'e2e test',
    'mock', 'stub', 'spy', 'fixture', 'coverage', 'assertion',
    'jest', 'vitest', 'mocha', 'chai', 'cypress', 'playwright',
    'tdd', 'bdd', 'test-driven',
    '테스트', '단위 테스트', '통합 테스트', '목', '스텁'
  ],
  'security': [
    'security', 'auth', 'authentication', 'authorization', 'permission',
    'vulnerability', 'xss', 'csrf', 'sql injection', 'injection',
    'sanitize', 'validate', 'escape', 'token', 'jwt', 'oauth',
    'encryption', 'hash', 'salt', 'https', 'ssl', 'tls',
    '보안', '인증', '권한', '취약점', '검증', '암호화'
  ],
  'performance': [
    'performance', 'optimization', 'optimize', 'speed', 'fast', 'slow',
    'cache', 'caching', 'memoize', 'lazy', 'eager', 'debounce', 'throttle',
    'bundle', 'minify', 'compress', 'async', 'parallel', 'concurrent',
    'memory', 'leak', 'profiling', 'bottleneck',
    '성능', '최적화', '캐시', '메모이제이션', '지연 로딩'
  ],
  'error-handling': [
    'error', 'exception', 'try', 'catch', 'throw', 'handling',
    'error handling', 'exception handling', 'fallback', 'retry',
    'graceful', 'degradation', 'failure', 'timeout',
    '에러', '예외', '처리', '오류 처리', '폴백'
  ],
  'documentation': [
    'documentation', 'document', 'comment', 'docs', 'readme',
    'jsdoc', 'tsdoc', 'docstring', 'inline comment', 'block comment',
    'api doc', 'changelog', 'guide', 'tutorial',
    '문서', '주석', '설명', '가이드'
  ],
  'accessibility': [
    'accessibility', 'a11y', 'aria', 'semantic', 'screen reader',
    'keyboard', 'focus', 'contrast', 'alt text', 'label',
    'wcag', 'section508',
    '접근성', '스크린 리더', '키보드', '대체 텍스트'
  ],
  'i18n': [
    'internationalization', 'i18n', 'localization', 'l10n',
    'translation', 'locale', 'language', 'multilingual',
    'rtl', 'ltr', 'unicode', 'encoding',
    '국제화', '다국어', '번역', '로케일'
  ],
  'api': [
    'api', 'endpoint', 'rest', 'restful', 'graphql', 'grpc',
    'request', 'response', 'http', 'method', 'status code',
    'header', 'body', 'query', 'param', 'path',
    'rate limit', 'pagination', 'versioning',
    '엔드포인트', '요청', '응답'
  ],
  'database': [
    'database', 'db', 'sql', 'nosql', 'query', 'schema',
    'migration', 'seed', 'orm', 'transaction', 'index',
    'primary key', 'foreign key', 'relation', 'join',
    'mongodb', 'postgresql', 'mysql', 'redis', 'prisma', 'typeorm',
    '데이터베이스', '쿼리', '스키마', '마이그레이션'
  ],
  'state-management': [
    'state', 'state management', 'store', 'reducer', 'action', 'dispatch',
    'redux', 'mobx', 'zustand', 'recoil', 'context',
    'immutable', 'mutation', 'selector',
    '상태', '상태 관리', '스토어', '리듀서'
  ],
  'git': [
    'git', 'commit', 'branch', 'merge', 'rebase', 'pull request', 'pr',
    'commit message', 'conventional commits', 'gitflow',
    'squash', 'cherry-pick', '.gitignore',
    '커밋', '브랜치', '병합', '풀 리퀘스트'
  ],
  'ci-cd': [
    'ci', 'cd', 'pipeline', 'deploy', 'deployment', 'build',
    'github actions', 'gitlab ci', 'jenkins', 'circleci',
    'docker', 'kubernetes', 'container', 'image',
    '배포', '빌드', '파이프라인', '컨테이너'
  ],
  'dependencies': [
    'dependency', 'dependencies', 'package', 'npm', 'yarn', 'pnpm',
    'version', 'update', 'upgrade', 'lock file',
    'node_modules', 'import', 'export', 'module',
    '의존성', '패키지', '버전'
  ]
};

// Programming languages (expanded)
const PROGRAMMING_LANGUAGES = [
  'javascript', 'js', 'typescript', 'ts', 'python', 'py',
  'java', 'kotlin', 'scala', 'go', 'golang', 'rust', 'c', 'c++', 'cpp',
  'c#', 'csharp', 'php', 'ruby', 'swift', 'objective-c', 'objc',
  'dart', 'elixir', 'erlang', 'haskell', 'clojure', 'lua',
  'perl', 'r', 'matlab', 'shell', 'bash', 'powershell'
];

// Frameworks & libraries (significantly expanded)
const FRAMEWORKS_LIBRARIES = [
  // Frontend
  'react', 'vue', 'angular', 'svelte', 'solid', 'preact',
  'next.js', 'nextjs', 'nuxt', 'gatsby', 'remix', 'astro',
  'jquery', 'backbone', 'ember',
  // Backend
  'express', 'fastify', 'koa', 'nestjs', 'hapi',
  'spring', 'spring boot', 'django', 'flask', 'fastapi',
  'rails', 'sinatra', 'laravel', 'symfony', 'codeigniter',
  'asp.net', 'dotnet',
  // Mobile
  'react native', 'flutter', 'ionic', 'cordova', 'capacitor',
  'xamarin', 'swiftui', 'jetpack compose',
  // Testing
  'jest', 'vitest', 'mocha', 'jasmine', 'karma',
  'cypress', 'playwright', 'puppeteer', 'selenium',
  'testing-library', 'enzyme',
  // Build tools
  'webpack', 'vite', 'rollup', 'parcel', 'esbuild', 'turbopack',
  'babel', 'swc', 'tsc',
  // State management
  'redux', 'mobx', 'zustand', 'recoil', 'jotai', 'xstate',
  // Styling
  'tailwind', 'tailwindcss', 'styled-components', 'emotion',
  'sass', 'scss', 'less', 'css modules',
  // Other
  'graphql', 'apollo', 'prisma', 'typeorm', 'sequelize', 'mongoose',
  'axios', 'fetch', 'lodash', 'ramda', 'date-fns', 'moment'
];

// Code structure keywords
const CODE_STRUCTURE_KEYWORDS = [
  'component', 'hook', 'class', 'interface', 'type', 'enum', 'struct',
  'function', 'method', 'property', 'field', 'constant', 'variable',
  'decorator', 'annotation', 'attribute', 'directive',
  'middleware', 'interceptor', 'guard', 'pipe', 'filter',
  'factory', 'builder', 'singleton', 'prototype',
  '컴포넌트', '훅', '클래스', '인터페이스', '타입', '열거형',
  '함수', '메서드', '속성', '상수', '변수'
];

// ============================================================================
// INTELLIGENT KEYWORD EXTRACTION
// ============================================================================

/**
 * Parse comment with intelligent keyword extraction
 */
export function parseComment(content: string): ParsedComment {
  const lowercaseContent = content.toLowerCase();

  // 1. Extract keywords using multiple strategies
  const keywords = extractKeywords(content, lowercaseContent);

  // 2. Classify category with improved scoring
  const category = classifyCategory(content, lowercaseContent, keywords);

  // 3. Extract code examples
  const codeExamples = extractCodeExamples(content);

  // 4. Generate filename
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
 * Intelligent keyword extraction with multiple strategies
 */
function extractKeywords(content: string, lowercaseContent: string): string[] {
  const keywordScores = new Map<string, number>();

  // Check if this is a convention comment
  const hasConventionKeyword = CONVENTION_KEYWORDS.some(keyword =>
    lowercaseContent.includes(keyword.toLowerCase())
  );

  if (!hasConventionKeyword) {
    return [];
  }

  // Strategy 1: Category keywords (highest priority)
  extractCategoryKeywords(lowercaseContent, keywordScores);

  // Strategy 2: Contextual extraction (should/must/avoid patterns)
  extractContextualKeywords(content, keywordScores);

  // Strategy 3: Technical keywords (languages, frameworks)
  extractTechnicalKeywords(lowercaseContent, keywordScores);

  // Strategy 4: Code identifiers (from code blocks and inline code)
  extractCodeIdentifiers(content, keywordScores);

  // Strategy 5: Important terms (CamelCase, UPPER_CASE, kebab-case)
  extractImportantTerms(content, keywordScores);

  // Strategy 6: File and path references
  extractFileReferences(content, keywordScores);

  // Strategy 7: TF-IDF style word importance
  extractImportantWords(content, keywordScores);

  // Remove stop words and filter
  const filteredKeywords = Array.from(keywordScores.entries())
    .filter(([word]) => !STOP_WORDS.has(word) && word.length > 2)
    .sort((a, b) => b[1] - a[1]) // Sort by score
    .map(([word]) => word)
    .slice(0, 15); // Increased from 10 to 15

  return filteredKeywords;
}

/**
 * Extract category-specific keywords
 */
function extractCategoryKeywords(
  lowercaseContent: string,
  scores: Map<string, number>
): void {
  for (const [category, categoryKeywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of categoryKeywords) {
      if (lowercaseContent.includes(keyword.toLowerCase())) {
        addScore(scores, keyword.toLowerCase(), 5);
        addScore(scores, category, 3);
      }
    }
  }
}

/**
 * Extract keywords from context (should/must/avoid patterns)
 * Examples:
 * - "should use camelCase" -> extracts "use", "camelCase"
 * - "never use var" -> extracts "never", "use", "var"
 * - "avoid global variables" -> extracts "avoid", "global", "variables"
 */
function extractContextualKeywords(
  content: string,
  scores: Map<string, number>
): void {
  // Pattern: should/must/always + verb + noun
  const positivePattern = /(?:should|must|always|prefer|recommend|use)\s+(\w+(?:\s+\w+){0,3})/gi;
  let match;

  while ((match = positivePattern.exec(content)) !== null) {
    const phrase = match[1].toLowerCase();
    const words = phrase.split(/\s+/).filter(w => !STOP_WORDS.has(w) && w.length > 2);
    words.forEach(word => addScore(scores, word, 4));
  }

  // Pattern: avoid/never/don't + verb + noun
  const negativePattern = /(?:avoid|never|don't|do not|shouldn't|must not)\s+(\w+(?:\s+\w+){0,3})/gi;

  while ((match = negativePattern.exec(content)) !== null) {
    const phrase = match[1].toLowerCase();
    const words = phrase.split(/\s+/).filter(w => !STOP_WORDS.has(w) && w.length > 2);
    words.forEach(word => addScore(scores, word, 4));
  }
}

/**
 * Extract technical keywords (languages, frameworks)
 */
function extractTechnicalKeywords(
  lowercaseContent: string,
  scores: Map<string, number>
): void {
  // Programming languages
  for (const lang of PROGRAMMING_LANGUAGES) {
    if (lowercaseContent.includes(lang.toLowerCase())) {
      addScore(scores, lang.toLowerCase(), 3);
    }
  }

  // Frameworks and libraries
  for (const framework of FRAMEWORKS_LIBRARIES) {
    if (lowercaseContent.includes(framework.toLowerCase())) {
      addScore(scores, framework.toLowerCase(), 3);
    }
  }

  // Code structure keywords
  for (const keyword of CODE_STRUCTURE_KEYWORDS) {
    if (lowercaseContent.includes(keyword.toLowerCase())) {
      addScore(scores, keyword.toLowerCase(), 2);
    }
  }
}

/**
 * Extract identifiers from code blocks
 */
function extractCodeIdentifiers(
  content: string,
  scores: Map<string, number>
): void {
  // Extract from inline code (`...`)
  const inlineCodeRegex = /`([^`]+)`/g;
  let match;

  while ((match = inlineCodeRegex.exec(content)) !== null) {
    const code = match[1].trim();
    if (code.length > 2 && code.length < 50) {
      // Extract identifiers (variable names, function names)
      const identifiers = code.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g);
      if (identifiers) {
        identifiers.forEach(id => {
          if (id.length > 2 && !STOP_WORDS.has(id.toLowerCase())) {
            addScore(scores, id.toLowerCase(), 2);
          }
        });
      }
    }
  }
}

/**
 * Extract important terms (CamelCase, UPPER_CASE, kebab-case)
 */
function extractImportantTerms(
  content: string,
  scores: Map<string, number>
): void {
  // CamelCase and PascalCase
  const camelCaseRegex = /\b[a-z]+[A-Z][a-zA-Z]*\b|\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g;
  const camelMatches = content.match(camelCaseRegex);
  if (camelMatches) {
    camelMatches.forEach(match => {
      if (match.length > 3) {
        addScore(scores, match.toLowerCase(), 3);
      }
    });
  }

  // UPPER_CASE (constants)
  const upperCaseRegex = /\b[A-Z][A-Z0-9_]+\b/g;
  const upperMatches = content.match(upperCaseRegex);
  if (upperMatches) {
    upperMatches.forEach(match => {
      if (match.length > 3 && match !== match.toUpperCase()) { // Avoid acronyms like "API"
        addScore(scores, match.toLowerCase(), 2);
      }
    });
  }

  // kebab-case (in inline code or text)
  const kebabCaseRegex = /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/g;
  const kebabMatches = content.match(kebabCaseRegex);
  if (kebabMatches) {
    kebabMatches.forEach(match => {
      if (match.length > 5) {
        addScore(scores, match, 2);
      }
    });
  }
}

/**
 * Extract file and path references
 */
function extractFileReferences(
  content: string,
  scores: Map<string, number>
): void {
  // File paths with extensions
  const fileRegex = /[\w/-]+\.(ts|tsx|js|jsx|py|java|go|rs|rb|php|swift|kt|cpp|cs|vue|svelte)/gi;
  const fileMatches = content.match(fileRegex);

  if (fileMatches) {
    fileMatches.forEach(match => {
      // Extract filename without extension
      const fileName = match.split('/').pop()?.split('.')[0];
      if (fileName && fileName.length > 2) {
        addScore(scores, fileName.toLowerCase(), 2);
      }
    });
  }
}

/**
 * Extract important words using TF-IDF style approach
 * Words that appear frequently but are not too common
 */
function extractImportantWords(
  content: string,
  scores: Map<string, number>
): void {
  // Remove code blocks and inline code for cleaner text analysis
  const textOnly = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '');

  // Extract all words
  const words = textOnly
    .toLowerCase()
    .match(/\b[a-z]{3,}\b/g) || [];

  // Count frequency
  const frequency = new Map<string, number>();
  words.forEach(word => {
    if (!STOP_WORDS.has(word)) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  });

  // Add score based on frequency (but not too common)
  for (const [word, count] of frequency.entries()) {
    if (count >= 2 && count <= 5) { // Sweet spot: not too rare, not too common
      addScore(scores, word, count);
    }
  }
}

/**
 * Helper: Add score to keyword
 */
function addScore(scores: Map<string, number>, keyword: string, score: number): void {
  scores.set(keyword, (scores.get(keyword) || 0) + score);
}

// ============================================================================
// CATEGORY CLASSIFICATION
// ============================================================================

/**
 * Classify category with improved scoring
 */
function classifyCategory(
  content: string,
  lowercaseContent: string,
  keywords: string[]
): string {
  const categoryScores: Record<string, number> = {};

  // 1. Keyword-based scoring
  for (const keyword of keywords) {
    for (const [category, categoryKeywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (categoryKeywords.some(ck => ck.toLowerCase() === keyword)) {
        categoryScores[category] = (categoryScores[category] || 0) + 3;
      }
    }
  }

  // 2. Content-based scoring (word frequency)
  for (const [category, categoryKeywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of categoryKeywords) {
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
      const matches = lowercaseContent.match(regex);
      if (matches) {
        categoryScores[category] = (categoryScores[category] || 0) + matches.length;
      }
    }
  }

  // 3. Context-based scoring (emoji patterns, special markers)
  if (EMOJI_PATTERNS.good.some(emoji => content.includes(emoji)) ||
      EMOJI_PATTERNS.bad.some(emoji => content.includes(emoji))) {
    categoryScores['style'] = (categoryScores['style'] || 0) + 2;
  }

  // 4. Code block analysis
  const hasCodeBlocks = /```/.test(content);
  if (hasCodeBlocks) {
    categoryScores['testing'] = (categoryScores['testing'] || 0) + 1;
    categoryScores['style'] = (categoryScores['style'] || 0) + 1;
  }

  // Select category with highest score
  let maxScore = 0;
  let bestCategory = 'conventions';

  for (const [category, score] of Object.entries(categoryScores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

// ============================================================================
// CODE EXAMPLE EXTRACTION
// ============================================================================

/**
 * Extract code examples from comment
 */
function extractCodeExamples(content: string): string[] {
  const codeBlocks: string[] = [];

  // 1. Markdown code blocks (```)
  const markdownCodeRegex = /```[\w]*\n([\s\S]*?)```/g;
  let match;

  while ((match = markdownCodeRegex.exec(content)) !== null) {
    const code = match[1].trim();
    if (code.length > 0) {
      codeBlocks.push(code);
    }
  }

  // 2. Inline code (`) - only if meaningful
  const inlineCodeRegex = /`([^`]+)`/g;
  const inlineCodes: string[] = [];

  while ((match = inlineCodeRegex.exec(content)) !== null) {
    const code = match[1].trim();
    // Only include if it looks like code (has special chars or is long enough)
    if (code.length > 5 &&
        (code.includes('(') || code.includes('{') || code.includes('.') || code.includes('_')) &&
        !codeBlocks.some(block => block.includes(code))) {
      inlineCodes.push(code);
    }
  }

  // Combine inline codes (max 3)
  if (inlineCodes.length > 0) {
    codeBlocks.push(inlineCodes.slice(0, 3).join(', '));
  }

  return codeBlocks;
}

// ============================================================================
// FILENAME GENERATION
// ============================================================================

/**
 * Generate filename from category and keywords
 */
function generateFileName(category: string, keywords: string[]): string {
  let baseName = category;

  // Find relevant keywords (exclude category itself and tech stack)
  const techKeywords = [
    ...PROGRAMMING_LANGUAGES,
    ...FRAMEWORKS_LIBRARIES,
    ...CODE_STRUCTURE_KEYWORDS.map(k => k.toLowerCase())
  ];

  const relevantKeywords = keywords
    .filter(k => k !== category)
    .filter(k => k.length > 2 && !k.includes(' '))
    .filter(k => !techKeywords.includes(k))
    .slice(0, 2);

  if (relevantKeywords.length > 0) {
    baseName = `${relevantKeywords.join('-')}-${category}`;
  }

  // Normalize to kebab-case
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if comment is convention-related
 */
export function isConventionComment(content: string): boolean {
  // 1. 50자 이상이면 무조건 통과 (관대한 필터링)
  if (content.length >= 50) {
    return true;
  }

  const lowercaseContent = content.toLowerCase();

  // 2. Check for convention keywords
  const hasKeyword = CONVENTION_KEYWORDS.some(keyword =>
    lowercaseContent.includes(keyword.toLowerCase())
  );

  // 3. Check for code examples (strong signal) - 길이 조건 제거
  const hasCodeExample = /```|`[^`]+`/.test(content);

  // 4. Check for emoji patterns
  const hasEmojiPattern =
    EMOJI_PATTERNS.good.some(emoji => content.includes(emoji)) ||
    EMOJI_PATTERNS.bad.some(emoji => content.includes(emoji));

  // OR 조건: 하나만 만족해도 통과
  return hasKeyword || hasCodeExample || hasEmojiPattern;
}

/**
 * Summarize comment (first sentence or 50 chars)
 */
export function summarizeComment(content: string): string {
  // Remove code blocks for cleaner summary
  const textOnly = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '');

  // Extract first sentence
  const firstSentence = textOnly.match(/^[^.!?]+[.!?]/);
  if (firstSentence) {
    return firstSentence[0].trim();
  }

  // Or first 50 characters
  if (textOnly.length > 50) {
    return textOnly.substring(0, 50).trim() + '...';
  }

  return textOnly.trim();
}
