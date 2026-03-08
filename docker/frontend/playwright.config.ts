/// <reference types="node" />

import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    process.env.CI ? ['github'] : ['list']
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  /* Timeout for each test */
  timeout: 60000,
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // E2E must target the frontend runtime built from the current workspace source,
    // not an unrelated long-lived container bound to :3000.
    // Default to :3001 so Playwright's managed webServer can run deterministically.
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Timeout for each action */
    actionTimeout: 10000,

    /*
     * Only reuse storage state when explicitly requested.
     * Implicitly loading test-results/storageState.json can carry stale session/action
     * state across frontend builds and trigger runtime divergence in auth routes.
     */
    storageState: (() => {
      const envPath = process.env.PLAYWRIGHT_STORAGE_STATE;
      if (envPath && fs.existsSync(envPath)) return envPath;
      return undefined;
    })(),
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      // Force localhost to resolve to IPv4 first.
      // This avoids intermittent IPv6 (::1) connection resets when services only listen on 0.0.0.0.
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--host-resolver-rules=MAP localhost 127.0.0.1'],
        },
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          args: ['--host-resolver-rules=MAP localhost 127.0.0.1'],
        },
      },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /*
   * Run a local Next.js server before starting the tests.
   * In this repo, E2E usually targets the docker-compose services (frontend on :3001),
   * so keep this disabled unless explicitly enabled.
   */
  webServer: {
    command: 'NEXT_IGNORE_INCORRECT_LOCKFILE=1 PORT=3001 pnpm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 240000,
  },

  /* Global setup and teardown */
  globalSetup: require.resolve('./e2e/global-setup'),
  globalTeardown: require.resolve('./e2e/global-teardown'),
});
