/**
 * Review to Instruction - GitLab Injector
 * GitLab MR 페이지에 버튼을 주입합니다.
 */

import { CommentDetector, type CommentElement } from './comment-detector';
import { ThreadDetector } from './thread-detector';
import { UIBuilder } from './ui-builder';
import { PreviewModal } from './preview-modal';
import { WrapupButtonManager } from './wrapup-button-manager';
import { extractCodeContextFromDOM, apiToCodeContext } from './code-context-extractor';
import { GITLAB_SELECTORS } from './platform-selectors';
import type { Comment, Repository, DiscussionThread, PRReviewData, ApiReviewThread } from '../types';
import { isConventionComment } from '../core/parser';

export class GitLabInjector {
  private detector: CommentDetector;
  private threadDetector: ThreadDetector;
  private uiBuilder: UIBuilder;
  private wrapupManager: WrapupButtonManager;
  private repository: Repository | null = null;
  private threadObserver: MutationObserver | null = null;
  private hasApiToken: boolean = false;
  private reviewData: PRReviewData | null = null;

  constructor() {
    this.uiBuilder = new UIBuilder();
    this.threadDetector = new ThreadDetector('gitlab');
    this.wrapupManager = new WrapupButtonManager('gitlab');

    // GitLab MR 페이지의 코멘트 선택자 (platform-selectors.ts에서 중앙 관리)
    // 시스템 노트, 커밋 히스토리, 새 코멘트 작성 폼은 shouldExcludeComment에서 필터링
    this.detector = new CommentDetector(
      (comment) => this.onCommentDetected(comment),
      GITLAB_SELECTORS.comment.containers,
      GITLAB_SELECTORS.comment.content
    );
  }

  /**
   * GitLab 페이지에서 레포지토리 정보 추출
   */
  private extractRepository(): Repository | null {
    try {
      const pathParts = window.location.pathname.split('/').filter(Boolean);

      // 경로 형식: /owner/repo/-/merge_requests/number
      const mrIndex = pathParts.indexOf('merge_requests');
      if (mrIndex >= 2 && pathParts[mrIndex - 1] === '-') {
        const owner = pathParts[0];
        const name = pathParts[1];
        const prNumber = parseInt(pathParts[mrIndex + 1], 10);

        // 현재 브랜치 정보 (MR 페이지에서 추출) - Fallback 지원
        let branch = this.extractBranch();

        if (!branch) {
          branch = 'main';
        }

        // 타겟 브랜치(base branch) 정보 추출
        let baseBranch = this.extractBaseBranch();

        if (!baseBranch) {
          baseBranch = 'main';
        }

        return {
          owner,
          name,
          platform: 'gitlab',
          branch,
          baseBranch,
          prNumber
        };
      }
    } catch (error) {
    }

    return null;
  }

  /**
   * GitLab MR 페이지에서 브랜치 정보 추출 (Fallback 지원)
   */
  private extractBranch(): string | null {
    // 1. DOM 선택자로 추출 시도 (platform-selectors.ts에서 관리)
    for (const selector of GITLAB_SELECTORS.branch.source) {
      const elements = document.querySelectorAll(selector);

      for (const element of elements) {
        const branch = element?.textContent?.trim();

        // "from" 또는 요청 정보에서 소스 브랜치 찾기
        if (branch && element.parentElement?.textContent?.includes('from')) {
          return branch;
        }

        // href 속성에서 브랜치 추출
        if (element instanceof HTMLAnchorElement && element.href.includes('/-/commits/')) {
          const match = element.href.match(/\/-\/commits\/([^/?#]+)/);
          if (match && match[1]) {
            const decodedBranch = decodeURIComponent(match[1]);
            return decodedBranch;
          }
        }

        if (branch) {
          return branch;
        }
      }
    }

    // 2. MR 정보 영역에서 "Request to merge <branch>" 패턴 찾기
    const mrInfo = document.querySelector('.merge-request-details, .issuable-details, .detail-page-description');
    if (mrInfo) {
      const infoText = mrInfo.textContent || '';
      const mergeMatch = infoText.match(/merge\s+([^\s]+)\s+into/i);
      if (mergeMatch && mergeMatch[1]) {
        const branch = mergeMatch[1].trim();
        return branch;
      }
    }

    // 3. URL에서 추출 시도 (Fallback)
    // GitLab MR URL 패턴: /owner/repo/-/merge_requests/123/diffs?start_sha=xxx&head_sha=yyy
    const urlParams = new URLSearchParams(window.location.search);
    const headSha = urlParams.get('head_sha');

    if (headSha) {
      return headSha.substring(0, 8);  // SHA의 앞 8자리 사용
    }

    // 4. 페이지 제목에서 추출 시도 (최종 Fallback)
    // 페이지 제목 예: "Merge Request !123: Add new feature (branch-name → main)"
    const titleMatch = document.title.match(/\(([^)→]+)\s*→/);
    if (titleMatch && titleMatch[1]) {
      const branch = titleMatch[1].trim();
      return branch;
    }

    return null;
  }

  /**
   * GitLab MR 페이지에서 타겟 브랜치(base branch) 정보 추출
   */
  private extractBaseBranch(): string | null {
    // 1. DOM 선택자로 추출 시도 (platform-selectors.ts에서 관리)
    for (const selector of GITLAB_SELECTORS.branch.target) {
      const elements = document.querySelectorAll(selector);

      for (const element of elements) {
        const branch = element?.textContent?.trim();

        // "into" 또는 "→" 다음에 오는 브랜치 찾기
        if (branch && element.parentElement?.textContent?.includes('into')) {
          return branch;
        }

        // href 속성에서 브랜치 추출
        if (element instanceof HTMLAnchorElement && element.href.includes('/-/tree/')) {
          const match = element.href.match(/\/-\/tree\/([^/?#]+)/);
          if (match && match[1]) {
            const decodedBranch = decodeURIComponent(match[1]);
            return decodedBranch;
          }
        }

        if (branch) {
          return branch;
        }
      }
    }

    // 2. MR 정보 영역에서 "into <branch>" 패턴 찾기
    const mrInfo = document.querySelector('.merge-request-details, .issuable-details, .detail-page-description');
    if (mrInfo) {
      const infoText = mrInfo.textContent || '';
      const intoMatch = infoText.match(/into\s+([^\s]+)/i);
      if (intoMatch && intoMatch[1]) {
        const branch = intoMatch[1].trim();
        return branch;
      }
    }

    // 3. 페이지 제목에서 추출 시도
    // 페이지 제목 예: "Merge Request !123: Add new feature (branch-name → main)"
    const titleMatch = document.title.match(/→\s*([^)]+)\)/);
    if (titleMatch && titleMatch[1]) {
      const branch = titleMatch[1].trim();
      return branch;
    }

    // 4. 페이지 본문에서 "wants to merge ... into ..." 패턴 찾기
    const bodyText = document.body.textContent || '';
    const wantsToMergeMatch = bodyText.match(/wants to merge.*?into\s+([^\s]+)/i);
    if (wantsToMergeMatch && wantsToMergeMatch[1]) {
      const branch = wantsToMergeMatch[1].trim();
      return branch;
    }

    return null;
  }

  /**
   * 시작
   */
  async start() {

    // 설정 확인
    const config = await this.getConfig();
    if (!config.showButtons) {
      return;
    }

    // API Token 상태 확인
    await this.checkApiTokenStatus();

    // 레포지토리 정보 추출
    this.repository = this.extractRepository();
    // repository 정보 없이도 계속 진행 (버튼은 표시되지만 클릭 시 재시도)

    // GitLab: Collapsed 토론 펼치기 (API 데이터 조회 전 DOM 준비)
    this.expandCollapsedDiscussionsOnPage();

    // 코멘트 감지 시작 (repository 정보 유무와 관계없이)
    this.detector.start();

    // API 기반 리뷰 데이터 조회 → Thread/Wrapup 버튼 생성
    this.fetchReviewData().then(async () => {
      if (this.reviewData) {
        this.addThreadButtonsFromApi();
        this.wrapupManager.addWrapupButtonFromApi(this.reviewData, (comments) => this.onWrapupButtonClick(comments));
      } else {
        // API 실패 시 기존 DOM 기반 fallback
        this.detectAndAddThreadButtons();
        this.observeThreads();
        await this.wrapupManager.addWrapupButton((comments) => this.onWrapupButtonClick(comments));
      }
    }).catch(async () => {
      // fallback: 기존 DOM 기반
      this.detectAndAddThreadButtons();
      this.observeThreads();
      await this.wrapupManager.addWrapupButton((comments) => this.onWrapupButtonClick(comments));
    });
  }

  /**
   * API Token 상태 확인 (복호화 가능 여부)
   */
  private async checkApiTokenStatus() {
    try {
      // Chrome API 존재 여부 확인
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        this.hasApiToken = false;
        return;
      }

      // Background로 메시지 전송하여 토큰 유효성 확인
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_TOKEN_STATUS',
        payload: { platform: 'gitlab' }
      });

      if (response.success) {
        this.hasApiToken = response.data.hasValidTokens;
      } else {
        this.hasApiToken = false;
      }
    } catch (error) {
      this.hasApiToken = false;
    }
  }

  /**
   * 중지
   */
  /**
   * GitLab: Collapsed 토론 펼치기
   */
  private expandCollapsedDiscussionsOnPage(): void {
    const collapsed = Array.from(
      document.querySelectorAll<HTMLElement>('.discussion.collapsed, .timeline-content.collapsed')
    );

    for (const discussion of collapsed) {
      try {
        discussion.classList.remove('collapsed');
        const expandButton = discussion.querySelector<HTMLElement>(
          '.discussion-toggle-button, .js-toggle-button, [aria-label*="Expand"]'
        );
        if (expandButton) expandButton.click();

        const body = discussion.querySelector<HTMLElement>('.discussion-body, .note-body');
        if (body && body.style.display === 'none') {
          body.style.display = '';
        }
      } catch {
        // 펼치기 실패는 무시
      }
    }
  }

  stop() {
    this.detector.stop();
    this.uiBuilder.removeAllButtons();
    this.uiBuilder.removeAllThreadButtons();
    this.wrapupManager.removeWrapupButton();

    // Thread Observer 정지
    if (this.threadObserver) {
      this.threadObserver.disconnect();
      this.threadObserver = null;
    }
  }

  /**
   * 코멘트 감지 콜백
   */
  private onCommentDetected(commentElement: CommentElement) {

    // 코멘트 정보 추출
    const comment = this.extractCommentInfo(commentElement);
    if (!comment) {
      return;
    }

    // 비활성화 이유 결정
    let disabled = false;
    let disabledReason = '';

    // 1. API Token 확인
    if (!this.hasApiToken) {
      disabled = true;
      disabledReason = '⚠️ API tokens not configured\n\nPlease configure your GitLab token and LLM API key in the extension settings to use this feature.';
    }
    // 2. 컨벤션 코멘트 여부 체크 (API token이 있는 경우에만)
    else {
      const isConvention = isConventionComment(comment.content);
      if (!isConvention) {
        disabled = true;
        disabledReason = '⚠️ Comment does not meet requirements\n\nThis comment needs at least one of:\n• 50+ characters\n• Convention keywords (e.g., "must", "should", "avoid")\n• Code examples\n• Emojis';
      }
    }

    // 버튼 추가
    this.uiBuilder.addButton(
      commentElement.element,
      commentElement.contentElement,
      {
        platform: 'gitlab',
        comment,
        onClick: (comment) => this.onButtonClick(comment),
        disabled,
        disabledReason
      }
    );
  }

  /**
   * 코멘트 정보 추출 (디스커션 답글 포함)
   */
  private extractCommentInfo(commentElement: CommentElement): Comment | null {
    try {
      const element = commentElement.element;

      // 작성자 (platform-selectors.ts에서 관리)
      let author = 'Unknown';
      for (const selector of GITLAB_SELECTORS.comment.author) {
        const authorElement = element.querySelector(selector);
        if (authorElement?.textContent?.trim()) {
          author = authorElement.textContent.trim();
          break;
        }
      }

      // 코멘트 내용
      const content = commentElement.contentElement.textContent?.trim() || '';
      const htmlContent = commentElement.contentElement.innerHTML || '';

      // 작성 시간 (platform-selectors.ts에서 관리)
      let createdAt = new Date().toISOString();
      for (const selector of GITLAB_SELECTORS.comment.timestamp) {
        const timeElement = element.querySelector(selector);
        const datetime = timeElement?.getAttribute('datetime');
        if (datetime) {
          createdAt = datetime;
          break;
        }
      }

      // 코멘트 URL
      const url = window.location.href;

      // 디스커션 답글 추출 (Feature 2)
      const replies = this.extractDiscussionReplies(element);

      // 코드 컨텍스트 추출: API 데이터 우선, DOM fallback
      const apiComment = this.findApiCommentForElement(commentElement);
      const codeContext = apiComment
        ? apiToCodeContext(apiComment)
        : extractCodeContextFromDOM(element, 'gitlab');

      return {
        id: commentElement.id,
        author,
        content,
        htmlContent,
        url,
        createdAt,
        platform: 'gitlab',
        replies: replies.length > 0 ? replies : undefined,
        codeContext
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 디스커션 스레드의 답글 추출
   */
  private extractDiscussionReplies(noteElement: Element): Array<{ id: string; author: string; content: string; createdAt: string; }> {
    const replies: Array<{ id: string; author: string; content: string; createdAt: string; }> = [];

    try {
      // GitLab에서 답글은 thread.replyArea 컨테이너 내의 다른 note 요소들
      const replyAreaSelector = GITLAB_SELECTORS.thread.replyArea.join(', ');
      const discussionContainer = noteElement.closest(replyAreaSelector);
      if (!discussionContainer) return replies;

      // 모든 note 요소 찾기 (system-note 제외)
      const allNotes = Array.from(discussionContainer.querySelectorAll('.note:not(.system-note)'));

      // 현재 note의 인덱스 찾기
      const currentIndex = allNotes.indexOf(noteElement as Element);
      if (currentIndex === -1) return replies;

      // 현재 note 다음부터만 답글로 추출 (현재 note 이후의 notes만)
      for (let i = currentIndex + 1; i < allNotes.length; i++) {
        const replyElement = allNotes[i];

        let replyAuthor = 'Unknown';
        for (const selector of GITLAB_SELECTORS.comment.author) {
          replyAuthor = replyElement.querySelector(selector)?.textContent?.trim() || 'Unknown';
          if (replyAuthor !== 'Unknown') break;
        }
        let replyBody: Element | null = null;
        for (const selector of GITLAB_SELECTORS.comment.content) {
          replyBody = replyElement.querySelector(selector);
          if (replyBody) break;
        }
        const replyContent = replyBody?.textContent?.trim() || '';
        let replyTime = '';
        for (const selector of GITLAB_SELECTORS.comment.timestamp) {
          replyTime = replyElement.querySelector(selector)?.getAttribute('datetime') || '';
          if (replyTime) break;
        }
        const replyId = replyElement.id || `reply-${i}`;

        if (replyContent) {
          replies.push({
            id: replyId,
            author: replyAuthor,
            content: replyContent,
            createdAt: replyTime
          });
        }
      }
    } catch (error) {
      // 답글 추출 실패는 무시하고 빈 배열 반환
    }

    return replies;
  }

  /**
   * 버튼 클릭 핸들러
   */
  private async onButtonClick(comment: Comment) {
    const button = this.uiBuilder.getButton(comment.id);
    if (!button) return;

    // Progress 타이머 추적 (취소 가능하도록)
    const progressTimers: number[] = [];

    try {
      // Chrome Extension API 체크
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome Extension API is not available.');
      }

      // 1. Progress 시뮬레이션 시작
      this.simulateProgress(button, progressTimers);

      // 2. 미리보기 요청 (실제 LLM 호출)
      const previewResponse = await chrome.runtime.sendMessage({
        type: 'PREVIEW_INSTRUCTION',
        payload: { comment, repository: this.repository }
      });

      // Progress 타이머 정리
      progressTimers.forEach(timer => clearTimeout(timer));

      if (!previewResponse.success) {
        throw new Error(previewResponse.error || 'Preview failed');
      }

      // 3. 완료: 100%
      this.uiBuilder.setButtonProgress(button, 100, 'Complete!');
      await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 표시

      // 4. 버튼 상태 복원
      this.uiBuilder.setButtonState(button, 'default');

      // 5. PreviewModal 표시 (edit 콜백 포함)
      let editedContent: string | null = null;
      const modal = new PreviewModal();
      const action = await modal.show({
        result: previewResponse.data.result,
        warnings: [],
        onEdit: (content) => { editedContent = content; }
      });

      // 6. 사용자 액션 처리
      if (action === 'cancel') {
        return;
      }

      // 7. edit 또는 confirm: 실제 변환 수행
      if (action === 'edit' || action === 'confirm') {
        this.uiBuilder.setButtonState(button, 'loading');

        const payload = action === 'edit' && editedContent !== null
          ? { comment, repository: this.repository, editedContent }
          : { comment, repository: this.repository };

        const convertResponse = await chrome.runtime.sendMessage({
          type: 'CONFIRM_AND_CONVERT',
          payload
        });

        if (convertResponse.success) {
          this.uiBuilder.showSuccessMessage(
            button,
            convertResponse.data.prUrl,
            convertResponse.data.isUpdate,
            convertResponse.data.tokenUsage,
            'gitlab',
            convertResponse.data.skipped,
            convertResponse.data.merged,
            convertResponse.data.similarityScore
          );
        } else {
          throw new Error(convertResponse.error || 'Conversion failed');
        }
      }

    } catch (error) {
      // Progress 타이머 정리
      progressTimers.forEach(timer => clearTimeout(timer));

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Extension context invalidated 에러 특별 처리
      if (errorMessage.includes('Extension context invalidated') ||
          errorMessage.includes('message port closed') ||
          errorMessage.includes('runtime.sendMessage')) {
        this.uiBuilder.setButtonState(button, 'error');
        alert(
          `⚠️ Extension Connection Lost\n\n` +
          `The extension was reloaded or updated.\n\n` +
          `💡 Please reload this page (F5) and try again.`
        );
        return;
      }

      this.uiBuilder.showErrorMessage(button, errorMessage, 'gitlab');
    }
  }

  /**
   * Progress 시뮬레이션 (추정 기반)
   */
  private simulateProgress(button: HTMLButtonElement, timers: number[]) {
    // 0ms: 0%
    this.uiBuilder.setButtonProgress(button, 0, 'Starting...');

    // 100ms: 10%
    timers.push(setTimeout(() => {
      this.uiBuilder.setButtonProgress(button, 10, 'Parsing comment...');
    }, 100));

    // 300ms: 20%
    timers.push(setTimeout(() => {
      this.uiBuilder.setButtonProgress(button, 20, 'Preparing analysis...');
    }, 300));

    // 500ms-5000ms: 20% → 90% (선형 증가)
    const startPercent = 20;
    const endPercent = 90;
    const startTime = 500;
    const endTime = 5000;
    const steps = 20; // 20단계로 나눔

    for (let i = 0; i <= steps; i++) {
      const time = startTime + (endTime - startTime) * (i / steps);
      const percent = startPercent + (endPercent - startPercent) * (i / steps);

      timers.push(setTimeout(() => {
        this.uiBuilder.setButtonProgress(button, percent, 'Analyzing with Claude...');
      }, time));
    }

    // 5000ms: 95%
    timers.push(setTimeout(() => {
      this.uiBuilder.setButtonProgress(button, 95, 'Processing results...');
    }, 5000));
  }

  /**
   * Thread 감지 및 버튼 추가
   */
  private detectAndAddThreadButtons() {
    const threads = this.threadDetector.detectThreads();

    threads.forEach(thread => {
      // 2개 이상 코멘트가 있는 Thread만 처리
      if (thread.comments.length >= 2) {
        this.uiBuilder.addThreadButton({
          platform: 'gitlab',
          thread,
          onClick: (thread) => this.onThreadButtonClick(thread)
        });
      }
    });
  }

  /**
   * 새로운 Thread 감지 (MutationObserver)
   */
  private observeThreads() {
    // 이미 Observer가 있으면 재사용
    if (this.threadObserver) {
      return;
    }

    let debounceTimer: number | null = null;

    this.threadObserver = new MutationObserver(() => {
      // 디바운싱: 500ms 후 Thread 재감지 (성능 최적화)
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        this.detectAndAddThreadButtons();
        debounceTimer = null;
      }, 500) as unknown as number;
    });

    // MR discussion 컨테이너 감시
    const discussionContainer = document.querySelector('.merge-request-tabs, .discussion-wrapper');
    if (discussionContainer) {
      this.threadObserver.observe(discussionContainer, {
        childList: true,
        subtree: false // subtree를 false로 변경하여 성능 향상
      });
    }
  }

  /**
   * DOM 코멘트 요소에 대응하는 API 코멘트 찾기
   */
  private findApiCommentForElement(commentElement: CommentElement): import('../types').ApiReviewComment | undefined {
    if (!this.reviewData) return undefined;

    const elementId = commentElement.id;

    for (const thread of this.reviewData.threads) {
      for (const c of thread.comments) {
        if (elementId.includes(String(c.id))) {
          return c;
        }
      }
    }

    for (const c of this.reviewData.generalComments) {
      if (elementId.includes(String(c.id))) {
        return c;
      }
    }

    return undefined;
  }

  /**
   * API로 MR 리뷰 데이터 조회
   */
  private async fetchReviewData(): Promise<void> {
    if (!this.repository) return;

    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

      const response = await chrome.runtime.sendMessage({
        type: 'GET_PR_REVIEW_DATA',
        payload: {
          owner: this.repository.owner,
          name: this.repository.name,
          prNumber: this.repository.prNumber,
          platform: 'gitlab'
        }
      });

      if (response.success && response.data) {
        this.reviewData = response.data;
      }
    } catch {
      // API 실패 시 reviewData는 null 유지 → fallback
    }
  }

  /**
   * API 데이터 기반 Thread 버튼 추가
   */
  private addThreadButtonsFromApi(): void {
    if (!this.reviewData) return;

    for (const apiThread of this.reviewData.threads) {
      if (apiThread.comments.length < 2) continue;

      const container = this.findThreadContainerForApi(apiThread);
      if (!container) continue;

      const thread = this.apiThreadToDiscussionThread(apiThread, container);

      this.uiBuilder.addThreadButton({
        platform: 'gitlab',
        thread,
        onClick: (t) => this.onThreadButtonClick(t)
      });
    }
  }

  /**
   * API 스레드에 대응하는 DOM 컨테이너 찾기
   */
  private findThreadContainerForApi(apiThread: ApiReviewThread): HTMLElement | null {
    // 1. discussion ID 기반 탐색
    const byId = document.querySelector<HTMLElement>(
      `[data-discussion-id="${apiThread.id}"]`
    );
    if (byId) return byId;

    // 2. 첫 번째 노트 ID 기반 탐색
    const firstNoteId = apiThread.comments[0]?.id;
    if (firstNoteId) {
      const byNoteId = document.querySelector<HTMLElement>(
        `#note_${firstNoteId}, [data-note-id="${firstNoteId}"]`
      );
      if (byNoteId) {
        return byNoteId.closest<HTMLElement>('.discussion-notes, .notes, [data-discussion-id]');
      }
    }

    return null;
  }

  /**
   * API 스레드 → DiscussionThread 변환
   */
  private apiThreadToDiscussionThread(
    apiThread: ApiReviewThread,
    container: HTMLElement
  ): DiscussionThread {
    const comments: Comment[] = apiThread.comments.map(c => ({
      id: String(c.id),
      author: c.author,
      content: c.body,
      htmlContent: c.body,
      url: window.location.href,
      createdAt: c.createdAt,
      platform: 'gitlab' as const,
      codeContext: c.path ? {
        filePath: c.path,
        lines: c.diffHunk || '',
        startLine: c.line,
        endLine: c.line
      } : undefined
    }));

    return {
      id: `thread-api-${apiThread.id}`,
      platform: 'gitlab',
      comments,
      containerElement: container
    };
  }

  /**
   * Thread 버튼 클릭 핸들러
   */
  private async onThreadButtonClick(thread: DiscussionThread) {
    const button = this.uiBuilder.getThreadButton(thread.id);
    if (!button) return;

    try {
      // Chrome Extension API 존재 여부 확인
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome Extension API is not available. Please check if the extension is properly loaded.');
      }

      // Background script로 메시지 전송
      const response = await chrome.runtime.sendMessage({
        type: 'CONVERT_THREAD',
        payload: {
          thread,
          repository: this.repository
        }
      });

      if (response.success) {
        // 성공 메시지 표시
        this.uiBuilder.showSuccessMessage(
          button,
          response.data.prUrl,
          response.data.isUpdate,
          response.data.tokenUsage,
          'gitlab',
          response.data.skipped,
          response.data.merged,
          response.data.similarityScore
        );
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (error) {
      // 에러 메시지 표시
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Extension context invalidated 에러 특별 처리
      if (errorMessage.includes('Extension context invalidated') ||
          errorMessage.includes('message port closed') ||
          errorMessage.includes('runtime.sendMessage')) {
        this.uiBuilder.setButtonState(button, 'error');
        alert(
          `⚠️ Extension Connection Lost\n\n` +
          `The extension was reloaded or updated.\n\n` +
          `💡 Please reload this page (F5) and try again.`
        );
        return;
      }

      this.uiBuilder.showErrorMessage(button, errorMessage, 'gitlab');
    }
  }

  /**
   * Wrapup 버튼 클릭 핸들러
   */
  private async onWrapupButtonClick(comments: Comment[]) {
    const button = this.wrapupManager.getButton();
    if (!button) return;


    try {
      // Chrome Extension API 존재 여부 확인
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome Extension API is not available. Please check if the extension is properly loaded.');
      }

      // 버튼 상태를 loading으로 변경
      this.wrapupManager.setButtonState('loading', 'Processing...');

      // Background script로 메시지 전송
      const response = await chrome.runtime.sendMessage({
        type: 'CONVERT_PR_WRAPUP',
        payload: {
          comments,
          repository: this.repository
        }
      });

      if (response.success) {
        // 성공 메시지 표시
        this.wrapupManager.setButtonState('success', 'Converted!');

        // 3초 후 성공 메시지를 alert로 표시
        setTimeout(() => {
          const prUrl = response.data.prUrl || 'N/A';
          const fileCount = response.data.fileCount || 0;
          const tokenUsage = response.data.tokenUsage;

          let message = `✅ Successfully converted ${comments.length} comments to AI Instructions!\n\n`;
          message += `📁 Files created/updated: ${fileCount}\n`;
          message += `🔗 MR: ${prUrl}\n`;

          if (tokenUsage) {
            message += `\n💰 Tokens used: ${tokenUsage.totalTokens}`;
          }

          alert(message);

          // MR 열기
          if (prUrl && prUrl !== 'N/A') {
            window.open(prUrl, '_blank');
          }
        }, 500);
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (error) {
      // 에러 메시지 표시
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[RTI Error] [GitLabInjector] Wrapup conversion failed:', errorMessage);

      this.wrapupManager.setButtonState('error', 'Failed');

      // Extension context invalidated 에러 특별 처리
      if (errorMessage.includes('Extension context invalidated') ||
          errorMessage.includes('message port closed') ||
          errorMessage.includes('runtime.sendMessage')) {
        setTimeout(() => {
          alert(
            `⚠️ Extension Connection Lost\n\n` +
            `The extension was reloaded or updated while processing your request.\n\n` +
            `💡 Solution:\n` +
            `1. Reload this page (F5 or Ctrl+R)\n` +
            `2. Try the operation again\n\n` +
            `If the problem persists:\n` +
            `• Go to chrome://extensions\n` +
            `• Find "Review to Instruction"\n` +
            `• Click the reload button`
          );
        }, 500);
        return;
      }

      // 3초 후 에러 메시지 표시
      setTimeout(() => {
        alert(`❌ Failed to convert MR conventions:\n\n${errorMessage}`);
      }, 500);
    }
  }

  /**
   * 설정 가져오기 (chrome.storage.local에서)
   */
  private async getConfig() {
    try {
      // Chrome API 존재 여부 확인
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return { showButtons: true };
      }

      const result = await chrome.storage.local.get(['showButtons']);
      return {
        showButtons: result.showButtons !== false  // 기본값 true
      };
    } catch (error) {
      return { showButtons: true };
    }
  }
}
