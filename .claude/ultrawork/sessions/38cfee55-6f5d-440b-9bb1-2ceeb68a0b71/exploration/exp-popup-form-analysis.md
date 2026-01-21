# Exploration: Popup Form Save/Load Logic Analysis

## Overview

이 문서는 `src/popup/popup.ts`의 설정 폼(form)에 대한 상세한 구현 분석입니다. 사용자가 입력한 설정값들이 어떻게 저장/로드되는지, 암호화가 어떻게 처리되는지를 체계적으로 분석합니다.

---

## 1. 모든 폼 필드 목록

### 1.1 필드 메타데이터 테이블

| 필드명 | DOM ID | HTML Type | 저장 키 | 암호화 여부 | 기본값 | 로드 시 처리 | 저장 시 처리 |
|--------|--------|-----------|--------|----------|--------|-----------|----------|
| GitHub Token | `github-token` | password | `githubToken_enc` | ✅ Yes | (empty) | try/catch 복호화 | 빈 값이면 스킵, 아니면 암호화 |
| GitLab Token | `gitlab-token` | password | `gitlabToken_enc` | ✅ Yes | (empty) | try/catch 복호화 | 빈 값이면 스킵, 아니면 암호화 |
| GitLab URL | `gitlab-url` | text | `gitlabUrl` | ❌ No | `https://git.projectbro.com` | 직접 로드 | `trim()` 후 저장 |
| Show Buttons | `show-buttons` | checkbox | `showButtons` | ❌ No | `true` | 직접 로드, 기본값 처리 | 직접 저장 (boolean) |
| LLM Enabled | `llm-enabled` | checkbox | `llmEnabled` | ❌ No | `false` | 직접 로드 | 직접 저장 (boolean) |
| LLM Provider | `llm-provider` | select | `llmProvider` | ❌ No | `'none'` | 직접 로드 | 직접 저장 (string) |
| Claude API Key | `claude-api-key` | password | `claudeApiKey_enc` | ✅ Yes | (empty) | try/catch 복호화 | 빈 값이면 스킵, 아니면 암호화 |
| OpenAI API Key | `openai-api-key` | password | `openaiApiKey_enc` | ✅ Yes | (empty) | try/catch 복호화 | 빈 값이면 스킵, 아니면 암호화 |

### 1.2 필드 그룹화

**GitHub 관련 필드:**
- GitHub Token (encrypted)

**GitLab 관련 필드:**
- GitLab Token (encrypted)
- GitLab URL (plain)

**UI 제어 필드:**
- Show Buttons (plain, boolean)

**LLM 설정 필드:**
- LLM Enabled (plain, boolean) - 토글 스위치
- LLM Provider (plain, string) - select 요소
- Claude API Key (encrypted)
- OpenAI API Key (encrypted)

**캐시 관리 필드 (읽기 전용, 저장하지 않음):**
- Cache Entries (표시만)
- Cache Hit Rate (표시만)
- Cache Hits (표시만)
- Cache Misses (표시만)
- Cache Size (표시만)

---

## 2. 현재 코드 흐름 분석

### 2.1 로드 흐름 (loadConfig)

```
loadConfig() 호출
    ↓
chrome.storage.local.get([8개 키]) 호출
    ↓
암호화된 토큰들 추출
    ├── githubToken_enc
    ├── gitlabToken_enc
    ├── claudeApiKey_enc
    └── openaiApiKey_enc
    ↓
각 암호화된 토큰에 대해 try/catch로 복호화
    ├── crypto.decrypt(githubTokenEnc) → githubTokenInput.value
    ├── crypto.decrypt(gitlabTokenEnc) → gitlabTokenInput.value
    ├── crypto.decrypt(claudeKeyEnc) → claudeApiKeyInput.value
    └── crypto.decrypt(openaiKeyEnc) → openaiApiKeyInput.value
    ↓
복호화 실패 시 빈 문자열로 설정 (console.warn 출력)
    ↓
평문 필드 직접 로드
    ├── gitlabUrl (기본값: 'https://git.projectbro.com')
    ├── showButtons (기본값: true)
    ├── llmEnabled (기본값: false)
    └── llmProvider (기본값: 'none')
    ↓
updateLLMUI() 호출 (UI 상태 업데이트)
    ↓
loadCacheStats() 호출 (캐시 통계 표시)
```

**로드 단계 상세 코드 흐름:**

```typescript
// 1. storage에서 데이터 추출
const result = await chrome.storage.local.get([...keys]);

// 2. 암호화된 토큰 추출
const githubTokenEnc = result.githubToken_enc as string | undefined;

// 3. 암호화된 토큰 존재 확인 및 복호화 (try/catch)
if (githubTokenEnc) {
  try {
    githubTokenInput.value = await crypto.decrypt(githubTokenEnc);
  } catch (error) {
    console.warn('GitHub token decryption failed:', error);
    githubTokenInput.value = '';  // 복호화 실패 시 빈 값
  }
}

// 4. 평문 필드 직접 로드 (기본값 포함)
gitlabUrlInput.value = (result.gitlabUrl as string | undefined) || 'https://git.projectbro.com';
showButtonsCheckbox.checked = (result.showButtons as boolean | undefined) !== false;

// 5. LLM 설정
llmEnabledCheckbox.checked = (result.llmEnabled as boolean | undefined) || false;
llmProviderSelect.value = (result.llmProvider as string | undefined) || 'none';

// 6. UI 동적 업데이트
updateLLMUI();
```

### 2.2 저장 흐름 (saveConfig)

```
saveConfig() 호출
    ↓
빈 객체 생성: encryptedData = {}
    ↓
필드별 처리
    ├── GitHub Token
    │   ├── trim()으로 공백 제거
    │   └── 값이 있으면 암호화 → githubToken_enc
    │
    ├── GitLab Token
    │   ├── trim()으로 공백 제거
    │   └── 값이 있으면 암호화 → gitlabToken_enc
    │
    ├── Claude API Key
    │   ├── trim()으로 공백 제거
    │   └── 값이 있으면 암호화 → claudeApiKey_enc
    │
    ├── OpenAI API Key
    │   ├── trim()으로 공백 제거
    │   └── 값이 있으면 암호화 → openaiApiKey_enc
    │
    ├── GitLab URL
    │   └── trim() 후 저장 → gitlabUrl (평문)
    │
    ├── Show Buttons
    │   └── boolean 직접 저장 → showButtons
    │
    ├── LLM Enabled
    │   └── boolean 직접 저장 → llmEnabled
    │
    └── LLM Provider
        └── string 직접 저장 → llmProvider
    ↓
chrome.storage.local.set(encryptedData) 호출
    ↓
성공 시: 상태 메시지 표시 (초록색, 3초 후 사라짐)
실패 시: 에러 메시지 표시 (빨강색, 3초 후 사라짐)
```

**저장 단계 상세 코드 흐름:**

```typescript
// 1. 설정 객체 생성
const encryptedData: Record<string, any> = {};

// 2. 토큰 처리 (조건부 암호화)
const githubToken = githubTokenInput.value.trim();
if (githubToken) {
  encryptedData.githubToken_enc = await crypto.encrypt(githubToken);
}

// 3. 평문 필드 직접 저장
encryptedData.gitlabUrl = gitlabUrlInput.value.trim();
encryptedData.showButtons = showButtonsCheckbox.checked;
encryptedData.llmEnabled = llmEnabledCheckbox.checked;
encryptedData.llmProvider = llmProviderSelect.value;

// 4. storage에 저장
await chrome.storage.local.set(encryptedData);

// 5. 사용자 피드백
showStatus(saveStatus, '✅ 설정이 암호화되어 저장되었습니다.', 'success');
```

### 2.3 DOM 참조 맵

```typescript
// Platform Tokens (encrypted)
const githubTokenInput = document.getElementById('github-token');       // ← githubToken_enc
const gitlabTokenInput = document.getElementById('gitlab-token');       // ← gitlabToken_enc

// GitLab Config
const gitlabUrlInput = document.getElementById('gitlab-url');           // ← gitlabUrl (plain)

// UI Control
const showButtonsCheckbox = document.getElementById('show-buttons');    // ← showButtons (plain)

// LLM Config (encrypted)
const claudeApiKeyInput = document.getElementById('claude-api-key');   // ← claudeApiKey_enc
const openaiApiKeyInput = document.getElementById('openai-api-key');   // ← openaiApiKey_enc

// LLM UI Control
const llmEnabledCheckbox = document.getElementById('llm-enabled');     // ← llmEnabled (plain)
const llmProviderSelect = document.getElementById('llm-provider');     // ← llmProvider (plain)

// LLM UI Visibility Control
const llmSettingsDiv = document.getElementById('llm-settings');
const claudeApiKeyGroup = document.getElementById('claude-api-key-group');
const openaiApiKeyGroup = document.getElementById('openai-api-key-group');

// Cache Management (display only, read-only)
const cacheEntriesSpan = document.getElementById('cache-entries');
const cacheHitRateSpan = document.getElementById('cache-hit-rate');
const cacheHitsSpan = document.getElementById('cache-hits');
const cacheMissesSpan = document.getElementById('cache-misses');
const cacheSizeSpan = document.getElementById('cache-size');
```

---

## 3. 암호화 로직 상세 분석

### 3.1 CryptoService 통합

**파일:** `src/background/services/crypto-service.ts`

**초기화:**
```typescript
const crypto = new CryptoService();  // popup.ts 최상단에서 싱글톤 생성
```

**암호화 방식:**
- 알고리즘: **AES-GCM 256-bit**
- 키 생성: **PBKDF2** (SHA-256, 100,000 iterations)
- 키 소스: **Chrome Extension ID** (재설치 시 변경됨 ⚠️)
- IV (Initialization Vector): **12 bytes** (매번 랜덤 생성)
- 저장 형식: **Base64** (IV + 암호화된 데이터)

### 3.2 암호화 흐름

```
평문 토큰 입력
    ↓
saveConfig() 호출
    ↓
암호화 필요 필드 확인 (trim() 체크)
    ↓
CryptoService.encrypt(plaintext)
    ├── Extension ID 기반 키 생성
    ├── 12-byte 랜덤 IV 생성
    ├── AES-GCM으로 평문 암호화
    ├── IV + 암호문 결합
    └── Base64 인코딩
    ↓
chrome.storage.local.set({
  'githubToken_enc': 'base64EncodedString',
  ...
})
```

### 3.3 복호화 흐름

```
chrome.storage.local에서 암호화된 데이터 읽음
    ↓
loadConfig() 호출
    ↓
암호화된 각 필드에 대해:
    ├── CryptoService.decrypt(ciphertext)
    │   ├── Base64 디코딩
    │   ├── IV 분리 (처음 12 bytes)
    │   ├── 암호문 분리 (나머지)
    │   ├── Extension ID 기반 동일 키 생성
    │   └── AES-GCM 복호화
    │       ↓
    │       (성공) → 평문 토큰 반환
    │       (실패) → catch 블록에서 console.warn 및 빈 값 설정
    └── DOM 요소에 값 할당
```

### 3.4 보안 특성

**장점:**
- ✅ Extension ID 기반 고유 키 → 다른 확장에서 접근 불가
- ✅ AES-GCM → authenticated encryption (위조 방지)
- ✅ 매번 새로운 IV → same plaintext ≠ same ciphertext
- ✅ PBKDF2 100,000 iterations → 무차별 대입 공격 어려움

**주의사항:**
- ⚠️ 재설치 시 Extension ID 변경 → 기존 암호화 데이터 복호화 불가
- ⚠️ chrome.storage.local은 로컬만 안전 (동기화 안 함)
- ⚠️ 복호화 실패 시 사용자에게 재입력 필요

---

## 4. 반복 패턴 분석 (Code Repetition)

### 4.1 암호화 토큰 처리 반복

**문제: 동일한 패턴 4번 반복**

**로드 시 (lines 64-103):**
```typescript
// 패턴 1: GitHub Token (lines 64-71)
if (githubTokenEnc) {
  try {
    githubTokenInput.value = await crypto.decrypt(githubTokenEnc);
  } catch (error) {
    console.warn('GitHub token decryption failed:', error);
    githubTokenInput.value = '';
  }
}

// 패턴 2: GitLab Token (lines 73-80) - 거의 동일
if (gitlabTokenEnc) {
  try {
    gitlabTokenInput.value = await crypto.decrypt(gitlabTokenEnc);
  } catch (error) {
    console.warn('GitLab token decryption failed:', error);
    gitlabTokenInput.value = '';
  }
}

// 패턴 3: Claude API Key (lines 87-94) - 거의 동일
// 패턴 4: OpenAI API Key (lines 96-103) - 거의 동일
```

**저장 시 (lines 122-143):**
```typescript
// 패턴 1: GitHub Token (lines 122-127)
const githubToken = githubTokenInput.value.trim();
if (githubToken) {
  encryptedData.githubToken_enc = await crypto.encrypt(githubToken);
}

// 패턴 2: GitLab Token (lines 129-131) - 거의 동일
const gitlabToken = gitlabTokenInput.value.trim();
if (gitlabToken) {
  encryptedData.gitlabToken_enc = await crypto.encrypt(gitlabToken);
}

// 패턴 3: Claude API Key (lines 134-139) - 거의 동일
// 패턴 4: OpenAI API Key (lines 141-143) - 거의 동일
```

### 4.2 테스트 버튼 핸들러 반복

**로드/저장 상태 메시지 표시 반복:**
```typescript
// testGithubApi() - lines 170-172
testGithubButton.disabled = true;
testGithubButton.classList.add('loading');
const originalText = testGithubButton.textContent;

// testGitlabApi() - lines 209-211 (동일)
testGitlabButton.disabled = true;
testGitlabButton.classList.add('loading');
const originalText = testGitlabButton.textContent;

// finally 블록도 거의 동일
finally {
  testGithubButton.disabled = false;
  testGithubButton.classList.remove('loading');
  testGithubButton.textContent = originalText || '연결 테스트';
}
```

### 4.3 캐시 관리 버튼 반복

**clearCache()와 비슷한 패턴:**
```typescript
// clearCacheButton 처리 (lines 308-330)
clearCacheButton.disabled = true;
clearCacheButton.classList.add('loading');
const originalText = clearCacheButton.textContent;

try {
  // 작업 수행
} catch (error) {
  // 에러 처리
} finally {
  clearCacheButton.disabled = false;
  clearCacheButton.classList.remove('loading');
  clearCacheButton.textContent = originalText || '캐시 초기화';
}
```

---

## 5. 유효성 검사 (Validation) 분석

### 5.1 입력 유효성 검사 패턴

**현재 구현되어 있는 유효성 검사:**

| 필드 | 유효성 검사 | 위치 | 유형 |
|------|----------|------|------|
| GitHub Token | `trim()` 확인 | testGithubApi() L164 | 빈 값 체크 |
| GitLab Token | `trim()` 확인 | testGitlabApi() L203 | 빈 값 체크 |
| GitLab URL | `trim()` 적용 | saveConfig() L146 | 공백 제거 |
| All Token Fields | `trim()` 적용 | saveConfig() L122-135 | 공백 제거 |

**누락된 유효성 검사:**

| 필드 | 누락된 검사 | 영향 | 심각도 |
|------|-----------|------|--------|
| GitHub Token | 형식 검사 (ghp_ 접두사) | 잘못된 토큰 저장 가능 | 🟡 Medium |
| GitLab Token | 형식 검사 (glpat- 접두사) | 잘못된 토큰 저장 가능 | 🟡 Medium |
| Claude API Key | 형식 검사 (sk-ant- 접두사) | 잘못된 키 저장 가능 | 🟡 Medium |
| OpenAI API Key | 형식 검사 (sk- 접두사) | 잘못된 키 저장 가능 | 🟡 Medium |
| GitLab URL | URL 형식 검사 | 유효하지 않은 URL 저장 | 🟡 Medium |
| LLM Provider | select 옵션 검사 | XSS 방지됨 (select 요소) | ✅ Protected |

### 5.2 저장 시 유효성 검사

**현재 로직:**
```typescript
// 토큰들: trim() 후 빈 값이 아니면 암호화하여 저장
const githubToken = githubTokenInput.value.trim();
if (githubToken) {
  encryptedData.githubToken_enc = await crypto.encrypt(githubToken);
}
// 빈 값이면: 저장되지 않음 (기존 값 유지)

// GitLab URL: trim() 후 항상 저장
encryptedData.gitlabUrl = gitlabUrlInput.value.trim();

// Boolean/String: 직접 저장
encryptedData.showButtons = showButtonsCheckbox.checked;
encryptedData.llmEnabled = llmEnabledCheckbox.checked;
encryptedData.llmProvider = llmProviderSelect.value;
```

---

## 6. 에러 처리 패턴 (Error Handling)

### 6.1 로드 시 에러 처리

**암호화된 필드 복호화 실패:**
```typescript
// lines 64-71 (GitHub Token 예시)
if (githubTokenEnc) {
  try {
    githubTokenInput.value = await crypto.decrypt(githubTokenEnc);
  } catch (error) {
    console.warn('GitHub token decryption failed:', error);
    githubTokenInput.value = '';  // 폴백: 빈 값
  }
}
```

**특징:**
- 개별 필드의 복호화 실패 → 해당 필드만 영향
- 전체 로드 실패 아님 (graceful degradation ✅)
- console.warn으로 로깅
- 사용자에게 명시적 에러 메시지 없음 (사용자는 필드가 비어있는 것만 볼 수 있음)

**최상위 try/catch:**
```typescript
// lines 111-113
catch (error) {
  console.error('Failed to load config:', error);
  // 에러 메시지 표시 없음
}
```

### 6.2 저장 시 에러 처리

```typescript
// lines 117-157
async function saveConfig() {
  try {
    // 암호화 및 저장 로직
    await chrome.storage.local.set(encryptedData);
    showStatus(saveStatus, '✅ 설정이 암호화되어 저장되었습니다.', 'success');
  } catch (error) {
    showStatus(saveStatus, `❌ 저장 실패: ${error}`, 'error');
  }
}
```

**특징:**
- 암호화 중 예외 발생 시 전체 저장 실패
- 사용자에게 에러 메시지 표시 (3초 후 자동 사라짐)
- 스택 트레이스는 표시하지 않음 (안전)

### 6.3 API 테스트 시 에러 처리

```typescript
// testGithubApi() - lines 174-194
try {
  const response = await chrome.runtime.sendMessage({
    type: 'TEST_API',
    payload: { platform: 'github', token }
  });

  if (response.success) {
    showStatus(statusElement, `연결 성공! (사용자: ${response.data.user})`, 'success');
  } else {
    showStatus(statusElement, `연결 실패: ${response.error}`, 'error');
  }
} catch (error) {
  showStatus(statusElement, `에러: ${error}`, 'error');
} finally {
  // 버튼 상태 복원
  testGithubButton.disabled = false;
  testGithubButton.classList.remove('loading');
  testGithubButton.textContent = originalText || '연결 테스트';
}
```

**특징:**
- response.success 확인 → 실패 처리
- chrome.runtime.sendMessage() 예외 처리
- 버튼 상태 복원 보장 (finally 블록)
- 사용자 피드백: 3초 표시 후 자동 사라짐

### 6.4 캐시 통계 로드 시 에러 처리

```typescript
// loadCacheStats() - lines 265-299
try {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_CACHE_STATS'
  });

  if (response.success) {
    // 통계 표시
  } else {
    console.error('Failed to load cache stats:', response.error);
    showStatus(cacheStatus, '캐시 통계를 불러올 수 없습니다.', 'error');
  }
} catch (error) {
  console.error('Error loading cache stats:', error);
  showStatus(cacheStatus, `에러: ${error}`, 'error');
}
```

---

## 7. 엣지 케이스 & 문제점 분석

### 7.1 엣지 케이스

| 케이스 | 현재 처리 | 예상 결과 | 문제점 |
|--------|---------|---------|--------|
| 빈 토큰 저장 시도 | `if (githubToken)` 체크 | 저장 안 됨 | ❓ 기존값 유지? 삭제? 불명확 |
| 공백만 있는 토큰 | `trim()` 후 체크 | 저장 안 됨 | ✅ 정상 처리 |
| 특수문자 포함 토큰 | UTF-8 인코딩 → 암호화 | 정상 저장/로드 | ✅ CryptoService에서 처리 |
| 매우 긴 토큰 (>10KB) | 그대로 암호화 | 성능 저하 가능 | 🟡 검증 없음 |
| Extension 재설치 | 새로운 Extension ID | 복호화 실패 | ❌ 심각한 문제 |
| 복호화 실패 후 다시 로드 | 빈 값 유지 | 사용자 재입력 필요 | ⚠️ UX 문제 |
| LLM Provider 선택 안 함 | 기본값 `'none'` | 정상 저장 | ✅ 정상 처리 |
| LLM 비활성화 → API 키 입력 | 모두 저장됨 | 메모리 낭비 | 🟡 비활성화 필드도 암호화 저장 |

### 7.2 주요 문제점

#### 문제 1: 빈 토큰 처리의 불명확함

**코드:**
```typescript
// 저장
const githubToken = githubTokenInput.value.trim();
if (githubToken) {
  encryptedData.githubToken_enc = await crypto.encrypt(githubToken);
}
// 빈 값이면 encryptedData에 포함 안 됨

await chrome.storage.local.set(encryptedData);
```

**문제:**
- `githubToken_enc` 키를 `encryptedData`에 포함하지 않음
- chrome.storage.local.set()은 포함되지 않은 키를 **유지**
- 사용자는 "저장했는데 값이 안 지워진다"고 생각할 수 있음
- 값을 비우려면? `null` 또는 빈 문자열을 명시적으로 저장해야 함

**해결 방안:**
```typescript
// 옵션 1: 값이 없으면 명시적으로 null 저장
if (githubToken) {
  encryptedData.githubToken_enc = await crypto.encrypt(githubToken);
} else {
  encryptedData.githubToken_enc = null;  // 또는 delete
}

// 옵션 2: 로드 시 명시적으로 확인
if (result.githubToken_enc) {
  // 복호화
} else {
  githubTokenInput.value = '';  // 로드 시 빈 값으로 설정
}
```

#### 문제 2: Extension 재설치 시 데이터 손실

**원인:**
```typescript
// CryptoService - lines 31-34
const extensionId = chrome.runtime.id;
if (!extensionId) {
  throw new Error('[CryptoService] Extension ID not available');
}
```

**문제:**
- Extension ID는 설치할 때마다 **새롭게 생성**
- 기존 암호화 데이터의 키를 재생성할 수 없음
- 재설치 후 기존 storage 데이터는 **복호화 불가** 🔒

**현재 처리:**
```typescript
// 복호화 실패 → catch 블록
} catch (error) {
  console.warn('GitHub token decryption failed:', error);
  githubTokenInput.value = '';  // 사용자에게 알리지 않고 빈 값
}
```

**문제점:**
- 사용자는 왜 토큰이 없어졌는지 모름
- 명확한 에러 메시지 또는 마이그레이션 전략 부재

#### 문제 3: LLM 비활성화 상태의 API 키 저장

**코드:**
```typescript
const claudeApiKey = claudeApiKeyInput.value.trim();
const openaiApiKey = openaiApiKeyInput.value.trim();

if (claudeApiKey) {
  encryptedData.claudeApiKey_enc = await crypto.encrypt(claudeApiKey);
}

if (openaiApiKey) {
  encryptedData.openaiApiKey_enc = await crypto.encrypt(openaiApiKey);
}
```

**문제:**
- `llmEnabled = false`여도 API 키는 저장됨
- 사용하지 않는 API 키를 암호화하여 저장 → 불필요한 저장소 사용
- UI상 숨겨진 필드여도 백그라운드에서 저장됨 (사용자 기대 불일치)

**해결 방안:**
```typescript
if (llmEnabledCheckbox.checked && claudeApiKey) {
  encryptedData.claudeApiKey_enc = await crypto.encrypt(claudeApiKey);
}
```

#### 문제 4: 복호화 실패 후 사용자 피드백 부족

**현재 처리:**
```typescript
if (githubTokenEnc) {
  try {
    githubTokenInput.value = await crypto.decrypt(githubTokenEnc);
  } catch (error) {
    console.warn('GitHub token decryption failed:', error);
    githubTokenInput.value = '';  // 사용자 알림 없음
  }
}
```

**문제:**
- console.warn만 출력 (일반 사용자는 볼 수 없음)
- UI에서 사용자에게 "토큰을 다시 입력하세요"라고 알리지 않음
- 복호화 실패 원인 불명확

**현재 결과:**
- 사용자는 필드가 비어있는 것을 보고 "아, 저장이 안 됐나?" 생각

#### 문제 5: 암호화/복호화 성능

**문제:**
- 매 로드/저장 시 PBKDF2 100,000 iterations 실행
- Extension ID 기반 키 유도는 계산 비용이 높음
- UI 로드 시간 지연 가능

**현재 코드:**
```typescript
private async deriveKey(): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(...);  // PBKDF2 시작
  const key = await crypto.subtle.deriveKey({
    iterations: CryptoService.PBKDF2_ITERATIONS,  // 100,000
    hash: 'SHA-256',
    ...
  }, keyMaterial, ...);
  return key;
}
```

**영향:**
- 4개 토큰 로드 → 4번 deriveKey() 호출
- 4개 토큰 저장 → 4번 deriveKey() 호출
- 각 호출마다 100,000 SHA-256 해싱

**해결 방안:**
```typescript
// 키 캐싱 (같은 세션 내에서만 유효)
private cachedKey: CryptoKey | null = null;
private cachedKeyTimestamp: number = 0;
private readonly KEY_CACHE_TTL = 60000;  // 1분

private async deriveKey(): Promise<CryptoKey> {
  const now = Date.now();
  if (this.cachedKey && now - this.cachedKeyTimestamp < this.KEY_CACHE_TTL) {
    return this.cachedKey;
  }
  // 키 생성...
  this.cachedKey = key;
  this.cachedKeyTimestamp = now;
  return key;
}
```

---

## 8. 현재 콘텐츠 스크린샷 (메모리 상태 다이어그램)

### 8.1 로드 프로세스 메모리 상태

```
시작
│
├─ chrome.storage.local.get([
│  'githubToken_enc',
│  'gitlabToken_enc',
│  'gitlabUrl',
│  'showButtons',
│  'claudeApiKey_enc',
│  'openaiApiKey_enc',
│  'llmProvider',
│  'llmEnabled'
│])
│
├─ result 객체:
│  ├─ githubToken_enc: 'base64EncodedCiphertext1'
│  ├─ gitlabToken_enc: 'base64EncodedCiphertext2'
│  ├─ claudeApiKey_enc: 'base64EncodedCiphertext3'
│  ├─ openaiApiKey_enc: 'base64EncodedCiphertext4'
│  ├─ gitlabUrl: 'https://git.projectbro.com'
│  ├─ showButtons: true
│  ├─ llmProvider: 'none'
│  └─ llmEnabled: false
│
├─ 각 암호화 필드별로:
│  ├─ crypto.decrypt(ciphertext)
│  │  ├─ Base64 디코딩 → Uint8Array
│  │  ├─ Extension ID 기반 키 생성 (PBKDF2)
│  │  ├─ IV 분리 (처음 12 bytes)
│  │  ├─ 암호문 분리 (나머지)
│  │  ├─ AES-GCM 복호화
│  │  └─ 평문 반환
│  └─ input.value = plaintext
│
├─ 평문 필드:
│  ├─ gitlabUrlInput.value = result.gitlabUrl
│  ├─ showButtonsCheckbox.checked = result.showButtons
│  ├─ llmEnabledCheckbox.checked = result.llmEnabled
│  └─ llmProviderSelect.value = result.llmProvider
│
├─ updateLLMUI() 호출
│  ├─ llmEnabled = true인 경우만 settings 표시
│  └─ provider에 따라 API 키 입력란 선택적 표시
│
└─ loadCacheStats() 호출
   ├─ chrome.runtime.sendMessage({ type: 'GET_CACHE_STATS' })
   └─ 캐시 통계 표시
```

### 8.2 저장 프로세스 메모리 상태

```
저장 버튼 클릭
│
├─ encryptedData = {} 생성
│
├─ 각 입력 필드 처리:
│
│ GitHub Token:
│ ├─ githubToken = githubTokenInput.value.trim()  → 'ghp_xyz123'
│ └─ if (githubToken) → true
│    └─ encryptedData['githubToken_enc'] = await crypto.encrypt('ghp_xyz123')
│       └─ 'base64EncodedCiphertext1'
│
│ GitLab Token:
│ ├─ gitlabToken = gitlabTokenInput.value.trim()  → ''
│ └─ if (gitlabToken) → false
│    └─ [저장되지 않음]
│
│ GitLab URL:
│ ├─ gitlabUrlInput.value.trim()  → 'https://git.projectbro.com'
│ └─ encryptedData['gitlabUrl'] = 'https://git.projectbro.com'
│
│ Show Buttons:
│ ├─ showButtonsCheckbox.checked  → true
│ └─ encryptedData['showButtons'] = true
│
│ LLM Enabled:
│ ├─ llmEnabledCheckbox.checked  → false
│ └─ encryptedData['llmEnabled'] = false
│
│ LLM Provider:
│ ├─ llmProviderSelect.value  → 'claude'
│ └─ encryptedData['llmProvider'] = 'claude'
│
│ Claude API Key:
│ ├─ claudeApiKey = claudeApiKeyInput.value.trim()  → 'sk-ant-xyz'
│ └─ if (claudeApiKey) → true
│    └─ encryptedData['claudeApiKey_enc'] = await crypto.encrypt('sk-ant-xyz')
│       └─ 'base64EncodedCiphertext2'
│
│ OpenAI API Key:
│ ├─ openaiApiKey = openaiApiKeyInput.value.trim()  → ''
│ └─ if (openaiApiKey) → false
│    └─ [저장되지 않음]
│
├─ encryptedData 최종 상태:
│  {
│    'githubToken_enc': 'base64EncodedCiphertext1',
│    'gitlabUrl': 'https://git.projectbro.com',
│    'showButtons': true,
│    'llmEnabled': false,
│    'llmProvider': 'claude',
│    'claudeApiKey_enc': 'base64EncodedCiphertext2'
│  }
│
├─ chrome.storage.local.set(encryptedData)
│
├─ 성공 시:
│  └─ showStatus(saveStatus, '✅ 설정이 암호화되어 저장되었습니다.', 'success')
│     └─ 3초 후 자동 사라짐
│
└─ 실패 시:
   └─ showStatus(saveStatus, '❌ 저장 실패: [error message]', 'error')
      └─ 3초 후 자동 사라짐
```

---

## 9. 요약 및 권장사항

### 9.1 현재 상태 요약

**강점:**
- ✅ AES-GCM 기반 안전한 암호화
- ✅ Extension ID 기반 고유 키
- ✅ 각 필드의 복호화 실패가 전체 시스템을 죽이지 않음
- ✅ UI 피드백 (3초 표시)
- ✅ 버튼 상태 관리 (로딩 표시)

**약점:**
- ❌ 빈 토큰 처리의 불명확함 (값 삭제 불가능)
- ❌ 복호화 실패 시 사용자 피드백 부족
- ❌ 유효성 검사 최소화
- ❌ 코드 반복 (DRY 위반)
- ❌ 성능 고려 부족 (키 캐싱 없음)

### 9.2 개선 권장사항

**우선순위 1 (높음):**
1. 복호화 실패 시 사용자에게 명확한 메시지 표시
2. 빈 토큰 처리 명확히 (삭제 옵션 추가)
3. 기본 유효성 검사 추가 (토큰 형식)

**우선순위 2 (중간):**
4. 코드 반복 제거 (헬퍼 함수 생성)
5. CryptoService에 키 캐싱 추가
6. 통합 에러 처리 (공통 상태 디스플레이)

**우선순위 3 (낮음):**
7. Extension 재설치 시 마이그레이션 전략
8. LLM 비활성화 시 API 키 저장 제어
9. 상세 로깅 추가 (debug 모드)

---

## 10. 코드 생성 가능한 개선 아이디어

### 10.1 헬퍼 함수 (반복 제거)

```typescript
// 암호화된 필드 로드 헬퍼
async function loadEncryptedField(
  storageKey: string,
  inputElement: HTMLInputElement
): Promise<void> {
  const encryptedValue = result[storageKey] as string | undefined;
  if (encryptedValue) {
    try {
      inputElement.value = await crypto.decrypt(encryptedValue);
    } catch (error) {
      console.warn(`Decryption failed for ${storageKey}:`, error);
      inputElement.value = '';
      // UI에 경고 표시
      showDecryptionWarning(storageKey);
    }
  }
}

// 암호화된 필드 저장 헬퍼
async function saveEncryptedField(
  storageKey: string,
  inputElement: HTMLInputElement,
  data: Record<string, any>
): Promise<void> {
  const value = inputElement.value.trim();
  if (value) {
    data[storageKey] = await crypto.encrypt(value);
  } else {
    // 명시적으로 저장소에서 제거
    data[storageKey] = null;
  }
}
```

### 10.2 버튼 상태 관리 헬퍼

```typescript
function withLoadingState(
  button: HTMLButtonElement,
  callback: () => Promise<void>
): () => Promise<void> {
  return async () => {
    button.disabled = true;
    button.classList.add('loading');
    const originalText = button.textContent;

    try {
      await callback();
    } catch (error) {
      console.error('Operation failed:', error);
    } finally {
      button.disabled = false;
      button.classList.remove('loading');
      button.textContent = originalText;
    }
  };
}

// 사용
saveButton.addEventListener('click', withLoadingState(saveButton, saveConfig));
```

---

**문서 작성 완료: 2026-01-20**
**분석 범위: popup.ts (361 lines), crypto-service.ts (182 lines), popup.html (185 lines)**
**총 830 라인 분석 완료**
