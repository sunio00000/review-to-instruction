/**
 * Review to Instruction - GitHub Injector
 * GitHub PR 페이지에 버튼을 주입합니다.
 */

import { CommentDetector, type CommentElement } from './comment-detector';
import { ThreadDetector } from './thread-detector';
import { UIBuilder } from './ui-builder';
import { PreviewModal } from './preview-modal';
import { WrapupButtonManager } from './wrapup-button-manager';
import { extractCodeContextFromDOM } from './code-context-extractor';
import type { Comment, Repository, DiscussionThread, PRReviewData, ApiReviewThread } from '../types';
import { isConventionComment } from '../core/parser';

export class GitHubInjector {
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

    // GitHub PR 페이지의 코멘트 선택자
    // 일반 코멘트, 리뷰 코멘트, 인라인 코드 리뷰 코멘트 포함
    this.detector = new CommentDetector(
      (comment) => this.onCommentDetected(comment),
      [
        '.timeline-comment',           // 일반 타임라인 코멘트
        '.review-comment',             // 리뷰 코멘트
        '.js-comment',                 // JS 타겟 코멘트
        '.inline-comment',             // 인라인 코멘트
        '.js-comment-container',       // 코멘트 컨테이너
        'div[id^="discussion_r"]',     // 디스커션 ID로 시작하는 div
        'div[id^="pullrequestreview"]' // PR 리뷰 ID로 시작하는 div
      ],
      [
        '.comment-body',               // 기본 코멘트 본문
        '.js-comment-body',            // JS 타겟 본문
        '.review-comment-contents .comment-body', // 리뷰 코멘트 본문
        '.edit-comment-hide'           // 편집 가능 코멘트
      ]
    );

    // Thread 감지기
    this.threadDetector = new ThreadDetector('github');

    // Wrapup 버튼 관리자
    this.wrapupManager = new WrapupButtonManager('github');
  }

  /**
   * GitHub 페이지에서 레포지토리 정보 추출
   */
  private extractRepository(): Repository | null {
    try {
      const pathParts = window.location.pathname.split('/').filter(Boolean);

      // 경로 형식: /owner/repo/pull/number
      if (pathParts.length >= 4 && pathParts[2] === 'pull') {
        const owner = pathParts[0];
        const name = pathParts[1];
        const prNumber = parseInt(pathParts[3], 10);

        // PR의 작업 브랜치 정보 추출 (instruction을 추가할 대상)
        // 1. head-ref 시도 (PR의 source/head branch - 작업 중인 브랜치)
        let branch = document.querySelector('.head-ref')?.textContent?.trim();

        // 2. branch-name 클래스 시도
        if (!branch) {
          const branchElement = document.querySelector('.commit-ref.head-ref .css-truncate-target');
          branch = branchElement?.textContent?.trim();
        }

        // 3. API를 통해 PR 정보 가져오기 (fallback)
        if (!branch) {
          // API fallback은 updateDefaultBranch에서 처리
          branch = 'main';  // 임시값
        }

        // PR의 타겟 브랜치(base branch) 정보 추출
        // 1. base-ref 시도 (PR의 target/base branch - 머지 대상 브랜치)
        let baseBranch = document.querySelector('.base-ref')?.textContent?.trim();

        // 2. branch-name 클래스 시도
        if (!baseBranch) {
          const baseBranchElement = document.querySelector('.commit-ref.base-ref .css-truncate-target');
          baseBranch = baseBranchElement?.textContent?.trim();
        }

        // 3. fallback to 'main'
        if (!baseBranch) {
          baseBranch = 'main';
        }

        return {
          owner,
          name,
          platform: 'github',
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
    if (!this.repository) {
      return;
    }

    // ✅ 즉시 버튼 감지 시작 (차단 없음)
    this.detector.start();

    // API 기반 리뷰 데이터 조회 → Thread 버튼 생성
    this.fetchReviewData().then(() => {
      if (this.reviewData) {
        this.addThreadButtonsFromApi();
      } else {
        // API 실패 시 기존 DOM 기반 fallback
        this.detectAndAddThreadButtons();
        this.observeThreads();
      }
    }).catch(() => {
      // fallback: 기존 DOM 기반
      this.detectAndAddThreadButtons();
      this.observeThreads();
    });

    // Wrapup 버튼 추가

    // API Token 여부와 관계없이 버튼 추가 (클릭 시 체크)
    await this.wrapupManager.addWrapupButton((comments) => this.onWrapupButtonClick(comments));

    // ✅ 브랜치 정보는 백그라운드에서 업데이트
    this.updateDefaultBranch().catch(() => {
      // 실패해도 버튼은 이미 표시되어 있음
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
        payload: { platform: 'github' }
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
   * API를 통해 PR의 head branch와 base branch 가져오기
   */
  private async updateDefaultBranch() {
    if (!this.repository) return;

    // Chrome Extension API 확인
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }

    try {
      // Background script를 통해 PR 정보 API 호출
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PR_INFO',
        payload: {
          owner: this.repository.owner,
          name: this.repository.name,
          prNumber: this.repository.prNumber
        }
      });

      if (response.success) {
        // head branch (작업 브랜치) 저장
        if (response.data.head_branch) {
          this.repository.branch = response.data.head_branch;
        }
        // base branch (타겟 브랜치) 저장
        if (response.data.base_branch) {
          this.repository.baseBranch = response.data.base_branch;
        }
      }
    } catch (error) {
      // API 호출 실패는 무시 (DOM에서 추출한 branch 사용)
    }
  }

  /**
   * 중지
   */
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
      disabledReason = '⚠️ API tokens not configured\n\nPlease configure your GitHub token and LLM API key in the extension settings to use this feature.';
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
        platform: 'github',
        comment,
        onClick: (comment) => this.onButtonClick(comment),
        disabled,
        disabledReason
      }
    );
  }

  /**
   * 코멘트 정보 추출 (스레드 답글 포함)
   */
  private extractCommentInfo(commentElement: CommentElement): Comment | null {
    try {
      const element = commentElement.element;

      // 작성자
      const authorElement = element.querySelector('.author');
      const author = authorElement?.textContent?.trim() || 'Unknown';

      // 코멘트 내용
      const content = commentElement.contentElement.textContent?.trim() || '';
      const htmlContent = commentElement.contentElement.innerHTML || '';

      // 작성 시간
      const timeElement = element.querySelector('relative-time');
      const createdAt = timeElement?.getAttribute('datetime') || new Date().toISOString();

      // 코멘트 URL
      const url = window.location.href;

      // 스레드 답글 추출 (Feature 2)
      const replies = this.extractCommentReplies(element);

      // 코드 컨텍스트 추출 (인라인 리뷰인 경우)
      const codeContext = extractCodeContextFromDOM(element, 'github');

      return {
        id: commentElement.id,
        author,
        content,
        htmlContent,
        url,
        createdAt,
        platform: 'github',
        replies: replies.length > 0 ? replies : undefined,
        codeContext
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 코멘트 스레드의 답글 추출
   */
  private extractCommentReplies(commentElement: Element): Array<{ id: string; author: string; content: string; createdAt: string; }> {
    const replies: Array<{ id: string; author: string; content: string; createdAt: string; }> = [];

    try {
      // GitHub에서 답글은 같은 timeline-comment-group 내에 있거나
      // review-thread-reply 클래스를 가진 요소들에 있음
      const parentGroup = commentElement.closest('.timeline-comment-group, .review-thread');
      if (!parentGroup) return replies;

      // 모든 코멘트 요소 찾기 (첫 번째는 원본 코멘트, 나머지는 답글)
      const allComments = Array.from(parentGroup.querySelectorAll('.timeline-comment, .review-comment'));

      // 첫 번째 요소(원본 코멘트) 제외하고 답글만 추출
      for (let i = 1; i < allComments.length; i++) {
        const replyElement = allComments[i];

        const replyAuthor = replyElement.querySelector('.author')?.textContent?.trim() || 'Unknown';
        const replyBody = replyElement.querySelector('.comment-body');
        const replyContent = replyBody?.textContent?.trim() || '';
        const replyTime = replyElement.querySelector('relative-time')?.getAttribute('datetime') || '';
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

      // 5. PreviewModal 표시
      const modal = new PreviewModal();
      const action = await modal.show({
        result: previewResponse.data.result,
        warnings: []
      });

      // 6. 사용자 액션 처리
      if (action === 'cancel') {
        return; // 취소 - 아무것도 안 함
      }

      if (action === 'edit') {
        // Phase 2에서 구현
        alert('Edit feature will be implemented in the next phase.');
        return;
      }

      // 7. 확인 버튼: 실제 변환 수행
      if (action === 'confirm') {
        this.uiBuilder.setButtonState(button, 'loading');

        const convertResponse = await chrome.runtime.sendMessage({
          type: 'CONFIRM_AND_CONVERT',
          payload: { comment, repository: this.repository }
        });

        if (convertResponse.success) {
          this.uiBuilder.showSuccessMessage(
            button,
            convertResponse.data.prUrl,
            convertResponse.data.isUpdate,
            convertResponse.data.tokenUsage,
            'github',
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

      this.uiBuilder.showErrorMessage(button, errorMessage, 'github');
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

    threads.forEach((thread) => {
      // 2개 이상 코멘트가 있는 Thread만 처리
      if (thread.comments.length >= 2) {
        this.uiBuilder.addThreadButton({
          platform: 'github',
          thread,
          onClick: (thread) => this.onThreadButtonClick(thread)
        });
      } else {
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

    // PR 타임라인 컨테이너 감시
    const timelineContainer = document.querySelector('.js-discussion, .discussion-timeline');
    if (timelineContainer) {
      this.threadObserver.observe(timelineContainer, {
        childList: true,
        subtree: false // subtree를 false로 변경하여 성능 향상
      });
    }
  }

  /**
   * API로 PR 리뷰 데이터 조회
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
          platform: 'github'
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

      // DOM에서 스레드 컨테이너 찾기 (위치 매칭)
      const container = this.findThreadContainerForApi(apiThread);
      if (!container) continue;

      // API 스레드를 DiscussionThread로 변환
      const thread = this.apiThreadToDiscussionThread(apiThread, container);

      this.uiBuilder.addThreadButton({
        platform: 'github',
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
      `div[id*="${apiThread.id}"], [data-discussion-id="${apiThread.id}"]`
    );
    if (byId) return byId;

    // 2. 첫 번째 코멘트 ID 기반 탐색
    const firstCommentId = apiThread.comments[0]?.id;
    if (firstCommentId) {
      const byCommentId = document.querySelector<HTMLElement>(
        `div[id*="${firstCommentId}"], [data-comment-id="${firstCommentId}"]`
      );
      if (byCommentId) {
        // 코멘트의 부모 스레드 컨테이너 반환
        return byCommentId.closest<HTMLElement>(
          '.review-thread, .timeline-comment-group, .inline-comments'
        );
      }
    }

    // 3. 파일 경로 + 라인 기반 fallback
    if (apiThread.path) {
      const fileContainer = document.querySelector<HTMLElement>(`[data-path="${apiThread.path}"]`);
      if (fileContainer) {
        const threads = fileContainer.querySelectorAll<HTMLElement>('.review-thread, .inline-comments');
        for (const t of threads) {
          // 이미 버튼이 있는 컨테이너는 스킵
          if (!t.querySelector('.review-to-instruction-thread-button-container')) {
            return t;
          }
        }
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
      platform: 'github' as const,
      codeContext: c.diffHunk && c.path ? {
        filePath: c.path,
        lines: c.diffHunk,
        startLine: c.line,
        endLine: c.line
      } : undefined
    }));

    return {
      id: `thread-api-${apiThread.id}`,
      platform: 'github',
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
          'github',
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

      this.uiBuilder.showErrorMessage(button, errorMessage, 'github');
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
          message += `🔗 PR: ${prUrl}\n`;

          if (tokenUsage) {
            message += `\n💰 Tokens used: ${tokenUsage.totalTokens}`;
          }

          alert(message);

          // PR 열기
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

      console.error('[RTI Error] [GitHubInjector] Wrapup conversion failed:', errorMessage);

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
        alert(`❌ Failed to convert PR conventions:\n\n${errorMessage}`);
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
