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
    // MR discussion notes와 답글을 모두 포함
    // 시스템 노트와 커밋 히스토리는 shouldExcludeComment에서 필터링
    this.detector = new CommentDetector(
      (comment) => this.onCommentDetected(comment),
      // 코멘트 컨테이너 선택자 (여러 Fallback 시도)
      [
        '.note',                           // 모든 GitLab 노트 (답글 포함)
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

    // 레포지토리 정보 추출
    this.repository = this.extractRepository();
    // repository 정보 없이도 계속 진행 (버튼은 표시되지만 클릭 시 재시도)

    // 코멘트 감지 시작 (repository 정보 유무와 관계없이)
    this.detector.start();
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
        platform: 'gitlab',
        comment,
        onClick: (comment) => this.onButtonClick(comment)
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

        // 성공 메시지 표시 (PR URL 링크 + 토큰 사용량 포함)
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
