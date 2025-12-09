import { test, expect } from '@playwright/test';

// Test user credentials (seeded in database)
const TEST_USERS = {
  platformAdmin: {
    email: 'admin@thaliumx.com',
    password: 'AdminPass123!',
    role: 'admin',
    expectedRedirect: '/dashboard'
  },
  brokerAdmin: {
    email: 'broker@thaliumx.com',
    password: 'BrokerPass123!',
    role: 'broker-admin',
    expectedRedirect: '/dashboard'
  },
  trader: {
    email: 'trader@thaliumx.com',
    password: 'TraderPass123!',
    role: 'trader',
    expectedRedirect: '/dashboard'
  },
  basicUser: {
    email: 'user@thaliumx.com',
    password: 'UserPass123!',
    role: 'user',
    expectedRedirect: '/dashboard'
  },
  pendingKyc: {
    email: 'pending@thaliumx.com',
    password: 'PendingPass123!',
    role: 'pending-kyc',
    expectedRedirect: '/dashboard'
  },
  suspended: {
    email: 'suspended@thaliumx.com',
    password: 'SuspendedPass123!',
    role: 'suspended',
    expectedRedirect: '/auth' // Should not allow login
  }
};

test.describe('Authentication - Browser Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should display login form correctly', async ({ page }) => {
    await page.goto('/auth');

    // Check form elements
    await expect(page.locator('text=Welcome Back')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('text=Sign up')).toBeVisible();
    await expect(page.locator('text=Forgot password?')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/auth');
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=Email and password are required')).toBeVisible();
  });

  test('should show validation errors for invalid email', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid email format')).toBeVisible();
  });

  test('should successfully login platform admin', async ({ page }) => {
    await page.goto('/auth');

    // Fill login form
    await page.fill('input[type="email"]', TEST_USERS.platformAdmin.email);
    await page.fill('input[type="password"]', TEST_USERS.platformAdmin.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.url()).toContain('/dashboard');

    // Check if user info is displayed
    await expect(page.locator('text=Platform Admin')).toBeVisible();
  });

  test('should successfully login broker admin', async ({ page }) => {
    await page.goto('/auth');

    await page.fill('input[type="email"]', TEST_USERS.brokerAdmin.email);
    await page.fill('input[type="password"]', TEST_USERS.brokerAdmin.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard');
    await expect(page.url()).toContain('/dashboard');
    await expect(page.locator('text=Broker Admin')).toBeVisible();
  });

  test('should successfully login trader', async ({ page }) => {
    await page.goto('/auth');

    await page.fill('input[type="email"]', TEST_USERS.trader.email);
    await page.fill('input[type="password"]', TEST_USERS.trader.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard');
    await expect(page.url()).toContain('/dashboard');
    await expect(page.locator('text=John Trader')).toBeVisible();
  });

  test('should successfully login basic user', async ({ page }) => {
    await page.goto('/auth');

    await page.fill('input[type="email"]', TEST_USERS.basicUser.email);
    await page.fill('input[type="password"]', TEST_USERS.basicUser.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard');
    await expect(page.url()).toContain('/dashboard');
    await expect(page.locator('text=Jane User')).toBeVisible();
  });

  test('should handle pending KYC user login', async ({ page }) => {
    await page.goto('/auth');

    await page.fill('input[type="email"]', TEST_USERS.pendingKyc.email);
    await page.fill('input[type="password"]', TEST_USERS.pendingKyc.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard');
    await expect(page.url()).toContain('/dashboard');

    // Should show KYC warning
    await expect(page.locator('text=KYC Pending')).toBeVisible();
  });

  test('should reject suspended user login', async ({ page }) => {
    await page.goto('/auth');

    await page.fill('input[type="email"]', TEST_USERS.suspended.email);
    await page.fill('input[type="password"]', TEST_USERS.suspended.password);
    await page.click('button[type="submit"]');

    // Should stay on auth page or show error
    await expect(page.url()).toContain('/auth');
    await expect(page.locator('text=Account suspended')).toBeVisible();
  });

  test('should handle invalid credentials', async ({ page }) => {
    await page.goto('/auth');

    await page.fill('input[type="email"]', 'nonexistent@thaliumx.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should navigate to register form', async ({ page }) => {
    await page.goto('/auth');
    await page.click('text=Sign up');

    await expect(page.locator('text=Create Account')).toBeVisible();
    await expect(page.locator('input[placeholder*="first name" i]')).toBeVisible();
    await expect(page.locator('input[placeholder*="last name" i]')).toBeVisible();
  });

  test('should show password reset form', async ({ page }) => {
    await page.goto('/auth');
    await page.click('text=Forgot password?');

    await expect(page.locator('text=Reset Password')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('text=Send Reset Link')).toBeVisible();
  });

  test('should handle session persistence', async ({ page }) => {
    // Login first
    await page.goto('/auth');
    await page.fill('input[type="email"]', TEST_USERS.trader.email);
    await page.fill('input[type="password"]', TEST_USERS.trader.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Refresh page
    await page.reload();

    // Should still be logged in
    await expect(page.url()).toContain('/dashboard');
    await expect(page.locator('text=John Trader')).toBeVisible();
  });

  test('should handle logout correctly', async ({ page }) => {
    // Login first
    await page.goto('/auth');
    await page.fill('input[type="email"]', TEST_USERS.trader.email);
    await page.fill('input[type="password"]', TEST_USERS.trader.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Click logout
    await page.click('text=Sign Out');

    // Should redirect to auth page
    await page.waitForURL('**/auth');
    await expect(page.url()).toContain('/auth');

    // Try to access dashboard (should redirect back to auth)
    await page.goto('/dashboard');
    await page.waitForURL('**/auth');
    await expect(page.url()).toContain('/auth');
  });

  test('should handle rate limiting', async ({ page }) => {
    await page.goto('/auth');

    // Attempt multiple failed logins
    for (let i = 0; i < 6; i++) {
      await page.fill('input[type="email"]', 'nonexistent@thaliumx.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Wait for response
      await page.waitForTimeout(1000);
    }

    // Should show rate limit error
    await expect(page.locator('text=Too many attempts')).toBeVisible();
  });

  test('should handle MFA flow', async ({ page }) => {
    await page.goto('/auth');

    // Login with MFA-enabled user (platform admin)
    await page.fill('input[type="email"]', TEST_USERS.platformAdmin.email);
    await page.fill('input[type="password"]', TEST_USERS.platformAdmin.password);
    await page.click('button[type="submit"]');

    // Should show MFA input
    await expect(page.locator('text=Two-Factor Authentication')).toBeVisible();
    await expect(page.locator('input[placeholder="000000"]')).toBeVisible();

    // For testing, we'll assume MFA code '123456'
    await page.fill('input[placeholder="000000"]', '123456');
    await page.click('text=Verify Code');

    await page.waitForURL('**/dashboard');
    await expect(page.url()).toContain('/dashboard');
  });
});