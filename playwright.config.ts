import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright Configuration for Chrome Extension E2E Tests
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',

  // Test execution settings
  timeout: 30000,
  fullyParallel: false, // Run tests sequentially for extension testing
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for extension context

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['list']
  ],

  // Shared settings
  use: {
    // Browser launch options for Chrome Extension
    launchOptions: {
      args: [
        `--load-extension=${path.resolve(process.cwd(), 'dist')}`,
        `--disable-extensions-except=${path.resolve(process.cwd(), 'dist')}`,
        '--no-sandbox'
      ]
    },

    // Base URL for test server
    baseURL: 'http://localhost:3002',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure'
  },

  // Projects configuration
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  // Web server for test fixtures
  webServer: {
    command: 'node tests/test-server.cjs',
    port: 3002,
    timeout: 10000,
    reuseExistingServer: !process.env.CI
  }
});
