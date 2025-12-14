/**
 * Global setup for Playwright E2E tests
 *
 * Sets up test environment, seeds database, and configures test users
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');

  try {
    // Check if backend is running using fetch (works better than page.goto for health checks)
    console.log('📡 Checking backend availability...');
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
    const healthResponse = await fetch(`${backendUrl}/health`, { 
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Backend health check:', JSON.stringify(healthData).substring(0, 200));
    } else {
      console.warn('⚠️ Backend health check returned:', healthResponse.status);
    }

    // Launch browser for setup tasks that require browser context
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      // Seed test data if needed
      console.log('🌱 Seeding test data...');
      await seedTestData(page);
    } finally {
      await browser.close();
    }

    console.log('✅ Global setup completed successfully');
  } catch (error: any) {
    console.error('❌ Global setup failed:', error.message);
    // Don't throw - allow tests to run even if setup has issues
    console.warn('⚠️ Continuing with tests despite setup warnings...');
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

  const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  for (const user of testUsers) {
    try {
      // Register test user via frontend
      await page.goto(`${frontendUrl}/auth`);
      await page.waitForSelector('input[type="email"]', { timeout: 5000 });
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      
      // Try to find and fill optional fields if they exist
      const firstNameInput = await page.$('input[name="firstName"]');
      if (firstNameInput) await page.fill('input[name="firstName"]', user.firstName);
      
      const lastNameInput = await page.$('input[name="lastName"]');
      if (lastNameInput) await page.fill('input[name="lastName"]', user.lastName);

      // Click register button if available, otherwise skip
      const registerButton = await page.$('button:has-text("Sign up"), button:has-text("Register")');
      if (registerButton) {
        await registerButton.click();
        await page.waitForTimeout(2000);
        console.log(`✅ Created test user: ${user.email}`);
      } else {
        console.log(`⚠️ Register form not found, user may need to be created manually: ${user.email}`);
      }
    } catch (error: any) {
      console.log(`⚠️ Test user may already exist: ${user.email} - ${error.message}`);
    }
  }

  // Seed some test market data
  try {
    const response = await fetch(`${backendUrl}/api/market/cache/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      console.log('✅ Cleared market data cache');
    }
  } catch (error: any) {
    console.log(`⚠️ Could not clear cache: ${error.message}`);
  }
}

export default globalSetup;