/**
 * E2E Test: Popup Configuration
 *
 * 테스트 시나리오:
 * 1. Validation 에러 테스트 (GitHub token, GitLab token, GitLab URL)
 * 2. 빈 토큰 삭제 테스트
 * 3. 조건부 필드 가시성 테스트 (LLM provider 선택)
 */

import { test, expect } from '@playwright/test';
import { chromium, BrowserContext } from '@playwright/test';
import path from 'path';

/**
 * Helper function: Extension 로드 및 Popup 페이지 열기
 */
async function openPopup() {
  const pathToExtension = path.resolve(process.cwd(), 'dist');
  const userDataDir = path.resolve(process.cwd(), 'test-results', `temp-${Date.now()}`);

  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox'
    ]
  });

  // Extension ID 획득
  let extensionId = '';
  try {
    const serviceWorker = await browser.waitForEvent('serviceworker', { timeout: 5000 });
    extensionId = serviceWorker.url().split('/')[2];
  } catch (error) {
    // ServiceWorker를 기다리지 못한 경우, background page에서 ID 획득
    const backgroundPages = browser.backgroundPages();
    if (backgroundPages.length > 0) {
      extensionId = backgroundPages[0].url().split('/')[2];
    }
  }

  if (!extensionId) {
    throw new Error('Extension ID를 획득할 수 없습니다.');
  }

  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await page.waitForLoadState('load');
  await page.waitForTimeout(1000);  // 폼 초기화 대기

  return { browser, page };
}

test.describe('Popup Configuration', () => {
  test.describe('Validation Error Tests', () => {
    test('should show error for invalid GitHub token format', async () => {
      const { browser, page } = await openPopup();

      try {
        // 잘못된 형식의 GitHub token 입력
        await page.fill('#github-token', 'invalid-token-format');

        // 저장 버튼 클릭
        await page.click('#save');

        // 에러 메시지 확인
        const errorMessage = page.locator('#save-status');
        await expect(errorMessage).toContainText('GitHub 토큰은 "ghp_"로 시작해야 합니다', { timeout: 5000 });
        await expect(errorMessage).toHaveClass(/error/);
      } finally {
        await browser.close();
      }
    });

    test('should show error for invalid GitLab token format', async () => {
      const { browser, page } = await openPopup();

      try {
        // 잘못된 형식의 GitLab token 입력
        await page.fill('#gitlab-token', 'invalid-gitlab-token');

        // 저장 버튼 클릭
        await page.click('#save');

        // 에러 메시지 확인
        const errorMessage = page.locator('#save-status');
        await expect(errorMessage).toContainText('GitLab 토큰은 "glpat-"로 시작해야 합니다', { timeout: 5000 });
        await expect(errorMessage).toHaveClass(/error/);
      } finally {
        await browser.close();
      }
    });

    test('should show error for invalid URL format', async () => {
      const { browser, page } = await openPopup();

      try {
        // 잘못된 URL 형식 입력
        await page.fill('#gitlab-url', 'not-a-valid-url');

        // 저장 버튼 클릭
        await page.click('#save');

        // 에러 메시지 확인
        const errorMessage = page.locator('#save-status');
        await expect(errorMessage).toContainText('URL', { timeout: 5000 });
        await expect(errorMessage).toHaveClass(/error/);
      } finally {
        await browser.close();
      }
    });
  });

  test.describe('Empty Token Deletion Test', () => {
    test('should delete token from storage when empty string is saved', async () => {
      const { browser, page } = await openPopup();

      try {
        // 1. 유효한 GitHub token 저장
        await page.fill('#github-token', 'ghp_' + 'a'.repeat(36));
        await page.click('#save');

        const successMessage = page.locator('#save-status');
        await expect(successMessage).toContainText('저장되었습니다', { timeout: 5000 });

        // 2. Storage에 저장되었는지 확인
        const storedValue = await page.evaluate(() => {
          return chrome.storage.local.get('githubToken_enc');
        });
        expect(storedValue['githubToken_enc']).toBeDefined();

        // 3. Token을 비워서 다시 저장
        await page.fill('#github-token', '');
        await page.click('#save');
        await expect(successMessage).toContainText('저장되었습니다', { timeout: 5000 });

        // 4. Storage에서 제거되었는지 확인
        const removedValue = await page.evaluate(() => {
          return chrome.storage.local.get('githubToken_enc');
        });
        expect(removedValue['githubToken_enc']).toBeUndefined();
      } finally {
        await browser.close();
      }
    });
  });

  test.describe('Conditional Field Visibility', () => {
    test('should show Claude API key field when Claude provider is selected', async () => {
      const { browser, page } = await openPopup();

      try {
        // LLM 활성화
        await page.check('#llm-enabled');
        await page.waitForTimeout(500);

        // Claude provider 선택
        await page.selectOption('#llm-provider', 'claude');
        await page.waitForTimeout(500);

        // Claude API key 필드가 표시되는지 확인
        const claudeApiKeyGroup = page.locator('#claude-api-key-group');
        await expect(claudeApiKeyGroup).toBeVisible();

        // OpenAI API key 필드는 숨겨져야 함
        const openaiApiKeyGroup = page.locator('#openai-api-key-group');
        await expect(openaiApiKeyGroup).toBeHidden();
      } finally {
        await browser.close();
      }
    });

    test('should show OpenAI API key field when OpenAI provider is selected', async () => {
      const { browser, page } = await openPopup();

      try {
        // LLM 활성화
        await page.check('#llm-enabled');
        await page.waitForTimeout(500);

        // OpenAI provider 선택
        await page.selectOption('#llm-provider', 'openai');
        await page.waitForTimeout(500);

        // OpenAI API key 필드가 표시되는지 확인
        const openaiApiKeyGroup = page.locator('#openai-api-key-group');
        await expect(openaiApiKeyGroup).toBeVisible();

        // Claude API key 필드는 숨겨져야 함
        const claudeApiKeyGroup = page.locator('#claude-api-key-group');
        await expect(claudeApiKeyGroup).toBeHidden();
      } finally {
        await browser.close();
      }
    });

    test('should hide both API key fields when "none" provider is selected', async () => {
      const { browser, page } = await openPopup();

      try {
        // LLM 활성화
        await page.check('#llm-enabled');
        await page.waitForTimeout(500);

        // None provider 선택
        await page.selectOption('#llm-provider', 'none');
        await page.waitForTimeout(500);

        // 두 API key 필드 모두 숨겨져야 함
        const claudeApiKeyGroup = page.locator('#claude-api-key-group');
        const openaiApiKeyGroup = page.locator('#openai-api-key-group');

        await expect(claudeApiKeyGroup).toBeHidden();
        await expect(openaiApiKeyGroup).toBeHidden();
      } finally {
        await browser.close();
      }
    });

    test('should hide LLM settings when LLM is disabled', async () => {
      const { browser, page } = await openPopup();

      try {
        // LLM 비활성화 확인 (기본값)
        const isChecked = await page.isChecked('#llm-enabled');
        expect(isChecked).toBe(false);

        // LLM 설정 영역이 숨겨져 있는지 확인
        const llmSettingsDiv = page.locator('#llm-settings');
        await expect(llmSettingsDiv).toBeHidden();
      } finally {
        await browser.close();
      }
    });
  });
});
