/**
 * Review to Instruction - GitHub Injector
 * GitHub PR 페이지에 버튼을 주입합니다.
 */

import { CommentDetector, type CommentElement } from './comment-detector';
import { ThreadDetector } from './thread-detector';
import { UIBuilder } from './ui-builder';
import { PreviewModal } from './preview-modal';
import type { Comment, Repository, DiscussionThread } from '../types';
import { isConventionComment } from '../core/parser';
import { logger } from '../utils/logger';

export class GitHubInjector {
  private detector: CommentDetector;
  private threadDetector: ThreadDetector;
  private uiBuilder: UIBuilder;
  private repository: Repository | null = null;
  private threadObserver: MutationObserver | null = null;
  private hasApiToken: boolean = false;

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

        return {
          owner,
          name,
          platform: 'github',
          branch,
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

    // Thread 감지 및 버튼 추가
    this.detectAndAddThreadButtons();

    // 새로운 Thread 감지 (MutationObserver)
    this.observeThreads();

    // ✅ 브랜치 정보는 백그라운드에서 업데이트
    this.updateDefaultBranch().catch((error) => {
      logger.warn('[GitHubInjector] Failed to update default branch:', error);
      // 실패해도 버튼은 이미 표시되어 있음
    });
  }

  /**
   * API Token 상태 확인
   */
  private async checkApiTokenStatus() {
    try {
      // Chrome API 존재 여부 확인
      if (typeof chrome === 'undefined' || !chrome.storage) {
        this.hasApiToken = false;
        return;
      }

      const result = await chrome.storage.local.get(['githubToken_enc', 'claudeApiKey_enc', 'openaiApiKey_enc', 'llmProvider']);

      // GitHub token과 LLM API key 모두 필요
      const hasGithubToken = !!result.githubToken_enc;
      const provider = result.llmProvider || 'claude';
      const hasLlmKey = provider === 'claude' ? !!result.claudeApiKey_enc : !!result.openaiApiKey_enc;

      this.hasApiToken = hasGithubToken && hasLlmKey;
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

      return {
        id: commentElement.id,
        author,
        content,
        htmlContent,
        url,
        createdAt,
        platform: 'github',
        replies: replies.length > 0 ? replies : undefined
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

    try {
      // Chrome Extension API 체크
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome Extension API is not available.');
      }

      // 1. 로딩 상태 표시
      this.uiBuilder.setButtonState(button, 'loading');

      // 2. 미리보기 요청
      const previewResponse = await chrome.runtime.sendMessage({
        type: 'PREVIEW_INSTRUCTION',
        payload: { comment, repository: this.repository }
      });

      if (!previewResponse.success) {
        throw new Error(previewResponse.error || 'Preview failed');
      }

      // 3. 로딩 완료
      this.uiBuilder.setButtonState(button, 'default');

      // 4. PreviewModal 표시
      const modal = new PreviewModal();
      const action = await modal.show({
        result: previewResponse.data.result,
        warnings: []
      });

      // 5. 사용자 액션 처리
      if (action === 'cancel') {
        return; // 취소 - 아무것도 안 함
      }

      if (action === 'edit') {
        // Phase 2에서 구현
        alert('Edit feature will be implemented in the next phase.');
        return;
      }

      // 6. 확인 버튼: 실제 변환 수행
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
            convertResponse.data.tokenUsage
          );
        } else {
          throw new Error(convertResponse.error || 'Conversion failed');
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.uiBuilder.showErrorMessage(button, errorMessage);
    }
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
          platform: 'github',
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

    this.threadObserver = new MutationObserver(() => {
      // 디바운싱: 100ms 후 Thread 재감지
      setTimeout(() => {
        this.detectAndAddThreadButtons();
      }, 100);
    });

    // PR 타임라인 컨테이너 감시
    const timelineContainer = document.querySelector('.js-discussion, .discussion-timeline');
    if (timelineContainer) {
      this.threadObserver.observe(timelineContainer, {
        childList: true,
        subtree: true
      });
    }
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
          response.data.tokenUsage
        );
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (error) {
      // 에러 메시지 표시
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.uiBuilder.showErrorMessage(button, errorMessage);
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
