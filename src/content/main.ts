/**
 * Review to Instruction - Content Script
 * GitHub/GitLab PR 페이지에 주입되는 스크립트
 */

import './styles.css';
import type { Platform } from '../types';
import { GitHubInjector } from './github-injector';
import { GitLabInjector } from './gitlab-injector';

let injector: GitHubInjector | GitLabInjector | null = null;

// 현재 플랫폼 감지
function detectPlatform(): Platform | null {
  const hostname = window.location.hostname;

  if (hostname.includes('github.com') || hostname === 'localhost') {
    return 'github';
  } else if (hostname.includes('gitlab.com')) {
    return 'gitlab';
  }

  return null;
}

// 초기화
async function init() {
  // Chrome Extension API 존재 여부 확인
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    console.warn('[Review to Instruction] Chrome Extension API not available');
    return;
  }

  const platform = detectPlatform();

  if (!platform) {
    console.log('[Review to Instruction] Not on supported platform');
    return;
  }

  console.log(`[Review to Instruction] Initialized on ${platform}`);

  try {
    // 플랫폼별 injector 시작
    if (platform === 'github') {
      injector = new GitHubInjector();
      await injector.start();
    } else if (platform === 'gitlab') {
      injector = new GitLabInjector();
      await injector.start();
    }
  } catch (error) {
    console.error('[Review to Instruction] Failed to initialize injector:', error);
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
