import { test, expect } from '@playwright/test';

/**
 * Debug test to see what's happening with frontend API calls
 * This test will:
 * 1. Navigate to the auth page
 * 2. Attempt to log in
 * 3. Capture all network requests and console errors
 * 4. Show what's actually happening
 */
test.describe('Debug Authentication Flow', () => {
  test('should debug login flow and capture network errors', async ({ page }) => {
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log(`[Console Error] ${msg.text()}`);
      }
    });

    // Capture all network requests
    const allRequests: Array<{ url: string; method: string; status?: number; error?: string }> = [];
    const networkErrors: Array<{ url: string; status: number; error: string }> = [];
    
    page.on('request', (request) => {
      allRequests.push({
        url: request.url(),
        method: request.method(),
      });
      console.log(`[Request] ${request.method()} ${request.url()}`);
    });
    
    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      console.log(`[Response] ${status} ${response.statusText()} - ${url}`);
      
      if (!response.ok()) {
        networkErrors.push({
          url: url,
          status: status,
          error: response.statusText(),
        });
        console.log(`[Network Error] ${status} ${response.statusText()} - ${url}`);
      }
    });

    // Capture failed requests
    page.on('requestfailed', (request) => {
      console.log(`[Request Failed] ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
      networkErrors.push({
        url: request.url(),
        status: 0,
        error: request.failure()?.errorText || 'Request failed',
      });
    });

    console.log('🚀 Navigating to auth page...');
    // Use explicit URL to ensure we hit the frontend on port 3001
    // Use 'domcontentloaded' instead of 'networkidle' to avoid timeout
    await page.goto('http://localhost:3001/auth', { waitUntil: 'domcontentloaded', timeout: 15000 });

    console.log('📄 Page loaded. Current URL:', page.url());
    console.log('📄 Page title:', await page.title());

    // Wait a bit for any async operations
    await page.waitForTimeout(2000);

    // Check if login form is visible
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    const emailVisible = await emailInput.isVisible().catch(() => false);
    const passwordVisible = await passwordInput.isVisible().catch(() => false);
    const submitVisible = await submitButton.isVisible().catch(() => false);

    console.log('📋 Form elements:');
    console.log(`  - Email input visible: ${emailVisible}`);
    console.log(`  - Password input visible: ${passwordVisible}`);
    console.log(`  - Submit button visible: ${submitVisible}`);

    // Try to fill in login form
    if (emailVisible && passwordVisible) {
      console.log('✍️ Filling in login form...');
      await emailInput.fill('admin@thaliumx.com');
      await passwordInput.fill('AdminPass123!');

      console.log('🖱️ Clicking submit button...');
      
      // Wait for navigation or response
      const [response] = await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().includes('/api/auth/login') || resp.url().includes('/login'),
          { timeout: 10000 }
        ).catch(() => null),
        submitButton.click(),
      ]);

      if (response) {
        console.log('📡 Login response received:');
        console.log(`  - Status: ${response.status()}`);
        console.log(`  - URL: ${response.url()}`);
        try {
          const responseBody = await response.json();
          console.log(`  - Body:`, JSON.stringify(responseBody, null, 2));
        } catch (e) {
          const responseText = await response.text();
          console.log(`  - Body (text): ${responseText.substring(0, 200)}`);
        }
      } else {
        console.log('⚠️ No response received within 10 seconds');
      }

      // Wait a bit more to see if page navigates
      await page.waitForTimeout(3000);
      console.log('📍 Final URL:', page.url());
    } else {
      console.log('⚠️ Login form not found or not visible');
    }

    // Print all errors
    console.log('\n📊 Summary:');
    console.log(`  - Console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('  Console errors:');
      consoleErrors.forEach((error, i) => {
        console.log(`    ${i + 1}. ${error}`);
      });
    }

    console.log(`  - Network errors: ${networkErrors.length}`);
    if (networkErrors.length > 0) {
      console.log('  Network errors:');
      networkErrors.forEach((error, i) => {
        console.log(`    ${i + 1}. ${error.status} ${error.error} - ${error.url}`);
      });
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/debug-auth.png', fullPage: true });
    console.log('📸 Screenshot saved to test-results/debug-auth.png');

    // Note: allRequests is already captured above via page.on('request')
    console.log(`\n📡 Total requests captured: ${allRequests.length}`);
    if (allRequests.length > 0) {
      console.log('  All requests:');
      allRequests.forEach((req, i) => {
        console.log(`    ${i + 1}. ${req.method} ${req.url} ${req.status ? `(${req.status})` : ''}`);
      });
    }
  });
});

