/**
 * Global teardown for Playwright E2E tests
 *
 * Cleans up test environment and removes test data
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...');

  // Launch browser for cleanup tasks
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Clean up test data
    console.log('🗑️ Cleaning up test data...');
    await cleanupTestData(page);

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  } finally {
    await browser.close();
  }
}

async function cleanupTestData(page: any) {
  // Clean up test users and data
  const testUsers = [
    'testuser1@thaliumx.com',
    'testuser2@thaliumx.com'
  ];

  for (const email of testUsers) {
    try {
      // Attempt to delete test user via API
      const response = await page.request.post('http://localhost:3002/api/admin/users/delete', {
        data: { email },
        headers: {
          'Content-Type': 'application/json',
          // Use admin token if available
        }
      });

      if (response.ok()) {
        console.log(`✅ Cleaned up test user: ${email}`);
      }
    } catch (error) {
      console.log(`⚠️ Could not clean up test user: ${email}`);
    }
  }

  // Clear caches
  try {
    await page.request.post('http://localhost:3002/api/market/cache/clear');
    console.log('✅ Cleared market data cache');
  } catch (error) {
    console.log('⚠️ Could not clear cache');
  }
}

export default globalTeardown;