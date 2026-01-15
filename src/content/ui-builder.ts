/**
 * PR Convention Bridge - UI Builder
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
    button.className = `pr-convention-bridge-button ${options.platform}`;
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
    container.className = 'pr-convention-bridge-button-container';
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
    state: 'default' | 'loading' | 'success' | 'error'
  ) {
    button.classList.remove('loading', 'success', 'error');
    button.disabled = false;

    switch (state) {
      case 'loading':
        button.classList.add('loading');
        button.disabled = true;
        button.querySelector('span')!.textContent = 'Processing...';
        break;

      case 'success':
        button.classList.add('success');
        button.disabled = true;
        button.querySelector('span')!.textContent = 'Converted!';

        // 3초 후 원래 상태로
        setTimeout(() => {
          if (button.classList.contains('success')) {
            this.setButtonState(button, 'default');
          }
        }, 3000);
        break;

      case 'error':
        button.classList.add('error');
        button.querySelector('span')!.textContent = 'Error';
        break;

      case 'default':
        button.querySelector('span')!.textContent = 'Convert to AI Instruction';
        break;
    }
  }

  /**
   * 특정 코멘트의 버튼 찾기
   */
  getButton(commentId: string): HTMLButtonElement | undefined {
    return this.buttons.get(commentId);
  }
}
