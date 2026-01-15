/**
 * PR Convention Bridge - Content Script
 * GitHub/GitLab PR 페이지에 주입되는 스크립트
 */

import type { Platform } from '../types';

// 현재 플랫폼 감지
function detectPlatform(): Platform | null {
  const hostname = window.location.hostname;

  if (hostname.includes('github.com')) {
    return 'github';
  } else if (hostname.includes('gitlab.com')) {
    return 'gitlab';
  }

  return null;
}

// 초기화
function init() {
  const platform = detectPlatform();

  if (!platform) {
    console.log('[PR Convention Bridge] Not on supported platform');
    return;
  }

  console.log(`[PR Convention Bridge] Initialized on ${platform}`);

  // TODO: Phase 2, 3에서 구현
  // - 코멘트 감지
  // - 버튼 추가
  // - 이벤트 핸들러
}

// DOM이 로드되면 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
