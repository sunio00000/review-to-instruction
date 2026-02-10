/**
 * Review to Instruction - Wrapup Button Manager
 * PR/MR 전체 코멘트를 변환하는 Wrapup 버튼 관리
 */

import type { Platform, Comment, PRReviewData, ApiReviewComment } from '../types';
import { ConventionFilter } from '../core/convention-filter';
import { extractCodeContextFromDOM } from './code-context-extractor';

/**
 * WrapupButtonManager - PR/MR 전체 변환 버튼 관리
 */
export class WrapupButtonManager {
  private platform: Platform;
  private button: HTMLButtonElement | null = null;
  private buttonContainer: HTMLElement | null = null;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  /**
   * PR/MR 전체의 컨벤션 코멘트 수집
   */
  collectAllConventionComments(): Comment[] {
    const allComments: Comment[] = [];
    const processedIds = new Set<string>();


    // Platform별 코멘트 선택자
    const commentSelectors = this.getCommentSelectors();

    let totalElements = 0;

    // 1단계: 모든 코멘트 요소 찾기
    for (const selector of commentSelectors) {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      totalElements += elements.length;

      elements.forEach((element) => {
        try {
          const comment = this.extractCommentFromElement(element);

          if (comment && !processedIds.has(comment.id)) {
            allComments.push(comment);
            processedIds.add(comment.id);
          }
        } catch (error) {
          // 추출 실패는 무시
        }
      });
    }


    // 2단계: ConventionFilter로 필터링
    const filter = new ConventionFilter();
    const conventionComments = filter.filterConventionComments(allComments);

    const filteredCount = allComments.length - conventionComments.length;

    if (filteredCount > 0) {
    }

    return conventionComments;
  }

  /**
   * Wrapup 버튼 추가 (convention 코멘트 개수 표시)
   */
  async addWrapupButton(onClick: (comments: Comment[]) => void): Promise<void> {
    // 이미 버튼이 있으면 제거
    if (this.button) {
      this.removeWrapupButton();
    }

    // GitLab: Collapsed 토론 자동으로 펼치고 콘텐츠 로딩 대기
    if (this.platform === 'gitlab') {
      this.expandCollapsedDiscussions();
      await this.waitForGitLabContent();
    }

    // Convention 코멘트 수집 (버튼에 개수 표시하기 위해)
    const conventionComments = this.collectAllConventionComments();

    // Convention 코멘트가 0개면 버튼 추가하지 않음
    if (conventionComments.length === 0) {
      return;
    }

    // 버튼 생성 (convention 코멘트 개수 포함)
    this.button = this.createWrapupButton(conventionComments.length);

    // 클릭 이벤트 (클릭 시 convention 코멘트 수집)
    this.button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 클릭 시점에 모든 코멘트 수집
      const allComments: Comment[] = [];
      const processedIds = new Set<string>();
      const commentSelectors = this.getCommentSelectors();

      for (const selector of commentSelectors) {
        const elements = document.querySelectorAll<HTMLElement>(selector);
        elements.forEach((element) => {
          try {
            const comment = this.extractCommentFromElement(element);
            if (comment && !processedIds.has(comment.id)) {
              allComments.push(comment);
              processedIds.add(comment.id);
            }
          } catch (error) {
            // 추출 실패는 무시
          }
        });
      }

      // ConventionFilter로 필터링
      const filter = new ConventionFilter();
      const conventionComments = filter.filterConventionComments(allComments);

      if (conventionComments.length === 0) {
        const prMr = this.platform === 'github' ? 'PR' : 'MR';
        alert(`❌ No convention comments found in this ${prMr}\n\nFound ${allComments.length} total comments, but none meet the convention criteria.\n\nFiltered out:\n• Questions and simple replies\n• Thanks and LGTM messages\n• One-time fixes and typos\n• Uncertain suggestions\n\nConvention comments should include:\n• Clear rules or patterns (50+ chars)\n• Keywords: must, should, always, avoid\n• Code examples\n• General best practices`);
        return;
      }

      const filteredCount = allComments.length - conventionComments.length;
      if (filteredCount > 0) {
      }

      onClick(conventionComments);
    });

    // 버튼 삽입
    const insertionPoint = this.findButtonInsertionPoint();
    if (insertionPoint) {

      // 컨테이너 생성
      this.buttonContainer = document.createElement('div');
      this.buttonContainer.className = 'review-to-instruction-wrapup-container';
      this.buttonContainer.appendChild(this.button);

      // 사이드바 최상단에 삽입 (prepend)
      insertionPoint.insertBefore(this.buttonContainer, insertionPoint.firstChild);

      // 버튼이 실제로 DOM에 추가되었는지 확인
      const addedButton = document.querySelector('.review-to-instruction-wrapup-button');
      if (addedButton) {
      } else {
      }
    } else {
    }
  }


  /**
   * API 데이터 기반 Wrapup 버튼 추가
   */
  addWrapupButtonFromApi(
    reviewData: PRReviewData,
    onClick: (comments: Comment[]) => void
  ): void {
    if (this.button) {
      this.removeWrapupButton();
    }

    // API 데이터에서 전체 코멘트를 Comment 형태로 변환
    const allComments = this.apiReviewDataToComments(reviewData);

    if (allComments.length === 0) {
      return;
    }

    // 버튼 생성
    this.button = this.createWrapupButton(allComments.length);

    // 클릭 이벤트
    this.button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (allComments.length === 0) {
        const prMr = this.platform === 'github' ? 'PR' : 'MR';
        alert(`No comments found in this ${prMr}`);
        return;
      }

      onClick(allComments);
    });

    // 버튼 삽입
    const insertionPoint = this.findButtonInsertionPoint();
    if (insertionPoint) {
      this.buttonContainer = document.createElement('div');
      this.buttonContainer.className = 'review-to-instruction-wrapup-container';
      this.buttonContainer.appendChild(this.button);
      insertionPoint.insertBefore(this.buttonContainer, insertionPoint.firstChild);
    }
  }

  /**
   * API 리뷰 데이터 → Comment 배열 변환
   */
  private apiReviewDataToComments(reviewData: PRReviewData): Comment[] {
    const comments: Comment[] = [];

    // 스레드의 코멘트들
    for (const thread of reviewData.threads) {
      for (const c of thread.comments) {
        comments.push(this.apiCommentToComment(c));
      }
    }

    // 일반 코멘트들
    for (const c of reviewData.generalComments) {
      comments.push(this.apiCommentToComment(c));
    }

    return comments;
  }

  /**
   * ApiReviewComment → Comment 변환
   */
  private apiCommentToComment(c: ApiReviewComment): Comment {
    return {
      id: String(c.id),
      author: c.author,
      content: c.body,
      htmlContent: c.body,
      url: window.location.href,
      createdAt: c.createdAt,
      platform: this.platform,
      codeContext: c.diffHunk && c.path ? {
        filePath: c.path,
        lines: c.diffHunk,
        startLine: c.line,
        endLine: c.line
      } : undefined
    };
  }

  /**
   * Wrapup 버튼 제거
   */
  removeWrapupButton(): void {
    if (this.buttonContainer) {
      this.buttonContainer.remove();
      this.buttonContainer = null;
    }
    this.button = null;
  }

  /**
   * 보라색 Wrapup 버튼 생성
   */
  private createWrapupButton(commentCount: number): HTMLButtonElement {
    const prMr = this.platform === 'github' ? 'PR' : 'MR';
    const button = document.createElement('button');
    button.className = `review-to-instruction-wrapup-button ${this.platform}`;
    button.setAttribute('type', 'button');
    button.title = `🎁 Convert All ${prMr} Conventions to AI Instructions\n\n⚡ This will analyze all ${commentCount} convention ${commentCount === 1 ? 'comment' : 'comments'} in this ${prMr} and create comprehensive AI Instructions.\n(LLM analysis will be performed, costs may apply)`;

    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0z"/>
        <path d="M4 7.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-1z"/>
        <path d="M7.5 4a.5.5 0 0 1 .5-.5h.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5H8a.5.5 0 0 1-.5-.5V4z"/>
        <path d="M7.5 11a.5.5 0 0 1 .5-.5h.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5H8a.5.5 0 0 1-.5-.5V11z"/>
      </svg>
      <span>Convert All ${prMr} Conventions (${commentCount})</span>
    `;

    return button;
  }

  /**
   * 버튼 삽입 위치 찾기 (Platform별)
   */
  private findButtonInsertionPoint(): HTMLElement | null {
    if (this.platform === 'github') {
      return this.findGitHubInsertionPoint();
    } else {
      return this.findGitLabInsertionPoint();
    }
  }

  /**
   * GitHub 버튼 삽입 위치 찾기 (사이드바 최상단)
   */
  private findGitHubInsertionPoint(): HTMLElement | null {

    // GitHub: Reviewers가 있는 사이드바 영역
    const selectors = [
      '.Layout-sidebar',                 // New GitHub layout sidebar
      '.discussion-sidebar',             // Discussion 사이드바
      '#partial-discussion-sidebar',     // Partial discussion sidebar
      '.js-discussion-sidebar',          // JS discussion sidebar
      'aside.Layout-sidebar',            // Aside sidebar
      '[aria-label="Select reviewers"]', // Reviewers section
      '.sidebar-assignee',               // Assignee section (fallback)
      '.merge-pr-container',             // Merge PR 컨테이너
      '[data-target="side-panel.content"]' // Side panel content
    ];

    for (const selector of selectors) {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {

        // Layout-sidebar인 경우 내부 컨텐츠 영역 찾기
        if (selector === '.Layout-sidebar' || selector === 'aside.Layout-sidebar') {
          const content = element.querySelector<HTMLElement>('.Layout-sidebar-section, .discussion-sidebar-item');
          if (content) {
            return element; // 전체 sidebar 반환 (최상단에 버튼 추가)
          }
        }

        return element;
      }
    }


    // Fallback: 페이지의 모든 aside 요소 찾기
    const asides = document.querySelectorAll<HTMLElement>('aside');

    for (const aside of asides) {
      // Reviewers 또는 Assignees 텍스트가 있는지 확인
      if (aside.textContent?.includes('Reviewers') || aside.textContent?.includes('Assignees')) {
        return aside;
      }
    }

    return null;
  }

  /**
   * GitLab 버튼 삽입 위치 찾기 (사이드바 최상단)
   */
  private findGitLabInsertionPoint(): HTMLElement | null {

    // GitLab: Reviewers가 있는 사이드바 영역
    const selectors = [
      '.right-sidebar',                  // Right sidebar
      '.issuable-sidebar',               // Issuable sidebar
      '[data-testid="sidebar-container"]', // Sidebar container
      '.sidebar-container',              // Sidebar container
      '#issuable-sidebar',               // Issuable sidebar ID
      'aside.right-sidebar'              // Aside right sidebar
    ];

    for (const selector of selectors) {
      const sidebar = document.querySelector<HTMLElement>(selector);
      if (sidebar) {
        return sidebar;
      }
    }


    // Fallback: 페이지의 모든 aside 요소 찾기
    const asides = document.querySelectorAll<HTMLElement>('aside');

    for (const aside of asides) {
      // Reviewers 또는 Assignees 텍스트가 있는지 확인
      if (aside.textContent?.includes('Reviewers') || aside.textContent?.includes('Assignees')) {
        return aside;
      }
    }

    return null;
  }

  /**
   * Platform별 코멘트 선택자 반환
   */
  private getCommentSelectors(): string[] {
    if (this.platform === 'github') {
      return [
        '.timeline-comment',
        '.review-comment',
        '.js-comment',
        '.inline-comment',
        'div[id^="discussion_r"]',
        'div[id^="pullrequestreview"]'
      ];
    } else {
      return [
        '.note:not(.system-note)',
        '[data-testid="note"]',
        '.diff-note',
        '.discussion-note'
      ];
    }
  }

  /**
   * DOM 요소에서 Comment 정보 추출
   */
  private extractCommentFromElement(element: HTMLElement): Comment | null {
    try {
      // Platform별 선택자
      const contentSelectors = this.platform === 'github'
        ? ['.comment-body', '.js-comment-body', '.review-comment-contents .comment-body']
        : ['.note-text', '[data-testid="note-text"]', '.note-text.md'];

      const authorSelectors = this.platform === 'github'
        ? ['.author', 'a.author', '.timeline-comment-author']
        : ['.note-header-author-name', '.author-link'];

      const timeSelectors = this.platform === 'github'
        ? ['relative-time', 'time']
        : ['time', '.note-created-at'];

      // 코멘트 내용
      let contentElement: HTMLElement | null = null;
      for (const selector of contentSelectors) {
        contentElement = element.querySelector<HTMLElement>(selector);
        if (contentElement) break;
      }

      if (!contentElement) {
        return null;
      }

      const content = contentElement.textContent?.trim() || '';
      const htmlContent = contentElement.innerHTML || '';

      // 작성자
      let author = 'Unknown';
      for (const selector of authorSelectors) {
        const authorElement = element.querySelector(selector);
        if (authorElement?.textContent?.trim()) {
          author = authorElement.textContent.trim();
          break;
        }
      }

      // 시간
      let createdAt = new Date().toISOString();
      for (const selector of timeSelectors) {
        const timeElement = element.querySelector(selector);
        const datetime = timeElement?.getAttribute('datetime') || timeElement?.getAttribute('data-time');
        if (datetime) {
          createdAt = datetime;
          break;
        }
      }

      // ID
      const id = element.id || `comment-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // URL
      const url = window.location.href;

      // 코드 컨텍스트 추출 (인라인 리뷰인 경우)
      const codeContext = extractCodeContextFromDOM(element, this.platform);

      return {
        id,
        author,
        content,
        htmlContent,
        url,
        createdAt,
        platform: this.platform,
        replies: undefined,
        codeContext
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 버튼 상태 변경 (UIBuilder와 유사)
   */
  setButtonState(state: 'loading' | 'success' | 'error', message?: string): void {
    if (!this.button) return;

    this.button.classList.remove('loading', 'success', 'error');
    this.button.disabled = false;

    switch (state) {
      case 'loading':
        this.button.classList.add('loading');
        this.button.disabled = true;
        if (message) {
          const span = this.button.querySelector('span');
          if (span) span.textContent = message;
        }
        break;

      case 'success':
        this.button.classList.add('success');
        this.button.disabled = true;
        if (message) {
          const span = this.button.querySelector('span');
          if (span) span.textContent = message;
        }
        break;

      case 'error':
        this.button.classList.add('error');
        if (message) {
          const span = this.button.querySelector('span');
          if (span) span.textContent = message;
        }
        break;
    }
  }

  /**
   * 현재 버튼 반환
   */
  getButton(): HTMLButtonElement | null {
    return this.button;
  }

  /**
   * GitLab: Collapsed 토론 자동으로 펼치기
   */
  private expandCollapsedDiscussions(): void {
    // Collapsed된 토론 찾기
    const collapsedDiscussions = Array.from(
      document.querySelectorAll<HTMLElement>('.discussion.collapsed, .timeline-content.collapsed')
    );

    if (collapsedDiscussions.length === 0) {
      return;
    }

    collapsedDiscussions.forEach((discussion) => {
      try {
        // "collapsed" 클래스 제거
        discussion.classList.remove('collapsed');

        // 토론 헤더에서 expand 버튼 찾아서 클릭 (있으면)
        const expandButton = discussion.querySelector<HTMLElement>('.discussion-toggle-button, .js-toggle-button, [aria-label*="Expand"]');
        if (expandButton) {
          expandButton.click();
        }

        // 강제로 display 스타일 변경 (fallback)
        const discussionBody = discussion.querySelector<HTMLElement>('.discussion-body, .note-body');
        if (discussionBody && discussionBody.style.display === 'none') {
          discussionBody.style.display = '';
        }
      } catch (error) {
        // Silently skip failed expansions
      }
    });
  }

  /**
   * GitLab: 콘텐츠가 완전히 로드될 때까지 대기
   * GitLab은 lazy-loading을 사용하여 댓글 콘텐츠를 "Loading..." 상태로 표시하다가 나중에 실제 내용을 로드합니다.
   * 이 메서드는 "Loading" 텍스트가 너무 많으면 재시도합니다.
   */
  private async waitForGitLabContent(): Promise<void> {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 500;
    const LOADING_THRESHOLD = 0.3; // 30% 이상이 "Loading"이면 재시도

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // 약간의 딜레이 (첫 시도 제외)
      if (attempt > 1) {
        await this.delay(RETRY_DELAY_MS);
      }

      // 댓글 추출
      const allComments: Comment[] = [];
      const processedIds = new Set<string>();
      const commentSelectors = this.getCommentSelectors();

      for (const selector of commentSelectors) {
        const elements = document.querySelectorAll<HTMLElement>(selector);
        elements.forEach((element) => {
          try {
            const comment = this.extractCommentFromElement(element);
            if (comment && !processedIds.has(comment.id)) {
              allComments.push(comment);
              processedIds.add(comment.id);
            }
          } catch (error) {
            // Silently skip failed extractions
          }
        });
      }

      if (allComments.length === 0) {
        continue;
      }

      // "Loading" 텍스트가 있는 댓글 카운트
      const loadingComments = allComments.filter(comment => {
        const content = comment.content.trim().toLowerCase();
        return content === 'loading' || content === 'loading...' || content.startsWith('loading');
      });

      const loadingRatio = loadingComments.length / allComments.length;

      // "Loading" 비율이 임계값 이하면 성공
      if (loadingRatio < LOADING_THRESHOLD) {
        return;
      }
    }
  }

  /**
   * Promise 기반 delay 유틸리티
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
