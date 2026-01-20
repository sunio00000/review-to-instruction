/**
 * Review to Instruction - GitLab Injector
 * GitLab MR 페이지에 버튼을 주입합니다.
 */

import { CommentDetector, type CommentElement } from './comment-detector';
import { UIBuilder } from './ui-builder';
import type { Comment, Repository } from '../types';

export class GitLabInjector {
  private detector: CommentDetector;
  private uiBuilder: UIBuilder;
  private repository: Repository | null = null;

  constructor() {
    this.uiBuilder = new UIBuilder();

    // GitLab MR 페이지의 코멘트 선택자 (Fallback 지원)
    this.detector = new CommentDetector(
      (comment) => this.onCommentDetected(comment),
      // 코멘트 컨테이너 선택자 (여러 Fallback 시도)
      [
        '.note',                           // 기존 GitLab 선택자
        '[data-testid="note"]',            // data-testid 속성
        '.timeline-entry',                 // 타임라인 엔트리
        '.discussion-note',                // 디스커션 노트
        'article[data-note-id]'            // article with note id
      ],
      // 코멘트 내용 선택자 (여러 Fallback 시도)
      [
        '.note-text',                      // 기존 GitLab 선택자
        '[data-testid="note-text"]',       // data-testid 속성
        '.timeline-entry-body',            // 타임라인 본문
        '.note-body',                      // 노트 본문
        '.js-note-text'                    // JS 타겟 클래스
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
          console.warn('[GitLabInjector] Failed to extract branch, using default "main"');
          branch = 'main';
        }

        console.log('[GitLabInjector] Extracted repository info:', {
          owner,
          name,
          branch,
          prNumber,
          url: window.location.href
        });

        return {
          owner,
          name,
          platform: 'gitlab',
          branch,
          prNumber
        };
      }
    } catch (error) {
      console.error('[GitLabInjector] Failed to extract repository info:', error);
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
        console.log(`[GitLabInjector] Branch extracted from selector "${selector}": ${branch}`);
        return branch;
      }
    }

    console.warn('[GitLabInjector] Branch element not found for any selectors:', BRANCH_SELECTORS);

    // 2. URL에서 추출 시도 (Fallback)
    // GitLab MR URL 패턴: /owner/repo/-/merge_requests/123/diffs?start_sha=xxx&head_sha=yyy
    const urlParams = new URLSearchParams(window.location.search);
    const headSha = urlParams.get('head_sha');

    if (headSha) {
      console.log('[GitLabInjector] Using head_sha from URL as branch identifier:', headSha.substring(0, 8));
      return headSha.substring(0, 8);  // SHA의 앞 8자리 사용
    }

    // 3. 페이지 제목에서 추출 시도 (최종 Fallback)
    // 페이지 제목 예: "Merge Request !123: Add new feature (branch-name → main)"
    const titleMatch = document.title.match(/\(([^)→]+)\s*→/);
    if (titleMatch && titleMatch[1]) {
      const branch = titleMatch[1].trim();
      console.log('[GitLabInjector] Branch extracted from page title:', branch);
      return branch;
    }

    return null;
  }

  /**
   * 시작
   */
  async start() {
    console.log('[GitLabInjector] Starting...');

    // 설정 확인
    const config = await this.getConfig();
    if (!config.showButtons) {
      console.log('[GitLabInjector] Buttons are disabled in settings');
      return;
    }

    // 레포지토리 정보 추출
    this.repository = this.extractRepository();
    if (!this.repository) {
      console.warn('[GitLabInjector] Failed to extract repository info, buttons will still be shown but may have limited functionality');
      // repository 정보 없이도 계속 진행 (버튼은 표시되지만 클릭 시 재시도)
    } else {
      console.log('[GitLabInjector] Repository:', this.repository);
    }

    // 코멘트 감지 시작 (repository 정보 유무와 관계없이)
    this.detector.start();
  }

  /**
   * 중지
   */
  stop() {
    this.detector.stop();
    this.uiBuilder.removeAllButtons();
    console.log('[GitLabInjector] Stopped');
  }

  /**
   * 코멘트 감지 콜백
   */
  private onCommentDetected(commentElement: CommentElement) {
    console.log('[GitLabInjector] Comment detected:', commentElement.id);

    // 코멘트 정보 추출
    const comment = this.extractCommentInfo(commentElement);
    if (!comment) {
      return;
    }

    // 버튼 추가
    this.uiBuilder.addButton(
      commentElement.element,
      commentElement.contentElement,
      {
        platform: 'gitlab',
        comment,
        onClick: (comment) => this.onButtonClick(comment)
      }
    );
  }

  /**
   * 코멘트 정보 추출
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

      return {
        id: commentElement.id,
        author,
        content,
        htmlContent,
        url,
        createdAt,
        platform: 'gitlab'
      };
    } catch (error) {
      console.error('[GitLabInjector] Failed to extract comment info:', error);
      return null;
    }
  }

  /**
   * 버튼 클릭 핸들러
   */
  private async onButtonClick(comment: Comment) {
    console.log('[GitLabInjector] Button clicked for comment:', comment.id);

    const button = this.uiBuilder.getButton(comment.id);
    if (!button) return;

    try {
      // Chrome Extension API 존재 여부 확인
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome Extension API를 사용할 수 없습니다. Extension이 제대로 로드되었는지 확인해주세요.');
      }

      // Background script로 메시지 전송
      const response = await chrome.runtime.sendMessage({
        type: 'CONVERT_COMMENT',
        payload: {
          comment,
          repository: this.repository
        }
      });

      if (response.success) {
        console.log('[GitLabInjector] Comment converted successfully:', response.data);

        // 성공 메시지 표시 (PR URL 링크 포함)
        this.uiBuilder.showSuccessMessage(
          button,
          response.data.prUrl,
          response.data.isUpdate
        );
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[GitLabInjector] Failed to convert comment:', error);

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
        console.warn('[GitLabInjector] Chrome storage API not available');
        return { showButtons: true };
      }

      const result = await chrome.storage.local.get(['showButtons']);
      return {
        showButtons: result.showButtons !== false  // 기본값 true
      };
    } catch (error) {
      console.error('[GitLabInjector] Failed to get config:', error);
      return { showButtons: true };
    }
  }
}
