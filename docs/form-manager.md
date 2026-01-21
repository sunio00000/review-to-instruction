# FormManager 사용 가이드

## 목차
- [개요](#개요)
- [빠른 시작](#빠른-시작)
- [필드 스키마 가이드](#필드-스키마-가이드)
- [새 필드 추가하기](#새-필드-추가하기)
- [검증 시스템](#검증-시스템)
- [문제 해결](#문제-해결)
- [API 레퍼런스](#api-레퍼런스)

---

## 개요

### FormManager란?

**FormManager**는 Chrome Extension 팝업의 폼 필드를 선언적으로 관리하는 클래스입니다. 수동 DOM 조작을 제거하고, 스키마 기반으로 폼 동작을 자동화합니다.

### 주요 기능

✅ **DOM 요소 캐싱**: Map을 사용한 빠른 접근
✅ **암호화 자동 처리**: CryptoService 연동으로 민감한 데이터 보호
✅ **자동 동기화**: chrome.storage.local과 양방향 동기화
✅ **검증 규칙**: 필수 입력, 정규식, 커스텀 검증 지원
✅ **조건부 가시성**: 다른 필드 값에 따라 필드 표시/숨김
✅ **빈 값 자동 제거**: storage.remove 호출로 불필요한 데이터 정리

### 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────┐
│                  FormManager                        │
│                                                     │
│  ┌───────────────┐         ┌──────────────────┐   │
│  │ Field Schema  │ ──────> │  DOM Elements    │   │
│  │  (선언적 정의)  │         │  (자동 바인딩)    │   │
│  └───────────────┘         └──────────────────┘   │
│         │                           │              │
│         │                           │              │
│         v                           v              │
│  ┌───────────────┐         ┌──────────────────┐   │
│  │ Validation    │         │  Visibility      │   │
│  │ (자동 검증)     │         │  (조건부 표시)     │   │
│  └───────────────┘         └──────────────────┘   │
│         │                           │              │
│         v                           v              │
│  ┌──────────────────────────────────────────────┐ │
│  │        chrome.storage.local                  │ │
│  │   (암호화 자동 처리 + 빈 값 자동 제거)          │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 핵심 이점

| 이전 방식 (수동)              | FormManager 방식 (선언적)      |
|------------------------------|-------------------------------|
| DOM 요소를 수동으로 조회       | 자동 캐싱                      |
| 값 읽기/쓰기 코드 반복        | 자동 동기화                    |
| 검증 로직 분산               | 스키마에 집중                  |
| 암호화 코드 중복             | CryptoService 자동 연동        |
| 조건부 표시 로직 복잡         | visible 함수로 간단히 정의      |

---

## 빠른 시작

### 1. 필드 스키마 정의

`src/popup/form-schema.ts` 파일에 필드를 선언적으로 정의합니다:

```typescript
import { FieldSchema, FormState } from '../types/form-manager';

export const popupFormSchema: FieldSchema[] = [
  // 기본 텍스트 필드
  {
    id: 'github-token',              // DOM 요소 ID
    storageKey: 'githubToken_enc',   // chrome.storage 키
    type: 'password',                // 필드 타입
    encrypted: true,                 // 암호화 여부
    validation: {
      pattern: /^ghp_[a-zA-Z0-9]{36,}$/,
      message: 'GitHub 토큰은 "ghp_"로 시작해야 합니다.'
    }
  },

  // 체크박스 필드
  {
    id: 'show-buttons',
    storageKey: 'showButtons',
    type: 'checkbox',
    encrypted: false,
    defaultValue: true               // 기본값 설정
  },

  // 조건부 표시 필드
  {
    id: 'claude-api-key',
    storageKey: 'claudeApiKey_enc',
    type: 'password',
    encrypted: true,
    visible: (state: FormState) => state['llm-provider'] === 'claude'
  }
];
```

### 2. FormManager 초기화

`src/popup/popup.ts`에서 FormManager 인스턴스를 생성합니다:

```typescript
import { CryptoService } from '../background/services/crypto-service';
import { FormManager } from '../utils/form-manager';
import { popupFormSchema } from './form-schema';

// CryptoService 인스턴스 생성
const crypto = new CryptoService();

// FormManager 인스턴스 생성
const formManager = new FormManager(popupFormSchema, crypto);

// DOM 요소 바인딩
formManager.bindElements();

// 조건부 가시성 자동 업데이트 활성화
formManager.bindVisibilityUpdates();

// 설정 로드
await formManager.load();
```

### 3. 설정 저장

```typescript
async function saveConfig() {
  const result = await formManager.save();

  if (result.isValid) {
    console.log('✅ 설정이 저장되었습니다.');
  } else {
    // 검증 오류 표시
    result.errors.forEach((message, fieldId) => {
      console.error(`${fieldId}: ${message}`);
    });
  }
}
```

### 4. 값 읽기/쓰기

```typescript
// 특정 필드 값 읽기
const githubToken = formManager.getValue('github-token');

// 특정 필드 값 설정
formManager.setValue('show-buttons', false);

// 전체 상태 읽기
const state = formManager.getState();
console.log(state); // { 'github-token': 'ghp_...', 'show-buttons': true, ... }
```

---

## 필드 스키마 가이드

### FieldSchema 속성

| 속성명        | 타입                          | 필수 | 설명                                      |
|--------------|-------------------------------|------|-------------------------------------------|
| `id`         | `string`                      | ✅   | DOM 요소의 ID                             |
| `storageKey` | `string`                      | ✅   | chrome.storage.local에 저장할 키           |
| `type`       | `'text' \| 'password' \| 'checkbox' \| 'select'` | ✅ | 필드 타입 |
| `encrypted`  | `boolean`                     | ✅   | 암호화 저장 여부 (민감한 데이터는 true)     |
| `defaultValue` | `string \| boolean`        | ❌   | 기본값 (값이 없을 때 사용)                  |
| `validation` | `ValidationRule`              | ❌   | 검증 규칙                                  |
| `visible`    | `(state: FormState) => boolean` | ❌ | 조건부 가시성 함수                         |

### 필드 타입별 특징

#### 1. `text` / `password`
- 일반 텍스트 입력 필드
- `value` 속성 사용
- 값 읽기/쓰기 시 자동으로 `.trim()` 적용

```typescript
{
  id: 'gitlab-url',
  storageKey: 'gitlabUrl',
  type: 'text',
  encrypted: false,
  defaultValue: 'https://gitlab.com'
}
```

#### 2. `checkbox`
- 체크박스
- `checked` 속성 사용
- 값은 `boolean` 타입
- **중요**: `false`도 유효한 값으로 간주 (빈 값 아님)

```typescript
{
  id: 'llm-enabled',
  storageKey: 'llmEnabled',
  type: 'checkbox',
  encrypted: false,
  defaultValue: false
}
```

#### 3. `select`
- 드롭다운 선택
- `value` 속성 사용
- 값은 `string` 타입

```typescript
{
  id: 'llm-provider',
  storageKey: 'llmProvider',
  type: 'select',
  encrypted: false,
  defaultValue: 'none'
}
```

### ValidationRule 속성

| 속성명     | 타입                            | 설명                                      |
|-----------|---------------------------------|-------------------------------------------|
| `required` | `boolean`                      | 필수 입력 여부                             |
| `pattern`  | `RegExp`                       | 정규식 패턴 검증 (문자열만 적용)            |
| `message`  | `string`                       | 검증 실패 시 표시할 메시지                  |
| `custom`   | `(value: any) => boolean \| string` | 커스텀 검증 함수 (true=성공, false 또는 메시지=실패) |

### 조건부 가시성

`visible` 함수를 사용하여 다른 필드 값에 따라 필드를 표시/숨김 처리할 수 있습니다.

```typescript
{
  id: 'claude-api-key',
  storageKey: 'claudeApiKey_enc',
  type: 'password',
  encrypted: true,
  // llm-provider 값이 'claude'일 때만 표시
  visible: (state: FormState) => state['llm-provider'] === 'claude'
}
```

**동작 방식:**
- `visible` 함수가 `true` 반환 → 필드 표시
- `visible` 함수가 `false` 반환 → 필드 숨김
- DOM 요소의 가장 가까운 `.input-group` 또는 `.form-group` 요소의 `display` 스타일 제어

**자동 업데이트:**
- `bindVisibilityUpdates()` 호출 시 자동으로 이벤트 리스너 등록
- 다른 필드 값 변경 시 자동으로 가시성 재평가

---

## 새 필드 추가하기

새로운 필드를 추가하는 전체 과정을 단계별로 설명합니다.

### 예시: Anthropic API Key 필드 추가

#### Step 1: HTML에 필드 추가

`src/popup/popup.html` 파일에 새 필드를 추가합니다:

```html
<div class="form-group">
  <label for="anthropic-api-key">
    Anthropic API Key
    <span class="security-badge">🔒 암호화 저장</span>
  </label>
  <div class="input-group">
    <input
      type="password"
      id="anthropic-api-key"
      placeholder="sk-ant-api..."
    />
  </div>
  <div id="anthropic-status" class="status"></div>
</div>
```

#### Step 2: 스키마에 필드 정의 추가

`src/popup/form-schema.ts` 파일에 필드 스키마를 추가합니다:

```typescript
export const popupFormSchema: FieldSchema[] = [
  // ... 기존 필드들 ...

  // 새로운 Anthropic API Key 필드
  {
    id: 'anthropic-api-key',              // HTML의 input id와 일치
    storageKey: 'anthropicApiKey_enc',    // chrome.storage 키 (_enc는 암호화 표시 관례)
    type: 'password',                     // 비밀번호 필드
    encrypted: true,                      // 암호화 저장
    validation: {
      pattern: /^sk-ant-[a-zA-Z0-9_-]{95,}$/,  // Anthropic API 키 패턴
      message: 'Anthropic API 키는 "sk-ant-"로 시작해야 합니다.'
    },
    visible: (state: FormState) => state['llm-provider'] === 'anthropic'  // 조건부 표시
  }
];
```

#### Step 3: 사용 (자동 처리됨!)

FormManager가 자동으로 처리하므로 추가 코드가 필요 없습니다:

```typescript
// ✅ 로드 시 자동으로 값 복원
await formManager.load();

// ✅ 저장 시 자동으로 암호화하여 저장
await formManager.save();

// ✅ 필요 시 직접 접근 가능
const apiKey = formManager.getValue('anthropic-api-key');
```

#### Step 4: 테스트

1. Extension 팝업 열기
2. 필드에 값 입력
3. "저장" 버튼 클릭
4. DevTools Console 확인:
   ```
   [FormManager] Saved 1 fields, removed 0 empty fields
   ```
5. Extension 재시작 후 값이 유지되는지 확인

### 필드 추가 체크리스트

- [ ] HTML에 DOM 요소 추가 (`id` 속성 필수)
- [ ] 스키마 파일에 FieldSchema 추가
- [ ] `id`와 `storageKey` 중복 확인
- [ ] 암호화가 필요한 민감한 데이터는 `encrypted: true` 설정
- [ ] 검증 규칙 정의 (필요 시)
- [ ] 조건부 표시가 필요하면 `visible` 함수 추가
- [ ] Extension 재빌드 (`npm run build`)
- [ ] Extension 재로드 (chrome://extensions)
- [ ] 테스트: 저장 → 재시작 → 로드 확인

---

## 검증 시스템

FormManager는 3가지 검증 방식을 지원합니다.

### 1. 필수 입력 검증 (required)

빈 값을 허용하지 않습니다.

```typescript
{
  id: 'github-token',
  storageKey: 'githubToken_enc',
  type: 'password',
  encrypted: true,
  validation: {
    required: true,
    message: 'GitHub 토큰을 입력해주세요.'
  }
}
```

**빈 값 판단:**
- `undefined`, `null`
- 빈 문자열 (`''`, `'   '` 등 공백만 있는 문자열)

### 2. 정규식 패턴 검증 (pattern)

입력값이 특정 패턴을 따르는지 확인합니다.

```typescript
{
  id: 'github-token',
  storageKey: 'githubToken_enc',
  type: 'password',
  encrypted: true,
  validation: {
    pattern: /^ghp_[a-zA-Z0-9]{36,}$/,
    message: 'GitHub 토큰은 "ghp_"로 시작해야 합니다.'
  }
}
```

**동작:**
- **문자열만 검증** (`type: 'text'`, `'password'`)
- 빈 값은 패턴 검증 생략 (필수 검증과 조합 사용)

### 3. 커스텀 검증 (custom)

복잡한 검증 로직을 함수로 정의합니다.

```typescript
{
  id: 'gitlab-url',
  storageKey: 'gitlabUrl',
  type: 'text',
  encrypted: false,
  validation: {
    custom: (value: string) => {
      try {
        new URL(value);
        return true;  // 검증 성공
      } catch {
        return 'URL 형식이 올바르지 않습니다.';  // 검증 실패 (에러 메시지)
      }
    }
  }
}
```

**반환 값:**
- `true`: 검증 성공
- `false`: 검증 실패 (기본 메시지 사용)
- `string`: 검증 실패 (커스텀 메시지)

### 복합 검증 예시

여러 검증 규칙을 조합할 수 있습니다:

```typescript
{
  id: 'gitlab-url',
  storageKey: 'gitlabUrl',
  type: 'text',
  encrypted: false,
  validation: {
    required: true,                           // 1. 필수 입력
    pattern: /^https?:\/\/.+$/,               // 2. http(s):// 시작
    message: 'URL은 http:// 또는 https://로 시작해야 합니다.',
    custom: (value: string) => {              // 3. URL 객체 생성 가능 여부
      try {
        new URL(value);
        return true;
      } catch {
        return 'URL 형식이 올바르지 않습니다.';
      }
    }
  }
}
```

**검증 순서:**
1. `required` 검증 → 실패 시 즉시 반환
2. `pattern` 검증 → 실패 시 즉시 반환
3. `custom` 검증 → 실패 시 즉시 반환

### 검증 결과 처리

```typescript
async function saveConfig() {
  const result = await formManager.save();

  if (result.isValid) {
    console.log('✅ 저장 성공');
  } else {
    // 검증 오류 처리
    result.errors.forEach((message, fieldId) => {
      console.error(`❌ ${fieldId}: ${message}`);

      // UI에 에러 표시
      const statusElement = document.getElementById(`${fieldId}-status`);
      if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = 'status error';
      }
    });
  }
}
```

**ValidationResult 구조:**
```typescript
interface ValidationResult {
  isValid: boolean;               // 전체 검증 성공 여부
  errors: Map<string, string>;    // fieldId -> 에러 메시지
}
```

### 에러 메시지 우선순위

검증 실패 시 에러 메시지는 다음 우선순위로 결정됩니다:

1. `custom` 함수가 반환한 `string` (가장 높은 우선순위)
2. `ValidationRule.message`
3. 기본 메시지 (예: `${fieldId}은(는) 필수 입력 항목입니다.`)

---

## 문제 해결

### 1. 필드 값이 로드되지 않아요

**증상:**
```
[FormManager] Element not found: #my-field
```

**원인:**
- HTML에 해당 ID를 가진 요소가 없음
- `bindElements()` 호출 전에 DOM이 준비되지 않음

**해결:**
```typescript
// ✅ DOMContentLoaded 이벤트 이후에 호출
document.addEventListener('DOMContentLoaded', () => {
  formManager.bindElements();
  formManager.load();
});

// ❌ 잘못된 방식
formManager.bindElements();  // DOM 준비 전 호출
```

### 2. 암호화된 값이 복호화되지 않아요

**증상:**
```
[FormManager] Decryption failed for github-token: Error: ...
```

**원인:**
- CryptoService 초기화 실패
- 이전 버전의 암호화 키로 저장된 데이터

**해결:**
```typescript
// CryptoService가 정상 초기화되었는지 확인
const crypto = new CryptoService();
await crypto.init();  // SubtleCrypto 키 생성

// 기존 데이터 삭제 후 재저장
await chrome.storage.local.remove('githubToken_enc');
```

### 3. 조건부 필드가 표시되지 않아요

**증상:**
- `visible` 함수가 `true`를 반환하는데도 필드가 숨겨져 있음

**원인:**
- `bindVisibilityUpdates()` 호출 누락
- 상태 업데이트 후 `updateVisibility()` 호출 누락

**해결:**
```typescript
// ✅ 초기화 시 자동 업데이트 활성화
formManager.bindElements();
formManager.bindVisibilityUpdates();  // 이벤트 리스너 등록

// ✅ 수동으로 값 변경 시
formManager.setValue('llm-provider', 'claude');
// updateVisibility()는 setValue 내부에서 자동 호출됨
```

### 4. 검증이 작동하지 않아요

**증상:**
- 잘못된 값을 입력해도 저장이 됨

**원인:**
- `validation` 규칙 정의 오류

**디버깅:**
```typescript
// 검증 결과 직접 확인
const result = formManager.validate();
console.log('Valid:', result.isValid);
console.log('Errors:', result.errors);

// 특정 필드 값 확인
const value = formManager.getValue('github-token');
console.log('Value:', value);
```

### 5. 빈 값이 스토리지에서 제거되지 않아요

**증상:**
- 필드를 비웠는데 `chrome.storage.local.get()`에 값이 남아있음

**원인:**
- `type: 'checkbox'`는 빈 값 제거 대상이 아님 (false도 유효한 값)

**해결:**
```typescript
// 체크박스가 아닌 경우 빈 문자열은 자동 제거됨
// 수동으로 제거하려면:
await chrome.storage.local.remove('storageKey');
```

### 6. FormManager 초기화 오류

**증상:**
```
[FormManager] 필드 스키마가 비어있습니다.
```

**원인:**
- `fields` 배열이 비어있음

**해결:**
```typescript
// ✅ 올바른 초기화
const fields: FieldSchema[] = [
  { id: 'my-field', storageKey: 'myField', type: 'text', encrypted: false }
];
const formManager = new FormManager(fields, crypto);

// ❌ 잘못된 초기화
const formManager = new FormManager([], crypto);  // 빈 배열
```

---

## API 레퍼런스

### FormManager 클래스

#### 생성자

```typescript
constructor(fields: FieldSchema[], crypto: CryptoService)
```

**파라미터:**
- `fields`: 필드 스키마 배열
- `crypto`: CryptoService 인스턴스 (암호화/복호화용)

**예외:**
- `fields`가 빈 배열이면 Error 발생
- `crypto`가 null이면 Error 발생

---

#### bindElements(): void

DOM 요소를 찾아 내부 Map에 캐시합니다.

```typescript
formManager.bindElements();
```

**동작:**
- 각 필드의 `id`로 `document.getElementById()` 호출
- 요소를 찾지 못하면 경고 로그 출력하고 계속 진행
- 찾은 요소를 `Map<string, HTMLElement>`에 저장

**로그:**
```
[FormManager] 8/8 elements bound
```

---

#### load(): Promise<void>

chrome.storage.local에서 값을 읽어와 DOM에 반영합니다.

```typescript
await formManager.load();
```

**동작:**
1. 모든 필드의 `storageKey` 목록 생성
2. `chrome.storage.local.get()` 일괄 조회
3. 각 필드에 값 설정:
   - 값이 없으면 `defaultValue` 사용
   - `encrypted: true`인 필드는 자동 복호화
   - DOM 요소에 값 설정
4. 조건부 가시성 업데이트

**오류 처리:**
- 복호화 실패 시 빈 값으로 설정하고 경고 로그 출력

---

#### save(): Promise<ValidationResult>

DOM에서 값을 읽어 chrome.storage.local에 저장합니다.

```typescript
const result = await formManager.save();

if (result.isValid) {
  console.log('저장 성공');
} else {
  console.error('검증 실패:', result.errors);
}
```

**동작:**
1. 검증 실행 (`validate()`)
2. 검증 실패 시 즉시 반환 (저장하지 않음)
3. DOM에서 값 읽기
4. 빈 값은 제거 목록에 추가
5. `encrypted: true`인 필드는 자동 암호화
6. `chrome.storage.local.set()` 배치 저장
7. `chrome.storage.local.remove()` 배치 삭제

**로그:**
```
[FormManager] Saved 5 fields, removed 2 empty fields
```

**반환:**
- `ValidationResult` 객체

---

#### validate(): ValidationResult

모든 필드의 검증 규칙을 실행합니다.

```typescript
const result = formManager.validate();

if (!result.isValid) {
  result.errors.forEach((message, fieldId) => {
    console.error(`${fieldId}: ${message}`);
  });
}
```

**반환:**
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: Map<string, string>;  // fieldId -> error message
}
```

---

#### updateVisibility(): void

조건부 가시성을 업데이트합니다.

```typescript
formManager.updateVisibility();
```

**동작:**
1. 현재 상태 최신화 (`refreshCurrentState()`)
2. 각 필드의 `visible` 함수 실행
3. 반환값에 따라 DOM 요소 표시/숨김

**대상 요소:**
1. `.input-group` (우선)
2. `.form-group` (차선)
3. 요소 자체 (fallback)

---

#### getValue(fieldId: string): any

특정 필드의 현재 값을 반환합니다.

```typescript
const token = formManager.getValue('github-token');
console.log(token);  // 'ghp_...'
```

**반환:**
- 필드 타입에 맞는 값
- 요소를 찾지 못하면 `undefined`

---

#### setValue(fieldId: string, value: any): void

특정 필드의 값을 설정합니다.

```typescript
formManager.setValue('show-buttons', false);
```

**동작:**
1. DOM 요소에 값 설정
2. 내부 상태 업데이트
3. 조건부 가시성 재평가

---

#### getState(): FormState

전체 폼 상태를 반환합니다.

```typescript
const state = formManager.getState();
console.log(state);
// {
//   'github-token': 'ghp_...',
//   'show-buttons': true,
//   'llm-enabled': false,
//   ...
// }
```

**반환:**
- `FormState` 객체 (모든 필드의 현재 값)

---

#### bindVisibilityUpdates(): void

상태 변경 시 자동으로 가시성을 업데이트하는 이벤트 리스너를 등록합니다.

```typescript
formManager.bindVisibilityUpdates();
```

**동작:**
- 각 필드에 적절한 이벤트 리스너 추가:
  - `checkbox`, `select` → `'change'` 이벤트
  - `text`, `password` → `'input'` 이벤트
- 이벤트 발생 시 `updateVisibility()` 자동 호출

---

### FieldSchema 인터페이스

```typescript
interface FieldSchema {
  id: string;                                     // DOM 요소 ID
  storageKey: string;                             // chrome.storage 키
  type: 'text' | 'password' | 'checkbox' | 'select';  // 필드 타입
  encrypted: boolean;                             // 암호화 저장 여부
  defaultValue?: string | boolean;                // 기본값
  validation?: ValidationRule;                    // 검증 규칙
  visible?: (state: FormState) => boolean;        // 조건부 가시성
}
```

---

### ValidationRule 인터페이스

```typescript
interface ValidationRule {
  required?: boolean;                             // 필수 입력
  pattern?: RegExp;                               // 정규식 패턴
  message?: string;                               // 에러 메시지
  custom?: (value: any) => boolean | string;      // 커스텀 검증
}
```

---

### ValidationResult 인터페이스

```typescript
interface ValidationResult {
  isValid: boolean;                               // 검증 성공 여부
  errors: Map<string, string>;                    // fieldId -> 에러 메시지
}
```

---

### FormState 타입

```typescript
type FormState = Record<string, any>;
```

폼의 전체 상태를 표현하는 타입입니다. 각 필드의 ID를 키로, 값을 밸류로 가집니다.

**예시:**
```typescript
const state: FormState = {
  'github-token': 'ghp_abcd1234...',
  'show-buttons': true,
  'llm-enabled': false,
  'llm-provider': 'claude'
};
```

---

## 부록

### 네이밍 규칙

| 항목            | 규칙                     | 예시                          |
|----------------|-------------------------|------------------------------|
| 필드 ID         | kebab-case              | `github-token`               |
| storageKey      | camelCase               | `githubToken_enc`            |
| 암호화 필드 suffix | `_enc`               | `claudeApiKey_enc`           |

### 보안 권장사항

1. **민감한 데이터는 반드시 암호화**
   - API 토큰, 비밀번호 등은 `encrypted: true` 설정
   - storageKey에 `_enc` suffix 추가 (관례)

2. **chrome.storage.local 직접 접근 금지**
   - FormManager를 통해서만 접근
   - 일관성 유지 및 암호화 보장

3. **검증 규칙 필수 정의**
   - 민감한 필드는 `pattern` 검증 추가
   - 형식 오류 조기 발견

### 성능 최적화

1. **DOM 캐싱**: `bindElements()`로 요소를 한 번만 조회
2. **배치 처리**: `chrome.storage.local.set()` 일괄 호출
3. **이벤트 위임**: 불필요한 이벤트 리스너 제거 가능

---

## 관련 문서

- [CryptoService 문서](./crypto-service.md) - 암호화/복호화 API
- [TESTING.md](../TESTING.md) - FormManager 테스트 가이드
- [ARCHITECTURE.md](../ARCHITECTURE.md) - 전체 아키텍처 설명

---

**문서 버전:** 1.0.0
**최종 수정:** 2026-01-21
**작성자:** Claude Sonnet 4.5
