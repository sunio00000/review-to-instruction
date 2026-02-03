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
  private processedCommentIds = new Map<string, boolean>();
  private callback: CommentCallback;
  private selectors: string[];
  private contentSelectors: string[];
  private debounceTimer: number | null = null;
  private pendingMutations: MutationRecord[] = [];
  private cleanupTimer: number | null = null;
  private retryCompleted = false; // 재시도 완료 플래그

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
    // 즉시 스캔
    this.processExistingComments();

    // 지수 백오프 재시도 (0.5s, 1s, 2s, 4s)
    this.scheduleRetries();

    // MutationObserver로 새 코멘트 감지
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    // 특정 컨테이너만 감시 (성능 최적화)
    this.observeCommentContainers();

    // 메모리 정리: 10분마다 processedCommentIds Map 정리
    this.scheduleMemoryCleanup();
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

    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Map 정리
    this.processedCommentIds.clear();
    this.pendingMutations = [];
  }

  /**
   * 재시도 로직: 제한된 재시도 (1s, 2s 총 2번만)
   */
  private scheduleRetries() {
    if (this.retryCompleted) {
      return; // 이미 재시도 완료
    }

    const retryDelays = [1000, 2000]; // 2번만 재시도 (성능 최적화)

    retryDelays.forEach((delay, index) => {
      setTimeout(() => {
        if (this.retryCompleted) return;

        this.processExistingComments();

        // 마지막 재시도 완료
        if (index === retryDelays.length - 1) {
          this.retryCompleted = true;
        }
      }, delay);
    });
  }

  /**
   * 메모리 정리: 10분마다 processedCommentIds Map 정리
   */
  private scheduleMemoryCleanup() {
    const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10분

    this.cleanupTimer = window.setInterval(() => {
      this.processedCommentIds.clear();
    }, CLEANUP_INTERVAL);
  }

  /**
   * 특정 컨테이너만 감시 (성능 최적화)
   */
  private observeCommentContainers() {
    const containerSelectors = [
      // GitHub
      '.js-discussion',
      '.discussion-timeline',
      '.js-timeline-item',
      // GitLab
      '.merge-request-tabs',
      '.discussion-wrapper',
      '.notes-container'
    ];

    const containers: HTMLElement[] = [];
    for (const selector of containerSelectors) {
      const container = document.querySelector<HTMLElement>(selector);
      if (container) {
        containers.push(container);
      }
    }

    if (containers.length > 0) {
      // 특정 컨테이너들만 감시
      containers.forEach(container => {
        this.observer!.observe(container, {
          childList: true,
          subtree: true
        });
      });
    } else {
      // Fallback: document.body 전체 감시
      this.observer!.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  /**
   * 페이지에 이미 존재하는 코멘트 처리
   */
  private processExistingComments() {
    let totalComments = 0;

    // 모든 선택자를 순회하며 모든 코멘트 처리 (WeakSet으로 중복 방지)
    for (const selector of this.selectors) {
      const comments = document.querySelectorAll<HTMLElement>(selector);

      comments.forEach((comment) => {
        this.processComment(comment);
      });

      totalComments += comments.length;
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
    // 시스템 노트나 커밋 히스토리 제외 (먼저 체크)
    if (this.shouldExcludeComment(element)) {
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

    if (!contentElement) {
      return;
    }

    // ID 기반 중복 체크 (DOM 교체에도 안정적)
    const id = this.getCommentId(element);
    if (this.processedCommentIds.has(id)) {
      return;
    }

    // ID를 처리됨으로 표시
    this.processedCommentIds.set(id, true);

    this.callback({
      element,
      id,
      contentElement
    });
  }

  /**
   * 제외해야 할 코멘트인지 확인
   */
  private shouldExcludeComment(element: HTMLElement): boolean {
    // ==================== Pending/Draft 코멘트 제외 ====================

    // GitHub/GitLab pending/draft 코멘트 제외 (클래스/속성)
    if (element.classList.contains('is-pending') ||
        element.classList.contains('is-comment-editing') ||
        element.classList.contains('is-comment-stale') ||
        element.hasAttribute('data-pending')) {
      return true;
    }

    // GitLab pending 배지 체크 (badge-warning + "Pending" 텍스트)
    // 구조: <span class="gl-badge badge badge-pill badge-warning" title="Pending comments...">
    const gitlabPendingBadge = element.querySelector('.gl-badge.badge-warning, .badge.badge-warning');
    if (gitlabPendingBadge) {
      const badgeText = gitlabPendingBadge.textContent?.trim() || '';
      const badgeTitle = gitlabPendingBadge.getAttribute('title') || '';
      if (badgeText.toLowerCase().includes('pending') ||
          badgeTitle.toLowerCase().includes('pending')) {
        return true;
      }
    }

    // GitLab gl-badge-content에서 Pending 체크
    const badgeContent = element.querySelector('.gl-badge-content');
    if (badgeContent && /\b(Pending|Draft)\b/i.test(badgeContent.textContent || '')) {
      return true;
    }

    // GitHub 리뷰 pending 코멘트 제외 (부모 컨테이너)
    const reviewParent = element.closest('.js-pending-review-comment, .pending-review-comment, [data-pending-review]');
    if (reviewParent) {
      return true;
    }

    // GitHub/GitLab Pending/Draft 배지 체크 (코멘트 본문 제외, 헤더만 체크)
    // GitHub: "sunio00000 now  🟠 Pending  Owner  Author"
    // GitLab: "username · Pending" 또는 "Draft" 배지

    // 전체 HTML을 복사하되 본문은 제거
    const elementClone = element.cloneNode(true) as HTMLElement;

    // GitHub 본문 제거
    const githubBody = elementClone.querySelector('.comment-body, .js-comment-body');
    if (githubBody) {
      githubBody.remove();
    }

    // GitLab 본문 제거
    const gitlabBody = elementClone.querySelector('.note-text, [data-testid="note-text"]');
    if (gitlabBody) {
      gitlabBody.remove();
    }

    // 헤더 영역에서만 "Pending" 또는 "Draft" 텍스트 찾기
    const headerText = elementClone.textContent || '';
    if (/\b(Pending|Draft)\b/i.test(headerText)) {
      return true;
    }

    // GitLab draft 코멘트 제외 (클래스/속성 기반)
    if (element.classList.contains('draft-note') ||
        element.classList.contains('is-editing') ||
        element.hasAttribute('data-draft') ||
        element.querySelector('.draft-note-label, .draft-badge')) {
      return true;
    }

    // GitLab 시스템 노트 제외 (커밋, 상태 변경, 라벨 변경 등)
    if (element.classList.contains('system-note')) {
      return true;
    }

    // GitLab 커밋 관련 요소 제외
    if (element.classList.contains('commit') ||
        element.classList.contains('commit-row') ||
        element.classList.contains('commit-row-message') ||
        element.classList.contains('commit-content')) {
      return true;
    }

    // 커밋 ID 속성이 있는 경우 제외
    if (element.hasAttribute('data-commit-id')) {
      return true;
    }

    // 부모 컨테이너가 커밋 관련인 경우 제외
    const commitParent = element.closest('.commit, .commit-row, .commits-list, .commit-discussion-notes');
    if (commitParent) {
      return true;
    }

    // 타임라인의 커밋 이벤트 제외
    if (element.hasAttribute('data-note-type')) {
      const noteType = element.getAttribute('data-note-type');
      if (noteType === 'CommitNote') {
        return true;
      }
    }

    // GitLab의 활동 피드나 커밋 히스토리 섹션 제외
    const activityParent = element.closest('.commit-activity, .commits-tab-content, .commits-container');
    if (activityParent) {
      return true;
    }

    // ==================== 새 코멘트 작성 영역 제외 ====================

    // 1. 작성자 정보 체크 (먼저 확인)
    // 작성자 정보가 있으면 = 이미 제출된 코멘트 → 포함
    const authorSelectors = [
      '.author',                       // GitHub 작성자
      'a.author',                      // GitHub 작성자 링크
      '.timeline-comment-author',      // GitHub 타임라인 작성자
      '.review-comment-author',        // GitHub 리뷰 코멘트 작성자
      '[data-hovercard-type="user"]',  // GitHub 사용자 hover 카드
      '.author-name',                  // GitHub 작성자 이름
      '.note-header-author-name',      // GitLab 작성자
      '.discussion-author'             // 디스커션 작성자
    ];

    const hasAuthor = authorSelectors.some(selector => element.querySelector(selector));

    // 작성자가 있어도 pending/draft 상태면 제외 (위에서 이미 체크됨)
    // 작성자가 있고 pending이 아니면 = 이미 제출된 코멘트 → 포함
    if (hasAuthor) {
      // 추가 pending 체크 (일부 플랫폼은 작성자가 있어도 pending일 수 있음)
      if (element.classList.contains('is-pending') ||
          element.classList.contains('draft-note') ||
          element.closest('.js-pending-review-comment, .pending-review-comment')) {
        return true;  // pending이면 제외
      }
      return false;  // 정상 제출된 코멘트
    }

    // 2. 작성자가 없는 경우 = 작성 중인 코멘트일 가능성
    // 코멘트 작성 폼 체크
    const formClasses = [
      '.note-form',              // GitLab 코멘트 폼
      '.js-main-target-form',    // 메인 코멘트 폼
      '.new-note',               // 새 노트 폼
      '.discussion-reply-holder',// 답글 작성 영역
      '.timeline-new-comment',   // GitHub 새 코멘트
      '.js-new-comment-form',    // GitHub 새 코멘트 폼
      '.review-comment-form',    // 리뷰 코멘트 폼
      '.inline-comment-form'     // 인라인 코멘트 폼
    ];

    for (const formClass of formClasses) {
      if (element.classList.contains(formClass.substring(1)) || element.closest(formClass)) {
        return true;
      }
    }

    // 3. visible textarea가 있는 경우 제외 (작성 중인 코멘트)
    const textareas = element.querySelectorAll('textarea');
    for (const textarea of Array.from(textareas)) {
      const ta = textarea as HTMLElement;
      // display:none이 아니고 visibility:hidden이 아닌 경우만 체크
      const style = window.getComputedStyle(ta);
      if (style.display !== 'none' && style.visibility !== 'hidden' && ta.offsetParent !== null) {
        return true;
      }
    }

    // 4. 작성자도 없고 폼도 아니면 → 엄격하게 필터링
    // 본문이 있고 충분히 긴 경우만 예외적으로 포함 (최소 20자)
    const commentBodySelectors = [
      '.comment-body',
      '.js-comment-body',
      '.note-text',
      '[data-testid="note-text"]',
      '.markdown-body'
    ];

    for (const selector of commentBodySelectors) {
      const bodyElement = element.querySelector(selector);
      if (bodyElement) {
        const content = bodyElement.textContent?.trim() || '';
        // 20자 이상의 본문이 있으면 정상 코멘트로 간주
        if (content.length >= 20) {
          return false;
        }
      }
    }

    // 작성자도 없고 충분한 본문도 없으면 제외 (잘못 감지된 요소)
    return true;
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
