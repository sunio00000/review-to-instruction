/**
 * E2E Test: GitHub Comment Detection
 *
 * Scenario 1: GitHub PR 페이지에서 컨벤션 코멘트 감지 및 버튼 표시
 */

import { test, expect } from '@playwright/test';

test.describe('GitHub Comment Detection', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test PR page
    await page.goto('/test-org/test-repo/pull/1');
  });

  test('should detect convention comments and show Convert button', async ({ page }) => {
    // Wait for page load
    await page.waitForLoadState('networkidle');

    // Wait for extension to inject buttons (max 5 seconds)
    await page.waitForTimeout(2000);

    // Find convention comment (comment-1)
    const conventionComment = page.locator('[data-comment-id="comment-1"]');
    await expect(conventionComment).toBeVisible();

    // Check if "Convert to Instruction" button is present
    const convertButton = conventionComment.locator('button:has-text("Convert to AI Instruction")');

    // Button should be visible
    await expect(convertButton).toBeVisible({ timeout: 5000 });
  });

  test('should NOT show button for general comments', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find general comment (comment-2)
    const generalComment = page.locator('[data-comment-id="comment-2"]');
    await expect(generalComment).toBeVisible();

    // Check that "Convert to Instruction" button is NOT present
    const convertButton = generalComment.locator('button:has-text("Convert to AI Instruction")');
    await expect(convertButton).not.toBeVisible();
  });

  test('should show buttons for multiple convention comments', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find all convention comments
    const comment1Button = page.locator('[data-comment-id="comment-1"] button:has-text("Convert to AI Instruction")');
    const comment3Button = page.locator('[data-comment-id="comment-3"] button:has-text("Convert to AI Instruction")');

    // Both should have buttons
    await expect(comment1Button).toBeVisible({ timeout: 5000 });
    await expect(comment3Button).toBeVisible({ timeout: 5000 });
  });

  test('button should have correct styling', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const convertButton = page.locator('[data-comment-id="comment-1"] button:has-text("Convert to AI Instruction")').first();
    await expect(convertButton).toBeVisible();

    // Check button is clickable
    await expect(convertButton).toBeEnabled();
  });
});
