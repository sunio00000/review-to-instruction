/**
 * Review to Instruction - UI Builder
 * 코멘트에 버튼을 추가하고 UI를 관리합니다.
 */

import type { Platform, Comment, DiscussionThread } from '../types';
import { calculateCost, formatCost } from '../utils/token-pricing';
import { Debouncer } from '../utils/rate-limiter';

export interface ButtonOptions {
  platform: Platform;
  comment: Comment;
  onClick: (comment: Comment) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export interface ThreadButtonOptions {
  platform: Platform;
  thread: DiscussionThread;
  onClick: (thread: DiscussionThread) => void;
}

export class UIBuilder {
  private buttons = new Map<string, HTMLButtonElement>();
  private threadButtons = new Map<string, HTMLButtonElement>();
  private buttonDebouncer = new Debouncer(2000); // 2초 debounce

  /**
   * 코멘트에 버튼 추가
   */
  addButton(
    _commentElement: HTMLElement,
    contentElement: HTMLElement,
    options: ButtonOptions
  ): HTMLButtonElement {
    const existingButton = this.buttons.get(options.comment.id);
    if (existingButton) {
      return existingButton;
    }

    const button = this.createButton(options);
    this.insertButton(contentElement, button);
    this.buttons.set(options.comment.id, button);

    return button;
  }

  /**
   * 버튼 제거
   */
  removeButton(commentId: string) {
    const button = this.buttons.get(commentId);
    if (button) {
      button.remove();
      this.buttons.delete(commentId);
    }
  }

  /**
   * 모든 버튼 제거
   */
  removeAllButtons() {
    this.buttons.forEach((button) => button.remove());
    this.buttons.clear();
  }

  /**
   * 버튼 엘리먼트 생성
   */
  private createButton(options: ButtonOptions): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = `review-to-instruction-button ${options.platform}`;
    button.setAttribute('data-comment-id', options.comment.id);
    button.setAttribute('type', 'button');

    // Check if comment has replies
    const hasReplies = options.comment.replies && options.comment.replies.length > 0;
    const replyCount = hasReplies ? options.comment.replies!.length : 0;

    // disabled 상태 설정 및 툴팁
    if (options.disabled) {
      button.disabled = true;
      button.classList.add('disabled');
      // Use custom reason if provided, otherwise use default
      const defaultReason = 'This comment does not meet conversion requirements\n(Requires at least one of: 50+ characters, convention keywords, code examples, or emojis)';
      button.title = options.disabledReason || defaultReason;
    } else {
      // Tooltip message (different based on replies)
      if (hasReplies) {
        button.title = `📋 Preview and Generate AI Instruction\n\n⚡ This comment includes ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}\nAll comments in this conversation will be analyzed together to create a comprehensive AI Instruction.\n(LLM analysis will be performed, costs may apply)`;
      } else {
        button.title = '📋 Preview and Generate AI Instruction\n\nCreates an AI Instruction based on this comment.\n(LLM analysis will be performed, costs may apply)';
      }
    }

    // Button text with reply indicator
    const buttonText = hasReplies
      ? `Convert to AI Instruction (+${replyCount} ${replyCount === 1 ? 'reply' : 'replies'})`
      : 'Convert to AI Instruction';

    // 아이콘 + 텍스트 + 경고 아이콘 (disabled인 경우)
    const warningIcon = options.disabled
      ? `<span class="warning-icon" title="${this.escapeHtml(options.disabledReason || 'Button is disabled')}">⚠️</span>`
      : '';

    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
      </svg>
      <span>${buttonText}</span>
      ${warningIcon}
    `;

    // 클릭 이벤트
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleButtonClick(button, options);
    });

    return button;
  }

  /**
   * HTML escape for tooltip and user-provided content
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 버튼을 코멘트에 삽입
   */
  private insertButton(contentElement: HTMLElement, button: HTMLButtonElement) {
    // 1. 코멘트 컨테이너 찾기 (GitHub/GitLab 구조 고려)
    const commentContainer = this.findCommentContainer(contentElement);
    if (!commentContainer) {
      return;
    }

    // 2. 이미 버튼 컨테이너가 있는지 확인 (중복 방지)
    const existingContainer = commentContainer.querySelector('.review-to-instruction-button-container');
    if (existingContainer) {
      return;
    }

    // 3. 버튼 컨테이너 생성
    const container = document.createElement('div');
    container.className = 'review-to-instruction-button-container';
    container.appendChild(button);

    // 4. 적절한 위치에 삽입
    const insertionPoint = this.findInsertionPoint(commentContainer, contentElement);
    if (insertionPoint.mode === 'after') {
      // 요소 다음에 삽입
      if (insertionPoint.element.nextSibling) {
        insertionPoint.element.parentElement!.insertBefore(
          container,
          insertionPoint.element.nextSibling
        );
      } else {
        insertionPoint.element.parentElement!.appendChild(container);
      }
    } else {
      // 컨테이너 끝에 추가
      commentContainer.appendChild(container);
    }
  }

  /**
   * 코멘트 컨테이너 찾기 (GitHub/GitLab 호환)
   */
  private findCommentContainer(contentElement: HTMLElement): HTMLElement | null {
    // GitHub 선택자 (일반 코멘트 + 리뷰 코멘트)
    const githubSelectors = [
      '.timeline-comment',           // 일반 코멘트
      '.review-comment',             // 리뷰 코멘트
      '.js-comment',                 // JS 타겟 코멘트
      '.inline-comment',             // 인라인 코멘트
      '.js-comment-container',       // 코멘트 컨테이너
      'div[id^="discussion_r"]',     // 디스커션 ID
      'div[id^="pullrequestreview"]' // PR 리뷰 ID
    ];

    // GitLab 선택자 (일반 노트 + diff 노트)
    const gitlabSelectors = [
      '.note',                       // GitLab 노트
      '[data-testid="note"]',        // data-testid
      '.timeline-entry',             // 타임라인 엔트리
      '.discussion-note',            // 디스커션 노트
      '.diff-note',                  // diff 노트
      '.note-wrapper',               // 노트 래퍼
      'li.note',                     // li 태그 노트
      '[data-note-type="DiffNote"]'  // diff 노트 타입
    ];

    const allSelectors = [...githubSelectors, ...gitlabSelectors];

    // closest로 가장 가까운 코멘트 컨테이너 찾기
    for (const selector of allSelectors) {
      const container = contentElement.closest(selector);
      if (container) {
        return container as HTMLElement;
      }
    }

    // Fallback: contentElement의 부모
    return contentElement.parentElement;
  }

  /**
   * 버튼 삽입 위치 찾기
   */
  private findInsertionPoint(
    commentContainer: HTMLElement,
    contentElement: HTMLElement
  ): { mode: 'after' | 'append'; element: HTMLElement } {
    // GitHub: comment-body 다음에 삽입
    if (commentContainer.classList.contains('timeline-comment') ||
        commentContainer.classList.contains('review-comment') ||
        commentContainer.classList.contains('inline-comment') ||
        commentContainer.classList.contains('js-comment')) {
      // 리뷰 코멘트의 경우 여러 위치 시도
      const bodySelectors = [
        '.comment-body',
        '.js-comment-body',
        '.review-comment-contents .comment-body',
        '.edit-comment-hide'
      ];

      for (const selector of bodySelectors) {
        const commentBody = commentContainer.querySelector(selector);
        if (commentBody) {
          return { mode: 'after', element: commentBody as HTMLElement };
        }
      }
    }

    // GitLab: note-text 다음에 삽입
    if (commentContainer.classList.contains('note') ||
        commentContainer.classList.contains('diff-note') ||
        commentContainer.classList.contains('discussion-note')) {
      const noteSelectors = [
        '.note-text',
        '[data-testid="note-text"]',
        '.note-text.md',
        '.note-body .note-text'
      ];

      for (const selector of noteSelectors) {
        const noteText = commentContainer.querySelector(selector);
        if (noteText) {
          return { mode: 'after', element: noteText as HTMLElement };
        }
      }
    }

    // Fallback: contentElement 다음에 삽입
    return { mode: 'after', element: contentElement };
  }

  /**
   * 버튼 클릭 핸들러
   */
  private handleButtonClick(button: HTMLButtonElement, options: ButtonOptions) {
    // Rate limiting check (2초 debounce)
    if (!this.buttonDebouncer.canCall()) {
      const timeRemaining = Math.ceil(this.buttonDebouncer.getTimeRemaining() / 1000);
      this.showTemporaryMessage(
        button,
        `⏳ Please wait ${timeRemaining}s before trying again`,
        'info'
      );
      return;
    }

    // 버튼 상태를 loading으로 변경
    this.setButtonState(button, 'loading');

    // 콜백 실행
    try {
      options.onClick(options.comment);
    } catch (error) {
      this.setButtonState(button, 'error');

      // 3초 후 원래 상태로 복귀
      setTimeout(() => {
        this.setButtonState(button, 'default');
      }, 3000);
    }
  }

  /**
   * 일시적인 메시지 표시 (rate limit 등)
   */
  private showTemporaryMessage(
    button: HTMLButtonElement,
    message: string,
    type: 'info' | 'warning'
  ) {
    const container = button.parentElement;
    if (!container) return;

    // 기존 메시지 확인
    const existingMessage = container.querySelector('.review-to-instruction-temp-message');
    if (existingMessage) return; // 이미 표시 중

    const messageDiv = document.createElement('div');
    messageDiv.className = `review-to-instruction-temp-message ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      display: inline-block;
      margin-left: 8px;
      padding: 4px 8px;
      font-size: 12px;
      border-radius: 4px;
      background-color: ${type === 'info' ? '#ddf4ff' : '#fff8c5'};
      color: ${type === 'info' ? '#0969da' : '#7d4e00'};
      border: 1px solid ${type === 'info' ? '#54aeff66' : '#d4a72c'};
      animation: fadeIn 0.2s ease;
    `;

    container.appendChild(messageDiv);

    // 2초 후 제거
    setTimeout(() => {
      if (messageDiv.parentElement) {
        messageDiv.remove();
      }
    }, 2000);
  }

  /**
   * 버튼 상태 변경
   */
  setButtonState(
    button: HTMLButtonElement,
    state: 'default' | 'loading' | 'success' | 'error',
    message?: string
  ) {
    button.classList.remove('loading', 'success', 'error');
    button.disabled = false;

    switch (state) {
      case 'loading':
        button.classList.add('loading');
        button.disabled = true;
        button.querySelector('span')!.textContent = message || 'Processing...';
        break;

      case 'success':
        button.classList.add('success');
        button.disabled = true;
        button.querySelector('span')!.textContent = message || 'Converted!';

        // 3초 후 원래 상태로
        setTimeout(() => {
          if (button.classList.contains('success')) {
            this.setButtonState(button, 'default');
          }
        }, 3000);
        break;

      case 'error':
        button.classList.add('error');
        button.querySelector('span')!.textContent = message || 'Error';
        break;

      case 'default':
        button.querySelector('span')!.textContent = 'Convert to AI Instruction';
        break;
    }
  }

  /**
   * 성공 메시지를 표시 (PR URL 링크 + 토큰 사용량 포함)
   */
  showSuccessMessage(
    button: HTMLButtonElement,
    prUrl: string,
    isUpdate: boolean,
    tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number; }
  ) {
    this.setButtonState(button, 'success', 'Converted!');

    // 결과 메시지 생성
    const container = button.parentElement;
    if (!container) return;

    // 기존 결과 메시지 제거
    const existingResult = container.querySelector('.review-to-instruction-result');
    if (existingResult) {
      existingResult.remove();
    }

    // 새 결과 메시지 추가 (안전한 DOM 조작 사용)
    const resultDiv = document.createElement('div');
    resultDiv.className = 'review-to-instruction-result success';

    const actionText = isUpdate ? 'updated' : 'created';

    // SVG 아이콘
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z');
    svg.appendChild(path);

    // 텍스트와 링크
    const messageSpan = document.createElement('span');
    messageSpan.textContent = `Instruction ${actionText}! `;

    // PR 링크 (URL 검증 및 escaping)
    const link = document.createElement('a');
    try {
      // URL 유효성 검증
      const url = new URL(prUrl);
      if (url.protocol === 'https:' && (url.hostname.includes('github.com') || url.hostname.includes('gitlab.com') || url.hostname === 'git.projectbro.com')) {
        link.href = prUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'View PR →';
      } else {
        throw new Error('Invalid URL');
      }
    } catch {
      // 잘못된 URL인 경우 링크 없이 텍스트만 표시
      link.textContent = '(Invalid PR URL)';
    }

    messageSpan.appendChild(link);

    // Token usage (있는 경우)
    if (tokenUsage) {
      const cost = calculateCost(
        { inputTokens: tokenUsage.inputTokens, outputTokens: tokenUsage.outputTokens },
        'claude' // TODO: Get provider from settings
      );
      const tokenSpan = document.createElement('span');
      tokenSpan.className = 'token-usage';
      tokenSpan.style.fontSize = '0.85em';
      tokenSpan.style.opacity = '0.8';
      tokenSpan.style.marginLeft = '8px';
      tokenSpan.textContent = `(${tokenUsage.totalTokens} tokens, ${formatCost(cost)})`;
      messageSpan.appendChild(tokenSpan);
    }

    resultDiv.appendChild(svg);
    resultDiv.appendChild(messageSpan);
    container.appendChild(resultDiv);

    // 10초 후 자동 제거
    setTimeout(() => {
      if (resultDiv.parentElement) {
        resultDiv.remove();
      }
    }, 10000);
  }

  /**
   * 에러 메시지를 표시
   */
  showErrorMessage(button: HTMLButtonElement, errorMessage: string) {
    // 사용자 친화적인 에러 메시지로 변환
    const friendlyMessage = this.getFriendlyErrorMessage(errorMessage);

    this.setButtonState(button, 'error', 'Failed');

    // 결과 메시지 생성
    const container = button.parentElement;
    if (!container) return;

    // 기존 결과 메시지 제거
    const existingResult = container.querySelector('.review-to-instruction-result');
    if (existingResult) {
      existingResult.remove();
    }

    // 새 결과 메시지 추가 (안전한 DOM 조작 사용)
    const resultDiv = document.createElement('div');
    resultDiv.className = 'review-to-instruction-result error';

    // SVG 아이콘
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z');
    svg.appendChild(path);

    // 에러 메시지 (textContent로 안전하게 설정)
    const messageSpan = document.createElement('span');
    messageSpan.textContent = friendlyMessage;

    resultDiv.appendChild(svg);
    resultDiv.appendChild(messageSpan);
    container.appendChild(resultDiv);

    // 8초 후 자동 제거
    setTimeout(() => {
      if (resultDiv.parentElement) {
        resultDiv.remove();
      }
      this.setButtonState(button, 'default');
    }, 8000);
  }

  /**
   * Convert error messages to user-friendly format
   */
  private getFriendlyErrorMessage(error: string): string {
    const errorLower = error.toLowerCase();

    // Token-related errors
    if (errorLower.includes('token') || errorLower.includes('설정되지') || errorLower.includes('not configured')) {
      return 'API Token is not configured. Please enter your token in the extension settings.';
    }

    // Authentication errors
    if (errorLower.includes('401') || errorLower.includes('unauthorized') || errorLower.includes('authentication')) {
      return 'Authentication failed: Token is invalid or expired.';
    }

    // Permission errors
    if (errorLower.includes('403') || errorLower.includes('forbidden') || errorLower.includes('permission')) {
      return 'Insufficient permissions: Write access to the repository is required.';
    }

    // Network errors
    if (errorLower.includes('network') || errorLower.includes('fetch') || errorLower.includes('timeout')) {
      return 'Network error: Please check your internet connection.';
    }

    // Convention detection failure
    if (errorLower.includes('컨벤션') || errorLower.includes('convention')) {
      return 'This comment is too short or not relevant. Please include at least 50 characters or code examples.';
    }

    // Keyword extraction failure (legacy safety net)
    if (errorLower.includes('키워드') || errorLower.includes('keyword')) {
      return 'Keyword extraction failed, but LLM will handle it automatically. Please try again later.';
    }

    // API errors
    if (errorLower.includes('404')) {
      // 404 is usually normal (no .claude/ directory exists yet)
      // But could be other 404s, so show original error
      return `Temporary issue occurred: ${error.substring(0, 100)}`;
    }

    if (errorLower.includes('422')) {
      return 'API request format is invalid. Please update the extension.';
    }

    // Branch duplication
    if (errorLower.includes('already exists') || errorLower.includes('duplicate')) {
      return 'A branch with the same name already exists. Please merge the existing PR first.';
    }

    // Other errors
    return `Error: ${error.length > 100 ? error.substring(0, 100) + '...' : error}`;
  }

  /**
   * 특정 코멘트의 버튼 찾기
   */
  getButton(commentId: string): HTMLButtonElement | undefined {
    return this.buttons.get(commentId);
  }

  /**
   * Thread 버튼 추가 (Discussion 상단)
   */
  addThreadButton(options: ThreadButtonOptions): HTMLButtonElement {
    const existingButton = this.threadButtons.get(options.thread.id);
    if (existingButton) {
      return existingButton;
    }

    const button = this.createThreadButton(options);
    this.insertThreadButton(options.thread.containerElement, button);
    this.threadButtons.set(options.thread.id, button);

    return button;
  }

  /**
   * Thread 버튼 엘리먼트 생성
   */
  private createThreadButton(options: ThreadButtonOptions): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = `review-to-instruction-button thread-button ${options.platform}`;
    button.setAttribute('data-thread-id', options.thread.id);
    button.setAttribute('type', 'button');

    // Thread 전용 아이콘 + 코멘트 수 표시
    const commentCount = options.thread.comments.length;

    // Thread 버튼 툴팁
    button.title = `🧵 Convert Discussion Thread to AI Instruction\n\n⚡ This thread contains ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}\nAll comments in this thread will be analyzed together to create a unified AI Instruction that captures the complete discussion context.\n(LLM analysis will be performed, costs may apply)`;

    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v9.5A1.75 1.75 0 0114.25 14H1.75A1.75 1.75 0 010 12.25v-9.5C0 1.784.784 1 1.75 1zM1.5 2.75v9.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-9.5a.25.25 0 00-.25-.25H1.75a.25.25 0 00-.25.25z"/>
        <path d="M3.5 6.75a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zm0 2.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75z"/>
      </svg>
      <span>Convert Thread (${commentCount} ${commentCount === 1 ? 'comment' : 'comments'})</span>
    `;

    // 클릭 이벤트
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleThreadButtonClick(button, options);
    });

    return button;
  }

  /**
   * Thread 버튼을 Discussion 컨테이너에 삽입
   */
  private insertThreadButton(container: HTMLElement, button: HTMLButtonElement) {
    // 이미 Thread 버튼이 있는지 확인 (중복 방지)
    const existingThreadButton = container.querySelector('.review-to-instruction-thread-button-container');
    if (existingThreadButton) {
      return;
    }

    // 버튼 컨테이너 생성
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'review-to-instruction-thread-button-container';
    buttonContainer.appendChild(button);

    // 플랫폼별 삽입 위치 찾기
    const insertionPoint = this.findThreadButtonInsertionPoint(container);

    if (insertionPoint) {
      insertionPoint.appendChild(buttonContainer);
    } else {
      // Fallback: 컨테이너 최상단에 삽입
      container.insertBefore(buttonContainer, container.firstChild);
    }
  }

  /**
   * Thread 버튼 삽입 위치 찾기 (GitHub/GitLab 호환)
   */
  private findThreadButtonInsertionPoint(container: HTMLElement): HTMLElement | null {
    // GitHub: 첫 번째 코멘트의 헤더 영역
    const githubSelectors = [
      '.timeline-comment-header',           // 코멘트 헤더
      '.timeline-comment-header-text',      // 헤더 텍스트 영역
      '.timeline-comment .comment-header'   // 코멘트 내부 헤더
    ];

    for (const selector of githubSelectors) {
      const header = container.querySelector(selector);
      if (header) {
        // 헤더 내부의 actions 영역 찾기 (있으면 그 옆에 추가)
        const actions = header.querySelector('.timeline-comment-actions, .comment-actions');
        if (actions) {
          return actions as HTMLElement;
        }
        // actions 영역이 없으면 헤더 자체에 추가
        return header as HTMLElement;
      }
    }

    // GitLab: 첫 번째 노트의 헤더 영역
    const gitlabSelectors = [
      '.note-header',                       // 노트 헤더
      '.note-header-info',                  // 헤더 정보 영역
      '[data-testid="note-header"]'        // data-testid
    ];

    for (const selector of gitlabSelectors) {
      const header = container.querySelector(selector);
      if (header) {
        // GitLab 헤더의 actions 영역 찾기
        const actions = header.querySelector('.note-actions, .note-header-actions');
        if (actions) {
          return actions as HTMLElement;
        }
        return header as HTMLElement;
      }
    }

    // Fallback: 컨테이너 자체
    return null;
  }

  /**
   * Thread 버튼 클릭 핸들러
   */
  private handleThreadButtonClick(button: HTMLButtonElement, options: ThreadButtonOptions) {
    // 버튼 상태를 loading으로 변경
    this.setButtonState(button, 'loading');

    // 콜백 실행
    try {
      options.onClick(options.thread);
    } catch (error) {
      this.setButtonState(button, 'error');

      // 3초 후 원래 상태로 복귀
      setTimeout(() => {
        this.setButtonState(button, 'default');
      }, 3000);
    }
  }

  /**
   * Thread 버튼 찾기
   */
  getThreadButton(threadId: string): HTMLButtonElement | undefined {
    return this.threadButtons.get(threadId);
  }

  /**
   * 모든 Thread 버튼 제거
   */
  removeAllThreadButtons() {
    this.threadButtons.forEach((button) => button.remove());
    this.threadButtons.clear();
  }
}
