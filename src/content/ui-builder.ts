/**
 * Review to Instruction - UI Builder
 * 코멘트에 버튼을 추가하고 UI를 관리합니다.
 */

import type { Platform, Comment, DiscussionThread } from '../types';
import { calculateCost, formatCost } from '../utils/token-pricing';

export interface ButtonOptions {
  platform: Platform;
  comment: Comment;
  onClick: (comment: Comment) => void;
  disabled?: boolean;
}

export interface ThreadButtonOptions {
  platform: Platform;
  thread: DiscussionThread;
  onClick: (thread: DiscussionThread) => void;
}

export class UIBuilder {
  private buttons = new Map<string, HTMLButtonElement>();
  private threadButtons = new Map<string, HTMLButtonElement>();

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

    // disabled 상태 설정 및 툴팁
    if (options.disabled) {
      button.disabled = true;
      button.classList.add('disabled');
      button.title = '이 코멘트는 변환 조건을 만족하지 않습니다\n(50자 이상, 컨벤션 키워드, 코드 예시, 이모지 중 하나 이상 필요)';
    } else {
      // 정상 버튼 툴팁 (답글 여부에 따라 다른 메시지)
      const hasReplies = options.comment.replies && options.comment.replies.length > 0;
      if (hasReplies) {
        button.title = `📋 Instruction 미리보기 및 생성\n\n이 코멘트와 ${options.comment.replies!.length}개의 답글을 모두 반영한 AI Instruction을 생성합니다.\n(클릭 시 LLM 분석 수행, 비용 발생)`;
      } else {
        button.title = '📋 Instruction 미리보기 및 생성\n\n이 코멘트 내용을 반영한 AI Instruction을 생성합니다.\n(클릭 시 LLM 분석 수행, 비용 발생)';
      }
    }

    // 아이콘 + 텍스트
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
      </svg>
      <span>Convert to AI Instruction</span>
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

    // 새 결과 메시지 추가
    const resultDiv = document.createElement('div');
    resultDiv.className = 'review-to-instruction-result success';

    const actionText = isUpdate ? '업데이트' : '생성';

    // 토큰 사용량 및 비용 텍스트 (작게 표시)
    const tokenText = tokenUsage
      ? (() => {
          const cost = calculateCost(
            { inputTokens: tokenUsage.inputTokens, outputTokens: tokenUsage.outputTokens },
            'claude' // TODO: 설정에서 provider 가져오기
          );
          return `<span class="token-usage" style="font-size: 0.85em; opacity: 0.8; margin-left: 8px;">(${tokenUsage.totalTokens} tokens, ${formatCost(cost)})</span>`;
        })()
      : '';

    resultDiv.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
      </svg>
      <span>Instruction ${actionText}됨! <a href="${prUrl}" target="_blank" rel="noopener noreferrer">PR 보기 →</a>${tokenText}</span>
    `;

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

    // 새 결과 메시지 추가
    const resultDiv = document.createElement('div');
    resultDiv.className = 'review-to-instruction-result error';
    resultDiv.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
      </svg>
      <span>${friendlyMessage}</span>
    `;

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
   * 에러 메시지를 사용자 친화적으로 변환
   */
  private getFriendlyErrorMessage(error: string): string {
    const errorLower = error.toLowerCase();

    // 토큰 관련 에러
    if (errorLower.includes('token') || errorLower.includes('설정되지')) {
      return 'API Token이 설정되지 않았습니다. Extension 설정에서 Token을 입력해주세요.';
    }

    // 인증 에러
    if (errorLower.includes('401') || errorLower.includes('unauthorized') || errorLower.includes('authentication')) {
      return '인증 실패: Token이 올바르지 않거나 만료되었습니다.';
    }

    // 권한 에러
    if (errorLower.includes('403') || errorLower.includes('forbidden') || errorLower.includes('permission')) {
      return '권한 부족: 레포지토리에 쓰기 권한이 필요합니다.';
    }

    // 네트워크 에러
    if (errorLower.includes('network') || errorLower.includes('fetch') || errorLower.includes('timeout')) {
      return '네트워크 오류: 인터넷 연결을 확인해주세요.';
    }

    // 컨벤션 감지 실패 (완화된 필터링)
    if (errorLower.includes('컨벤션') || errorLower.includes('convention')) {
      return '이 코멘트는 너무 짧거나 관련 내용이 없습니다. 최소 50자 이상 또는 코드 예시를 포함해주세요.';
    }

    // 키워드 추출 실패 (더 이상 발생하지 않지만 안전장치로 유지)
    if (errorLower.includes('키워드') || errorLower.includes('keyword')) {
      return '키워드 추출에 실패했지만 LLM이 자동으로 처리합니다. 잠시 후 다시 시도해주세요.';
    }

    // API 에러
    if (errorLower.includes('404')) {
      // 404는 대부분 .claude/ 디렉토리가 없는 정상 상황
      // 하지만 다른 404일 수도 있으므로 원본 에러 표시
      return `일시적인 문제가 발생했습니다: ${error.substring(0, 100)}`;
    }

    if (errorLower.includes('422')) {
      return 'API 요청 형식이 올바르지 않습니다. Extension을 업데이트해주세요.';
    }

    // 브랜치 중복
    if (errorLower.includes('already exists') || errorLower.includes('duplicate')) {
      return '이미 동일한 브랜치가 존재합니다. 기존 PR을 먼저 병합해주세요.';
    }

    // 기타 에러
    return `에러: ${error.length > 100 ? error.substring(0, 100) + '...' : error}`;
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
    button.title = `이 스레드의 ${commentCount}개 코멘트를 모두 통합 분석하여 AI Instruction을 생성합니다`;

    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v9.5A1.75 1.75 0 0114.25 14H1.75A1.75 1.75 0 010 12.25v-9.5C0 1.784.784 1 1.75 1zM1.5 2.75v9.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-9.5a.25.25 0 00-.25-.25H1.75a.25.25 0 00-.25.25z"/>
        <path d="M3.5 6.75a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zm0 2.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75z"/>
      </svg>
      <span>Convert Thread (${commentCount} comments)</span>
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
