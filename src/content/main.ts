/**
 * PR Convention Bridge - Content Script
 * GitHub/GitLab PR 페이지에 주입되는 스크립트
 */

import type { Platform } from '../types';
import { GitHubInjector } from './github-injector';

let injector: GitHubInjector | null = null;

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
async function init() {
  const platform = detectPlatform();

  if (!platform) {
    console.log('[PR Convention Bridge] Not on supported platform');
    return;
  }

  console.log(`[PR Convention Bridge] Initialized on ${platform}`);

  // 플랫폼별 injector 시작
  if (platform === 'github') {
    injector = new GitHubInjector();
    await injector.start();
  } else if (platform === 'gitlab') {
    // TODO: Phase 3에서 GitLab injector 구현
    console.log('[PR Convention Bridge] GitLab support coming in Phase 3');
  }
}

// 정리 (페이지 unload 시)
window.addEventListener('beforeunload', () => {
  if (injector) {
    injector.stop();
  }
});

// DOM이 로드되면 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
