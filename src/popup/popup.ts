/**
 * Review to Instruction - Popup Script
 *
 * v2 변경사항:
 * - API 토큰을 암호화하여 chrome.storage.local에 저장
 * - Web Crypto API (AES-GCM 256-bit) 사용
 * - LLM API 보안 경고 표시
 *
 * v3 변경사항 (리팩토링):
 * - FormManager를 사용하여 폼 관리 자동화
 * - 수동 DOM 조작 제거
 * - 선언적 폼 스키마 기반 동작
 */

import { CryptoService } from '../background/services/crypto-service';
import { FormManager } from '../utils/form-manager';
import { popupFormSchema } from './form-schema';

// CryptoService 인스턴스
const crypto = new CryptoService();

// FormManager 인스턴스 생성
const formManager = new FormManager(popupFormSchema, crypto);

// DOM 요소 (FormManager가 관리하지 않는 요소들만)
const saveButton = document.getElementById('save') as HTMLButtonElement;
const testGithubButton = document.getElementById('test-github') as HTMLButtonElement;
const testGitlabButton = document.getElementById('test-gitlab') as HTMLButtonElement;
const saveStatus = document.getElementById('save-status') as HTMLDivElement;

// LLM 설정 DOM 요소 (가시성 제어용)
const llmEnabledCheckbox = document.getElementById('llm-enabled') as HTMLInputElement;
const llmSettingsDiv = document.getElementById('llm-settings') as HTMLDivElement;
const llmProviderSelect = document.getElementById('llm-provider') as HTMLSelectElement;

// 캐시 관리 DOM 요소
const cacheEntriesSpan = document.getElementById('cache-entries') as HTMLSpanElement;
const cacheHitRateSpan = document.getElementById('cache-hit-rate') as HTMLSpanElement;
const cacheHitsSpan = document.getElementById('cache-hits') as HTMLSpanElement;
const cacheMissesSpan = document.getElementById('cache-misses') as HTMLSpanElement;
const cacheSizeSpan = document.getElementById('cache-size') as HTMLSpanElement;
const refreshCacheStatsButton = document.getElementById('refresh-cache-stats') as HTMLButtonElement;
const clearCacheButton = document.getElementById('clear-cache') as HTMLButtonElement;
const cacheStatus = document.getElementById('cache-status') as HTMLDivElement;

// 설정 로드 (FormManager 사용)
async function loadConfig() {
  try {
    await formManager.load();
    updateLLMUI();
  } catch (error) {
    console.error('Failed to load config:', error);
    showStatus(saveStatus, '❌ 설정 로드 실패', 'error');
  }
}

// 설정 저장 (FormManager 사용)
async function saveConfig() {
  try {
    const result = await formManager.save();

    if (result.isValid) {
      showStatus(saveStatus, '✅ 설정이 암호화되어 저장되었습니다.', 'success');
    } else {
      // 검증 오류 표시
      const errorMessages = Array.from(result.errors.entries())
        .map(([, message]) => `• ${message}`)
        .join('\n');
      showStatus(saveStatus, `❌ 검증 실패:\n${errorMessages}`, 'error');
    }
  } catch (error) {
    showStatus(saveStatus, `❌ 저장 실패: ${error}`, 'error');
  }
}

// GitHub API 테스트
async function testGithubApi() {
  const token = formManager.getValue('github-token');
  const statusElement = document.getElementById('github-status')!;

  if (!token || token.trim() === '') {
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
  const token = formManager.getValue('gitlab-token');
  const gitlabUrl = formManager.getValue('gitlab-url');
  const statusElement = document.getElementById('gitlab-status')!;

  if (!token || token.trim() === '') {
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

  // LLM 활성화 시 설정 표시
  llmSettingsDiv.style.display = isEnabled ? 'block' : 'none';

  // FormManager의 가시성 업데이트 호출 (API 키 필드 표시/숨김)
  formManager.updateVisibility();
}

// 캐시 통계 로드
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

// 캐시 초기화
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

// 캐시 관리 이벤트 리스너
refreshCacheStatsButton.addEventListener('click', loadCacheStats);
clearCacheButton.addEventListener('click', clearCache);

// FormManager 초기화 및 설정 로드
formManager.bindElements();
formManager.bindVisibilityUpdates();
loadConfig();
loadCacheStats();
