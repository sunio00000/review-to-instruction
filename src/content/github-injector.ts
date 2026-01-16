/**
 * Review to Instruction - GitHub Injector
 * GitHub PR 페이지에 버튼을 주입합니다.
 */

import { CommentDetector, type CommentElement } from './comment-detector';
import { UIBuilder } from './ui-builder';
import type { Comment, Repository } from '../types';

export class GitHubInjector {
  private detector: CommentDetector;
  private uiBuilder: UIBuilder;
  private repository: Repository | null = null;

  constructor() {
    this.uiBuilder = new UIBuilder();

    // GitHub PR 페이지의 코멘트 선택자
    this.detector = new CommentDetector(
      (comment) => this.onCommentDetected(comment),
      '.timeline-comment, .review-comment',  // GitHub 코멘트 선택자
      '.comment-body'                         // 코멘트 내용 선택자
    );
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

        // 기본 브랜치 정보 추출 (PR이 머지될 대상 브랜치)
        // 1. base-ref 시도 (PR의 target branch)
        let branch = document.querySelector('.base-ref')?.textContent?.trim();

        // 2. branch-select 메뉴에서 기본 브랜치 찾기
        if (!branch) {
          const branchButton = document.querySelector('[data-hovercard-type="repository"]');
          branch = branchButton?.textContent?.trim();
        }

        // 3. 메타 태그에서 기본 브랜치 찾기
        if (!branch) {
          const metaTag = document.querySelector('meta[name="octolytics-dimension-repository_default_branch"]');
          branch = metaTag?.getAttribute('content') || undefined;
        }

        // 4. 최종 fallback
        if (!branch) {
          console.warn('[GitHubInjector] Could not detect base branch, defaulting to "main"');
          branch = 'main';
        }

        console.log('[GitHubInjector] Extracted repository info:', {
          owner,
          name,
          branch,
          prNumber
        });

        return {
          owner,
          name,
          platform: 'github',
          branch,
          prNumber
        };
      }
    } catch (error) {
      console.error('[GitHubInjector] Failed to extract repository info:', error);
    }

    return null;
  }

  /**
   * 시작
   */
  async start() {
    console.log('[GitHubInjector] Starting...');

    // 설정 확인
    const config = await this.getConfig();
    if (!config.showButtons) {
      console.log('[GitHubInjector] Buttons are disabled in settings');
      return;
    }

    // 레포지토리 정보 추출
    this.repository = this.extractRepository();
    if (!this.repository) {
      console.error('[GitHubInjector] Failed to extract repository info');
      return;
    }

    console.log('[GitHubInjector] Initial repository info:', this.repository);

    // API를 통해 기본 브랜치 확인 및 업데이트
    try {
      await this.updateDefaultBranch();
    } catch (error) {
      console.warn('[GitHubInjector] Failed to update default branch from API:', error);
      // API 호출 실패해도 계속 진행 (추출한 branch 사용)
    }

    console.log('[GitHubInjector] Final repository info:', this.repository);

    // 코멘트 감지 시작
    this.detector.start();
  }

  /**
   * API를 통해 repository의 기본 브랜치 가져오기
   */
  private async updateDefaultBranch() {
    if (!this.repository) return;

    // Chrome Extension API 확인
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }

    try {
      // Background script를 통해 API 호출
      const response = await chrome.runtime.sendMessage({
        type: 'GET_REPOSITORY_INFO',
        payload: {
          owner: this.repository.owner,
          name: this.repository.name
        }
      });

      if (response.success && response.data.default_branch) {
        console.log('[GitHubInjector] Updated branch from API:', response.data.default_branch);
        this.repository.branch = response.data.default_branch;
      }
    } catch (error) {
      // API 호출 실패는 무시 (이미 추출한 branch 사용)
      console.warn('[GitHubInjector] API call for default branch failed:', error);
    }
  }

  /**
   * 중지
   */
  stop() {
    this.detector.stop();
    this.uiBuilder.removeAllButtons();
    console.log('[GitHubInjector] Stopped');
  }

  /**
   * 코멘트 감지 콜백
   */
  private onCommentDetected(commentElement: CommentElement) {
    console.log('[GitHubInjector] Comment detected:', commentElement.id);

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
        platform: 'github',
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

      return {
        id: commentElement.id,
        author,
        content,
        htmlContent,
        url,
        createdAt,
        platform: 'github'
      };
    } catch (error) {
      console.error('[GitHubInjector] Failed to extract comment info:', error);
      return null;
    }
  }

  /**
   * 버튼 클릭 핸들러
   */
  private async onButtonClick(comment: Comment) {
    console.log('[GitHubInjector] Button clicked for comment:', comment.id);
    console.log('[GitHubInjector] Sending to background:', {
      repository: this.repository,
      commentLength: comment.content.length
    });

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
        console.log('[GitHubInjector] Comment converted successfully:', response.data);

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
      console.error('[GitHubInjector] Failed to convert comment:', error);

      // 에러 메시지 표시
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.uiBuilder.showErrorMessage(button, errorMessage);
    }
  }

  /**
   * 설정 가져오기
   */
  private async getConfig() {
    try {
      // Chrome API 존재 여부 확인
      if (typeof chrome === 'undefined' || !chrome.storage) {
        console.warn('[GitHubInjector] Chrome storage API not available');
        return { showButtons: true };
      }

      const result = await chrome.storage.sync.get(['showButtons']);
      return {
        showButtons: result.showButtons !== false  // 기본값 true
      };
    } catch (error) {
      console.error('[GitHubInjector] Failed to get config:', error);
      return { showButtons: true };
    }
  }
}
