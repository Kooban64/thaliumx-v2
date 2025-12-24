/**
 * Global setup for Playwright E2E tests
 *
 * Sets up test environment, seeds database, and configures test users
 */

import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');

  try {
    // Check if backend is running using fetch (works better than page.goto for health checks)
    console.log('📡 Checking backend availability...');
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
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

    // Seed test data via backend API (faster + more reliable than UI clicking)
    console.log('🌱 Seeding test data...');
    await seedTestDataViaApi(backendUrl);

    console.log('✅ Global setup completed successfully');
  } catch (error: any) {
    console.error('❌ Global setup failed:', error.message);
    // Don't throw - allow tests to run even if setup has issues
    console.warn('⚠️ Continuing with tests despite setup warnings...');
  }
}

async function seedTestDataViaApi(backendUrl: string) {
  // Users expected by E2E specs (see e2e/auth.spec.ts).
  // These are seeded via backend registration API.
  const testUsers = [
    {
      email: 'admin@thaliumx.com',
      password: 'AdminPass123!',
      firstName: 'Platform',
      lastName: 'Admin',
    },
    {
      email: 'broker@thaliumx.com',
      password: 'BrokerPass123!',
      firstName: 'Broker',
      lastName: 'Admin',
    },
    {
      email: 'trader@thaliumx.com',
      password: 'TraderPass123!',
      firstName: 'John',
      lastName: 'Trader',
    },
    {
      email: 'user@thaliumx.com',
      password: 'UserPass123!',
      firstName: 'Jane',
      lastName: 'User',
    },
    {
      email: 'pending@thaliumx.com',
      password: 'PendingPass123!',
      firstName: 'Pending',
      lastName: 'KYC',
    },
    {
      email: 'suspended@thaliumx.com',
      password: 'SuspendedPass123!',
      firstName: 'Suspended',
      lastName: 'User',
    },
  ];

  for (const user of testUsers) {
    try {
      const resp = await fetch(`${backendUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // Default tenant for tests
          'X-Tenant-ID': '10000000-0000-0000-0000-000000000000',
        },
        body: JSON.stringify(user),
        signal: AbortSignal.timeout(15000),
      });

      if (resp.ok) {
        console.log(`✅ Ensured test user exists: ${user.email}`);
      } else {
        // Often 400 if already exists. Log and continue.
        const text = await resp.text().catch(() => '');
        console.log(`⚠️ Could not create test user (may already exist): ${user.email} (status ${resp.status}) ${text.substring(0, 200)}`);
      }
    } catch (e: any) {
      console.log(`⚠️ Could not create test user: ${user.email} - ${e?.message || e}`);
    }
  }

  // Warm up / clear caches if available
  try {
    const response = await fetch(`${backendUrl}/api/market/cache/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) {
      console.log('✅ Cleared market data cache');
    } else {
      console.log(`⚠️ Market cache clear returned ${response.status}`);
    }
  } catch (error: any) {
    console.log(`⚠️ Could not clear cache: ${error.message}`);
  }
}

export default globalSetup;
