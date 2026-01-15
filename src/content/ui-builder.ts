/**
 * Review to Instruction - UI Builder
 * 코멘트에 버튼을 추가하고 UI를 관리합니다.
 */

import type { Platform, Comment } from '../types';

export interface ButtonOptions {
  platform: Platform;
  comment: Comment;
  onClick: (comment: Comment) => void;
}

export class UIBuilder {
  private buttons = new Map<string, HTMLButtonElement>();

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
    // 코멘트 본문 다음에 버튼 삽입
    const container = document.createElement('div');
    container.className = 'review-to-instruction-button-container';
    container.appendChild(button);

    // 코멘트 엘리먼트의 부모를 찾아서 삽입
    const parent = contentElement.parentElement;
    if (parent) {
      const nextSibling = contentElement.nextSibling;
      if (nextSibling) {
        parent.insertBefore(container, nextSibling);
      } else {
        parent.appendChild(container);
      }
    }
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
      console.error('[UIBuilder] Button click error:', error);
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
   * 성공 메시지를 표시 (PR URL 링크 포함)
   */
  showSuccessMessage(button: HTMLButtonElement, prUrl: string, isUpdate: boolean) {
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
    resultDiv.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
      </svg>
      <span>Instruction ${actionText}됨! <a href="${prUrl}" target="_blank" rel="noopener noreferrer">PR 보기 →</a></span>
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

    // 컨벤션 감지 실패
    if (errorLower.includes('컨벤션') || errorLower.includes('convention')) {
      return '이 코멘트는 컨벤션 관련 내용이 아닙니다. 규칙이나 패턴을 명확히 설명해주세요.';
    }

    // 키워드 추출 실패
    if (errorLower.includes('키워드') || errorLower.includes('keyword')) {
      return '키워드를 추출할 수 없습니다. 더 명확한 컨벤션 설명이 필요합니다.';
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
}
