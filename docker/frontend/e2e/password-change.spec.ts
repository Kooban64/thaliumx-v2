import { test, expect } from '@playwright/test';

test.describe('Authentication - Register/Login/Change Password', () => {
  test('should register a new user, login, change password, then login with new password', async ({ page }) => {
    const unique = Date.now();
    const email = `pwtest-${unique}@thaliumx.com`;
    const firstName = 'Playwright';
    const lastName = 'User';
    const oldPassword = 'OldPass123!';
    const newPassword = 'NewPass456!';

    // 1) Register via UI
    await page.goto('/auth');
    await page.click('text=Sign up');

    await expect(page.locator('text=Create Account')).toBeVisible();
    await page.fill('#firstName', firstName);
    await page.fill('#lastName', lastName);
    await page.fill('#email', email);
    await page.fill('#password', oldPassword);
    await page.fill('#confirmPassword', oldPassword);

    await page.click('button[type="submit"]');

    // Registration success screen
    await expect(page.locator('text=Registration Successful!')).toBeVisible({ timeout: 20000 });
    await page.click('text=Continue to Platform');

    // 2) Ensure we are logged in (cookie-based session)
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await expect(page.url()).toContain('/dashboard');

    // 3) Change password via authenticated API call (cookies included)
    const change = await page.evaluate(async ({ currentPassword, nextPassword }) => {
      const resp = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword: nextPassword }),
      });

      const text = await resp.text().catch(() => '');
      return { status: resp.status, text };
    }, { currentPassword: oldPassword, nextPassword: newPassword });

    expect(change.status).toBe(200);

    // 4) Logout via UI
    await page.click('text=Sign Out');
    await page.waitForURL('**/auth', { timeout: 20000 });

    // 5) Login with new password
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', newPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await expect(page.url()).toContain('/dashboard');

    // Sanity: user name visible somewhere on dashboard (best-effort)
    const hasName = await page.locator(`text=${firstName}`).isVisible().catch(() => false);
    expect(hasName).toBeTruthy();
  });
});

