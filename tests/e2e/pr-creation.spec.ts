/**
 * E2E Test: PR Creation Flow
 *
 * Scenario 3: 전체 E2E 플로우 테스트
 */

import { test, expect } from '@playwright/test';
import { setupServer } from 'msw/node';
import { githubHandlers } from '../mocks/github-handlers';

const server = setupServer(...githubHandlers);

test.describe('PR Creation Flow (E2E)', () => {
  test.beforeAll(() => {
    server.listen();
  });

  test.afterAll(() => {
    server.close();
  });

  test.beforeEach(async ({ page, context }) => {
    // Setup extension storage
    await context.addInitScript(() => {
      chrome.storage.sync.set({
        githubToken: 'test-token-123',
        showButtons: true,
        llm: {
          enabled: false,
          provider: 'none'
        }
      });
    });

    await page.goto('/test-org/test-repo/pull/1');
    await page.waitForTimeout(2000);
  });

  test('complete flow: detect → convert → PR creation', async ({ page }) => {
    // Step 1: Verify comment detection
    const conventionComment = page.locator('[data-comment-id="comment-1"]');
    await expect(conventionComment).toBeVisible();

    // Step 2: Verify button injection
    const convertButton = conventionComment.locator('button:has-text("Convert to AI Instruction")');
    await expect(convertButton).toBeVisible({ timeout: 5000 });

    // Step 3: Click button
    await convertButton.click();

    // Step 4: Verify loading state
    await expect(convertButton).toContainText('Processing', { timeout: 2000 });
    await expect(convertButton).toBeDisabled();

    // Step 5: Wait for success
    const successMsg = page.locator('text=/Instruction.*생성됨/');
    await expect(successMsg).toBeVisible({ timeout: 15000 });

    // Step 6: Verify PR link
    const prLink = successMsg.locator('a[target="_blank"]');
    const prUrl = await prLink.getAttribute('href');
    expect(prUrl).toBeTruthy();
    expect(prUrl).toContain('github.com');
    expect(prUrl).toContain('/pull/');

    // Step 7: Verify button returns to normal state
    await expect(convertButton).toBeEnabled();
    await expect(convertButton).toContainText('Convert to AI Instruction');
  });

  test('should handle API timeout gracefully', async ({ page }) => {
    // Simulate slow API (handled by timeout in extension)
    const convertButton = page.locator('[data-comment-id="comment-1"] button:has-text("Convert to AI Instruction")').first();
    await convertButton.click();

    // Should either succeed or show timeout error within 30 seconds
    const result = await Promise.race([
      page.locator('text=/Instruction.*생성됨/').waitFor({ timeout: 30000 }).then(() => 'success'),
      page.locator('text=/timeout|시간 초과/i').waitFor({ timeout: 30000 }).then(() => 'timeout'),
      page.locator('text=/error|에러|실패/i').waitFor({ timeout: 30000 }).then(() => 'error')
    ]).catch(() => 'no_response');

    expect(['success', 'timeout', 'error']).toContain(result);
  });

  test('should allow multiple conversions in sequence', async ({ page }) => {
    // First conversion
    const button1 = page.locator('[data-comment-id="comment-1"] button:has-text("Convert to AI Instruction")').first();
    await button1.click();
    await expect(page.locator('text=/Instruction.*생성됨/').first()).toBeVisible({ timeout: 15000 });

    // Wait a bit
    await page.waitForTimeout(1000);

    // Second conversion (comment-3)
    const button3 = page.locator('[data-comment-id="comment-3"] button:has-text("Convert to AI Instruction")').first();
    await button3.click();
    await expect(page.locator('text=/Instruction.*생성됨/').nth(1)).toBeVisible({ timeout: 15000 });

    // Both buttons should be back to normal
    await expect(button1).toBeEnabled();
    await expect(button3).toBeEnabled();
  });
});
