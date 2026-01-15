/**
 * PR Convention Bridge - Comment Detector
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
  private processedComments = new Set<string>();
  private callback: CommentCallback;
  private selector: string;
  private contentSelector: string;
  private debounceTimer: number | null = null;
  private pendingMutations: MutationRecord[] = [];

  constructor(
    callback: CommentCallback,
    selector: string,
    contentSelector: string
  ) {
    this.callback = callback;
    this.selector = selector;
    this.contentSelector = contentSelector;
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

    console.log('[CommentDetector] Started observing comments');
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

    this.processedComments.clear();
    this.pendingMutations = [];
    console.log('[CommentDetector] Stopped observing');
  }

  /**
   * 페이지에 이미 존재하는 코멘트 처리
   */
  private processExistingComments() {
    const comments = document.querySelectorAll<HTMLElement>(this.selector);

    comments.forEach((comment) => {
      this.processComment(comment);
    });

    console.log(`[CommentDetector] Processed ${comments.length} existing comments`);
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

            // 추가된 노드가 코멘트인지 확인
            if (element.matches(this.selector)) {
              this.processComment(element);
            }

            // 자식 노드 중에 코멘트가 있는지 확인
            const childComments = element.querySelectorAll<HTMLElement>(this.selector);
            childComments.forEach((comment) => {
              this.processComment(comment);
            });
          }
        });
      }
    }
  }

  /**
   * 개별 코멘트 처리
   */
  private processComment(element: HTMLElement) {
    const id = this.getCommentId(element);

    if (!id || this.processedComments.has(id)) {
      return;
    }

    const contentElement = element.querySelector<HTMLElement>(this.contentSelector);

    if (!contentElement) {
      return;
    }

    this.processedComments.add(id);

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
    if (id) return id;

    // 없으면 엘리먼트를 기반으로 고유 ID 생성
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `comment-${timestamp}-${random}`;
  }
}
