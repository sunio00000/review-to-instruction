# API 및 LLM 통신 보안 분석

## 탐색 목표
GitHub/GitLab API 및 LLM API 통신 보안 분석, Deprecated 함수 탐지, Server-side Proxy 필요성 검토

---

## 1. API 인증 메커니즘 분석

### 1.1 GitHub/GitLab API 인증

**파일**: `src/background/api-client.ts`

#### 인증 방식

```typescript
// Line 508-515
private async fetch(url: string, options: RequestInit = {}): Promise<any> {
  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(this.platform === 'github'
      ? { 'Authorization': `Bearer ${this.token}` }
      : { 'PRIVATE-TOKEN': this.token }
    )
  };
}
```

| Platform | Header | 형식 |
|----------|--------|------|
| GitHub | `Authorization` | `Bearer {token}` |
| GitLab | `PRIVATE-TOKEN` | `{token}` |

#### API Base URL

```typescript
// Line 43-55
constructor(options: ApiClientOptions) {
  this.token = options.token;
  this.platform = options.platform;

  if (this.platform === 'github') {
    this.baseUrl = 'https://api.github.com';  // ✅ HTTPS 강제
  } else {
    const gitlabBaseUrl = options.gitlabUrl || 'https://gitlab.com';
    const cleanUrl = gitlabBaseUrl.replace(/\/$/, '');
    this.baseUrl = `${cleanUrl}/api/v4`;  // ⚠️ 사용자 입력 URL
  }
}
```

**보안 이슈**:
- ✅ GitHub: 하드코딩된 HTTPS URL 사용 (안전)
- ⚠️ GitLab: 사용자 입력 `gitlabUrl` 검증 부족
  - HTTP URL 입력 가능 (중간자 공격 취약)
  - 악의적 서버 URL 입력 가능

### 1.2 LLM API 인증

#### Claude API (`src/background/llm/claude-client.ts`)

```typescript
// Line 44-50
const response = await fetch(this.apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': this.apiKey,  // ⚠️ 브라우저에서 직접 전송
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'  // 🔴 위험한 헤더
  }
});
```

**중대한 보안 문제**:
- 🔴 `anthropic-dangerous-direct-browser-access`: Anthropic이 명시적으로 "위험"하다고 표시한 헤더
- 🔴 API 키가 브라우저 메모리에 노출됨
- 🔴 DevTools Network 탭에서 API 키 확인 가능
- 🔴 XSS 공격 시 API 키 탈취 가능

#### OpenAI API (`src/background/llm/openai-client.ts`)

```typescript
// Line 44-49
const response = await fetch(this.apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.apiKey}`  // ⚠️ 브라우저에서 직접 전송
  }
});
```

**보안 문제**:
- ⚠️ OpenAI API도 CORS 정책 상 브라우저 직접 호출 비권장
- ⚠️ API 키 노출 위험 동일

### 1.3 토큰 저장소

**파일**: `src/background/services/config-service.ts`

```typescript
// Line 31
const storage = await chrome.storage.sync.get([tokenKey, 'gitlabUrl', 'llm']);
```

| 저장소 | 용도 | 보안 수준 |
|--------|------|----------|
| `chrome.storage.sync` | GitHub/GitLab 토큰, LLM API 키 | ⚠️ 암호화되지 않음 |
| `chrome.storage.local` | LLM 캐시 (Line 80, cache.ts) | ⚠️ 암호화되지 않음 |

**보안 이슈**:
- Chrome Storage는 기본적으로 암호화되지 않음
- 물리적 접근 시 토큰 추출 가능
- Malware Extension이 다른 Extension 데이터 접근 가능 (Chrome의 격리 정책에 의존)

---

## 2. HTTPS 강제 및 검증

### 2.1 API Endpoint HTTPS 사용 현황

| API | URL | HTTPS | 검증 |
|-----|-----|-------|------|
| GitHub API | `https://api.github.com` | ✅ | Hardcoded |
| GitLab API (기본) | `https://gitlab.com` | ✅ | Hardcoded default |
| GitLab API (사용자 지정) | 사용자 입력 | ❌ | 미검증 |
| Claude API | `https://api.anthropic.com` | ✅ | Hardcoded |
| OpenAI API | `https://api.openai.com` | ✅ | Hardcoded |

### 2.2 TLS/SSL 검증

**현재 상태**: 브라우저의 `fetch()` API 사용 → 브라우저가 자동으로 TLS 검증 수행

**하지만**:
- 사용자가 Self-signed 인증서 무시 가능 (브라우저 설정)
- GitLab URL 검증 없음 → 악의적 서버로 유도 가능

### 2.3 Manifest Host Permissions

**파일**: `manifest.json`

```json
// Line 10-15
"host_permissions": [
  "https://github.com/*",
  "https://gitlab.com/*",
  "https://git.projectbro.com/*",
  "https://*/*"  // 🔴 모든 HTTPS 도메인 접근 허용
]
```

**보안 문제**:
- `https://*/*`: 필요 이상의 권한
- 사용자 신뢰 저하 (Chrome Web Store 리뷰에서 지적될 가능성)

**권장 사항**:
```json
"optional_host_permissions": [
  "https://*/*/-/merge_requests/*"
]
```

---

## 3. Deprecated 함수 및 안전하지 않은 API 사용

### 3.1 `unescape()` 함수 (Deprecated)

**파일**: `src/background/api-client.ts`

```typescript
// Line 260
content: btoa(unescape(encodeURIComponent(content))),  // UTF-8 to Base64
```

**문제**:
- `unescape()`는 **ECMAScript 표준에서 deprecated**됨
- MDN: "Use `decodeURIComponent()` instead"
- 향후 브라우저에서 제거될 가능성

**수정 방법**:
```typescript
// ❌ Before (Deprecated)
content: btoa(unescape(encodeURIComponent(content)))

// ✅ After (권장)
content: btoa(String.fromCharCode(...new TextEncoder().encode(content)))

// 또는 더 간단한 방법 (최신 브라우저)
content: btoa(new TextEncoder().encode(content).reduce(
  (acc, byte) => acc + String.fromCharCode(byte), ''
))
```

### 3.2 `escape()` 함수 (Deprecated)

**파일**: `src/core/file-matcher.ts`

```typescript
// Line 255-256
const decoded = atob(base64);
return decodeURIComponent(escape(decoded));  // ⚠️ Deprecated
```

**문제**:
- `escape()`도 deprecated
- UTF-8 디코딩 목적이지만 비표준 방식

**수정 방법**:
```typescript
// ❌ Before (Deprecated)
const decoded = atob(base64);
return decodeURIComponent(escape(decoded));

// ✅ After (권장)
function decodeBase64(base64: string): string {
  const binaryString = atob(base64);
  const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}
```

### 3.3 `atob()` 사용 (보안 문제 없음, 하지만 주의 필요)

**파일**:
- `src/core/file-matcher.ts:255`
- `src/core/instruction-analyzer.ts:99`

```typescript
// instruction-analyzer.ts Line 99
const decodedContent = atob(fileContent.content);
```

**현재 상태**:
- `atob()`는 deprecated 아님 (계속 사용 가능)
- 하지만 UTF-8 지원 문제 있음 (ASCII만 지원)

**권장**: `TextDecoder` API 사용

---

## 4. Rate Limiting & Error Handling

### 4.1 Retry Logic

**파일**: `src/background/llm/base-client.ts`

```typescript
// Line 94-118
protected async retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`[LLM] Attempt ${attempt + 1} failed:`, error);

      if (attempt === maxRetries) {
        throw lastError;
      }

      // 지수 백오프 (1초, 2초)
      await this.sleep(1000 * Math.pow(2, attempt));
    }
  }
}
```

**분석**:
- ✅ 지수 백오프 구현 (Exponential Backoff)
- ✅ 최대 3회 시도 (초기 + 2회 재시도)
- ❌ **429 (Rate Limit) 응답 특별 처리 없음**
  - 429 응답의 `Retry-After` 헤더 무시
  - API 서버가 지정한 대기 시간 무시

### 4.2 Timeout 설정

```typescript
// Line 12, 82-89
protected timeout: number = 30000; // 30초 타임아웃

protected async withTimeout<T>(promise: Promise<T>, ms: number = this.timeout): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ]);
}
```

**분석**:
- ✅ 30초 타임아웃 설정
- ✅ Promise.race() 패턴 사용
- ⚠️ 타임아웃 시 네트워크 요청 취소 안 됨 (AbortController 미사용)

### 4.3 API Error Handling

**파일**: `src/background/api-client.ts`

```typescript
// Line 525-529
if (!response.ok) {
  const errorText = await response.text();
  console.error(`[ApiClient] API request failed: ${options.method || 'GET'} ${url} -> ${response.status}`);
  throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
}
```

**분석**:
- ❌ 429 Rate Limit 특별 처리 없음
- ❌ `Retry-After` 헤더 파싱 없음
- ❌ 403 Forbidden vs 401 Unauthorized 구분 없음

**권장 개선**:
```typescript
if (!response.ok) {
  // 429 Rate Limit 특별 처리
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
    throw new RateLimitError(`Rate limit exceeded. Retry after ${waitTime}ms`, waitTime);
  }

  // 401/403 구분
  if (response.status === 401) {
    throw new AuthenticationError('Invalid or expired token');
  }

  if (response.status === 403) {
    throw new AuthorizationError('Insufficient permissions');
  }

  // 기타 에러
  const errorText = await response.text();
  throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
}
```

---

## 5. LLM API Proxy 필요성

### 5.1 현재 구조 (Browser Direct Access)

```
┌─────────────────┐
│  Chrome         │
│  Extension      │
│  (Content/BG)   │
└────────┬────────┘
         │ API Key in Header
         │ (브라우저 메모리에 노출)
         ↓
┌─────────────────┐
│  Claude API     │  anthropic-dangerous-direct-browser-access: true
│  OpenAI API     │
└─────────────────┘
```

**보안 위험**:
1. **API 키 노출**: DevTools에서 키 확인 가능
2. **XSS 공격**: 악의적 스크립트가 API 키 탈취
3. **Rate Limit 우회 불가**: 서버 측 집계 없음
4. **비용 제어 불가**: 사용자가 무제한 API 호출 가능
5. **CORS 정책**: Claude는 `dangerous` 헤더 필요 (보안 경고)

### 5.2 권장 구조 (Server-side Proxy)

```
┌─────────────────┐
│  Chrome         │
│  Extension      │
└────────┬────────┘
         │ Session Token (임시, 짧은 TTL)
         ↓
┌─────────────────┐
│  Proxy Server   │ ← API 키 안전 보관 (환경변수)
│  (Node.js/CF)   │ ← Rate Limiting (per user)
└────────┬────────┘ ← 사용량 모니터링/로깅
         │ API Key
         ↓
┌─────────────────┐
│  Claude API     │
│  OpenAI API     │
└─────────────────┘
```

#### 구현 예시 (Cloudflare Workers)

```typescript
// workers/llm-proxy.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. Session Token 검증
    const sessionToken = request.headers.get('X-Session-Token');
    if (!validateSession(sessionToken)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. Rate Limiting (per user)
    const userId = extractUserId(sessionToken);
    if (await isRateLimited(userId)) {
      return new Response('Rate Limit Exceeded', {
        status: 429,
        headers: { 'Retry-After': '60' }
      });
    }

    // 3. API 호출 (API 키는 환경변수에서)
    const body = await request.json();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.CLAUDE_API_KEY,  // ✅ 환경변수
        'anthropic-version': '2023-06-01'
        // ❌ dangerous 헤더 불필요
      },
      body: JSON.stringify(body)
    });

    // 4. 사용량 로깅
    await logUsage(userId, body.model, response.headers.get('anthropic-token-count'));

    return response;
  }
};
```

### 5.3 마이그레이션 전략

#### Phase 1: Backward Compatible Proxy (선택적)
- Extension에서 Proxy URL 설정 가능
- Proxy 미설정 시 기존 방식 유지 (Direct Access)
- 사용자가 자체 Proxy 서버 운영 가능

#### Phase 2: Proxy Mandatory (권장)
- 모든 LLM API 호출 Proxy 강제
- API 키를 Extension에서 제거
- OAuth 또는 Session Token 인증

#### Phase 3: SaaS Model (선택)
- 유료 플랜: 무제한 LLM 호출
- 무료 플랜: 월 N회 제한
- 서버 측 API 키 관리

---

## 6. API 키 Rotation 전략

### 6.1 현재 문제점
- API 키가 한 번 설정되면 영구적으로 유지
- 키 노출 시 즉시 대응 불가
- 키 갱신 프로세스 없음

### 6.2 권장 전략

#### 단기 (Extension 개선)
1. **키 만료 알림**:
   ```typescript
   // config-service.ts
   interface StoredToken {
     value: string;
     createdAt: number;
     expiresAt?: number;
   }

   async loadConfig(platform: Platform): Promise<ConfigServiceResult> {
     const token = storage[tokenKey] as StoredToken;

     // 90일 경과 시 경고
     if (Date.now() - token.createdAt > 90 * 24 * 60 * 60 * 1000) {
       console.warn('Token is older than 90 days. Consider rotation.');
     }
   }
   ```

2. **키 검증 API**:
   ```typescript
   // api-client.ts
   async validateToken(): Promise<boolean> {
     try {
       await this.testConnection();
       return true;
     } catch (error) {
       // 401/403 시 false 반환
       return false;
     }
   }
   ```

#### 중기 (Proxy 도입 후)
1. **Session Token 발급**:
   - Extension에서 GitHub/GitLab OAuth 로그인
   - Proxy 서버가 Session Token 발급 (TTL: 7일)
   - Refresh Token으로 갱신

2. **API 키는 서버에서만 관리**:
   - 환경변수 또는 KMS (Key Management Service)
   - 정기적 자동 Rotation (30-90일)

---

## 7. 추가 보안 권장 사항

### 7.1 Content Security Policy (CSP)

**파일**: `manifest.json`

현재 CSP 미설정 → XSS 공격 취약

**권장 추가**:
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### 7.2 Permissions 최소화

**현재**:
```json
"host_permissions": [
  "https://*/*"  // 🔴 너무 광범위
]
```

**권장**:
```json
"host_permissions": [
  "https://api.github.com/*",
  "https://gitlab.com/*",
  "https://git.projectbro.com/*"
],
"optional_host_permissions": [
  "https://*/*/-/merge_requests/*"  // 사용자 승인 후 허용
]
```

### 7.3 Sensitive Data Logging 제거

**파일**: `src/background/api-client.ts`

```typescript
// Line 57 - ⚠️ Base URL 로깅 (GitLab 사용자 지정 URL 노출 가능)
console.log('[ApiClient] Initialized with baseUrl:', this.baseUrl);

// Line 506 - ⚠️ URL 전체 로깅 (토큰이 Query Param에 있을 경우 노출)
console.log(`[ApiClient] ${options.method || 'GET'} ${url}`);
```

**권장**: Production 빌드에서 민감한 로그 제거
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[ApiClient] Initialized with baseUrl:', this.baseUrl);
}
```

---

## 8. 보안 우선순위 및 Roadmap

| 우선순위 | 항목 | 위험도 | 작업량 |
|---------|------|--------|--------|
| 🔴 **P0** | Deprecated 함수 수정 (`unescape`, `escape`) | 중 | 소 |
| 🔴 **P0** | GitLab URL HTTPS 검증 | 중 | 소 |
| 🟡 **P1** | LLM API Proxy 도입 | 고 | 대 |
| 🟡 **P1** | Rate Limit 429 특별 처리 | 중 | 소 |
| 🟢 **P2** | Host Permissions 최소화 | 저 | 소 |
| 🟢 **P2** | CSP 정책 추가 | 저 | 소 |
| 🟢 **P3** | API 키 Rotation 알림 | 저 | 중 |

---

## 9. 즉시 적용 가능한 Quick Wins

### 9.1 Deprecated 함수 수정

**파일 1**: `src/background/api-client.ts:260`
```typescript
// Before
content: btoa(unescape(encodeURIComponent(content)))

// After
content: (() => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
})()
```

**파일 2**: `src/core/file-matcher.ts:252-256`
```typescript
// Before
function decodeBase64(base64: string): string {
  try {
    const decoded = atob(base64);
    return decodeURIComponent(escape(decoded));
  } catch (error) {
    console.error('[FileMatcher] Failed to decode base64:', error);
    return '';
  }
}

// After
function decodeBase64(base64: string): string {
  try {
    const binaryString = atob(base64);
    const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (error) {
    console.error('[FileMatcher] Failed to decode base64:', error);
    return '';
  }
}
```

### 9.2 GitLab URL HTTPS 검증

**파일**: `src/background/api-client.ts:43-55`
```typescript
// Before
if (this.platform === 'gitlab') {
  const gitlabBaseUrl = options.gitlabUrl || 'https://gitlab.com';
  const cleanUrl = gitlabBaseUrl.replace(/\/$/, '');
  this.baseUrl = `${cleanUrl}/api/v4`;
}

// After
if (this.platform === 'gitlab') {
  const gitlabBaseUrl = options.gitlabUrl || 'https://gitlab.com';

  // HTTPS 강제 검증
  if (!gitlabBaseUrl.startsWith('https://')) {
    throw new Error('GitLab URL must use HTTPS protocol');
  }

  const cleanUrl = gitlabBaseUrl.replace(/\/$/, '');
  this.baseUrl = `${cleanUrl}/api/v4`;
}
```

### 9.3 Rate Limit 처리

**파일**: `src/background/api-client.ts:525-529`
```typescript
// After
if (!response.ok) {
  // 429 Rate Limit 특별 처리
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '60';
    throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
  }

  const errorText = await response.text();
  console.error(`[ApiClient] API request failed: ${options.method || 'GET'} ${url} -> ${response.status}`);
  throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
}
```

---

## 10. API 통신 Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │ Content      │ Message │ Background   │                  │
│  │ Script       │────────>│ Service      │                  │
│  │              │         │ Worker       │                  │
│  └──────────────┘         └──────┬───────┘                  │
│                                   │                          │
└───────────────────────────────────┼──────────────────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
                ↓                   ↓                   ↓
         ┌─────────────┐     ┌─────────────┐    ┌─────────────┐
         │ GitHub API  │     │ GitLab API  │    │ LLM APIs    │
         │             │     │             │    │             │
         │ Bearer Auth │     │PRIVATE-TOKEN│    │ x-api-key   │
         │ ✅ HTTPS    │     │⚠️ User URL  │    │🔴Dangerous  │
         └─────────────┘     └─────────────┘    └─────────────┘
              ↓                     ↓                   ↓
         ✅ 안전              ⚠️ 검증 필요        🔴 Proxy 필요

현재 문제점:
1. GitLab: 사용자 입력 URL HTTPS 검증 없음
2. LLM: 브라우저에서 API 키 직접 전송 (노출 위험)
3. Rate Limit: 429 응답 특별 처리 없음
4. Deprecated: unescape(), escape() 사용
```

---

## 11. Server-side Proxy Architecture

### 옵션 A: Cloudflare Workers (권장)

```
Extension → CF Workers → LLM APIs
            ↑
            └─ KV Store (Session/Rate Limit)
            └─ Env Vars (API Keys)

장점:
- Serverless (비용 효율)
- Global Edge Network (낮은 Latency)
- KV Store 내장 (Session 관리)
- 무료 티어: 100K req/day

단점:
- Vendor Lock-in
```

### 옵션 B: Vercel Edge Functions

```
Extension → Vercel Edge → LLM APIs
            ↑
            └─ Vercel KV (Redis)
            └─ Env Vars

장점:
- Next.js 통합
- 무료 티어 제공

단점:
- CF Workers보다 제한적
```

### 옵션 C: Self-hosted (최대 제어)

```
Extension → Nginx + Node.js → LLM APIs
            ↑
            └─ Redis (Session)
            └─ PostgreSQL (Usage Log)

장점:
- 완전한 제어
- 커스텀 로직

단점:
- 운영 비용
- 인프라 관리 부담
```

---

## 결론 및 권장 사항

### 즉시 수정 필요 (P0)
1. ✅ Deprecated 함수 수정 (`unescape` → `TextEncoder`)
2. ✅ GitLab URL HTTPS 검증 추가
3. ✅ Rate Limit 429 처리 개선

### 단기 개선 (P1)
1. ⚠️ LLM API Proxy 서버 도입 검토 (보안 향상)
2. ⚠️ Host Permissions 최소화
3. ⚠️ CSP 정책 추가

### 장기 계획 (P2-P3)
1. 🔄 API 키 Rotation 자동화
2. 🔄 OAuth 기반 인증 도입
3. 🔄 사용량 모니터링 대시보드

현재 코드는 **기능적으로는 작동하지만, 보안 측면에서 개선이 필요**합니다. 특히 LLM API의 브라우저 직접 호출은 Anthropic이 명시적으로 "dangerous"라고 표시한 방식이므로, Server-side Proxy 도입을 강력히 권장합니다.
