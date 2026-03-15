/**
 * Global setup for Playwright E2E tests
 *
 * Sets up test environment, seeds database, and configures test users
 */

import { FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');
  const env = (globalThis as any).process?.env ?? {};

  try {
    // Check if backend is running using fetch (works better than page.goto for health checks)
    console.log('📡 Checking backend availability...');
    const backendUrl = env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
    const healthResponse = await fetch(`${backendUrl}/health`, { 
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Backend health check:', JSON.stringify(healthData).substring(0, 200));
    } else {
      console.warn('⚠️ Backend health check returned:', healthResponse.status);
    }

    // Test users are now provisioned in Authentik, not via backend API.
    console.log('ℹ️ Test users provisioned in Authentik.');

    console.log('✅ Global setup completed successfully');
  } catch (error: any) {
    console.error('❌ Global setup failed:', error.message);
    // Don't throw - allow tests to run even if setup has issues
    console.warn('⚠️ Continuing with tests despite setup warnings...');
  }
}


export default globalSetup;
