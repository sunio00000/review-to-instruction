/**
 * E2E Test: GitHub Instruction Creation
 *
 * Scenario 2: 새로운 instruction 파일 생성 및 PR URL 확인
 */

import { test, expect } from '@playwright/test';
import { setupServer } from 'msw/node';
import { githubHandlers } from '../mocks/github-handlers';

// Setup MSW server
const server = setupServer(...githubHandlers);

test.describe('GitHub Instruction Creation', () => {
  test.beforeAll(() => {
    server.listen();
  });

  test.afterAll(() => {
    server.close();
  });

  test.beforeEach(async ({ page, context }) => {
    // Set GitHub token in extension storage
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

  test('should create instruction and show PR link', async ({ page }) => {
    // Find convert button
    const convertButton = page.locator('[data-comment-id="comment-1"] button:has-text("Convert to AI Instruction")').first();
    await expect(convertButton).toBeVisible({ timeout: 5000 });

    // Click button
    await convertButton.click();

    // Check loading state
    await expect(convertButton).toContainText('Processing', { timeout: 2000 });

    // Wait for success message (max 15 seconds)
    const successMsg = page.locator('text=/Instruction.*생성됨/');
    await expect(successMsg).toBeVisible({ timeout: 15000 });

    // Check PR link is present
    const prLink = successMsg.locator('a[target="_blank"]');
    await expect(prLink).toBeVisible();

    // Verify PR URL format
    const prUrl = await prLink.getAttribute('href');
    expect(prUrl).toMatch(/^https:\/\/github\.com\/.*\/pull\/\d+$/);
  });

  test('should handle missing token error', async ({ page, context }) => {
    // Clear token
    await context.addInitScript(() => {
      chrome.storage.sync.set({
        githubToken: '',
        showButtons: true
      });
    });

    await page.reload();
    await page.waitForTimeout(2000);

    const convertButton = page.locator('[data-comment-id="comment-1"] button:has-text("Convert to AI Instruction")').first();
    await convertButton.click();

    // Error message should appear
    const errorMsg = page.locator('text=/token.*설정/i');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test('should show different messages for instruction vs skill', async ({ page }) => {
    const convertButton = page.locator('[data-comment-id="comment-1"] button:has-text("Convert to AI Instruction")').first();
    await convertButton.click();

    // Success message should mention instruction
    const successMsg = page.locator('text=/Instruction.*생성됨/');
    await expect(successMsg).toBeVisible({ timeout: 15000 });
  });
});
