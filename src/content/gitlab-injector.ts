/**
 * Review to Instruction - GitLab Injector
 * GitLab MR 페이지에 버튼을 주입합니다.
 */

import { CommentDetector, type CommentElement } from './comment-detector';
import { ThreadDetector } from './thread-detector';
import { UIBuilder } from './ui-builder';
import { PreviewModal } from './preview-modal';
import type { Comment, Repository, DiscussionThread } from '../types';
import { isConventionComment } from '../core/parser';
import { logger } from '../utils/logger';

export class GitLabInjector {
  private detector: CommentDetector;
  private threadDetector: ThreadDetector;
  private uiBuilder: UIBuilder;
  private repository: Repository | null = null;
  private threadObserver: MutationObserver | null = null;
  private hasApiToken: boolean = false;

  constructor() {
    this.uiBuilder = new UIBuilder();
    this.threadDetector = new ThreadDetector('gitlab');

    // GitLab MR 페이지의 코멘트 선택자 (Fallback 지원)
    // MR discussion notes, 리뷰 코멘트, diff 노트, 답글을 모두 포함
    // 시스템 노트, 커밋 히스토리, 새 코멘트 작성 폼은 shouldExcludeComment에서 필터링
    this.detector = new CommentDetector(
      (comment) => this.onCommentDetected(comment),
      // 코멘트 컨테이너 선택자 (여러 Fallback 시도)
      [
        '.note',                           // 모든 GitLab 노트 (답글 포함)
        '[data-testid="note"]',            // data-testid 속성
        '.timeline-entry',                 // 타임라인 엔트리
        '.discussion-note',                // 디스커션 노트
        'article[data-note-id]',           // article with note id
        '.diff-note',                      // diff 내부 노트
        '.note-wrapper',                   // 노트 래퍼
        'li.note',                         // li 태그 노트
        '[data-note-type="DiffNote"]'      // diff 노트 타입
      ],
      // 코멘트 내용 선택자 (여러 Fallback 시도)
      [
        '.note-text',                      // 기존 GitLab 선택자
        '[data-testid="note-text"]',       // data-testid 속성
        '.timeline-entry-body',            // 타임라인 본문
        '.note-body',                      // 노트 본문
        '.js-note-text',                   // JS 타겟 클래스
        '.note-text.md',                   // 마크다운 노트 텍스트
        '.note-body .note-text'            // 노트 본문 내부 텍스트
      ]
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

        return {
          owner,
          name,
          platform: 'gitlab',
          branch,
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
    const BRANCH_SELECTORS = [
      '.source-branch-link',              // 기존 선택자
      '[data-testid="source-branch"]',    // data-testid 속성
      '.merge-request-source-branch',     // MR 소스 브랜치
      '.issuable-source-branch',          // Issuable 소스 브랜치
      '.source-branch .ref-name'          // ref-name 클래스
    ];

    // 1. DOM 선택자로 추출 시도
    for (const selector of BRANCH_SELECTORS) {
      const element = document.querySelector(selector);
      const branch = element?.textContent?.trim();

      if (branch) {
        return branch;
      }
    }


    // 2. URL에서 추출 시도 (Fallback)
    // GitLab MR URL 패턴: /owner/repo/-/merge_requests/123/diffs?start_sha=xxx&head_sha=yyy
    const urlParams = new URLSearchParams(window.location.search);
    const headSha = urlParams.get('head_sha');

    if (headSha) {
      return headSha.substring(0, 8);  // SHA의 앞 8자리 사용
    }

    // 3. 페이지 제목에서 추출 시도 (최종 Fallback)
    // 페이지 제목 예: "Merge Request !123: Add new feature (branch-name → main)"
    const titleMatch = document.title.match(/\(([^)→]+)\s*→/);
    if (titleMatch && titleMatch[1]) {
      const branch = titleMatch[1].trim();
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

    // 코멘트 감지 시작 (repository 정보 유무와 관계없이)
    this.detector.start();

    // Thread 감지 및 버튼 추가
    this.detectAndAddThreadButtons();

    // 새로운 Thread 감지 (MutationObserver)
    this.observeThreads();
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
      logger.warn('[GitLabInjector] Failed to check token status:', error);
      this.hasApiToken = false;
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

      // 작성자
      const authorElement = element.querySelector('.note-header-author-name');
      const author = authorElement?.textContent?.trim() || 'Unknown';

      // 코멘트 내용
      const content = commentElement.contentElement.textContent?.trim() || '';
      const htmlContent = commentElement.contentElement.innerHTML || '';

      // 작성 시간
      const timeElement = element.querySelector('time');
      const createdAt = timeElement?.getAttribute('datetime') || new Date().toISOString();

      // 코멘트 URL
      const url = window.location.href;

      // 디스커션 답글 추출 (Feature 2)
      const replies = this.extractDiscussionReplies(element);

      return {
        id: commentElement.id,
        author,
        content,
        htmlContent,
        url,
        createdAt,
        platform: 'gitlab',
        replies: replies.length > 0 ? replies : undefined
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
      // GitLab에서 답글은 discussion 컨테이너 내의 다른 note 요소들
      const discussionContainer = noteElement.closest('.discussion-notes, .notes, [data-discussion-id]');
      if (!discussionContainer) return replies;

      // 모든 note 요소 찾기
      const allNotes = Array.from(discussionContainer.querySelectorAll('.note'));

      // 첫 번째 요소(원본 노트) 제외하고 답글만 추출
      for (let i = 1; i < allNotes.length; i++) {
        const replyElement = allNotes[i];

        const replyAuthor = replyElement.querySelector('.note-header-author-name')?.textContent?.trim() || 'Unknown';
        const replyBody = replyElement.querySelector('.note-text, [data-testid="note-text"]');
        const replyContent = replyBody?.textContent?.trim() || '';
        const replyTime = replyElement.querySelector('time')?.getAttribute('datetime') || '';
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
            convertResponse.data.tokenUsage
          );
        } else {
          throw new Error(convertResponse.error || 'Conversion failed');
        }
      }

    } catch (error) {
      // Progress 타이머 정리
      progressTimers.forEach(timer => clearTimeout(timer));

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.uiBuilder.showErrorMessage(button, errorMessage);
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

    this.threadObserver = new MutationObserver(() => {
      // 디바운싱: 100ms 후 Thread 재감지
      setTimeout(() => {
        this.detectAndAddThreadButtons();
      }, 100);
    });

    // MR discussion 컨테이너 감시
    const discussionContainer = document.querySelector('.merge-request-tabs, .discussion-wrapper');
    if (discussionContainer) {
      this.threadObserver.observe(discussionContainer, {
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
