/**
 * Production Authentication Verification
 * 
 * Simple, focused test to verify registration and login work from a real browser.
 * Can be run against production domain (thaliumx.com) or localhost.
 * 
 * This test verifies:
 * 1. User can register a new account
 * 2. User can login with registered credentials
 * 3. User is redirected to correct dashboard
 */

import { test, expect, Page } from '@playwright/test';

// Use environment variable for base URL, default to localhost
const BASE_URL = process.env.PRODUCTION_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Generate unique test user
const timestamp = Date.now();
const randomSuffix = Math.floor(Math.random() * 1000000);
const TEST_USER = {
  email: `test-${timestamp}-${randomSuffix}@thaliumx.test`,
  password: 'TestUser123!@#',
  firstName: 'Test',
  lastName: 'User'
};

console.log(`\n🌐 Testing against: ${BASE_URL}`);
console.log(`👤 Test user: ${TEST_USER.email}\n`);

/**
 * Wait for page to load
 */
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
  await page.waitForTimeout(1000);
}

/**
 * Register a new user
 */
async function registerUser(page: Page): Promise<boolean> {
  try {
    console.log('📝 Step 1: Navigating to registration...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPageLoad(page);

    // Wait for form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Check if we need to switch to register mode
    const isRegisterMode = await page.locator('input[id="firstName"], input[name="firstName"]').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!isRegisterMode) {
      console.log('📝 Switching to register mode...');
      const switchSelectors = [
        'button:has-text("Sign up")',
        'button:has-text("Register")',
        'a:has-text("Sign up")',
        'a:has-text("Register")',
        'text=/sign up/i',
        'text=/register/i'
      ];
      
      for (const selector of switchSelectors) {
        try {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.click();
            await page.waitForTimeout(2000);
            await waitForPageLoad(page);
            break;
          }
        } catch {
          continue;
        }
      }
    }

    // Wait for registration form
    await page.waitForSelector('input[id="firstName"], input[name="firstName"]', { timeout: 5000 });
    console.log('📝 Registration form found');

    // Fill form
    const firstNameInput = page.locator('input[id="firstName"], input[name="firstName"]').first();
    const lastNameInput = page.locator('input[id="lastName"], input[name="lastName"]').first();
    const emailInput = page.locator('input[type="email"], input[id="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const confirmPasswordInput = page.locator('input[type="password"]').nth(1);

    console.log('📝 Filling registration form...');
    await firstNameInput.fill(TEST_USER.firstName);
    await page.waitForTimeout(300);
    await lastNameInput.fill(TEST_USER.lastName);
    await page.waitForTimeout(300);
    await emailInput.fill(TEST_USER.email);
    await page.waitForTimeout(300);
    await passwordInput.fill(TEST_USER.password);
    await page.waitForTimeout(300);
    await confirmPasswordInput.fill(TEST_USER.password);
    await page.waitForTimeout(500);

    // Monitor API response
    let apiSuccess = false;
    const responsePromise = page.waitForResponse(
      response => {
        const url = response.url();
        return (url.includes('/api/auth/register') || url.includes('/api/auth/signup')) && 
               response.request().method() === 'POST';
      },
      { timeout: 20000 }
    ).catch(() => null);

    // Submit
    console.log('📝 Submitting registration...');
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    // Wait for response
    try {
      const response = await responsePromise;
      if (response) {
        const status = response.status();
        const data = await response.json().catch(() => ({}));
        
        console.log(`📝 Registration API response: ${status}`);
        
        if (status === 200 || status === 201) {
          if (data.success === true || data.data?.user || data.user) {
            apiSuccess = true;
            console.log('✅ Registration API success');
          }
        } else if (status === 429) {
          console.log('⚠️ Rate limit (429) - waiting to check if registration succeeded...');
          await page.waitForTimeout(5000);
        } else {
          console.log(`⚠️ Registration API returned ${status}: ${data.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.log('⚠️ Error waiting for API response');
    }

    // Wait for UI update
    await page.waitForTimeout(4000);

    // Check for success
    if (apiSuccess) {
      console.log('✅ Registration successful (API confirmed)');
      return true;
    }

    // Check UI for success
    const successSelectors = [
      'text=/Registration Successful/i',
      'text=/successfully registered/i',
      'h3:has-text("Registration")',
      '.text-green-600',
      '.text-green-500'
    ];

    for (const selector of successSelectors) {
      try {
        if (await page.locator(selector).first().isVisible({ timeout: 3000 })) {
          console.log('✅ Registration successful (UI confirmed)');
          return true;
        }
      } catch {
        continue;
      }
    }

    // Check page text
    const pageText = await page.textContent('body').catch(() => '');
    if (pageText && (pageText.includes('Registration Successful') || 
        (pageText.includes('successfully') && !pageText.includes('error') && !pageText.includes('failed')))) {
      console.log('✅ Registration successful (page text confirmed)');
      return true;
    }

    // If we're redirected away from login, might be success
    const currentUrl = page.url();
    if (!currentUrl.includes('/login') && (currentUrl.includes('/dashboard') || currentUrl.includes('/verify'))) {
      console.log('✅ Registration successful (redirect detected)');
      return true;
    }

    console.log('❌ Registration failed - no success indicators found');
    return false;
  } catch (error) {
    console.error('❌ Registration error:', error);
    return false;
  }
}

/**
 * Login user
 */
async function loginUser(page: Page): Promise<boolean> {
  try {
    console.log('🔐 Step 2: Navigating to login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPageLoad(page);

    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Ensure we're in login mode
    const isInRegisterMode = await page.locator('input[id="firstName"]').isVisible({ timeout: 2000 }).catch(() => false);
    if (isInRegisterMode) {
      console.log('🔐 Switching to login mode...');
      const switchSelectors = [
        'button:has-text("Sign in")',
        'button:has-text("Log in")',
        'a:has-text("Sign in")',
        'a:has-text("Log in")',
        'text=/sign in/i',
        'text=/log in/i'
      ];
      
      for (const selector of switchSelectors) {
        try {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.click();
            await page.waitForTimeout(2000);
            await waitForPageLoad(page);
            break;
          }
        } catch {
          continue;
        }
      }
    }

    // Fill credentials
    console.log('🔐 Filling login credentials...');
    const emailInput = page.locator('input[type="email"], input[id="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[id="password"]').first();
    
    await emailInput.fill(TEST_USER.email);
    await page.waitForTimeout(300);
    await passwordInput.fill(TEST_USER.password);
    await page.waitForTimeout(500);

    // Monitor API response
    let loginSuccess = false;
    const responsePromise = page.waitForResponse(
      response => {
        const url = response.url();
        return (url.includes('/api/auth/login') || url.includes('/api/auth/signin')) && 
               response.request().method() === 'POST';
      },
      { timeout: 20000 }
    ).catch(() => null);

    // Submit
    console.log('🔐 Submitting login...');
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    // Wait for response
    try {
      const response = await responsePromise;
      if (response) {
        const status = response.status();
        const data = await response.json().catch(() => ({}));
        
        console.log(`🔐 Login API response: ${status}`);
        
        if (status === 200 && (data.success === true || data.data?.user || data.token)) {
          loginSuccess = true;
          console.log('✅ Login API success');
        } else {
          console.log(`⚠️ Login API returned ${status}: ${data.error || 'Unknown error'}`);
        }
      }
    } catch {
      // Continue to check URL
    }

    // Wait for redirect
    console.log('🔐 Waiting for redirect...');
    try {
      await page.waitForURL(/\/dashboard|\/admin|\/broker/, { timeout: 25000 });
      const currentUrl = page.url();
      console.log(`✅ Login successful - redirected to: ${currentUrl}`);
      return true;
    } catch {
      // Check current URL
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      
      if (currentUrl.includes('/dashboard') || currentUrl.includes('/admin') || currentUrl.includes('/broker')) {
        console.log(`✅ Login successful - on dashboard: ${currentUrl}`);
        return true;
      }
      
      if (loginSuccess) {
        // API said success, wait a bit more
        await page.waitForTimeout(3000);
        const finalUrl = page.url();
        if (finalUrl.includes('/dashboard') || finalUrl.includes('/admin') || finalUrl.includes('/broker')) {
          console.log(`✅ Login successful - final URL: ${finalUrl}`);
          return true;
        }
      }
      
      console.log(`❌ Login failed - still on: ${currentUrl}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Login error:', error);
    return false;
  }
}

test.describe('Production Authentication Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page first before accessing localStorage
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Clear state
    try {
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch {
      // Ignore if localStorage access is denied
    }
    
    await page.context().clearCookies();
    await page.waitForTimeout(1000);
  });

  test('✅ VERIFY: Registration and Login Work from Browser', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 PRODUCTION AUTHENTICATION VERIFICATION TEST');
    console.log('='.repeat(60));
    
    // Step 1: Register
    console.log('\n📝 REGISTRATION TEST');
    console.log('-'.repeat(60));
    const registered = await registerUser(page);
    
    if (!registered) {
      console.log('\n❌ REGISTRATION FAILED');
      console.log('='.repeat(60));
      throw new Error('Registration failed - user could not be registered');
    }
    
    console.log('\n✅ REGISTRATION SUCCESSFUL');
    console.log('='.repeat(60));
    
    // Wait a bit before login
    await page.waitForTimeout(3000);
    
    // Step 2: Login
    console.log('\n🔐 LOGIN TEST');
    console.log('-'.repeat(60));
    const loggedIn = await loginUser(page);
    
    if (!loggedIn) {
      console.log('\n❌ LOGIN FAILED');
      console.log('='.repeat(60));
      throw new Error('Login failed - user could not login');
    }
    
    // Verify we're on dashboard
    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    
    console.log('\n✅ LOGIN SUCCESSFUL');
    console.log('='.repeat(60));
    
    // Verify dashboard content is visible
    console.log('\n🏠 DASHBOARD VERIFICATION');
    console.log('-'.repeat(60));
    
    let dashboardContentVisible = false;
    const dashboardSelectors = [
      'h1, h2, h3',
      '[data-testid="dashboard"]',
      'text=/dashboard|welcome|portfolio|balance/i',
      'nav',
      'main',
      'header'
    ];
    
    for (const selector of dashboardSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 })) {
          dashboardContentVisible = true;
          const text = await element.textContent().catch(() => '');
          console.log(`✅ Dashboard content visible: ${selector.substring(0, 30)}...`);
          if (text) {
            console.log(`   Content preview: ${text.substring(0, 50)}...`);
          }
          break;
        }
      } catch {
        continue;
      }
    }
    
    // Get page title
    const pageTitle = await page.title().catch(() => '');
    console.log(`📄 Page title: ${pageTitle || 'Not available'}`);
    
    // Get page text preview
    const pageText = await page.textContent('body').catch(() => '');
    if (pageText) {
      const preview = pageText.substring(0, 200).replace(/\s+/g, ' ');
      console.log(`📄 Page content preview: ${preview}...`);
    }
    
    // Take screenshot of dashboard
    try {
      await page.screenshot({ 
        path: 'test-results/dashboard-verification.png',
        fullPage: false
      });
      console.log('📸 Dashboard screenshot saved: test-results/dashboard-verification.png');
    } catch {
      console.log('⚠️ Could not save screenshot');
    }
    
    console.log('='.repeat(60));
    console.log(`\n✅ FINAL VERIFICATION:`);
    console.log(`   - User registered: ✅`);
    console.log(`   - User logged in: ✅`);
    console.log(`   - Dashboard URL: ${finalUrl}`);
    console.log(`   - Dashboard content visible: ${dashboardContentVisible ? '✅' : '⚠️'}`);
    console.log(`   - Page title: ${pageTitle || 'N/A'}`);
    console.log('='.repeat(60));
    console.log('\n✅ ALL TESTS PASSED - AUTHENTICATION WORKS!');
    console.log(`✅ SUCCESSFULLY REACHED DASHBOARD: ${finalUrl}\n`);
    
    // Final assertions
    expect(registered).toBe(true);
    expect(loggedIn).toBe(true);
    expect(finalUrl).toMatch(/\/dashboard|\/admin|\/broker/);
    
    // Dashboard should have some content
    if (!dashboardContentVisible) {
      console.log('⚠️ Warning: Dashboard content not clearly visible, but URL is correct');
    }
  });
});
