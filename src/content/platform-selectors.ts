/**
 * Review to Instruction - Platform Selectors
 * GitHub/GitLab 플랫폼별 DOM selector를 중앙에서 관리합니다.
 * 플랫폼 UI 변경 시 이 파일만 수정하면 됩니다.
 */

/**
 * 플랫폼별 DOM selector 인터페이스
 */
export interface PlatformSelectors {
  comment: {
    containers: string[];    // 코멘트 컨테이너 선택자
    content: string[];       // 코멘트 내용 선택자
    author: string[];        // 작성자 선택자
    timestamp: string[];     // 시간 선택자
  };
  thread: {
    containers: string[];    // 스레드 컨테이너 선택자
    replyArea: string[];     // 답글 영역 선택자
  };
  branch: {
    source: string[];        // 소스 브랜치 선택자
    target: string[];        // 타겟 브랜치 선택자
  };
  page: {
    timeline: string[];      // 타임라인 컨테이너 선택자 (MutationObserver 대상)
    discussion: string[];    // 디스커션 컨테이너 선택자
  };
}

/**
 * GitHub PR 페이지 DOM 선택자
 */
export const GITHUB_SELECTORS: PlatformSelectors = {
  comment: {
    // 코멘트 컨테이너: 일반 코멘트, 리뷰 코멘트, 인라인 코드 리뷰 코멘트
    containers: [
      '.timeline-comment',           // 일반 타임라인 코멘트
      '.review-comment',             // 리뷰 코멘트
      '.js-comment',                 // JS 타겟 코멘트
      '.inline-comment',             // 인라인 코멘트
      '.js-comment-container',       // 코멘트 컨테이너
      'div[id^="discussion_r"]',     // 디스커션 ID로 시작하는 div
      'div[id^="pullrequestreview"]' // PR 리뷰 ID로 시작하는 div
    ],
    // 코멘트 본문 선택자
    content: [
      '.comment-body',               // 기본 코멘트 본문
      '.js-comment-body',            // JS 타겟 본문
      '.review-comment-contents .comment-body', // 리뷰 코멘트 본문
      '.edit-comment-hide'           // 편집 가능 코멘트
    ],
    // 작성자 선택자
    author: [
      '.author'
    ],
    // 시간 선택자
    timestamp: [
      'relative-time'
    ]
  },
  thread: {
    // 스레드 컨테이너 선택자
    containers: [
      '.timeline-comment-group',       // 일반 코멘트 그룹
      '.review-thread',                // 리뷰 스레드
      '[data-discussion-id]',          // Discussion ID 속성
      '.js-discussion',                // Discussion 컨테이너
      '.discussion-timeline-actions',  // Timeline actions
      'div[id^="discussion_r"]',       // Discussion ID로 시작하는 div
      '.review-comment-group',         // Review comment group
      '.js-comment-container'          // JS comment container
    ],
    // 답글 영역 선택자: 답글은 같은 timeline-comment-group 또는 review-thread 내에 위치
    replyArea: [
      '.timeline-comment-group',
      '.review-thread'
    ]
  },
  branch: {
    // 소스 브랜치 (PR의 head branch - 작업 중인 브랜치)
    source: [
      '.head-ref',
      '.commit-ref.head-ref .css-truncate-target'
    ],
    // 타겟 브랜치 (PR의 base branch - 머지 대상 브랜치)
    target: [
      '.base-ref',
      '.commit-ref.base-ref .css-truncate-target'
    ]
  },
  page: {
    // 타임라인 컨테이너 (Thread Observer 대상)
    timeline: [
      '.js-discussion',
      '.discussion-timeline'
    ],
    // 디스커션 컨테이너 (MutationObserver 대상)
    discussion: [
      '.js-discussion',
      '.discussion-timeline',
      '.js-timeline-item'
    ]
  }
};

/**
 * GitLab MR 페이지 DOM 선택자
 */
export const GITLAB_SELECTORS: PlatformSelectors = {
  comment: {
    // 코멘트 컨테이너: MR discussion notes, 리뷰 코멘트, diff 노트, 답글
    containers: [
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
    // 코멘트 내용 선택자
    content: [
      '.note-text',                      // 기존 GitLab 선택자
      '[data-testid="note-text"]',       // data-testid 속성
      '.timeline-entry-body',            // 타임라인 본문
      '.note-body',                      // 노트 본문
      '.js-note-text',                   // JS 타겟 클래스
      '.note-text.md',                   // 마크다운 노트 텍스트
      '.note-body .note-text'            // 노트 본문 내부 텍스트
    ],
    // 작성자 선택자
    author: [
      '.note-header-author-name'
    ],
    // 시간 선택자
    timestamp: [
      'time'
    ]
  },
  thread: {
    // 스레드 컨테이너 선택자
    containers: [
      '.discussion-notes',        // Discussion notes 컨테이너
      '.notes',                   // Notes 컨테이너
      '[data-discussion-id]'      // Discussion ID 속성
    ],
    // 답글 영역 선택자
    replyArea: [
      '.discussion-notes',
      '.notes',
      '[data-discussion-id]'
    ]
  },
  branch: {
    // 소스 브랜치 (MR의 source branch)
    source: [
      '.source-branch-link',              // 기존 선택자
      '[data-testid="source-branch"]',    // data-testid 속성
      '.merge-request-source-branch',     // MR 소스 브랜치
      '.issuable-source-branch',          // Issuable 소스 브랜치
      '.source-branch .ref-name',         // ref-name 클래스
      'a[href*="/-/commits/"]',           // 커밋 링크
      '.gl-link.gl-label-text'            // GitLab 레이블 텍스트 링크
    ],
    // 타겟 브랜치 (MR의 target branch)
    target: [
      '.target-branch-link',              // 타겟 브랜치 링크
      '[data-testid="target-branch"]',    // data-testid 속성
      '.merge-request-target-branch',     // MR 타겟 브랜치
      '.issuable-target-branch',          // Issuable 타겟 브랜치
      '.target-branch .ref-name',         // ref-name 클래스
      'a[href*="/-/tree/"]',              // 브랜치 트리 링크
      '.gl-link.gl-label-text'            // GitLab 레이블 텍스트 링크
    ]
  },
  page: {
    // 타임라인 컨테이너 (Thread Observer 대상)
    timeline: [
      '.merge-request-tabs',
      '.discussion-wrapper'
    ],
    // 디스커션 컨테이너 (MutationObserver 대상)
    discussion: [
      '.merge-request-tabs',
      '.discussion-wrapper',
      '.notes-container'
    ]
  }
};

/**
 * 플랫폼에 맞는 selector 설정 반환
 */
export function getPlatformSelectors(platform: 'github' | 'gitlab'): PlatformSelectors {
  return platform === 'github' ? GITHUB_SELECTORS : GITLAB_SELECTORS;
}
