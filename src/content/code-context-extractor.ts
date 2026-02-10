/**
 * Review to Instruction - Code Context Extractor
 * 인라인 리뷰 코멘트의 코드 컨텍스트(diff hunk)를 DOM 또는 API에서 추출합니다.
 */

import type { Platform, CodeContext, ApiReviewComment } from '../types';

const MAX_CODE_LINES = 50;

/**
 * DOM 요소에서 코드 컨텍스트를 추출 (GitHub/GitLab 공통 진입점)
 */
export function extractCodeContextFromDOM(
  element: Element,
  platform: Platform
): CodeContext | undefined {
  try {
    return platform === 'github'
      ? extractGitHubCodeContext(element)
      : extractGitLabCodeContext(element);
  } catch {
    return undefined;
  }
}

/**
 * GitHub 인라인 리뷰 코멘트의 코드 컨텍스트 추출
 */
function extractGitHubCodeContext(element: Element): CodeContext | undefined {
  // 1. 코멘트가 속한 review-thread 컨테이너 찾기
  const threadContainer = element.closest(
    '.review-thread, .inline-comments, .js-resolvable-timeline-thread-container'
  );
  if (!threadContainer) return undefined;

  // 2. diff 테이블에서 코드 라인 추출
  let codeLines: string[] = [];

  const diffTable = threadContainer.querySelector(
    'table.diff-table, table.js-diff-table, .file-diff table'
  );

  if (diffTable) {
    codeLines = extractCodeLinesFromElements(
      diffTable.querySelectorAll('.blob-code-inner')
    );
  }

  // 3. Fallback: 이전 형제 요소에서 diff 찾기
  if (codeLines.length === 0) {
    const parent = threadContainer.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const threadIndex = siblings.indexOf(threadContainer as HTMLElement);
      for (let i = threadIndex - 1; i >= Math.max(0, threadIndex - 3); i--) {
        const table = siblings[i].querySelector?.('table.diff-table, table.js-diff-table');
        if (table) {
          codeLines = extractCodeLinesFromElements(
            table.querySelectorAll('.blob-code-inner')
          );
          break;
        }
      }
    }
  }

  if (codeLines.length === 0) return undefined;

  // 4. 파일 경로 추출
  const filePath = extractGitHubFilePath(threadContainer);

  // 5. 라인 번호 추출
  const { startLine, endLine } = extractLineNumbers(
    diffTable || threadContainer,
    '[data-line-number]',
    'data-line-number'
  );

  return {
    filePath,
    lines: truncateLines(codeLines).join('\n'),
    startLine,
    endLine
  };
}

/**
 * GitLab 인라인 리뷰 코멘트의 코드 컨텍스트 추출
 */
function extractGitLabCodeContext(element: Element): CodeContext | undefined {
  // 1. 디스커션 컨테이너 찾기
  const discussionContainer = element.closest(
    '.discussion-notes, [data-discussion-id], .notes'
  );
  if (!discussionContainer) return undefined;

  // 2. diff-content에서 코드 라인 추출
  let codeLines: string[] = [];

  const diffContent = discussionContainer.querySelector(
    '.diff-content, .diff-file'
  );

  if (diffContent) {
    codeLines = extractCodeLinesFromElements(
      diffContent.querySelectorAll('.line_content, td.line_content, .diff-line-content')
    );
  }

  // 3. Fallback: 부모 요소에서 diff 찾기
  if (codeLines.length === 0) {
    const parent = discussionContainer.parentElement;
    if (parent) {
      const diffFile = parent.querySelector('.diff-file, .diff-content');
      if (diffFile) {
        codeLines = extractCodeLinesFromElements(
          diffFile.querySelectorAll('.line_content')
        );
      }
    }
  }

  if (codeLines.length === 0) return undefined;

  // 4. 파일 경로 추출
  const filePath = extractGitLabFilePath(discussionContainer);

  // 5. 라인 번호 추출
  const searchContainer = diffContent || discussionContainer;
  const { startLine, endLine } = extractGitLabLineNumbers(searchContainer);

  return {
    filePath,
    lines: truncateLines(codeLines).join('\n'),
    startLine,
    endLine
  };
}

/**
 * 요소 목록에서 코드 라인 텍스트 추출
 */
function extractCodeLinesFromElements(elements: NodeListOf<Element>): string[] {
  return Array.from(elements)
    .map(el => el.textContent?.trimEnd() || '')
    .filter(line => line.length > 0);
}

/**
 * GitHub 파일 경로 추출
 */
function extractGitHubFilePath(container: Element): string {
  const fileHeader = container.closest('.file, [data-path]');
  return fileHeader?.getAttribute('data-path')
    || fileHeader?.querySelector('.file-info a, .file-header a')?.textContent?.trim()
    || 'unknown';
}

/**
 * GitLab 파일 경로 추출
 */
function extractGitLabFilePath(container: Element): string {
  const fileHeader = container.closest('.diff-file, [data-path]');
  return fileHeader?.getAttribute('data-path')
    || fileHeader?.querySelector('.file-title-name, .diff-file-header a')?.textContent?.trim()
    || 'unknown';
}

/**
 * 라인 번호 추출 (GitHub용)
 */
function extractLineNumbers(
  container: Element,
  selector: string,
  attribute: string
): { startLine?: number; endLine?: number } {
  const lineNumbers = Array.from(container.querySelectorAll(selector))
    .map(el => parseInt(el.getAttribute(attribute) || '0', 10))
    .filter(n => n > 0);

  if (lineNumbers.length === 0) return {};

  return {
    startLine: Math.min(...lineNumbers),
    endLine: Math.max(...lineNumbers)
  };
}

/**
 * GitLab 라인 번호 추출
 */
function extractGitLabLineNumbers(
  container: Element
): { startLine?: number; endLine?: number } {
  const lineNumbers = Array.from(
    container.querySelectorAll('[data-linenumber], .diff-line-num')
  ).map(el => {
    const num = el.getAttribute('data-linenumber') || el.textContent?.trim();
    return parseInt(num || '0', 10);
  }).filter(n => n > 0);

  if (lineNumbers.length === 0) return {};

  return {
    startLine: Math.min(...lineNumbers),
    endLine: Math.max(...lineNumbers)
  };
}

/**
 * 코드 라인을 최대 줄 수로 truncation
 */
function truncateLines(lines: string[]): string[] {
  return lines.slice(0, MAX_CODE_LINES);
}

/**
 * API의 리뷰 코멘트에서 CodeContext 생성
 * DOM 스크래핑 대신 API의 diff_hunk, path, line 필드 사용
 */
export function apiToCodeContext(apiComment: ApiReviewComment): CodeContext | undefined {
  if (!apiComment.path) return undefined;
  if (!apiComment.diffHunk) return undefined;

  return {
    filePath: apiComment.path,
    lines: apiComment.diffHunk,
    startLine: apiComment.line,
    endLine: apiComment.line
  };
}
