import { test, expect } from '@playwright/test';

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE || 'zitadel';

test.describe('Zitadel integration (smoke)', () => {
  test.skip(AUTH_MODE !== 'zitadel', 'Zitadel smoke suite only runs when NEXT_PUBLIC_AUTH_MODE=zitadel');

  test('auth page renders Zitadel CTA', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^continue$/i })).toBeVisible();
  });

  test('oidc callback route exists (shows error without code)', async ({ page }) => {
    // The callback route is expected to show an error when called without params.
    await page.goto('/oidc/callback', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/authentication failed|missing authorization code/i)).toBeVisible();
  });

  test('dashboard is reachable when authenticated (best-effort)', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // If auth state exists (from zitadel-auth.setup), we should land in the app.
    // If not, we typically get redirected to /auth.
    if (page.url().includes('/auth')) {
      test.skip(true, 'Not authenticated. Enable zitadel-auth.setup (E2E_ZITADEL_LOGINNAME/PASSWORD + NEXT_PUBLIC_E2E_TOKEN_PERSIST=1) to validate authenticated flows.');
    }

    await expect(page.url()).toContain('/dashboard');
  });
});

