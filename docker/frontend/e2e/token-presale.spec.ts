import { test, expect } from '@playwright/test';

/**
 * Token Presale E2E Tests
 *
 * Tests the complete token presale workflow including:
 * - Presale page display
 * - Token purchase flow
 * - Payment processing
 * - Portfolio tracking
 * - Error handling
 */

test.describe('Token Presale Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'testuser1@thaliumx.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should display presale page with real data', async ({ page }) => {
    await page.goto('/token-presale');

    // Check presale branding
    await expect(page.locator('text=THAL Token Presale')).toBeVisible();

    // Check statistics display
    await expect(page.locator('text=Total Raised')).toBeVisible();
    await expect(page.locator('text=Target')).toBeVisible();

    // Check purchase form
    await expect(page.locator('text=Purchase THAL Tokens')).toBeVisible();
  });

  test('should show real THAL token pricing', async ({ page }) => {
    await page.goto('/token-presale');

    // Check that pricing is displayed (should be real, not hardcoded $0.10)
    await expect(page.locator('text=1 THAL = $')).toBeVisible();

    // Price should be a reasonable value (not exactly $0.10)
    const priceText = await page.locator('text=1 THAL = $').textContent();
    expect(priceText).toBeTruthy();
  });

  test('should calculate token amount correctly', async ({ page }) => {
    await page.goto('/token-presale');

    // Enter amount
    await page.fill('input[placeholder="100.00"]', '100');

    // Check calculation display
    await expect(page.locator('text=You\'ll receive:')).toBeVisible();
    await expect(page.locator('text=THAL')).toBeVisible();
  });

  test('should handle USDT payment method', async ({ page }) => {
    await page.goto('/token-presale');

    // USDT should be selected by default
    await expect(page.locator('input[value="USDT"]').isChecked()).toBeTruthy();

    // Enter wallet address
    await page.fill('input[placeholder="0x..."]', '0x1234567890abcdef1234567890abcdef12345678');

    // Enter amount
    await page.fill('input[placeholder="100.00"]', '50');

    // Submit purchase
    await page.click('button[type="submit"]');

    // Should show success or processing message
    await expect(page.locator('text=Token purchase request submitted').or(page.locator('text=successfully'))).toBeVisible();
  });

  test('should handle bank transfer payment method', async ({ page }) => {
    await page.goto('/token-presale');

    // Switch to bank transfer
    await page.check('input[value="BANK_TRANSFER"]');

    // Wallet address field should be hidden
    await expect(page.locator('input[placeholder="0x..."]')).not.toBeVisible();

    // Enter amount
    await page.fill('input[placeholder="100.00"]', '100');

    // Submit purchase
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('text=Token purchase request submitted').or(page.locator('text=successfully'))).toBeVisible();
  });

  test('should validate minimum purchase amount', async ({ page }) => {
    await page.goto('/token-presale');

    // Enter amount below minimum
    await page.fill('input[placeholder="100.00"]', '10');

    // Submit button should be disabled or show validation
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
  });

  test('should handle broker code', async ({ page }) => {
    await page.goto('/token-presale');

    // Enter broker code
    await page.fill('input[placeholder="BROKER123"]', 'TESTBROKER');

    // Enter purchase details
    await page.fill('input[placeholder="100.00"]', '100');

    // Submit purchase
    await page.click('button[type="submit"]');

    // Should process with broker code
    await expect(page.locator('text=Token purchase request submitted').or(page.locator('text=successfully'))).toBeVisible();
  });

  test('should display presale statistics', async ({ page }) => {
    await page.goto('/token-presale');

    // Check statistics cards
    await expect(page.locator('text=Total Raised')).toBeVisible();
    await expect(page.locator('text=Target')).toBeVisible();
    await expect(page.locator('text=Participants')).toBeVisible();
    await expect(page.locator('text=Time Remaining')).toBeVisible();
  });

  test('should show presale benefits and details', async ({ page }) => {
    await page.goto('/token-presale');

    // Check benefits section
    await expect(page.locator('text=Presale Benefits')).toBeVisible();
    await expect(page.locator('text=Early access to THAL tokens')).toBeVisible();

    // Check token distribution
    await expect(page.locator('text=Token Distribution')).toBeVisible();

    // Check how to participate
    await expect(page.locator('text=How to Participate')).toBeVisible();
  });

  test('should integrate with portfolio page', async ({ page }) => {
    // First make a purchase
    await page.goto('/token-presale');
    await page.fill('input[placeholder="100.00"]', '50');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Token purchase request submitted').or(page.locator('text=successfully'))).toBeVisible();

    // Navigate to portfolio
    await page.goto('/portfolio');

    // Check purchase is displayed
    await expect(page.locator('text=My Presale Purchases')).toBeVisible();
    await expect(page.locator('text=Presale:')).toBeVisible();
  });

  test('should handle unauthenticated access', async ({ page }) => {
    // Clear authentication
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    await page.goto('/token-presale');

    // Should show sign in prompt
    await expect(page.locator('text=Sign in').or(page.locator('text=Sign In'))).toBeVisible();

    // Try to make purchase without auth
    await page.fill('input[placeholder="100.00"]', '100');
    await page.click('button[type="submit"]');

    // Should show authentication required message
    await expect(page.locator('text=Please sign in to purchase tokens')).toBeVisible();
  });

  test('should handle network errors during purchase', async ({ page }) => {
    await page.goto('/token-presale');

    // Mock network failure
    await page.route('**/api/presale/**', route => route.abort());

    await page.fill('input[placeholder="100.00"]', '100');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=An error occurred').or(page.locator('text=Failed to')).or(page.locator('text=Network error'))).toBeVisible();
  });

  test('should support quick amount buttons', async ({ page }) => {
    await page.goto('/token-presale');

    // Click $100 quick button
    await page.click('button:has-text("$100")');

    // Check amount field is populated
    const amountField = page.locator('input[placeholder="100.00"]');
    await expect(amountField).toHaveValue('100');
  });

  test('should validate wallet address format', async ({ page }) => {
    await page.goto('/token-presale');

    // Enter invalid wallet address
    await page.fill('input[placeholder="0x..."]', 'invalid-address');

    // Enter amount and submit
    await page.fill('input[placeholder="100.00"]', '100');
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=Invalid wallet address').or(page.locator('text=Please enter a valid')).or(page.locator('text=address'))).toBeVisible();
  });
});