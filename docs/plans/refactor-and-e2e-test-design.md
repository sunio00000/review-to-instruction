# Review to Instruction - Refactoring and E2E Test Addition

**Written**: 2026-01-16
**Version**: Based on v1.2.0
**Goal**: Improve code quality and build automated E2E test infrastructure

---

## 1. Overview

### 1.1 Project Status

- **Type**: Chrome Extension (Manifest V3)
- **Language**: TypeScript 5.9.3
- **Build**: Vite 7.3.1
- **Main Features**:
  - Automatically convert GitHub/GitLab PR review comments to AI instructions
  - Support multiple AI tools (Claude Code, Cursor, Windsurf)
  - LLM response caching (50-70% cost savings)

### 1.2 Issues and Goals

**Current Issues:**
1. `handleConvertComment` function in `message-handler.ts` is 157 lines, cyclomatic complexity 21
2. No test framework (manual testing only)
3. `chrome.runtime.lastError` not checked

**Improvement Goals:**
1. ✅ Refactor message-handler (complexity 21 → 8-10)
2. ✅ Automate core E2E tests (3-4 scenarios)
3. ✅ Improve essential error handling

---

## 2. Architecture Design

### 2.1 Current Architecture

```
Content Script → chrome.runtime.sendMessage → Background Service Worker
                                                  ↓
                                            message-handler
                                                  ↓
                                   (10 responsibilities in one function)
```

### 2.2 Improved Architecture

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

### 2.3 Service Layer Design

#### ConfigService
```typescript
interface ConfigService {
  loadConfig(platform: Platform): Promise<{
    token: string;
    llmConfig: LLMConfig;
  }>;
}
```
- **Responsibility**: Load and validate settings from Chrome Storage
- **Dependencies**: chrome.storage.sync

#### CommentService
```typescript
interface CommentService {
  validateAndEnhance(
    comment: Comment,
    llmConfig: LLMConfig
  ): Promise<EnhancedComment>;
}
```
- **Responsibility**: Check conventions, parse comments, LLM enhancement
- **Dependencies**: parser, enhancer

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
- **Responsibility**: Detect project type, file matching, execute Generator
- **Dependencies**: ProjectTypeDetector, GeneratorFactory, file-matcher

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
- **Responsibility**: Create PR/MR and wrap results
- **Dependencies**: pr-creator (reuse existing module)

---

## 3. Refactoring Plan

### 3.1 Phase 1: Extract Services (2 days)

**Task 1.1: Create ConfigService**
- File: `src/background/services/config-service.ts` (new)
- Code movement: message-handler.ts lines 137-145 (9 lines)
- Testability: ✅ (chrome.storage mocking)

**Task 1.2: Create CommentService**
- File: `src/background/services/comment-service.ts` (new)
- Code movement: message-handler.ts lines 132-177 (46 lines)
- Integrate existing modules: parser.ts, llm/enhancer.ts

**Task 1.3: Create FileGenerationService**
- File: `src/background/services/file-generation-service.ts` (new)
- Code movement: message-handler.ts lines 179-240 (62 lines)
- Integrate existing modules: project-detector.ts, generators/*

**Task 1.4: PullRequestService Wrapper**
- File: `src/background/services/pr-service.ts` (new)
- Wrap existing pr-creator.ts with service interface
- Code movement: message-handler.ts lines 244-259 (16 lines)

### 3.2 Phase 2: Apply Dependency Injection (1 day)

**Task 2.1: Implement DI Container**
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

**Task 2.2: Create ConversionOrchestrator**
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

**Task 2.3: Simplify message-handler**
```typescript
// src/background/message-handler.ts (after refactoring)
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

Expected results:
- handleConvertComment: 157 lines → 10-15 lines
- Cyclomatic complexity: 21 → 3-4

---

## 4. E2E Test Infrastructure

### 4.1 Test Stack

```json
{
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "msw": "^2.6.0"
  }
}
```

### 4.2 Folder Structure

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

### 4.3 Test Scenarios

#### Scenario 1: GitHub PR Comment Detection
```typescript
test('Detect convention comment on GitHub PR page', async ({ page }) => {
  await page.goto('http://localhost:3000/test-pr');

  // Verify "Convert to AI Instruction" button appears
  const button = page.locator('button:has-text("Convert to AI Instruction")');
  await expect(button).toBeVisible();
});
```

#### Scenario 2: Instruction Creation
```typescript
test('Create new instruction file and PR', async ({ page }) => {
  await setupGitHubMocks(page);

  const button = page.locator('button:has-text("Convert to AI Instruction")');
  await button.click();

  // Verify success message and PR link
  const successMsg = page.locator('text=/Instruction.*created/');
  await expect(successMsg).toBeVisible({ timeout: 15000 });

  const prLink = successMsg.locator('a[target="_blank"]');
  expect(await prLink.getAttribute('href')).toMatch(/pull\/\d+$/);
});
```

#### Scenario 3: PR Creation Flow
```typescript
test('Full PR creation flow (E2E)', async ({ page }) => {
  // 1. Comment detection
  // 2. Button click
  // 3. API calls (mocked)
  // 4. PR URL return
  // 5. Verify all steps
});
```

#### Scenario 4: Error Handling
```typescript
test('Error message when token not configured', async ({ page }) => {
  await clearStorageToken(page);

  const button = page.locator('button:has-text("Convert to AI Instruction")');
  await button.click();

  const errorMsg = page.locator('text=/Token not configured/');
  await expect(errorMsg).toBeVisible();
});
```

### 4.4 Mock Setup

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
      { name: 'rules', type: 'dir', path: '.claude/rules' }
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

### 4.5 Playwright Configuration

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

## 5. Error Handling Improvements

### 5.1 chrome.runtime.lastError Check

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

### 5.2 Add ErrorResponse Type

```typescript
// src/types/index.ts
interface ErrorResponse {
  success: false;
  error: {
    message: string;      // User message
    code?: string;        // Error code (optional)
    timestamp: number;    // Error occurrence time
  };
}

// Error codes (optional)
enum ErrorCode {
  AUTH_FAILED = 'AUTH_FAILED',
  API_TIMEOUT = 'API_TIMEOUT',
  TOKEN_MISSING = 'TOKEN_MISSING',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}
```

### 5.3 buildErrorResponse Helper

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

## 6. Implementation Order and Task Division

### Week 1: Refactoring (3 days)

**Day 1: Extract Services (1/2)**
- [ ] Create and test ConfigService
- [ ] Create and test CommentService

**Day 2: Extract Services (2/2)**
- [ ] Create and test FileGenerationService
- [ ] Create PullRequestService wrapper

**Day 3: DI Integration and Simplification**
- [ ] Implement DI Container
- [ ] Create ConversionOrchestrator
- [ ] Simplify message-handler
- [ ] Verify with manual testing

### Week 2: E2E Tests (4 days)

**Day 4: Set up E2E Infrastructure**
- [ ] Install and configure Playwright
- [ ] Set up MSW
- [ ] Implement test server (Express)

**Day 5: Write Core Tests (1/2)**
- [ ] Scenario 1: Comment detection
- [ ] Scenario 2: Instruction creation

**Day 6: Write Core Tests (2/2)**
- [ ] Scenario 3: PR creation flow
- [ ] Scenario 4: Error handling

**Day 7: Improve Error Handling**
- [ ] Add chrome.runtime.lastError checks
- [ ] Apply ErrorResponse type
- [ ] Implement buildErrorResponse helper

---

## 7. Success Criteria

### 7.1 Refactoring

- [x] handleConvertComment cyclomatic complexity ≤ 10
- [x] Single Responsibility Principle per service
- [x] Apply Dependency Injection pattern
- [x] Maintain 100% existing functionality

### 7.2 E2E Tests

- [x] Automate 4 core scenarios
- [x] Test execution time < 5 minutes
- [x] Test stability > 95% (flakiness < 5%)
- [x] CI/CD integrable structure

### 7.3 Error Handling

- [x] Check chrome.runtime.lastError everywhere
- [x] Consistent ErrorResponse format
- [x] Maintain user-friendly error messages

---

## 8. Risks and Mitigation Strategies

### 8.1 Refactoring Risks

**Risk**: Regression bugs in existing functionality
**Mitigation**: Run manual full tests after each service extraction

### 8.2 E2E Test Risks

**Risk**: Chrome extension load failure
**Mitigation**: Reference Playwright official documentation, step-by-step verification

### 8.3 Timeline Risks

**Risk**: Takes longer than expected
**Mitigation**: Work by priority, implement only essential features

---

## 9. Milestones

| Date | Milestone | Deliverables |
|------|---------|--------------|
| Day 1 | ConfigService, CommentService | 2 service files, tests |
| Day 2 | FileGenerationService, PRService | 2 service files |
| Day 3 | DI Integration Complete | Refactoring done, manual verification |
| Day 4 | E2E Infrastructure | playwright.config.ts, MSW setup |
| Day 5-6 | 4 Core Tests | 4 .spec.ts files |
| Day 7 | Error Handling Improvements | ErrorResponse type, check logic |

---

## 10. Follow-up Tasks (Optional)

Out of scope for this work:
- [ ] GitLab compatibility E2E tests
- [ ] LLM caching performance tests
- [ ] Full codebase refactoring (pr-creator, cache, etc.)
- [ ] Apply error code system across entire codebase
- [ ] Track cache error statistics

---

This design document focuses on minimal refactoring and core E2E tests, presenting an **executable plan completable within 7 days total**.
