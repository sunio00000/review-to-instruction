/**
 * Review to Instruction - Comment Detector
 * MutationObserver를 사용하여 PR/MR 페이지의 코멘트를 감지합니다.
 */

export interface CommentElement {
  element: HTMLElement;
  id: string;
  contentElement: HTMLElement;
}

export type CommentCallback = (comment: CommentElement) => void;

export class CommentDetector {
  private observer: MutationObserver | null = null;
  private processedComments = new WeakSet<HTMLElement>();
  private callback: CommentCallback;
  private selectors: string[];
  private contentSelectors: string[];
  private debounceTimer: number | null = null;
  private pendingMutations: MutationRecord[] = [];

  constructor(
    callback: CommentCallback,
    selector: string | string[],
    contentSelector: string | string[]
  ) {
    this.callback = callback;
    // 배열로 정규화 (단일 문자열도 배열로 변환)
    this.selectors = Array.isArray(selector) ? selector : [selector];
    this.contentSelectors = Array.isArray(contentSelector) ? contentSelector : [contentSelector];
  }

  /**
   * 코멘트 감지 시작
   */
  start() {
    // 기존 코멘트 처리
    this.processExistingComments();

    // MutationObserver로 새 코멘트 감지
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

  }

  /**
   * 감지 중지
   */
  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // 대기 중인 타이머 정리
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // WeakSet은 자동으로 가비지 컬렉션되므로 clear() 불필요
    this.pendingMutations = [];
  }

  /**
   * 페이지에 이미 존재하는 코멘트 처리
   */
  private processExistingComments() {
    let totalComments = 0;

    // 모든 Fallback 선택자를 순회하며 첫 번째로 발견된 선택자 사용
    for (const selector of this.selectors) {
      const comments = document.querySelectorAll<HTMLElement>(selector);

      if (comments.length > 0) {

        comments.forEach((comment) => {
          this.processComment(comment);
        });

        totalComments = comments.length;
        break;  // 첫 번째 성공한 선택자만 사용
      }
    }

    if (totalComments === 0) {
    } else {
    }
  }

  /**
   * MutationObserver 콜백 (디바운싱 적용)
   */
  private handleMutations(mutations: MutationRecord[]) {
    this.pendingMutations.push(...mutations);

    // 기존 타이머 취소
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    // 100ms 후에 처리 (디바운싱)
    this.debounceTimer = window.setTimeout(() => {
      this.processPendingMutations();
      this.pendingMutations = [];
      this.debounceTimer = null;
    }, 100);
  }

  /**
   * 대기 중인 mutation 처리
   */
  private processPendingMutations() {
    for (const mutation of this.pendingMutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            // 추가된 노드가 코멘트인지 확인 (모든 선택자 시도)
            for (const selector of this.selectors) {
              if (element.matches(selector)) {
                this.processComment(element);
                break;  // 하나라도 매치되면 중단
              }
            }

            // 자식 노드 중에 코멘트가 있는지 확인 (모든 선택자 시도)
            for (const selector of this.selectors) {
              const childComments = element.querySelectorAll<HTMLElement>(selector);
              if (childComments.length > 0) {
                childComments.forEach((comment) => {
                  this.processComment(comment);
                });
                break;  // 하나라도 발견되면 중단
              }
            }
          }
        });
      }
    }
  }

  /**
   * 개별 코멘트 처리
   */
  private processComment(element: HTMLElement) {
    // DOM 요소 자체로 중복 체크 (ID와 무관)
    if (this.processedComments.has(element)) {
      return;
    }

    // 모든 contentSelector Fallback을 시도
    let contentElement: HTMLElement | null = null;
    for (const selector of this.contentSelectors) {
      contentElement = element.querySelector<HTMLElement>(selector);
      if (contentElement) {
        break;  // 첫 번째로 발견된 요소 사용
      }
    }

    const id = this.getCommentId(element);
    if (!contentElement) {
      return;
    }

    // DOM 요소를 처리됨으로 표시
    this.processedComments.add(element);

    this.callback({
      element,
      id,
      contentElement
    });
  }

  /**
   * 코멘트 고유 ID 생성
   */
  private getCommentId(element: HTMLElement): string {
    // data-comment-id 속성이 있으면 사용
    const dataId = element.getAttribute('data-comment-id');
    if (dataId) return dataId;

    // id 속성이 있으면 사용
    const id = element.getAttribute('id');
    if (id) {
      // id를 data-comment-id에도 저장 (일관성 유지)
      element.setAttribute('data-comment-id', id);
      return id;
    }

    // 없으면 엘리먼트를 기반으로 고유 ID 생성 후 저장
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const generatedId = `comment-${timestamp}-${random}`;

    // 생성된 ID를 element에 저장 (다음 호출 시 재사용)
    element.setAttribute('data-comment-id', generatedId);

    return generatedId;
  }
}
