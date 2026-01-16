# Review to Instruction - 리팩토링 및 E2E 테스트 추가

**작성일**: 2026-01-16
**버전**: v1.2.0 기준
**목표**: 코드 품질 개선 및 자동화된 E2E 테스트 인프라 구축

---

## 1. 개요

### 1.1 프로젝트 현황

- **타입**: Chrome Extension (Manifest V3)
- **언어**: TypeScript 5.9.3
- **빌드**: Vite 7.3.1
- **주요 기능**:
  - GitHub/GitLab PR 리뷰 코멘트를 AI instruction으로 자동 변환
  - 다중 AI 도구 지원 (Claude Code, Cursor, Windsurf)
  - LLM 응답 캐싱 (50-70% 비용 절감)

### 1.2 문제점 및 목표

**현재 문제:**
1. `message-handler.ts`의 `handleConvertComment` 함수가 157줄, 순환 복잡도 21
2. 테스트 프레임워크 없음 (수동 테스트만)
3. `chrome.runtime.lastError` 미확인

**개선 목표:**
1. ✅ message-handler 리팩토링 (복잡도 21 → 8-10)
2. ✅ 핵심 E2E 테스트 자동화 (3-4개 시나리오)
3. ✅ 필수 에러 처리 개선

---

## 2. 아키텍처 설계

### 2.1 현재 아키텍처

```
Content Script → chrome.runtime.sendMessage → Background Service Worker
                                                  ↓
                                            message-handler
                                                  ↓
                                   (10가지 책임이 하나의 함수에)
```

### 2.2 개선된 아키텍처

```
Content Script → Message Router → ConversionOrchestrator
                                         ↓
                              ┌──────────┴──────────┐
                              │                     │
                        ConfigService      CommentService
                              │                     │
                        FileGenerationService   ErrorHandler
                              │
                        PullRequestService
```

### 2.3 서비스 계층 설계

#### ConfigService
```typescript
interface ConfigService {
  loadConfig(platform: Platform): Promise<{
    token: string;
    llmConfig: LLMConfig;
  }>;
}
```
- **책임**: Chrome Storage에서 설정 로드 및 유효성 검증
- **의존성**: chrome.storage.sync

#### CommentService
```typescript
interface CommentService {
  validateAndEnhance(
    comment: Comment,
    llmConfig: LLMConfig
  ): Promise<EnhancedComment>;
}
```
- **책임**: 컨벤션 확인, 코멘트 파싱, LLM 강화
- **의존성**: parser, enhancer

#### FileGenerationService
```typescript
interface FileGenerationService {
  generateForAllTypes(
    client: ApiClient,
    repository: Repository,
    comment: EnhancedComment
  ): Promise<FileGenerationResult[]>;
}
```
- **책임**: 프로젝트 타입 감지, 파일 매칭, Generator 실행
- **의존성**: ProjectTypeDetector, GeneratorFactory, file-matcher

#### PullRequestService
```typescript
interface PullRequestService {
  create(
    client: ApiClient,
    repository: Repository,
    files: FileGenerationResult[],
    comment: EnhancedComment
  ): Promise<PullRequestResult>;
}
```
- **책임**: PR/MR 생성 및 결과 포장
- **의존성**: pr-creator (기존 모듈 재사용)

---

## 3. 리팩토링 계획

### 3.1 Phase 1: 서비스 추출 (2일)

**Task 1.1: ConfigService 생성**
- 파일: `src/background/services/config-service.ts` (신규)
- 코드 이동: message-handler.ts 라인 137-145 (9줄)
- 테스트 가능성: ✅ (chrome.storage 모킹)

**Task 1.2: CommentService 생성**
- 파일: `src/background/services/comment-service.ts` (신규)
- 코드 이동: message-handler.ts 라인 132-177 (46줄)
- 기존 모듈 통합: parser.ts, llm/enhancer.ts

**Task 1.3: FileGenerationService 생성**
- 파일: `src/background/services/file-generation-service.ts` (신규)
- 코드 이동: message-handler.ts 라인 179-240 (62줄)
- 기존 모듈 통합: project-detector.ts, generators/*

**Task 1.4: PullRequestService 래퍼**
- 파일: `src/background/services/pr-service.ts` (신규)
- 기존 pr-creator.ts를 서비스 인터페이스로 감싸기
- 코드 이동: message-handler.ts 라인 244-259 (16줄)

### 3.2 Phase 2: 의존성 주입 적용 (1일)

**Task 2.1: DI Container 구현**
```typescript
// src/background/services/di-container.ts
interface ServiceContainer {
  configService: ConfigService;
  commentService: CommentService;
  fileGenerationService: FileGenerationService;
  prService: PullRequestService;
}

function createServiceContainer(): ServiceContainer {
  return {
    configService: new ConfigServiceImpl(),
    commentService: new CommentServiceImpl(),
    fileGenerationService: new FileGenerationServiceImpl(),
    prService: new PullRequestServiceImpl()
  };
}
```

**Task 2.2: ConversionOrchestrator 생성**
```typescript
// src/background/services/conversion-orchestrator.ts
class ConversionOrchestrator {
  constructor(private container: ServiceContainer) {}

  async convertComment(
    payload: ConvertCommentPayload
  ): Promise<ConversionResult> {
    const config = await this.container.configService.load(...);
    const enhanced = await this.container.commentService.validate(...);
    const files = await this.container.fileGenerationService.generate(...);
    const pr = await this.container.prService.create(...);
    return { prUrl: pr.url, files, ... };
  }
}
```

**Task 2.3: message-handler 간소화**
```typescript
// src/background/message-handler.ts (리팩토링 후)
const orchestrator = new ConversionOrchestrator(createServiceContainer());

async function handleConvertComment(payload, sendResponse) {
  try {
    const result = await orchestrator.convertComment(payload);
    sendResponse({ success: true, data: result });
  } catch (error) {
    sendResponse(buildErrorResponse(error));
  }
}
```

예상 결과:
- handleConvertComment: 157줄 → 10-15줄
- 순환 복잡도: 21 → 3-4

---

## 4. E2E 테스트 인프라

### 4.1 테스트 스택

```json
{
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "msw": "^2.6.0"
  }
}
```

### 4.2 폴더 구조

```
tests/
├── e2e/
│   ├── github-comment-detection.spec.ts
│   ├── github-instruction-creation.spec.ts
│   ├── pr-creation.spec.ts
│   └── error-handling.spec.ts
├── fixtures/
│   ├── github-pr-page.html
│   └── mock-responses.ts
└── mocks/
    ├── github-handlers.ts
    └── llm-handlers.ts
```

### 4.3 테스트 시나리오

#### Scenario 1: GitHub PR Comment Detection
```typescript
test('GitHub PR 페이지에서 컨벤션 코멘트 감지', async ({ page }) => {
  await page.goto('http://localhost:3000/test-pr');

  // "Convert to AI Instruction" 버튼 표시 확인
  const button = page.locator('button:has-text("Convert to AI Instruction")');
  await expect(button).toBeVisible();
});
```

#### Scenario 2: Instruction Creation
```typescript
test('새로운 instruction 파일 생성 및 PR 생성', async ({ page }) => {
  await setupGitHubMocks(page);

  const button = page.locator('button:has-text("Convert to AI Instruction")');
  await button.click();

  // 성공 메시지 및 PR 링크 확인
  const successMsg = page.locator('text=/Instruction.*생성됨/');
  await expect(successMsg).toBeVisible({ timeout: 15000 });

  const prLink = successMsg.locator('a[target="_blank"]');
  expect(await prLink.getAttribute('href')).toMatch(/pull\/\d+$/);
});
```

#### Scenario 3: PR Creation Flow
```typescript
test('전체 PR 생성 플로우 (E2E)', async ({ page }) => {
  // 1. Comment detection
  // 2. Button click
  // 3. API calls (mocked)
  // 4. PR URL return
  // 5. Verify all steps
});
```

#### Scenario 4: Error Handling
```typescript
test('Token 미설정 시 에러 메시지', async ({ page }) => {
  await clearStorageToken(page);

  const button = page.locator('button:has-text("Convert to AI Instruction")');
  await button.click();

  const errorMsg = page.locator('text=/Token이 설정되지 않았습니다/');
  await expect(errorMsg).toBeVisible();
});
```

### 4.4 Mock 설정

#### GitHub API Mock (MSW)
```typescript
// tests/mocks/github-handlers.ts
import { http, HttpResponse } from 'msw';

export const githubHandlers = [
  http.get('https://api.github.com/user', () => {
    return HttpResponse.json({ login: 'test-user', id: 12345 });
  }),

  http.get('https://api.github.com/repos/:owner/:repo/contents/.claude', () => {
    return HttpResponse.json([
      { name: 'instructions', type: 'dir', path: '.claude/instructions' }
    ]);
  }),

  http.post('https://api.github.com/repos/:owner/:repo/git/refs', () => {
    return HttpResponse.json({ ref: 'refs/heads/ai-instruction/add-test' });
  }),

  http.post('https://api.github.com/repos/:owner/:repo/pulls', () => {
    return HttpResponse.json({
      number: 123,
      html_url: 'https://github.com/test/repo/pull/123'
    });
  })
];
```

### 4.5 Playwright 설정

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,

  use: {
    launchOptions: {
      args: [
        `--load-extension=${path.resolve(__dirname, 'dist')}`,
        '--disable-extensions-except=' + path.resolve(__dirname, 'dist')
      ]
    }
  },

  webServer: {
    command: 'npm run test:server',
    port: 3000,
    reuseExistingServer: true
  }
});
```

---

## 5. 에러 처리 개선

### 5.1 chrome.runtime.lastError 체크

**Before:**
```typescript
// service-worker.ts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message, sendResponse);
  return true;
});
```

**After:**
```typescript
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (chrome.runtime.lastError) {
    console.error('[Runtime Error]', chrome.runtime.lastError.message);
    sendResponse({
      success: false,
      error: 'Runtime error occurred'
    });
    return true;
  }

  handleMessage(message, sendResponse);
  return true;
});
```

### 5.2 ErrorResponse 타입 추가

```typescript
// src/types/index.ts
interface ErrorResponse {
  success: false;
  error: {
    message: string;      // 사용자 메시지
    code?: string;        // 에러 코드 (선택)
    timestamp: number;    // 에러 발생 시각
  };
}

// 에러 코드 (선택적)
enum ErrorCode {
  AUTH_FAILED = 'AUTH_FAILED',
  API_TIMEOUT = 'API_TIMEOUT',
  TOKEN_MISSING = 'TOKEN_MISSING',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}
```

### 5.3 buildErrorResponse 헬퍼

```typescript
// src/background/utils/error-builder.ts
function buildErrorResponse(error: unknown): ErrorResponse {
  const message = error instanceof Error
    ? error.message
    : String(error);

  return {
    success: false,
    error: {
      message,
      timestamp: Date.now()
    }
  };
}
```

---

## 6. 구현 순서 및 작업 분할

### Week 1: 리팩토링 (3일)

**Day 1: 서비스 추출 (1/2)**
- [ ] ConfigService 생성 및 테스트
- [ ] CommentService 생성 및 테스트

**Day 2: 서비스 추출 (2/2)**
- [ ] FileGenerationService 생성 및 테스트
- [ ] PullRequestService 래퍼 생성

**Day 3: DI 통합 및 간소화**
- [ ] DI Container 구현
- [ ] ConversionOrchestrator 생성
- [ ] message-handler 간소화
- [ ] 수동 테스트로 검증

### Week 2: E2E 테스트 (4일)

**Day 4: E2E 인프라 설정**
- [ ] Playwright 설치 및 설정
- [ ] MSW 설정
- [ ] Test server 구현 (Express)

**Day 5: 핵심 테스트 작성 (1/2)**
- [ ] Scenario 1: Comment detection
- [ ] Scenario 2: Instruction creation

**Day 6: 핵심 테스트 작성 (2/2)**
- [ ] Scenario 3: PR creation flow
- [ ] Scenario 4: Error handling

**Day 7: 에러 처리 개선**
- [ ] chrome.runtime.lastError 체크 추가
- [ ] ErrorResponse 타입 적용
- [ ] buildErrorResponse 헬퍼 구현

---

## 7. 성공 기준

### 7.1 리팩토링

- [x] handleConvertComment 순환 복잡도 ≤ 10
- [x] 서비스별 단일 책임 원칙 준수
- [x] 의존성 주입 패턴 적용
- [x] 기존 기능 100% 유지

### 7.2 E2E 테스트

- [x] 4개 핵심 시나리오 자동화
- [x] 테스트 실행 시간 < 5분
- [x] 테스트 안정성 > 95% (flakiness < 5%)
- [x] CI/CD 통합 가능한 구조

### 7.3 에러 처리

- [x] chrome.runtime.lastError 모든 곳에서 확인
- [x] 일관된 ErrorResponse 포맷
- [x] 사용자 친화적 에러 메시지 유지

---

## 8. 리스크 및 완화 전략

### 8.1 리팩토링 리스크

**리스크**: 기존 기능 회귀 버그
**완화**: 각 서비스 추출 후 수동 전체 테스트 실행

### 8.2 E2E 테스트 리스크

**리스크**: Chrome extension 로드 실패
**완화**: Playwright 공식 문서 참고, 단계별 검증

### 8.3 시간 리스크

**리스크**: 예상보다 오래 걸림
**완화**: 우선순위별 작업 진행, 필수 기능만 구현

---

## 9. 마일스톤

| 날짜 | 마일스톤 | 산출물 |
|------|---------|-------|
| Day 1 | ConfigService, CommentService | 2개 서비스 파일, 테스트 |
| Day 2 | FileGenerationService, PRService | 2개 서비스 파일 |
| Day 3 | DI 통합 완료 | 리팩토링 완료, 수동 검증 |
| Day 4 | E2E 인프라 | playwright.config.ts, MSW 설정 |
| Day 5-6 | 핵심 테스트 4개 | 4개 .spec.ts 파일 |
| Day 7 | 에러 처리 개선 | ErrorResponse 타입, 체크 로직 |

---

## 10. 후속 작업 (Optional)

이번 작업 범위 밖:
- [ ] GitLab 호환성 E2E 테스트
- [ ] LLM 캐싱 성능 테스트
- [ ] 전체 코드베이스 리팩토링 (pr-creator, cache 등)
- [ ] 에러 코드 체계 전체 적용
- [ ] 캐시 에러 통계 추적

---

이 디자인 문서는 최소한의 리팩토링과 핵심 E2E 테스트에 초점을 맞추어, **총 7일 이내에 완료 가능한 실행 가능한 계획**을 제시합니다.
