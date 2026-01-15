/**
 * PR Convention Bridge - Popup Script
 */

import type { ApiConfig } from '../types';

// DOM 요소
const githubTokenInput = document.getElementById('github-token') as HTMLInputElement;
const gitlabTokenInput = document.getElementById('gitlab-token') as HTMLInputElement;
const showButtonsCheckbox = document.getElementById('show-buttons') as HTMLInputElement;
const saveButton = document.getElementById('save') as HTMLButtonElement;
const testGithubButton = document.getElementById('test-github') as HTMLButtonElement;
const testGitlabButton = document.getElementById('test-gitlab') as HTMLButtonElement;
const saveStatus = document.getElementById('save-status') as HTMLDivElement;

// 설정 로드
async function loadConfig() {
  try {
    const result = await chrome.storage.sync.get(['githubToken', 'gitlabToken', 'showButtons']);
    const config = result as ApiConfig;

    githubTokenInput.value = config.githubToken || '';
    gitlabTokenInput.value = config.gitlabToken || '';
    showButtonsCheckbox.checked = config.showButtons !== false;  // 기본값 true
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

// 설정 저장
async function saveConfig() {
  const config: ApiConfig = {
    githubToken: githubTokenInput.value.trim(),
    gitlabToken: gitlabTokenInput.value.trim(),
    showButtons: showButtonsCheckbox.checked
  };

  try {
    await chrome.storage.sync.set(config);
    showStatus(saveStatus, '설정이 저장되었습니다.', 'success');
  } catch (error) {
    showStatus(saveStatus, `저장 실패: ${error}`, 'error');
  }
}

// GitHub API 테스트 (Phase 5에서 구현)
async function testGithubApi() {
  const token = githubTokenInput.value.trim();

  if (!token) {
    showStatus(document.getElementById('github-status')!, 'Token을 입력하세요.', 'error');
    return;
  }

  // TODO: Phase 5에서 실제 API 호출 구현
  showStatus(document.getElementById('github-status')!, 'API 테스트는 Phase 5에서 구현됩니다.', 'info');
}

// GitLab API 테스트 (Phase 5에서 구현)
async function testGitlabApi() {
  const token = gitlabTokenInput.value.trim();

  if (!token) {
    showStatus(document.getElementById('gitlab-status')!, 'Token을 입력하세요.', 'error');
    return;
  }

  // TODO: Phase 5에서 실제 API 호출 구현
  showStatus(document.getElementById('gitlab-status')!, 'API 테스트는 Phase 5에서 구현됩니다.', 'info');
}

// 상태 메시지 표시
function showStatus(element: HTMLElement, message: string, type: 'success' | 'error' | 'info') {
  element.textContent = message;
  element.className = `status ${type}`;

  // 3초 후 자동 사라짐
  setTimeout(() => {
    element.textContent = '';
    element.className = 'status';
  }, 3000);
}

// 이벤트 리스너
saveButton.addEventListener('click', saveConfig);
testGithubButton.addEventListener('click', testGithubApi);
testGitlabButton.addEventListener('click', testGitlabApi);

// 페이지 로드 시 설정 로드
loadConfig();
