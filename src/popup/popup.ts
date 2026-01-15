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

// GitHub API 테스트
async function testGithubApi() {
  const token = githubTokenInput.value.trim();
  const statusElement = document.getElementById('github-status')!;

  if (!token) {
    showStatus(statusElement, 'Token을 입력하세요.', 'error');
    return;
  }

  // 버튼 비활성화
  testGithubButton.disabled = true;
  testGithubButton.textContent = '테스트 중...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_API',
      payload: {
        platform: 'github',
        token
      }
    });

    if (response.success) {
      showStatus(statusElement, `연결 성공! (사용자: ${response.data.user})`, 'success');
    } else {
      showStatus(statusElement, `연결 실패: ${response.error}`, 'error');
    }
  } catch (error) {
    showStatus(statusElement, `에러: ${error}`, 'error');
  } finally {
    testGithubButton.disabled = false;
    testGithubButton.textContent = '연결 테스트';
  }
}

// GitLab API 테스트
async function testGitlabApi() {
  const token = gitlabTokenInput.value.trim();
  const statusElement = document.getElementById('gitlab-status')!;

  if (!token) {
    showStatus(statusElement, 'Token을 입력하세요.', 'error');
    return;
  }

  // 버튼 비활성화
  testGitlabButton.disabled = true;
  testGitlabButton.textContent = '테스트 중...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_API',
      payload: {
        platform: 'gitlab',
        token
      }
    });

    if (response.success) {
      showStatus(statusElement, `연결 성공! (사용자: ${response.data.user})`, 'success');
    } else {
      showStatus(statusElement, `연결 실패: ${response.error}`, 'error');
    }
  } catch (error) {
    showStatus(statusElement, `에러: ${error}`, 'error');
  } finally {
    testGitlabButton.disabled = false;
    testGitlabButton.textContent = '연결 테스트';
  }
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
