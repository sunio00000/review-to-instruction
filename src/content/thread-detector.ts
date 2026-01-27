/**
 * Review to Instruction - Thread Detector
 * Discussion Thread를 감지하고 모든 코멘트를 추출합니다.
 */

import type { Platform, DiscussionThread, Comment } from '../types';

/**
 * Platform별 Thread 선택자
 */
const GITHUB_THREAD_SELECTORS = {
  container: [
    '.timeline-comment-group',  // 일반 코멘트 그룹
    '.review-thread',           // 리뷰 스레드
    '[data-discussion-id]'      // Discussion ID 속성
  ],
  comment: '.timeline-comment, .review-comment',
  content: '.comment-body',
  author: '.author',
  time: 'relative-time'
};

const GITLAB_THREAD_SELECTORS = {
  container: [
    '.discussion-notes',        // Discussion notes 컨테이너
    '.notes',                   // Notes 컨테이너
    '[data-discussion-id]'      // Discussion ID 속성
  ],
  comment: '.note:not(.system-note)',
  content: '.note-text',
  author: '.note-header-author-name',
  time: 'time'
};

/**
 * ThreadDetector - Discussion Thread 감지 및 추출
 */
export class ThreadDetector {
  private platform: Platform;
  private processedThreads = new WeakSet<HTMLElement>();

  constructor(platform: Platform) {
    this.platform = platform;
  }

  /**
   * Discussion Thread 감지 및 수집
   * @returns 감지된 Thread 배열 (2개 이상 코멘트만)
   */
  detectThreads(): DiscussionThread[] {
    const selectors = this.getThreadSelectors();
    const threads: DiscussionThread[] = [];

    // 각 선택자로 컨테이너 찾기
    for (const selector of selectors.container) {
      const containers = document.querySelectorAll<HTMLElement>(selector);

      containers.forEach(container => {
        // 이미 처리된 컨테이너는 스킵
        if (this.processedThreads.has(container)) {
          return;
        }

        // Thread 추출
        const thread = this.extractThread(container);

        // 2개 이상의 코멘트가 있는 Thread만 반환
        if (thread && thread.comments.length >= 2) {
          threads.push(thread);
          this.processedThreads.add(container);
        }
      });
    }

    return threads;
  }

  /**
   * Thread 내 모든 코멘트 추출
   */
  private extractThread(container: HTMLElement): DiscussionThread | null {
    const comments: Comment[] = [];
    const selectors = this.getThreadSelectors();

    // Thread 내 모든 코멘트 요소 찾기
    const commentElements = container.querySelectorAll<HTMLElement>(selectors.comment);

    commentElements.forEach((element, index) => {
      const comment = this.extractSingleComment(element, index);
      if (comment) {
        comments.push(comment);
      }
    });

    if (comments.length === 0) {
      return null;
    }

    return {
      id: this.generateThreadId(container),
      platform: this.platform,
      comments,
      containerElement: container
    };
  }

  /**
   * 개별 코멘트 정보 추출
   */
  private extractSingleComment(element: HTMLElement, index: number): Comment | null {
    try {
      const selectors = this.getThreadSelectors();

      // 작성자
      const authorElement = element.querySelector(selectors.author);
      const author = authorElement?.textContent?.trim() || 'Unknown';

      // 코멘트 내용
      const contentElement = element.querySelector<HTMLElement>(selectors.content);
      if (!contentElement) {
        return null;
      }

      const content = contentElement.textContent?.trim() || '';
      const htmlContent = contentElement.innerHTML || '';

      // 작성 시간
      const timeElement = element.querySelector(selectors.time);
      const createdAt = timeElement?.getAttribute('datetime')
        || timeElement?.getAttribute('data-time')
        || new Date().toISOString();

      // 코멘트 ID (element id 또는 자동 생성)
      const id = element.id || `comment-${Date.now()}-${index}`;

      // 코멘트 URL
      const url = window.location.href;

      return {
        id,
        author,
        content,
        htmlContent,
        url,
        createdAt,
        platform: this.platform,
        // Thread의 코멘트들은 replies를 수집하지 않음 (이미 Thread 단위로 수집)
        replies: undefined
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Thread 고유 ID 생성
   */
  private generateThreadId(container: HTMLElement): string {
    // 1. data-discussion-id 속성 확인
    const discussionId = container.getAttribute('data-discussion-id');
    if (discussionId) {
      return `thread-${discussionId}`;
    }

    // 2. container id 확인
    if (container.id) {
      return `thread-${container.id}`;
    }

    // 3. 첫 번째 코멘트 ID 기반
    const selectors = this.getThreadSelectors();
    const firstComment = container.querySelector(selectors.comment);
    if (firstComment?.id) {
      return `thread-${firstComment.id}`;
    }

    // 4. Fallback: 타임스탬프 + 랜덤
    return `thread-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Platform별 선택자 가져오기
   */
  private getThreadSelectors() {
    return this.platform === 'github'
      ? GITHUB_THREAD_SELECTORS
      : GITLAB_THREAD_SELECTORS;
  }

  /**
   * 처리된 Thread 초기화 (테스트용)
   */
  reset() {
    this.processedThreads = new WeakSet();
  }
}
