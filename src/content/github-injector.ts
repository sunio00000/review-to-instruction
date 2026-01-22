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

    // 레포지토리 정보 추출
    this.repository = this.extractRepository();
    if (!this.repository) {
      return;
    }


    // API를 통해 기본 브랜치 확인 및 업데이트
    try {
      await this.updateDefaultBranch();
    } catch (error) {
      // API 호출 실패해도 계속 진행 (추출한 branch 사용)
    }


    // 코멘트 감지 시작
    this.detector.start();
  }

  /**
   * API를 통해 PR의 head branch 가져오기
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

      if (response.success && response.data.head_branch) {
        this.repository.branch = response.data.head_branch;
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
      return null;
    }
  }

  /**
   * 버튼 클릭 핸들러
   */
  private async onButtonClick(comment: Comment) {
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
