/**
 * Review to Instruction - Popup Script
 *
 * v2 변경사항:
 * - API 토큰을 암호화하여 chrome.storage.local에 저장
 * - Web Crypto API (AES-GCM 256-bit) 사용
 * - LLM API 보안 경고 표시
 */

import { CryptoService } from '../background/services/crypto-service';

// CryptoService 인스턴스
const crypto = new CryptoService();

// DOM 요소
const githubTokenInput = document.getElementById('github-token') as HTMLInputElement;
const gitlabTokenInput = document.getElementById('gitlab-token') as HTMLInputElement;
const gitlabUrlInput = document.getElementById('gitlab-url') as HTMLInputElement;
const showButtonsCheckbox = document.getElementById('show-buttons') as HTMLInputElement;
const saveButton = document.getElementById('save') as HTMLButtonElement;
const testGithubButton = document.getElementById('test-github') as HTMLButtonElement;
const testGitlabButton = document.getElementById('test-gitlab') as HTMLButtonElement;
const saveStatus = document.getElementById('save-status') as HTMLDivElement;

// LLM 설정 DOM 요소
const llmEnabledCheckbox = document.getElementById('llm-enabled') as HTMLInputElement;
const llmSettingsDiv = document.getElementById('llm-settings') as HTMLDivElement;
const llmProviderSelect = document.getElementById('llm-provider') as HTMLSelectElement;
const claudeApiKeyInput = document.getElementById('claude-api-key') as HTMLInputElement;
const openaiApiKeyInput = document.getElementById('openai-api-key') as HTMLInputElement;
const claudeApiKeyGroup = document.getElementById('claude-api-key-group') as HTMLDivElement;
const openaiApiKeyGroup = document.getElementById('openai-api-key-group') as HTMLDivElement;

// 캐시 관리 DOM 요소 (Feature 2)
const cacheEntriesSpan = document.getElementById('cache-entries') as HTMLSpanElement;
const cacheHitRateSpan = document.getElementById('cache-hit-rate') as HTMLSpanElement;
const cacheHitsSpan = document.getElementById('cache-hits') as HTMLSpanElement;
const cacheMissesSpan = document.getElementById('cache-misses') as HTMLSpanElement;
const cacheSizeSpan = document.getElementById('cache-size') as HTMLSpanElement;
const refreshCacheStatsButton = document.getElementById('refresh-cache-stats') as HTMLButtonElement;
const clearCacheButton = document.getElementById('clear-cache') as HTMLButtonElement;
const cacheStatus = document.getElementById('cache-status') as HTMLDivElement;

// 설정 로드 (암호화된 storage.local에서)
async function loadConfig() {
  try {
    const result = await chrome.storage.local.get([
      'githubToken_enc',
      'gitlabToken_enc',
      'gitlabUrl',
      'showButtons',
      'claudeApiKey_enc',
      'openaiApiKey_enc',
      'llmProvider',
      'llmEnabled'
    ]);

    // 토큰 복호화
    const githubTokenEnc = result.githubToken_enc as string | undefined;
    const gitlabTokenEnc = result.gitlabToken_enc as string | undefined;
    const claudeKeyEnc = result.claudeApiKey_enc as string | undefined;
    const openaiKeyEnc = result.openaiApiKey_enc as string | undefined;

    if (githubTokenEnc) {
      try {
        githubTokenInput.value = await crypto.decrypt(githubTokenEnc);
      } catch (error) {
        console.warn('GitHub token decryption failed:', error);
        githubTokenInput.value = '';
      }
    }

    if (gitlabTokenEnc) {
      try {
        gitlabTokenInput.value = await crypto.decrypt(gitlabTokenEnc);
      } catch (error) {
        console.warn('GitLab token decryption failed:', error);
        gitlabTokenInput.value = '';
      }
    }

    // GitLab URL (암호화 불필요)
    gitlabUrlInput.value = (result.gitlabUrl as string | undefined) || 'https://git.projectbro.com';
    showButtonsCheckbox.checked = (result.showButtons as boolean | undefined) !== false;  // 기본값 true

    // LLM API 키 복호화
    if (claudeKeyEnc) {
      try {
        claudeApiKeyInput.value = await crypto.decrypt(claudeKeyEnc);
      } catch (error) {
        console.warn('Claude API key decryption failed:', error);
        claudeApiKeyInput.value = '';
      }
    }

    if (openaiKeyEnc) {
      try {
        openaiApiKeyInput.value = await crypto.decrypt(openaiKeyEnc);
      } catch (error) {
        console.warn('OpenAI API key decryption failed:', error);
        openaiApiKeyInput.value = '';
      }
    }

    // LLM 설정
    llmEnabledCheckbox.checked = (result.llmEnabled as boolean | undefined) || false;
    llmProviderSelect.value = (result.llmProvider as string | undefined) || 'none';

    // LLM UI 업데이트
    updateLLMUI();
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

// 설정 저장 (암호화하여 storage.local에)
async function saveConfig() {
  try {
    const encryptedData: Record<string, any> = {};

    // 토큰 암호화
    const githubToken = githubTokenInput.value.trim();
    const gitlabToken = gitlabTokenInput.value.trim();

    if (githubToken) {
      encryptedData.githubToken_enc = await crypto.encrypt(githubToken);
    }

    if (gitlabToken) {
      encryptedData.gitlabToken_enc = await crypto.encrypt(gitlabToken);
    }

    // LLM API 키 암호화
    const claudeApiKey = claudeApiKeyInput.value.trim();
    const openaiApiKey = openaiApiKeyInput.value.trim();

    if (claudeApiKey) {
      encryptedData.claudeApiKey_enc = await crypto.encrypt(claudeApiKey);
    }

    if (openaiApiKey) {
      encryptedData.openaiApiKey_enc = await crypto.encrypt(openaiApiKey);
    }

    // 나머지 설정 (암호화 불필요)
    encryptedData.gitlabUrl = gitlabUrlInput.value.trim();
    encryptedData.showButtons = showButtonsCheckbox.checked;
    encryptedData.llmEnabled = llmEnabledCheckbox.checked;
    encryptedData.llmProvider = llmProviderSelect.value;

    // Local storage에 저장
    await chrome.storage.local.set(encryptedData);
    showStatus(saveStatus, '✅ 설정이 암호화되어 저장되었습니다.', 'success');
  } catch (error) {
    showStatus(saveStatus, `❌ 저장 실패: ${error}`, 'error');
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

  // 버튼 로딩 상태
  testGithubButton.disabled = true;
  testGithubButton.classList.add('loading');
  const originalText = testGithubButton.textContent;

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
    testGithubButton.classList.remove('loading');
    testGithubButton.textContent = originalText || '연결 테스트';
  }
}

// GitLab API 테스트
async function testGitlabApi() {
  const token = gitlabTokenInput.value.trim();
  const gitlabUrl = gitlabUrlInput.value.trim();
  const statusElement = document.getElementById('gitlab-status')!;

  if (!token) {
    showStatus(statusElement, 'Token을 입력하세요.', 'error');
    return;
  }

  // 버튼 로딩 상태
  testGitlabButton.disabled = true;
  testGitlabButton.classList.add('loading');
  const originalText = testGitlabButton.textContent;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_API',
      payload: {
        platform: 'gitlab',
        token,
        gitlabUrl
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
    testGitlabButton.classList.remove('loading');
    testGitlabButton.textContent = originalText || '연결 테스트';
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

// LLM UI 업데이트
function updateLLMUI() {
  const isEnabled = llmEnabledCheckbox.checked;
  const provider = llmProviderSelect.value;

  // LLM 활성화 시 설정 표시
  llmSettingsDiv.style.display = isEnabled ? 'block' : 'none';

  // 제공자에 따라 API 키 입력란 표시
  if (isEnabled) {
    claudeApiKeyGroup.style.display = provider === 'claude' ? 'block' : 'none';
    openaiApiKeyGroup.style.display = provider === 'openai' ? 'block' : 'none';
  }
}

// 캐시 통계 로드 (Feature 2)
async function loadCacheStats() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CACHE_STATS'
    });

    if (response.success) {
      const stats = response.data;

      // 캐시 항목 수
      cacheEntriesSpan.textContent = stats.totalEntries.toString();

      // 적중률 계산
      const totalRequests = stats.hitCount + stats.missCount;
      const hitRate = totalRequests > 0
        ? ((stats.hitCount / totalRequests) * 100).toFixed(1)
        : '0.0';
      cacheHitRateSpan.textContent = `${hitRate}%`;

      // HIT/MISS 횟수
      cacheHitsSpan.textContent = stats.hitCount.toString();
      cacheMissesSpan.textContent = stats.missCount.toString();

      // 캐시 크기
      cacheSizeSpan.textContent = formatBytes(stats.cacheSize);

    } else {
      console.error('Failed to load cache stats:', response.error);
      showStatus(cacheStatus, '캐시 통계를 불러올 수 없습니다.', 'error');
    }
  } catch (error) {
    console.error('Error loading cache stats:', error);
    showStatus(cacheStatus, `에러: ${error}`, 'error');
  }
}

// 캐시 초기화 (Feature 2)
async function clearCache() {
  // 확인 대화상자
  if (!confirm('캐시를 초기화하시겠습니까?\n\n저장된 모든 LLM 응답이 삭제되며, 다음 요청부터 다시 API를 호출합니다.')) {
    return;
  }

  // 버튼 로딩 상태
  clearCacheButton.disabled = true;
  clearCacheButton.classList.add('loading');
  const originalText = clearCacheButton.textContent;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_CACHE'
    });

    if (response.success) {
      showStatus(cacheStatus, '캐시가 초기화되었습니다.', 'success');
      // 통계 갱신
      await loadCacheStats();
    } else {
      showStatus(cacheStatus, `초기화 실패: ${response.error}`, 'error');
    }
  } catch (error) {
    showStatus(cacheStatus, `에러: ${error}`, 'error');
  } finally {
    clearCacheButton.disabled = false;
    clearCacheButton.classList.remove('loading');
    clearCacheButton.textContent = originalText || '캐시 초기화';
  }
}

// 바이트를 사람이 읽기 쉬운 형식으로 변환
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// 이벤트 리스너
saveButton.addEventListener('click', saveConfig);
testGithubButton.addEventListener('click', testGithubApi);
testGitlabButton.addEventListener('click', testGitlabApi);

// LLM 설정 이벤트 리스너
llmEnabledCheckbox.addEventListener('change', updateLLMUI);
llmProviderSelect.addEventListener('change', updateLLMUI);

// 캐시 관리 이벤트 리스너 (Feature 2)
refreshCacheStatsButton.addEventListener('click', loadCacheStats);
clearCacheButton.addEventListener('click', clearCache);

// 페이지 로드 시 설정 및 캐시 통계 로드
loadConfig();
loadCacheStats();
