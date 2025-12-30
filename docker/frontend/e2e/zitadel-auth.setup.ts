import { test, expect } from '@playwright/test';

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE || 'keycloak';

// For Zitadel UI login (smoke only). If unset, this setup is skipped.
const LOGINNAME = process.env.E2E_ZITADEL_LOGINNAME || '';
const PASSWORD = process.env.E2E_ZITADEL_PASSWORD || '';

test.describe('Zitadel auth setup (optional)', () => {
  test('login once and persist storageState (for non-brittle app E2E)', async ({ page }) => {
    test.skip(AUTH_MODE !== 'zitadel', 'Zitadel auth setup only runs when NEXT_PUBLIC_AUTH_MODE=zitadel');
    test.skip(!LOGINNAME || !PASSWORD, 'Set E2E_ZITADEL_LOGINNAME and E2E_ZITADEL_PASSWORD to enable Zitadel UI login in CI');

    // Start at the app auth page and click the Zitadel continue button.
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    const continueBtn = page.getByRole('button', { name: /^continue$/i });
    await expect(continueBtn).toBeVisible({ timeout: 15_000 });
    await continueBtn.click();

    // Best-effort login flow against Zitadel UI.
    // Keep selectors flexible since IdP UI can change.
    const usernameInput = page.locator(
      'input[autocomplete="username"], input[type="email"], input[name="loginName"], input[name="loginname"], input[name="username"], input[id*="login" i]'
    );
    const passwordInput = page.locator(
      'input[autocomplete="current-password"], input[type="password"]'
    );
    const submitButton = page.locator(
      'button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Next"), button:has-text("Continue")'
    );

    // Step 1: fill username if needed
    if (await usernameInput.first().isVisible({ timeout: 20_000 }).catch(() => false)) {
      await usernameInput.first().fill(LOGINNAME);
      if (await submitButton.first().isVisible().catch(() => false)) {
        await submitButton.first().click();
      } else {
        await page.keyboard.press('Enter');
      }
    }

    // Step 2: fill password
    await expect(passwordInput.first()).toBeVisible({ timeout: 20_000 });
    await passwordInput.first().fill(PASSWORD);
    if (await submitButton.first().isVisible().catch(() => false)) {
      await submitButton.first().click();
    } else {
      await page.keyboard.press('Enter');
    }

    // The app should return to /oidc/callback then redirect into the app.
    await page.waitForURL(/\/oidc\/callback|\/dashboard|\/auth/, { timeout: 60_000 });

    // Prefer the authenticated landing page.
    if (page.url().includes('/auth')) {
      // Some environments require additional steps (MFA, consent, etc.).
      // Fail with a clear message so operators know what needs to be disabled for CI.
      throw new Error(`Zitadel login did not complete; still on ${page.url()}`);
    }

    // Ensure the token is available in localStorage when E2E persistence is enabled.
    const tokenKey = 'thaliumx_oidc_access_token';
    const token = await page.evaluate((k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    }, tokenKey);
    if (!token) {
      // This typically means NEXT_PUBLIC_E2E_TOKEN_PERSIST was not enabled.
      // Don't fail the run, but note that subsequent tests may not reuse auth.
      console.warn(`WARN: No token found in localStorage key ${tokenKey}. Set NEXT_PUBLIC_E2E_TOKEN_PERSIST=1 for reusable auth state.`);
    }

    // Persist storageState for downstream tests.
    await page.context().storageState({ path: 'test-results/storageState.json' });
  });
});

