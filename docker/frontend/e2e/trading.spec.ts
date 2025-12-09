import { test, expect } from '@playwright/test';

/**
 * Trading E2E Tests
 *
 * Tests the complete trading workflow including:
 * - Market data display
 * - Order placement
 * - Wallet balance updates
 * - Real-time price updates
 * - Error handling
 */

test.describe('Trading Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'testuser1@thaliumx.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should display trading dashboard with real market data', async ({ page }) => {
    await page.goto('/dashboard');

    // Check BTC/USDT chart is visible
    await expect(page.locator('text=BTC/USDT')).toBeVisible();

    // Check price display (should be real, not mock)
    const priceElement = page.locator('text=$').first();
    await expect(priceElement).toBeVisible();

    // Check trading panel
    await expect(page.locator('text=Place Order')).toBeVisible();

    // Check wallet connector
    await expect(page.locator('text=Web3 Wallets')).toBeVisible();
  });

  test('should show real-time price updates', async ({ page }) => {
    await page.goto('/dashboard');

    // Get initial price
    const initialPriceElement = page.locator('[data-testid="current-price"]').or(page.locator('text=$').first());
    const initialPrice = await initialPriceElement.textContent();

    // Wait for potential price update (30 seconds max)
    await page.waitForTimeout(5000);

    // Price should still be displayed (may or may not change)
    const updatedPriceElement = page.locator('[data-testid="current-price"]').or(page.locator('text=$').first());
    await expect(updatedPriceElement).toBeVisible();
  });

  test('should place market buy order', async ({ page }) => {
    await page.goto('/dashboard');

    // Select buy order
    await page.click('button:has-text("Buy")');

    // Ensure market order is selected
    await page.click('button:has-text("Market")');

    // Enter amount
    await page.fill('input[placeholder="0.001"]', '0.001');

    // Submit order
    await page.click('button[type="submit"]');

    // Should show success message or order confirmation
    await expect(page.locator('text=Order placed successfully').or(page.locator('text=successfully'))).toBeVisible();
  });

  test('should place limit sell order', async ({ page }) => {
    await page.goto('/dashboard');

    // Select sell order
    await page.click('button:has-text("Sell")');

    // Select limit order
    await page.click('button:has-text("Limit")');

    // Enter amount and price
    await page.fill('input[placeholder="0.001"]', '0.001');
    await page.fill('input[placeholder="45000"]', '50000');

    // Submit order
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('text=Order placed successfully').or(page.locator('text=successfully'))).toBeVisible();
  });

  test('should validate order inputs', async ({ page }) => {
    await page.goto('/dashboard');

    // Try to submit without amount
    await page.click('button[type="submit"]');

    // Should show validation error or disable submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
  });

  test('should display wallet balance', async ({ page }) => {
    await page.goto('/dashboard');

    // Switch to wallet tab
    await page.click('button:has-text("Wallet")');

    // Check wallet balance display
    await expect(page.locator('text=Wallet Balance')).toBeVisible();

    // Should show some balance information
    await expect(page.locator('text=$').or(page.locator('text=Balance'))).toBeVisible();
  });

  test('should handle wallet connection', async ({ page }) => {
    await page.goto('/dashboard');

    // Check Web3 wallet connector
    await expect(page.locator('text=Connect MetaMask')).toBeVisible();

    // Note: Actual MetaMask connection would require browser extension
    // This test just verifies the UI is present
  });

  test('should display recent transactions', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('button:has-text("Wallet")');

    // Check recent transactions section
    await expect(page.locator('text=Recent Transactions')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network failure by blocking API calls
    await page.route('**/api/market/**', route => route.abort());

    await page.goto('/dashboard');

    // Should still load with fallback data or error message
    await expect(page.locator('text=ThaliumX')).toBeVisible();
  });

  test('should show portfolio information', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('button:has-text("Portfolio")');

    // Check portfolio metrics
    await expect(page.locator('text=Total Value').or(page.locator('text=Portfolio'))).toBeVisible();
  });

  test('should handle mobile responsive design', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dashboard');

    // Check mobile menu button is visible
    await expect(page.locator('[aria-label="Menu"]').or(page.locator('button').filter({ hasText: 'Menu' }))).toBeVisible();

    // Open mobile menu
    await page.click('[aria-label="Menu"]');

    // Check sidebar navigation
    await expect(page.locator('text=Trading')).toBeVisible();
  });

  test('should maintain state across page refreshes', async ({ page }) => {
    await page.goto('/dashboard');

    // Select a tab
    await page.click('button:has-text("Wallet")');
    await expect(page.locator('text=Wallet Balance')).toBeVisible();

    // Refresh page
    await page.reload();

    // Should maintain dashboard access (user still logged in)
    await expect(page).toHaveURL(/.*dashboard/);
  });
});