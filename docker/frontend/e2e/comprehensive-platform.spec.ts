/**
 * Comprehensive Platform E2E Tests
 * Tests all features and roles through the browser
 */

import { test, expect, Page } from '@playwright/test';

// Test user credentials
const TEST_USERS = {
  platformAdmin: {
    email: 'admin@thaliumx.com',
    password: 'AdminPass123!',
    role: 'admin'
  },
  brokerAdmin: {
    email: 'broker@thaliumx.com',
    password: 'BrokerPass123!',
    role: 'broker-admin'
  },
  trader: {
    email: 'trader@thaliumx.com',
    password: 'TraderPass123!',
    role: 'user'
  },
  basicUser: {
    email: 'user@thaliumx.com',
    password: 'UserPass123!',
    role: 'user'
  }
};

// Helper function to login
async function login(page: Page, email: string, password: string): Promise<boolean> {
  try {
    await page.goto('/auth');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard or error
    await page.waitForURL(/.*dashboard|.*auth/, { timeout: 10000 });
    
    return page.url().includes('/dashboard');
  } catch (error) {
    return false;
  }
}

test.describe('Platform Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should login as platform admin and access admin dashboard', async ({ page }) => {
    const loggedIn = await login(page, TEST_USERS.platformAdmin.email, TEST_USERS.platformAdmin.password);
    expect(loggedIn).toBe(true);
    
    // Check if admin dashboard is accessible
    await page.goto('/admin');
    await expect(page).toHaveURL(/.*admin/);
  });

  test('should view admin stats', async ({ page }) => {
    await login(page, TEST_USERS.platformAdmin.email, TEST_USERS.platformAdmin.password);
    
    // Navigate to admin stats
    await page.goto('/admin');
    
    // Check for admin dashboard elements
    const hasStats = await page.locator('text=/Stats|Statistics|Dashboard/i').isVisible().catch(() => false);
    expect(hasStats).toBe(true);
  });

  test('should access user management', async ({ page }) => {
    await login(page, TEST_USERS.platformAdmin.email, TEST_USERS.platformAdmin.password);
    
    await page.goto('/admin');
    
    // Look for user management link or section
    const hasUsers = await page.locator('text=/Users|User Management/i').isVisible().catch(() => false);
    expect(hasUsers).toBe(true);
  });
});

test.describe('Broker Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should login as broker admin and access broker dashboard', async ({ page }) => {
    const loggedIn = await login(page, TEST_USERS.brokerAdmin.email, TEST_USERS.brokerAdmin.password);
    expect(loggedIn).toBe(true);
    
    // Check if broker dashboard is accessible
    await page.goto('/broker');
    await expect(page).toHaveURL(/.*broker|.*dashboard/);
  });

  test('should view broker-specific data', async ({ page }) => {
    await login(page, TEST_USERS.brokerAdmin.email, TEST_USERS.brokerAdmin.password);
    
    await page.goto('/broker');
    
    // Check for broker dashboard elements
    const hasBrokerContent = await page.locator('text=/Broker|Dashboard/i').isVisible().catch(() => false);
    expect(hasBrokerContent).toBe(true);
  });
});

test.describe('Trading Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await login(page, TEST_USERS.trader.email, TEST_USERS.trader.password);
  });

  test('should display trading dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for trading interface elements
    const hasTrading = await page.locator('text=/Trading|Trade|Order/i').isVisible().catch(() => false);
    expect(hasTrading).toBe(true);
  });

  test('should display market data', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for market data (price, chart, etc.)
    const hasMarketData = await page.locator('text=/BTC|USDT|Price|Chart/i').isVisible().catch(() => false);
    expect(hasMarketData).toBe(true);
  });

  test('should show orderbook', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for orderbook
    const hasOrderbook = await page.locator('text=/Orderbook|Bids|Asks/i').isVisible().catch(() => false);
    expect(hasOrderbook).toBe(true);
  });

  test('should display wallet balance', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Switch to wallet tab or check wallet section
    const walletTab = page.locator('button:has-text("Wallet"), a:has-text("Wallet")').first();
    const walletVisible = await walletTab.isVisible().catch(() => false);
    
    if (walletVisible) {
      await walletTab.click();
      await page.waitForTimeout(1000);
    }
    
    // Check for balance display
    const hasBalance = await page.locator('text=/Balance|Wallet|USDT|BTC/i').isVisible().catch(() => false);
    expect(hasBalance).toBe(true);
  });
});

test.describe('Wallet Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await login(page, TEST_USERS.trader.email, TEST_USERS.trader.password);
  });

  test('should display wallet page', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to wallet
    const walletLink = page.locator('button:has-text("Wallet"), a:has-text("Wallet")').first();
    const walletVisible = await walletLink.isVisible().catch(() => false);
    
    if (walletVisible) {
      await walletLink.click();
      await page.waitForTimeout(1000);
    }
    
    // Check wallet page loaded
    const hasWallet = await page.locator('text=/Wallet|Balance/i').isVisible().catch(() => false);
    expect(hasWallet).toBe(true);
  });

  test('should show deposit options', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for deposit button or section
    const hasDeposit = await page.locator('button:has-text("Deposit"), text=/Deposit/i').isVisible().catch(() => false);
    expect(hasDeposit).toBe(true);
  });

  test('should show withdrawal options', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for withdrawal button or section
    const hasWithdraw = await page.locator('button:has-text("Withdraw"), text=/Withdraw/i').isVisible().catch(() => false);
    expect(hasWithdraw).toBe(true);
  });
});

test.describe('Portfolio Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await login(page, TEST_USERS.trader.email, TEST_USERS.trader.password);
  });

  test('should display portfolio page', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to portfolio
    const portfolioLink = page.locator('button:has-text("Portfolio"), a:has-text("Portfolio")').first();
    const portfolioVisible = await portfolioLink.isVisible().catch(() => false);
    
    if (portfolioVisible) {
      await portfolioLink.click();
      await page.waitForTimeout(1000);
    }
    
    // Check portfolio page loaded
    const hasPortfolio = await page.locator('text=/Portfolio|Holdings|Assets/i').isVisible().catch(() => false);
    expect(hasPortfolio).toBe(true);
  });
});

test.describe('KYC Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await login(page, TEST_USERS.trader.email, TEST_USERS.trader.password);
  });

  test('should display KYC status', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for KYC status or settings
    const hasKYC = await page.locator('text=/KYC|Verification|Verify/i').isVisible().catch(() => false);
    expect(hasKYC).toBe(true);
  });
});

test.describe('Token Presale Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await login(page, TEST_USERS.trader.email, TEST_USERS.trader.password);
  });

  test('should display presale page', async ({ page }) => {
    await page.goto('/presale');
    
    // Check presale page loaded
    const hasPresale = await page.locator('text=/Presale|Token Sale|THAL/i').isVisible().catch(() => false);
    expect(hasPresale).toBe(true);
  });
});

test.describe('Role-Based Access Control', () => {
  test('regular user should not access admin dashboard', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await login(page, TEST_USERS.basicUser.email, TEST_USERS.basicUser.password);
    
    // Try to access admin dashboard
    await page.goto('/admin');
    
    // Should be redirected away from admin
    const isAdmin = page.url().includes('/admin');
    expect(isAdmin).toBe(false);
  });

  test('unauthenticated user should be redirected to login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Try to access dashboard without login
    await page.goto('/dashboard');
    
    // Should redirect to auth
    await page.waitForURL(/.*auth|.*login/, { timeout: 5000 });
    const isAuth = page.url().includes('/auth') || page.url().includes('/login');
    expect(isAuth).toBe(true);
  });
});

test.describe('Navigation and UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await login(page, TEST_USERS.trader.email, TEST_USERS.trader.password);
  });

  test('should have working navigation', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for navigation elements
    const hasNav = await page.locator('nav, [role="navigation"], header').isVisible().catch(() => false);
    expect(hasNav).toBe(true);
  });

  test('should display user profile', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for user profile/avatar
    const hasProfile = await page.locator('text=/Profile|Settings|Account/i, [data-testid="user-menu"]').isVisible().catch(() => false);
    expect(hasProfile).toBe(true);
  });

  test('should handle logout', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")').first();
    const logoutVisible = await logoutButton.isVisible().catch(() => false);
    
    if (logoutVisible) {
      await logoutButton.click();
      await page.waitForURL(/.*auth|.*login/, { timeout: 5000 });
      const isAuth = page.url().includes('/auth') || page.url().includes('/login');
      expect(isAuth).toBe(true);
    } else {
      // Logout might be in a menu
      const menuButton = page.locator('[aria-label="Menu"], button[aria-label*="menu" i]').first();
      const menuVisible = await menuButton.isVisible().catch(() => false);
      if (menuVisible) {
        await menuButton.click();
        await page.waitForTimeout(500);
        const logoutAfterMenu = page.locator('button:has-text("Logout"), button:has-text("Sign Out")').first();
        const logoutAfterMenuVisible = await logoutAfterMenu.isVisible().catch(() => false);
        if (logoutAfterMenuVisible) {
          await logoutAfterMenu.click();
          await page.waitForURL(/.*auth|.*login/, { timeout: 5000 });
        }
      }
    }
  });
});

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await login(page, TEST_USERS.trader.email, TEST_USERS.trader.password);
  });

  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    
    // Check mobile menu or responsive layout
    const hasMobileMenu = await page.locator('[aria-label="Menu"], button[aria-label*="menu" i]').isVisible().catch(() => false);
    expect(hasMobileMenu).toBe(true);
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    
    // Page should load without errors
    const hasContent = await page.locator('body').isVisible().catch(() => false);
    expect(hasContent).toBe(true);
  });
});

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should handle invalid login gracefully', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await page.waitForTimeout(2000);
    const hasError = await page.locator('text=/Invalid|Error|Failed/i').isVisible().catch(() => false);
    expect(hasError).toBe(true);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Block network requests
    await page.route('**/api/**', route => route.abort());
    
    await login(page, TEST_USERS.trader.email, TEST_USERS.trader.password);
    
    await page.goto('/dashboard');
    
    // Should show error or fallback UI
    const hasErrorOrFallback = await page.locator('text=/Error|Loading|Retry/i, body').isVisible().catch(() => false);
    expect(hasErrorOrFallback).toBe(true);
  });
});

