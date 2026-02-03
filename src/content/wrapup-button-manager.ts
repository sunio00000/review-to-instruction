/**
 * Review to Instruction - Wrapup Button Manager
 * PR/MR 전체 코멘트를 변환하는 Wrapup 버튼 관리
 */

import type { Platform, Comment } from '../types';
import { ConventionFilter } from '../core/convention-filter';

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
   * Wrapup 버튼 추가 (항상 표시, convention 체크는 클릭 시)
   */
  addWrapupButton(onClick: (comments: Comment[]) => void): void {

    // 이미 버튼이 있으면 제거
    if (this.button) {
      this.removeWrapupButton();
    }

    // 전체 코멘트 수 확인 (convention 여부 무관)
    const allCommentSelectors = this.getCommentSelectors();
    let totalComments = 0;
    for (const selector of allCommentSelectors) {
      totalComments += document.querySelectorAll(selector).length;
    }

    if (totalComments === 0) {
      return;
    }


    // 버튼 생성 (초기에는 코멘트 수 표시 안 함)
    this.button = this.createWrapupButton(0);
    this.updateButtonText(); // 버튼 텍스트만 업데이트

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
   * 버튼 텍스트만 업데이트
   */
  private updateButtonText(): void {
    if (!this.button) return;

    const span = this.button.querySelector('span');
    if (span) {
      const prMr = this.platform === 'github' ? 'PR' : 'MR';
      span.textContent = `Convert All ${prMr} Conventions`;
    }
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

      return {
        id,
        author,
        content,
        htmlContent,
        url,
        createdAt,
        platform: this.platform,
        replies: undefined
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
}
