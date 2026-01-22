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
async function detectPlatform(): Promise<Platform | null> {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  // GitHub 감지
  if (hostname.includes('github.com') || hostname === 'localhost') {
    return 'github';
  }

  // GitLab 감지 (gitlab.com 또는 MR URL 패턴)
  // GitLab의 MR URL 패턴: /-/merge_requests/
  if (hostname.includes('gitlab.com') || pathname.includes('/-/merge_requests/')) {
    return 'gitlab';
  }

  return null;
}

// 초기화
async function init() {
  // Chrome Extension API 존재 여부 확인
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    return;
  }

  const platform = await detectPlatform();

  if (!platform) {
    return;
  }


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
