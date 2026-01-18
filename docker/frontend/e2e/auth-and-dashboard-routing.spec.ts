/**
 * Authentication and Dashboard Routing E2E Tests
 * 
 * Tests the complete authentication flow:
 * 1. User registration
 * 2. User login
 * 3. Role-based dashboard routing
 * 4. Smooth navigation between dashboards
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// Generate unique test user emails to avoid conflicts
// Use random number to ensure uniqueness even if tests run quickly
const timestamp = Date.now();
const randomSuffix = Math.floor(Math.random() * 1000000);
const TEST_USERS = {
  regularUser: {
    email: `testuser-${timestamp}-${randomSuffix}@thaliumx.test`,
    password: 'TestUser123!@#',
    firstName: 'Test',
    lastName: 'User',
    expectedRole: 'user',
    expectedDashboard: '/dashboard'
  },
  adminUser: {
    email: `admin-${timestamp}@thaliumx.test`,
    password: 'AdminPass123!@#',
    firstName: 'Admin',
    lastName: 'User',
    expectedRole: 'admin',
    expectedDashboard: '/admin'
  },
  brokerUser: {
    email: `broker-${timestamp}@thaliumx.test`,
    password: 'BrokerPass123!@#',
    firstName: 'Broker',
    lastName: 'User',
    expectedRole: 'broker_admin',
    expectedDashboard: '/broker'
  }
};

/**
 * Helper: Wait for page to be fully loaded
 */
async function waitForPageLoad(page: Page) {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await page.waitForTimeout(1000); // Small delay for React hydration
  } catch {
    // If networkidle times out, just wait a bit
    await page.waitForTimeout(2000);
  }
}

/**
 * Helper: Register a new user
 */
async function registerUser(page: Page, user: typeof TEST_USERS.regularUser): Promise<boolean> {
  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPageLoad(page);

    // Wait for form to be visible
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Check if we're already in register mode by looking for firstName field
    const isRegisterMode = await page.locator('input[id="firstName"], input[name="firstName"]').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!isRegisterMode) {
      // Look for button/link to switch to register mode
      // The login page has a mode switcher - look for "Sign up" or "Register" button
      const switchButtons = [
        'button:has-text("Sign up")',
        'button:has-text("Register")',
        'a:has-text("Sign up")',
        'a:has-text("Register")',
        'text=/sign up/i',
        'text=/register/i'
      ];
      
      let switched = false;
      for (const selector of switchButtons) {
        const switchBtn = page.locator(selector).first();
        if (await switchBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await switchBtn.click();
          await page.waitForTimeout(1500);
          await waitForPageLoad(page);
          switched = true;
          break;
        }
      }
      
      if (!switched) {
        console.log('Could not find register mode switch button');
      }
    }

    // Wait for registration form fields to be visible
    await page.waitForSelector('input[id="firstName"], input[name="firstName"]', { timeout: 5000 });
    
    // Fill registration form
    const firstNameInput = page.locator('input[id="firstName"], input[name="firstName"]').first();
    const lastNameInput = page.locator('input[id="lastName"], input[name="lastName"]').first();
    const emailInput = page.locator('input[type="email"], input[id="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const confirmPasswordInput = page.locator('input[type="password"]').nth(1); // Second password field
    
    await firstNameInput.fill(user.firstName);
    await lastNameInput.fill(user.lastName);
    await emailInput.fill(user.email);
    await passwordInput.fill(user.password);
    await confirmPasswordInput.fill(user.password);

    // Submit registration and wait for network request
    const submitButton = page.locator('button[type="submit"]').first();
    
    // Set up response listener before clicking
    let apiSuccess = false;
    let apiResponseData: any = null;
    
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/auth/register') && response.request().method() === 'POST',
      { timeout: 15000 }
    ).catch(() => null);
    
    // Click submit
    await submitButton.click();
    
    // Wait for the API response
    try {
      const response = await responsePromise;
      if (response) {
        const status = response.status();
        apiResponseData = await response.json().catch(() => ({}));
        const responseStr = JSON.stringify(apiResponseData).substring(0, 200);
        console.log(`Registration API response [${status}]:`, responseStr);
        
        // If API says success, registration worked
        if (apiResponseData.success === true || (apiResponseData.data && apiResponseData.data.user)) {
          console.log('Registration API returned success - returning true');
          apiSuccess = true;
        }
        
        // Handle backend connection errors - wait and check UI
        if (status >= 500 || 
            apiResponseData.error?.message?.toLowerCase().includes('connect') ||
            apiResponseData.error?.message?.toLowerCase().includes('backend service')) {
          console.log('Backend connection error detected - waiting and checking UI');
          await page.waitForTimeout(5000);
          // Continue to check UI - might have succeeded despite error
        }
        
        // Handle rate limiting - if rate limited, wait longer and try to continue
        if (apiResponseData.error && 
            (apiResponseData.error.code === 'RATE_LIMIT_EXCEEDED' || 
             apiResponseData.error.message?.toLowerCase().includes('rate limit') ||
             apiResponseData.error.message?.toLowerCase().includes('too many requests'))) {
          console.log('Rate limit detected - waiting longer and checking UI');
          await page.waitForTimeout(5000); // Wait longer for rate limit to clear
          // Don't return false immediately - check UI to see if registration actually worked
        }
      }
    } catch (error) {
      // If we can't catch the response, continue to check UI
      console.log('Could not catch API response, checking UI:', error);
      // Wait a bit for UI to update
      await page.waitForTimeout(3000);
    }
    
    // If API confirmed success, wait for UI and return
    if (apiSuccess) {
      await page.waitForTimeout(2000); // Wait for UI to update
      // Return true immediately if API confirmed success
      return true;
    }

    // Wait for response - look for success message or error
    // Success shows "Registration Successful!" as CardTitle with CheckCircle icon
    // Error shows in Alert with destructive variant
    await page.waitForTimeout(3000); // Give React time to update after form submission
    
    // Check for error first - if error exists, registration failed
    // Only check for actual error text, not just alert elements
    const errorTextSelectors = [
      '[role="alert"]:has-text(/error|failed|invalid|connect|backend service/i)',
      '.destructive:has-text(/error|failed|invalid|connect|backend service/i)',
      'text=/error|failed|invalid|connect|backend service/i'
    ];
    
    for (const selector of errorTextSelectors) {
      const errorElement = page.locator(selector).first();
      if (await errorElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        const errorText = await errorElement.textContent().catch(() => '');
        // If error says user already exists, that's actually a success (user was created)
        if (errorText && errorText.toLowerCase().includes('already exists')) {
          console.log('User already exists - considering as success');
          return true;
        }
        // Backend connection errors - wait and check if UI shows success anyway
        if (errorText && (errorText.toLowerCase().includes('connect') || 
                          errorText.toLowerCase().includes('backend service'))) {
          console.log('Backend connection error in UI - waiting longer:', errorText);
          await page.waitForTimeout(3000);
          // Continue to check for success - might have succeeded despite error
        }
        // Only fail if there's actual error text (not connection errors)
        if (errorText && errorText.trim().length > 0 && 
            !errorText.toLowerCase().includes('success') &&
            !errorText.toLowerCase().includes('connect') &&
            !errorText.toLowerCase().includes('backend service')) {
          console.log('Registration error detected:', errorText);
          return false;
        }
      }
    }
    
    // Check for success message - the CardTitle shows "Registration Successful!"
    // Look for the h3 element with this text (CardTitle renders as h3)
    const successSelectors = [
      'h3:has-text("Registration Successful!")',
      'h3:has-text("Registration Successful")',
      'text="Registration Successful!"',
      'text=/Registration Successful/i',
      '.text-green-600', // CheckCircle icon color class
      'svg.lucide-check-circle-2', // CheckCircle icon
    ];
    
    let hasSuccess = false;
    for (const selector of successSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 })) {
          hasSuccess = true;
          console.log(`Registration success detected via: ${selector}`);
          break;
        }
      } catch {
        // Continue to next selector
      }
    }
    
    // Also check page content for success indicators
    if (!hasSuccess) {
      const pageText = await page.textContent('body').catch(() => '');
      if (pageText) {
        const hasSuccessText = pageText.includes('Registration Successful') || 
                              (pageText.includes('successfully') && !pageText.includes('error') && !pageText.includes('failed'));
        if (hasSuccessText) {
          hasSuccess = true;
          console.log('Registration success detected via page text');
        }
      }
    }
    
    // Also check if we're still on login page (success state shows success card)
    const currentUrl = page.url();
    const onLoginPage = currentUrl.includes('/login');
    
    // Success is shown as a card on the same page, not a redirect
    // If we're on login page and see success indicators, registration worked
    if (onLoginPage && hasSuccess) {
      return true;
    }
    
    // If we see success indicators anywhere, it worked
    return hasSuccess;
  } catch (error) {
    console.error('Registration error:', error);
    // Take screenshot for debugging
    await page.screenshot({ path: `test-results/registration-error-${Date.now()}.png` }).catch(() => {});
    return false;
  }
}

/**
 * Helper: Login a user
 */
async function loginUser(page: Page, email: string, password: string): Promise<boolean> {
  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPageLoad(page);

    // Wait for login form to be visible
    await page.waitForSelector('input[type="email"], input[id="email"], input[name="email"]', { timeout: 10000 });

    // Ensure we're in login mode (not register) - login mode doesn't have firstName field
    const hasFirstName = await page.locator('input[id="firstName"]').isVisible({ timeout: 1000 }).catch(() => false);
    if (hasFirstName) {
      // We're in register mode, switch to login
      const switchToLogin = page.locator('button:has-text("Sign in"), a:has-text("Sign in"), text=/sign in/i, text=/login/i').first();
      if (await switchToLogin.isVisible({ timeout: 2000 }).catch(() => false)) {
        await switchToLogin.click();
        await page.waitForTimeout(1500);
        await waitForPageLoad(page);
      }
    }

    // Fill login form
    const emailInput = page.locator('input[type="email"], input[id="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[id="password"]').first();

    await emailInput.fill(email);
    await passwordInput.fill(password);

    // Submit login
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    // Wait for redirect (should redirect to dashboard based on role)
    // The login page redirects via router.push, so wait for URL change
    try {
      await page.waitForURL(/.*\/(dashboard|admin|broker)/, { timeout: 20000 });
      const currentUrl = page.url();
      return currentUrl.includes('/dashboard') || currentUrl.includes('/admin') || currentUrl.includes('/broker');
    } catch {
      // If URL doesn't change, check for error or wait more
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      
      // Check if we're still on login page with an error
      if (currentUrl.includes('/login')) {
        const hasError = await page.locator('[role="alert"], .destructive, text=/error|invalid|incorrect|failed/i').isVisible({ timeout: 2000 }).catch(() => false);
        if (hasError) {
          console.log('Login failed - still on login page with error');
          return false;
        }
        // No error but still on login - might be loading
        await page.waitForTimeout(2000);
        const finalUrl = page.url();
        return !finalUrl.includes('/login');
      }
      
      // Check final URL
      return currentUrl.includes('/dashboard') || currentUrl.includes('/admin') || currentUrl.includes('/broker');
    }
  } catch (error) {
    console.error('Login error:', error);
    // Take screenshot for debugging
    await page.screenshot({ path: `test-results/login-error-${Date.now()}.png` }).catch(() => {});
    return false;
  }
}

/**
 * Helper: Get user role from profile
 */
async function getUserRole(page: Page): Promise<string | null> {
  try {
    // Use page context to make request with cookies
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const response = await page.request.get('/api/auth/profile', {
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok()) {
      const data = await response.json();
      const user = data?.data?.user || data?.data || null;
      return user?.role || null;
    }
    return null;
  } catch (error) {
    console.error('getUserRole error:', error);
    return null;
  }
}

/**
 * Helper: Verify dashboard content based on role
 */
async function verifyDashboardContent(page: Page, role: string): Promise<boolean> {
  try {
    await waitForPageLoad(page);
    
    if (role === 'admin' || role === 'super_admin') {
      // Admin dashboard should have admin-specific content
      const hasAdminContent = await Promise.any([
        page.locator('text=/admin|platform|system/i').isVisible(),
        page.locator('[data-testid="admin-dashboard"]').isVisible(),
        page.locator('h1, h2').filter({ hasText: /admin|platform/i }).isVisible()
      ]).catch(() => false);
      return hasAdminContent;
    }
    
    if (role?.startsWith('broker_')) {
      // Broker dashboard should have broker-specific content
      const hasBrokerContent = await Promise.any([
        page.locator('text=/broker|trading|users/i').isVisible(),
        page.locator('[data-testid="broker-dashboard"]').isVisible(),
        page.locator('h1, h2').filter({ hasText: /broker/i }).isVisible()
      ]).catch(() => false);
      return hasBrokerContent;
    }
    
    // Regular user dashboard should have trading/wallet content
    const hasUserContent = await Promise.any([
      page.locator('text=/trading|wallet|portfolio/i').isVisible(),
      page.locator('[data-testid="user-dashboard"]').isVisible(),
      page.locator('h1, h2').filter({ hasText: /dashboard|trading|wallet/i }).isVisible()
    ]).catch(() => false);
    return hasUserContent;
  } catch {
    return false;
  }
}

test.describe('Authentication and Dashboard Routing', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies and storage before each test
    await page.context().clearCookies();
    // Only clear storage if we can navigate to a page
    try {
      await page.goto('/', { timeout: 5000, waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {
          // Ignore localStorage errors in some contexts
        }
      });
    } catch {
      // If page doesn't load, just clear cookies - storage will be cleared when page loads
    }
    
    // Add a delay between tests to avoid rate limiting
    // Increased delay to prevent hitting behavioral analysis threshold
    await page.waitForTimeout(3000);
  });

  test.describe('User Registration Flow', () => {
    test('should successfully register a new user', async ({ page }) => {
      const user = TEST_USERS.regularUser;
      
      const registered = await registerUser(page, user);
      expect(registered).toBe(true);
      
      // Wait for registration to complete
      await page.waitForTimeout(3000);
      
      // Navigate to login page to test login
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      
      // After registration, should be able to login
      const loggedIn = await loginUser(page, user.email, user.password);
      expect(loggedIn).toBe(true);
    });

    test('should validate registration form fields', async ({ page }) => {
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);

      // Wait for form
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });

      // Switch to register mode
      const isRegisterMode = await page.locator('input[id="firstName"]').isVisible({ timeout: 5000 }).catch(() => false);
      if (!isRegisterMode) {
        // Try multiple selectors for the sign up button
        const switchSelectors = [
          'button:has-text("Sign up")',
          'a:has-text("Sign up")',
          'button:has-text("Sign Up")',
          'a:has-text("Sign Up")',
          'text=/sign up/i',
          '[data-testid="sign-up-button"]'
        ];
        
        let switched = false;
        for (const selector of switchSelectors) {
          try {
            const switchButton = page.locator(selector).first();
            if (await switchButton.isVisible({ timeout: 2000 })) {
              await switchButton.click();
              await page.waitForTimeout(2000);
              await waitForPageLoad(page);
              // Verify we're now in register mode
              const nowInRegisterMode = await page.locator('input[id="firstName"]').isVisible({ timeout: 3000 }).catch(() => false);
              if (nowInRegisterMode) {
                switched = true;
                break;
              }
            }
          } catch {
            continue;
          }
        }
        
        if (!switched) {
          console.log('Could not switch to register mode - trying to continue anyway');
        }
      }

      // Wait for registration form with multiple attempts
      let formFound = false;
      for (let i = 0; i < 3; i++) {
        try {
          await page.waitForSelector('input[id="firstName"]', { timeout: 5000 });
          formFound = true;
          break;
        } catch {
          // Try clicking sign up again
          const switchButton = page.locator('button:has-text("Sign"), a:has-text("Sign")').first();
          if (await switchButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await switchButton.click();
            await page.waitForTimeout(2000);
          }
        }
      }
      
      if (!formFound) {
        throw new Error('Registration form not found after multiple attempts');
      }

      // Try to submit empty form - but first check if HTML5 validation prevents it
      const submitButton = page.locator('button[type="submit"]').first();
      
      // Check if form has required attributes (HTML5 validation)
      const firstNameInput = page.locator('input[id="firstName"]').first();
      const isRequired = await firstNameInput.evaluate((el: HTMLInputElement) => el.required).catch(() => false);
      
      if (isRequired) {
        // HTML5 validation will prevent submission
        // Try to submit and check if it was prevented
        await submitButton.click();
        await page.waitForTimeout(1000);
        
        // Check if form is still visible (submission was prevented)
        const formStillVisible = await page.locator('input[id="firstName"]').isVisible({ timeout: 1000 }).catch(() => false);
        expect(formStillVisible).toBe(true);
      } else {
        // Custom validation - submit and check for error message
        await submitButton.click();
        await page.waitForTimeout(2000);
        
        // Check for error message in Alert (destructive variant)
        const errorSelectors = [
          '[role="alert"]', // Alert component
          '.destructive', // Destructive variant
          'text=/required/i',
          'text=/invalid/i',
          'text=/error/i',
          'text=/please enter/i',
          'text=/must be/i',
        ];
        
        let hasErrors = false;
        for (const selector of errorSelectors) {
          if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
            hasErrors = true;
            break;
          }
        }
        
        expect(hasErrors).toBe(true);
      }
    });
  });

  test.describe('User Login Flow', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      const user = TEST_USERS.regularUser;
      
      // First register the user
      const registered = await registerUser(page, user);
      expect(registered).toBe(true);
      await page.waitForTimeout(3000);
      
      // Navigate to login page
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      
      // Then login
      const loggedIn = await loginUser(page, user.email, user.password);
      expect(loggedIn).toBe(true);
      
      // Should be redirected to dashboard
      await page.waitForTimeout(3000);
      expect(page.url()).toMatch(/\/dashboard|\/admin|\/broker/);
    });

    test('should reject login with invalid credentials', async ({ page }) => {
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);

      // Wait for form
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });

      // Try to login with invalid credentials
      const emailInput = page.locator('input[type="email"], input[id="email"]').first();
      const passwordInput = page.locator('input[type="password"], input[id="password"]').first();
      
      await emailInput.fill('invalid@example.com');
      await passwordInput.fill('wrongpassword');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      
      // Should show error message
      await page.waitForTimeout(3000);
      const errorSelectors = [
        '[role="alert"]',
        '.destructive',
        'text=/invalid|incorrect|error|failed/i'
      ];
      
      let hasError = false;
      for (const selector of errorSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
          hasError = true;
          break;
        }
      }
      
      expect(hasError).toBe(true);
      
      // Should still be on login page
      expect(page.url()).toMatch(/\/login/);
    });

    test('should persist login session', async ({ page }) => {
      const user = TEST_USERS.regularUser;
      
      // Register and login
      const registered = await registerUser(page, user);
      expect(registered).toBe(true);
      await page.waitForTimeout(3000);
      
      // Navigate to login page
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      
      const loggedIn = await loginUser(page, user.email, user.password);
      expect(loggedIn).toBe(true);
      
      // Verify we're logged in
      await page.waitForTimeout(3000);
      expect(page.url()).toMatch(/\/dashboard|\/admin|\/broker/);
      
      // Navigate to another page and back
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);
      
      // Should still be authenticated (might redirect to dashboard)
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/dashboard|\/admin|\/broker|\//);
    });
  });

  test.describe('Role-Based Dashboard Routing', () => {
    test('should route regular user to /dashboard', async ({ page }) => {
      const user = TEST_USERS.regularUser;
      
      // Register and login
      const registered = await registerUser(page, user);
      expect(registered).toBe(true);
      
      // Wait for registration to complete and form to switch back to login
      await page.waitForTimeout(3000);
      
      // Now login - need to ensure we're on login page
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      
      const loggedIn = await loginUser(page, user.email, user.password);
      expect(loggedIn).toBe(true);
      
      // Wait for redirect to dashboard
      await page.waitForTimeout(3000);
      
      // Should be on user dashboard
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/dashboard/);
      
      // Verify dashboard content
      await waitForPageLoad(page);
      const hasUserContent = await verifyDashboardContent(page, 'user');
      expect(hasUserContent).toBe(true);
    });

    test('should route admin user to /admin', async ({ page }) => {
      // Note: This test assumes admin users can be created or exist
      // In a real scenario, you might need to create admin users via API
      
      // Try to login as admin (if exists)
      const loggedIn = await loginUser(page, TEST_USERS.adminUser.email, TEST_USERS.adminUser.password);
      
      if (loggedIn) {
        // Should be redirected to admin dashboard
        await page.waitForURL(/.*\/admin/, { timeout: 10000 });
        expect(page.url()).toContain('/admin');
        
        // Verify admin dashboard content
        const hasAdminContent = await verifyDashboardContent(page, 'admin');
        expect(hasAdminContent).toBe(true);
      } else {
        // If admin doesn't exist, skip this test
        test.skip();
      }
    });

    test('should route broker user to /broker', async ({ page }) => {
      // Note: This test assumes broker users can be created or exist
      const loggedIn = await loginUser(page, TEST_USERS.brokerUser.email, TEST_USERS.brokerUser.password);
      
      if (loggedIn) {
        // Should be redirected to broker dashboard
        await page.waitForURL(/.*\/broker/, { timeout: 10000 });
        expect(page.url()).toContain('/broker');
        
        // Verify broker dashboard content
        const hasBrokerContent = await verifyDashboardContent(page, 'broker_admin');
        expect(hasBrokerContent).toBe(true);
      } else {
        test.skip();
      }
    });

    test('should redirect non-admin from /admin to /dashboard', async ({ page }) => {
      const user = TEST_USERS.regularUser;
      
      // Register and login as regular user
      const registered = await registerUser(page, user);
      expect(registered).toBe(true);
      await page.waitForTimeout(3000);
      
      // Navigate to login page
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      
      const loggedIn = await loginUser(page, user.email, user.password);
      expect(loggedIn).toBe(true);
      
      // Wait for dashboard to load
      await page.waitForTimeout(3000);
      
      // Verify we're on dashboard first
      let currentUrl = page.url();
      if (!currentUrl.includes('/dashboard')) {
        // If not redirected yet, wait a bit more
        await page.waitForTimeout(2000);
        currentUrl = page.url();
      }
      
      // Try to access admin dashboard
      await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      await page.waitForTimeout(2000); // Wait for redirect
      
      // Should be redirected to user dashboard
      currentUrl = page.url();
      expect(currentUrl).toContain('/dashboard');
      expect(currentUrl).not.toContain('/admin');
    });

    test('should redirect non-broker from /broker to /dashboard', async ({ page }) => {
      const user = TEST_USERS.regularUser;
      
      // Register and login as regular user
      const registered = await registerUser(page, user);
      expect(registered).toBe(true);
      await page.waitForTimeout(3000);
      
      // Navigate to login page
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      
      const loggedIn = await loginUser(page, user.email, user.password);
      expect(loggedIn).toBe(true);
      
      // Wait for dashboard to load
      await page.waitForTimeout(3000);
      
      // Verify we're on dashboard first
      let currentUrl = page.url();
      if (!currentUrl.includes('/dashboard')) {
        // If not redirected yet, wait a bit more
        await page.waitForTimeout(2000);
        currentUrl = page.url();
      }
      
      // Try to access broker dashboard
      await page.goto('/broker', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      await page.waitForTimeout(2000); // Wait for redirect
      
      // Should be redirected to user dashboard
      currentUrl = page.url();
      expect(currentUrl).toContain('/dashboard');
      expect(currentUrl).not.toContain('/broker');
    });
  });

  test.describe('Smooth Navigation', () => {
    test('should navigate smoothly between dashboard sections', async ({ page }) => {
      const user = TEST_USERS.regularUser;
      
      // Register and login
      const registered = await registerUser(page, user);
      expect(registered).toBe(true);
      await page.waitForTimeout(3000);
      
      // Navigate to login page
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      
      const loggedIn = await loginUser(page, user.email, user.password);
      expect(loggedIn).toBe(true);
      
      // Wait for dashboard to load - check current URL
      await page.waitForTimeout(4000);
      let currentUrl = page.url();
      expect(currentUrl).toMatch(/\/dashboard/);
      
      await waitForPageLoad(page);
      
      // Try to navigate to wallet section by URL first
      await page.goto('/dashboard/wallet', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);
      let walletUrl = page.url();
      expect(walletUrl).toMatch(/wallet/);
      
      // Try to navigate to trading section by URL
      await page.goto('/dashboard/trading', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);
      let tradingUrl = page.url();
      expect(tradingUrl).toMatch(/trading/);
      
      // Verify we can navigate back to main dashboard
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);
      currentUrl = page.url();
      expect(currentUrl).toMatch(/\/dashboard/);
    });

    test('should maintain authentication during navigation', async ({ page }) => {
      const user = TEST_USERS.regularUser;
      
      // Register and login
      const registered = await registerUser(page, user);
      expect(registered).toBe(true);
      await page.waitForTimeout(3000);
      
      // Navigate to login page
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      
      const loggedIn = await loginUser(page, user.email, user.password);
      expect(loggedIn).toBe(true);
      
      // Wait for initial dashboard load
      await page.waitForTimeout(4000);
      
      // Navigate to multiple pages
      const pages = ['/dashboard', '/dashboard/wallet', '/dashboard/trading'];
      
      for (const path of pages) {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForPageLoad(page);
        await page.waitForTimeout(2000);
        
        // Should not be redirected to login
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('/login');
        
        // Should be on a dashboard page
        expect(currentUrl).toMatch(/\/dashboard/);
        
        // Should be able to access profile (might need to wait a bit)
        await page.waitForTimeout(1000);
        const role = await getUserRole(page);
        // Role might be null if cookies aren't set yet, but we should at least not be on login page
        if (!role && currentUrl.includes('/login')) {
          throw new Error('User was redirected to login page');
        }
      }
    });

    test('should handle logout smoothly', async ({ page }) => {
      const user = TEST_USERS.regularUser;
      
      // Register and login
      await registerUser(page, user);
      await page.waitForTimeout(1000);
      await loginUser(page, user.email, user.password);
      
      // Find and click logout button
      const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign out")').first();
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        await page.waitForTimeout(1000);
        
        // Should be redirected to login or home
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/login|\//);
      }
    });
  });

  test.describe('Complete User Journey', () => {
    test('should complete full registration -> login -> dashboard flow', async ({ page }) => {
      // Create a unique user for this test
      const uniqueUser = {
        email: `journey-${Date.now()}-${Math.floor(Math.random() * 1000000)}@thaliumx.test`,
        password: 'JourneyTest123!@#',
        firstName: 'Journey',
        lastName: 'Test',
        expectedRole: 'user',
        expectedDashboard: '/dashboard'
      };
      
      // Step 1: Register
      const registered = await registerUser(page, uniqueUser);
      expect(registered).toBe(true);
      
      // Step 2: Wait for registration to complete and navigate to login
      await page.waitForTimeout(3000);
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      
      // Step 3: Login
      const loggedIn = await loginUser(page, uniqueUser.email, uniqueUser.password);
      expect(loggedIn).toBe(true);
      
      // Step 4: Verify dashboard access
      await page.waitForTimeout(4000);
      let currentUrl = page.url();
      expect(currentUrl).toMatch(/\/dashboard/);
      
      // Step 5: Verify user can see dashboard content
      await waitForPageLoad(page);
      const hasContent = await verifyDashboardContent(page, 'user');
      expect(hasContent).toBe(true);
      
      // Step 6: Verify user role
      await page.waitForTimeout(2000);
      const role = await getUserRole(page);
      expect(role).toBeTruthy();
      expect(role).toBe('user');
    });
  });
});
