import { test, expect } from '@playwright/test';

test.describe('External Access Tests', () => {
  test('should access thaliumx.com over HTTPS', async ({ page }) => {
    // Set longer timeout for external requests
    test.setTimeout(30000);

    try {
      // Navigate to the external site
      await page.goto('https://thaliumx.com', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      // Check if we get a response (even if it's an error page)
      const title = await page.title();
      console.log('Page title:', title);

      // Check if the connection is secure
      const url = page.url();
      console.log('Current URL:', url);

      // If we reach here, the SSL connection worked
      expect(url).toMatch(/^https:\/\//);

    } catch (error) {
      console.error('Navigation failed:', error);

      // Check the error message
      const errorMessage = error.message;
      console.log('Error message:', errorMessage);

      // If it's SSL related, it will show in the error
      if (errorMessage.includes('SSL') || errorMessage.includes('CERT')) {
        throw new Error(`SSL Certificate Error: ${errorMessage}`);
      } else {
        throw error;
      }
    }
  });

  test('should access auth.thaliumx.com over HTTPS', async ({ page }) => {
    test.setTimeout(30000);

    try {
      await page.goto('https://auth.thaliumx.com', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      const url = page.url();
      console.log('Auth URL:', url);

      expect(url).toMatch(/^https:\/\//);

    } catch (error) {
      console.error('Auth navigation failed:', error);
      throw error;
    }
  });
});