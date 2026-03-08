import { test, expect } from '@playwright/test';

const env = (globalThis as any).process?.env ?? {};
const AUTH_ISSUER = env.NEXT_PUBLIC_KEYCLOAK_ISSUER || 'https://auth.thaliumx.com';

test.describe('Keycloak integration (smoke)', () => {

  test('auth page renders continue CTA', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^continue$/i })).toBeVisible();
  });

  test('auth issuer targets auth.thaliumx.com', async () => {
    expect(AUTH_ISSUER).toContain('auth.thaliumx.com');
  });

  test('oidc callback route exists (shows error without code)', async ({ page }) => {
    // Callback without params must fail closed and return to canonical /auth entry.
    await page.goto('/oidc/callback', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/auth(\?|$)/, { timeout: 15000 });
    await expect(page.getByRole('button', { name: /^continue$/i })).toBeVisible();
  });

  test('legacy login endpoint is deprecated (410)', async ({ page }) => {
    const response = await page.request.post('/api/auth/login', {
      data: { email: 'legacy@example.com', password: 'legacy-password' },
    });

    expect(response.status()).toBe(410);
    const body = await response.text();
    expect(body).toContain('LEGACY_AUTH_DISABLED');
  });

  test('dashboard is reachable when authenticated (best-effort)', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // If auth state exists (from keycloak-auth.setup), we should land in the app.
    // If not, we typically get redirected to /auth.
    if (page.url().includes('/auth')) {
      test.skip(true, 'Not authenticated. Enable keycloak-auth.setup (E2E_KEYCLOAK_LOGINNAME/PASSWORD + NEXT_PUBLIC_E2E_TOKEN_PERSIST=1) to validate authenticated flows.');
    }

    await expect(page.url()).toContain('/dashboard');
  });
});
