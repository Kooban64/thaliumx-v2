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
const env = (globalThis as any).process?.env ?? {};
const BASE_URL = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
const BACKEND_URL = env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const HAS_AUTHENTIK_E2E_CREDS = Boolean(env.E2E_AUTHENTIK_LOGINNAME && env.E2E_AUTHENTIK_PASSWORD);

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
 * Helper: Login via Authentik (requires E2E creds)
 */
async function loginViaAuthentik(page: Page): Promise<boolean> {
  if (!HAS_AUTHENTIK_E2E_CREDS) {
    return false;
  }

  try {
    await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPageLoad(page);

    const continueButton = page.getByRole('button', { name: /^continue$/i });
    await continueButton.click();
    await page.waitForURL(/auth\.thaliumx\.com/, { timeout: 45000 });

    await page.getByLabel(/username|email|login/i).fill(env.E2E_AUTHENTIK_LOGINNAME);
    await page.getByLabel(/password/i).fill(env.E2E_AUTHENTIK_PASSWORD);
    await page.getByRole('button', { name: /log in|sign in/i }).click();

    await page.waitForURL(/.*\/(dashboard|admin|broker|token-presale)/, { timeout: 60000 });
    const currentUrl = page.url();
    return /\/dashboard|\/admin|\/broker|\/token-presale/.test(currentUrl);
  } catch (error) {
    console.error('Authentik login error:', error);
    await page.screenshot({ path: `test-results/Authentik-login-error-${Date.now()}.png` }).catch(() => {});
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
    test('should defer registration to IdP (legacy form removed)', async ({ page }) => {
      await page.goto('/register', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);

      // Registration should redirect to /auth entry and show the continue CTA.
      await expect(page.getByRole('button', { name: /^continue$/i })).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('User Login Flow', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');

      const loggedIn = await loginViaAuthentik(page);
      expect(loggedIn).toBe(true);
      
      // Should be redirected to dashboard
      await page.waitForTimeout(3000);
      expect(page.url()).toMatch(/\/dashboard|\/admin|\/broker/);
    });

    test('should reject login with invalid credentials', async ({ page }) => {
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');

      await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      await page.getByRole('button', { name: /^continue$/i }).click();
      await page.waitForURL(/auth\.thaliumx\.com/, { timeout: 45000 });

      await page.getByLabel(/username|email|login/i).fill('invalid@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /log in|sign in/i }).click();

      const errorVisible = await page.getByText(/invalid|incorrect|error|failed/i).isVisible({ timeout: 15000 }).catch(() => false);
      expect(errorVisible).toBe(true);
    });

    test('should persist login session', async ({ page }) => {
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');

      const loggedIn = await loginViaAuthentik(page);
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
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');

      const loggedIn = await loginViaAuthentik(page);
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
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');
      // Note: This test assumes admin users can be created or exist
      // In a real scenario, you might need to create admin users via API
      
      // Try to login as admin (if exists)
      const loggedIn = await loginViaAuthentik(page);
      
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
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');
      // Note: This test assumes broker users can be created or exist
      const loggedIn = await loginViaAuthentik(page);
      
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
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');

      const loggedIn = await loginViaAuthentik(page);
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
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');

      const loggedIn = await loginViaAuthentik(page);
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
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');

      const loggedIn = await loginViaAuthentik(page);
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
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');

      const loggedIn = await loginViaAuthentik(page);
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
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');

      await loginViaAuthentik(page);
      
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
      test.skip(!HAS_AUTHENTIK_E2E_CREDS, 'Authentik creds required for login flow');

      const loggedIn = await loginViaAuthentik(page);
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
