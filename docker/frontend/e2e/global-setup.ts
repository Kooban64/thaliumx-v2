/**
 * Global setup for Playwright E2E tests
 *
 * Sets up test environment, seeds database, and configures test users
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');

  // Launch browser for setup tasks
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Check if backend is running
    console.log('📡 Checking backend availability...');
    await page.goto('http://localhost:3002/health', { timeout: 10000 });
    const healthResponse = await page.textContent('body');
    console.log('✅ Backend health check:', healthResponse);

    // Seed test data if needed
    console.log('🌱 Seeding test data...');
    await seedTestData(page);

    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function seedTestData(page: any) {
  // Create test user accounts for E2E testing
  const testUsers = [
    {
      email: 'testuser1@thaliumx.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'trader'
    },
    {
      email: 'testuser2@thaliumx.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'Admin',
      role: 'admin'
    }
  ];

  for (const user of testUsers) {
    try {
      // Register test user
      await page.goto('http://localhost:3000/auth');
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      await page.fill('input[name="firstName"]', user.firstName);
      await page.fill('input[name="lastName"]', user.lastName);

      // Click register button
      await page.click('button[type="submit"]');

      // Wait for success or handle if user already exists
      await page.waitForTimeout(2000);

      console.log(`✅ Created test user: ${user.email}`);
    } catch (error) {
      console.log(`⚠️ Test user may already exist: ${user.email}`);
    }
  }

  // Seed some test market data
  try {
    await page.goto('http://localhost:3002/api/market/cache/clear', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('✅ Cleared market data cache');
  } catch (error) {
    console.log('⚠️ Could not clear cache, may not be available');
  }
}

export default globalSetup;