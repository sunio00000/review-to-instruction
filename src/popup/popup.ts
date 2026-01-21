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

// ==================== 마스터 비밀번호 관리 ====================

// 마스터 비밀번호 설정 여부 확인
async function checkMasterPasswordSetup(): Promise<boolean> {
  const result = await chrome.storage.local.get(['masterPasswordHash']);
  return !!result.masterPasswordHash;
}

// 마스터 비밀번호 검증용 해시 생성
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// 비밀번호 강도 체크
function checkPasswordStrength(password: string): { score: number; text: string; className: string } {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) {
    return { score, text: '약함', className: 'weak' };
  } else if (score <= 4) {
    return { score, text: '보통', className: 'medium' };
  } else {
    return { score, text: '강함', className: 'strong' };
  }
}

// 비밀번호 강도 업데이트
function updatePasswordStrength() {
  const passwordInput = document.getElementById('master-password') as HTMLInputElement;
  const strengthBar = document.getElementById('strength-bar') as HTMLDivElement;
  const strengthText = document.getElementById('strength-text') as HTMLSpanElement;

  const password = passwordInput.value;
  const strength = checkPasswordStrength(password);

  // 바 업데이트
  strengthBar.className = `strength-bar ${strength.className}`;

  // 텍스트 업데이트
  strengthText.textContent = strength.text;
  strengthText.className = `strength-text ${strength.className}`;
}

// 마스터 비밀번호 설정
async function setupMasterPassword(): Promise<void> {
  const passwordInput = document.getElementById('master-password') as HTMLInputElement;
  const confirmInput = document.getElementById('master-password-confirm') as HTMLInputElement;
  const errorDiv = document.getElementById('master-password-error') as HTMLDivElement;
  const setButton = document.getElementById('set-master-password-btn') as HTMLButtonElement;

  const password = passwordInput.value;
  const confirm = confirmInput.value;

  // 비밀번호 확인
  if (!password || !confirm) {
    errorDiv.textContent = '비밀번호를 입력하세요.';
    errorDiv.style.display = 'block';
    return;
  }

  if (password !== confirm) {
    errorDiv.textContent = '비밀번호가 일치하지 않습니다.';
    errorDiv.style.display = 'block';
    return;
  }

  const strength = checkPasswordStrength(password);
  if (strength.score < 3) {
    errorDiv.textContent = '비밀번호가 너무 약합니다. 영문, 숫자, 특수문자를 조합하여 8자 이상 입력하세요.';
    errorDiv.style.display = 'block';
    return;
  }

  // 버튼 로딩 상태
  setButton.disabled = true;
  setButton.classList.add('loading');

  try {
    // 비밀번호 해시 저장 (검증용)
    const passwordHash = await hashPassword(password);
    await chrome.storage.local.set({ masterPasswordHash: passwordHash });

    // CryptoService에 비밀번호 설정
    crypto.setMasterPassword(password);

    // 모달 닫기
    const modal = document.getElementById('master-password-modal')!;
    modal.style.display = 'none';

    // 기존 암호화된 데이터 마이그레이션 (있다면)
    await migrateEncryptedData();

    // FormManager 초기화 및 설정 로드
    formManager.bindElements();
    formManager.bindVisibilityUpdates();
    await loadConfig();
    await loadCacheStats();

    showStatus(saveStatus, '✅ 마스터 비밀번호가 설정되었습니다.', 'success');
  } catch (error) {
    console.error('Failed to setup master password:', error);
    errorDiv.textContent = `설정 실패: ${error}`;
    errorDiv.style.display = 'block';
  } finally {
    setButton.disabled = false;
    setButton.classList.remove('loading');
  }
}

// 마스터 비밀번호로 잠금 해제
async function unlockWithPassword(): Promise<boolean> {
  const passwordInput = document.getElementById('unlock-password') as HTMLInputElement;
  const errorDiv = document.getElementById('unlock-error') as HTMLDivElement;
  const unlockButton = document.getElementById('unlock-btn') as HTMLButtonElement;

  const password = passwordInput.value;

  if (!password) {
    errorDiv.textContent = '비밀번호를 입력하세요.';
    errorDiv.style.display = 'block';
    return false;
  }

  // 버튼 로딩 상태
  unlockButton.disabled = true;
  unlockButton.classList.add('loading');

  try {
    const passwordHash = await hashPassword(password);
    const result = await chrome.storage.local.get(['masterPasswordHash']);

    if (result.masterPasswordHash !== passwordHash) {
      errorDiv.textContent = '비밀번호가 일치하지 않습니다.';
      errorDiv.style.display = 'block';
      return false;
    }

    // CryptoService에 비밀번호 설정
    crypto.setMasterPassword(password);

    // 모달 닫기
    const modal = document.getElementById('unlock-modal')!;
    modal.style.display = 'none';

    // FormManager 초기화 및 설정 로드
    formManager.bindElements();
    formManager.bindVisibilityUpdates();
    await loadConfig();
    await loadCacheStats();

    return true;
  } catch (error) {
    console.error('Failed to unlock:', error);
    errorDiv.textContent = `잠금 해제 실패: ${error}`;
    errorDiv.style.display = 'block';
    return false;
  } finally {
    unlockButton.disabled = false;
    unlockButton.classList.remove('loading');
  }
}

// 비밀번호 재설정
async function resetMasterPassword(): Promise<void> {
  if (!confirm('비밀번호를 재설정하시겠습니까?\n\n⚠️ 경고: 기존에 저장된 모든 API 키가 삭제됩니다.')) {
    return;
  }

  try {
    // 모든 암호화된 데이터 삭제
    await chrome.storage.local.remove([
      'masterPasswordHash',
      'githubToken_enc',
      'gitlabToken_enc',
      'claudeApiKey_enc',
      'openaiApiKey_enc'
    ]);

    // 현재 모달 닫고 설정 모달 열기
    const unlockModal = document.getElementById('unlock-modal')!;
    const setupModal = document.getElementById('master-password-modal')!;

    unlockModal.style.display = 'none';
    setupModal.style.display = 'flex';

    // 입력 필드 초기화
    (document.getElementById('master-password') as HTMLInputElement).value = '';
    (document.getElementById('master-password-confirm') as HTMLInputElement).value = '';
  } catch (error) {
    console.error('Failed to reset password:', error);
    alert(`비밀번호 재설정 실패: ${error}`);
  }
}

// 기존 암호화 데이터 마이그레이션 (Extension ID → 마스터 비밀번호)
async function migrateEncryptedData(): Promise<void> {
  console.log('[Popup] Checking for data migration...');

  try {
    const storage = await chrome.storage.local.get([
      'githubToken_enc',
      'gitlabToken_enc',
      'claudeApiKey_enc',
      'openaiApiKey_enc'
    ]);

    const keysToMigrate = Object.keys(storage).filter(key => key.endsWith('_enc'));

    if (keysToMigrate.length === 0) {
      console.log('[Popup] No encrypted data to migrate');
      return;
    }

    console.log(`[Popup] Migrating ${keysToMigrate.length} encrypted keys...`);

    // 각 키에 대해 Legacy 방식으로 복호화 후 마스터 비밀번호 방식으로 재암호화
    const migratedData: Record<string, string> = {};

    for (const key of keysToMigrate) {
      const encryptedValue = storage[key] as string;
      if (!encryptedValue || typeof encryptedValue !== 'string') continue;

      try {
        // Legacy 방식으로 복호화 시도
        const tempPassword = crypto.getMasterPassword();
        crypto.clearMasterPassword(); // 임시로 마스터 비밀번호 제거

        const decryptedValue = await crypto.decrypt(encryptedValue);

        // 마스터 비밀번호 복원
        if (tempPassword) {
          crypto.setMasterPassword(tempPassword);
        }

        // 마스터 비밀번호로 재암호화
        const reencryptedValue = await crypto.encrypt(decryptedValue);
        migratedData[key] = reencryptedValue;

        console.log(`[Popup] Migrated ${key}`);
      } catch (error) {
        console.warn(`[Popup] Failed to migrate ${key}:`, error);
        // 실패한 키는 건너뛰기 (이미 마스터 비밀번호로 암호화되어 있을 수 있음)
      }
    }

    // 마이그레이션된 데이터 저장
    if (Object.keys(migratedData).length > 0) {
      await chrome.storage.local.set(migratedData);
      console.log(`[Popup] Migration complete: ${Object.keys(migratedData).length} keys migrated`);
    }
  } catch (error) {
    console.error('[Popup] Migration error:', error);
    // 마이그레이션 실패해도 계속 진행 (사용자가 수동으로 재입력 가능)
  }
}

// 비밀번호 표시/숨김 토글
function setupPasswordToggles(): void {
  document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', (e) => {
      const target = (e.currentTarget as HTMLElement).getAttribute('data-target');
      if (!target) return;

      const input = document.getElementById(target) as HTMLInputElement;
      const showIcon = (e.currentTarget as HTMLElement).querySelector('.show-icon') as HTMLElement;
      const hideIcon = (e.currentTarget as HTMLElement).querySelector('.hide-icon') as HTMLElement;

      if (input.type === 'password') {
        input.type = 'text';
        showIcon.style.display = 'none';
        hideIcon.style.display = 'inline';
      } else {
        input.type = 'password';
        showIcon.style.display = 'inline';
        hideIcon.style.display = 'none';
      }
    });
  });
}

// 초기화 함수
async function init() {
  const hasPassword = await checkMasterPasswordSetup();

  if (!hasPassword) {
    // 첫 실행: 마스터 비밀번호 설정
    const setupModal = document.getElementById('master-password-modal')!;
    setupModal.style.display = 'flex';

    // 비밀번호 강도 체크 이벤트 리스너
    const passwordInput = document.getElementById('master-password') as HTMLInputElement;
    passwordInput.addEventListener('input', updatePasswordStrength);

    // 비밀번호 설정 버튼
    const setButton = document.getElementById('set-master-password-btn')!;
    setButton.addEventListener('click', setupMasterPassword);

    // 비밀번호 표시/숨김 토글
    setupPasswordToggles();
  } else {
    // 기존 사용자: 잠금 해제
    const unlockModal = document.getElementById('unlock-modal')!;
    unlockModal.style.display = 'flex';

    // Enter 키로 잠금 해제
    const unlockPassword = document.getElementById('unlock-password') as HTMLInputElement;
    unlockPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        unlockWithPassword();
      }
    });

    // 잠금 해제 버튼
    const unlockButton = document.getElementById('unlock-btn')!;
    unlockButton.addEventListener('click', unlockWithPassword);

    // 비밀번호 재설정 버튼
    const resetButton = document.getElementById('reset-password-btn')!;
    resetButton.addEventListener('click', resetMasterPassword);

    // 비밀번호 표시/숨김 토글
    setupPasswordToggles();
  }
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

// 마스터 비밀번호 초기화
init();
