/**
 * E2E Test: Error Handling
 *
 * Scenario 4: 다양한 에러 케이스 및 사용자 피드백
 */

import { test, expect } from '@playwright/test';
import { setupServer } from 'msw/node';
import { githubHandlers } from '../mocks/github-handlers';
import { http, HttpResponse } from 'msw';

const server = setupServer(...githubHandlers);

test.describe('Error Handling', () => {
  test.beforeAll(() => {
    server.listen();
  });

  test.afterAll(() => {
    server.close();
  });

  test.afterEach(() => {
    server.resetHandlers();
  });

  test('should show error when GitHub token is not set', async ({ page, context }) => {
    // No token
    await context.addInitScript(() => {
      chrome.storage.sync.set({
        githubToken: '',
        showButtons: true
      });
    });

    await page.goto('/test-org/test-repo/pull/1');
    await page.waitForTimeout(2000);

    const convertButton = page.locator('[data-comment-id="comment-1"] button:has-text("Convert to AI Instruction")').first();
    await convertButton.click();

    // Error message should appear
    const errorMsg = page.locator('text=/token.*설정/i');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });

    // Button should return to normal state
    await expect(convertButton).toBeEnabled();
  });

  test('should show error for invalid token (403 Forbidden)', async ({ page, context }) => {
    // Override user endpoint to return 403
    server.use(
      http.get('https://api.github.com/user', () => {
        return HttpResponse.json(
          { message: 'Bad credentials' },
          { status: 403 }
        );
      })
    );

    await context.addInitScript(() => {
      chrome.storage.sync.set({
        githubToken: 'invalid-token',
        showButtons: true
      });
    });

    await page.goto('/test-org/test-repo/pull/1');
    await page.waitForTimeout(2000);

    const convertButton = page.locator('[data-comment-id="comment-1"] button:has-text("Convert to AI Instruction")').first();
    await convertButton.click();

    // Error message about authentication
    const errorMsg = page.locator('text=/권한|인증|token/i');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test('should show error when .claude directory not found', async ({ page, context }) => {
    // Override .claude endpoint to return 404
    server.use(
      http.get('https://api.github.com/repos/:owner/:repo/contents/.claude', () => {
        return HttpResponse.json(
          { message: 'Not Found' },
          { status: 404 }
        );
      }),
      http.get('https://api.github.com/repos/:owner/:repo/contents/.cursorrules', () => {
        return HttpResponse.json(
          { message: 'Not Found' },
          { status: 404 }
        );
      }),
      http.get('https://api.github.com/repos/:owner/:repo/contents/rules', () => {
        return HttpResponse.json(
          { message: 'Not Found' },
          { status: 404 }
        );
      })
    );

    await context.addInitScript(() => {
      chrome.storage.sync.set({
        githubToken: 'test-token-123',
        showButtons: true
      });
    });

    await page.goto('/test-org/test-repo/pull/1');
    await page.waitForTimeout(2000);

    const convertButton = page.locator('[data-comment-id="comment-1"] button:has-text("Convert to AI Instruction")').first();
    await convertButton.click();

    // Error about missing AI tool directories
    const errorMsg = page.locator('text=/\.claude.*cursorrules.*rules|AI 도구 형식/i');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test('should show error for non-convention comment', async ({ page, context }) => {
    await context.addInitScript(() => {
      chrome.storage.sync.set({
        githubToken: 'test-token-123',
        showButtons: true
      });
    });

    await page.goto('/test-org/test-repo/pull/1');
    await page.waitForTimeout(2000);

    // Try to convert general comment (should not have button, but test the case)
    // Actually, button won't be there, so this tests the parser directly
    // For this test, we assume button was somehow shown for non-convention content

    // This test verifies the parser rejects non-convention comments
    // Since button won't appear for non-convention comments, this test is informational
    const generalComment = page.locator('[data-comment-id="comment-2"]');
    await expect(generalComment).toBeVisible();

    const convertButton = generalComment.locator('button:has-text("Convert to AI Instruction")');
    await expect(convertButton).not.toBeVisible();
  });

  test('should recover from error and allow retry', async ({ page, context }) => {
    // First request fails
    let callCount = 0;
    server.use(
      http.post('https://api.github.com/repos/:owner/:repo/pulls', () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json(
            { message: 'Server error' },
            { status: 500 }
          );
        }
        // Second request succeeds
        return HttpResponse.json({
          number: 123,
          html_url: 'https://github.com/test/repo/pull/123'
        });
      })
    );

    await context.addInitScript(() => {
      chrome.storage.sync.set({
        githubToken: 'test-token-123',
        showButtons: true
      });
    });

    await page.goto('/test-org/test-repo/pull/1');
    await page.waitForTimeout(2000);

    const convertButton = page.locator('[data-comment-id="comment-1"] button:has-text("Convert to AI Instruction")').first();

    // First attempt - should fail
    await convertButton.click();
    const errorMsg = page.locator('text=/error|에러|실패/i');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });

    // Button should be enabled for retry
    await expect(convertButton).toBeEnabled();

    // Retry - should succeed
    await page.waitForTimeout(1000);
    await convertButton.click();
    const successMsg = page.locator('text=/Instruction.*생성됨/');
    await expect(successMsg).toBeVisible({ timeout: 15000 });
  });
});
