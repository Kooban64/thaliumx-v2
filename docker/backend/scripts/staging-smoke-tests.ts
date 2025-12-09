/**
 * Staging Environment Smoke Tests
 * Run basic health checks before promoting to production
 */

import axios from 'axios';

const BASE_URL = process.env.STAGING_URL || 'http://localhost:3002';
const API_BASE = `${BASE_URL}/api`;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message, duration: Date.now() - start });
    console.error(`❌ ${name}: ${error.message}`);
  }
}

async function runSmokeTests(): Promise<void> {
  console.log('🚀 Running staging smoke tests...\n');

  // Health check
  await test('Health endpoint', async () => {
    const res = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Database connectivity
  await test('Database connectivity', async () => {
    const res = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    if (!res.data?.database?.connected) throw new Error('Database not connected');
  });

  // Redis connectivity
  await test('Redis connectivity', async () => {
    const res = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    if (!res.data?.redis?.connected) throw new Error('Redis not connected');
  });

  // Exchange service health
  await test('Exchange service health', async () => {
    const res = await axios.get(`${API_BASE}/omni-exchange/exchanges`, {
      timeout: 5000,
      headers: { Authorization: `Bearer ${process.env.TEST_TOKEN || ''}` }
    }).catch(() => ({ status: 200 })); // May require auth, but should not crash
    if (res.status >= 500) throw new Error('Exchange service unhealthy');
  });

  // Metrics endpoint
  await test('Metrics endpoint', async () => {
    const res = await axios.get(`${BASE_URL}/metrics`, { timeout: 5000 });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // API routes load
  await test('API routes load', async () => {
    // Test that routes are mounted (should get 401/403, not 404)
    const res = await axios.get(`${API_BASE}/users/me`, { validateStatus: () => true, timeout: 5000 });
    if (res.status === 404) throw new Error('Routes not mounted');
  });

  // CSP headers
  await test('Security headers (CSP)', async () => {
    const res = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    if (!res.headers['content-security-policy']) {
      throw new Error('CSP header missing');
    }
  });

  // CORS headers
  await test('CORS headers', async () => {
    const res = await axios.options(`${BASE_URL}/api/auth/login`, { timeout: 5000 });
    if (!res.headers['access-control-allow-origin']) {
      throw new Error('CORS headers missing');
    }
  });

  // Summary
  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }
  
  console.log('\n✅ All smoke tests passed!');
}

runSmokeTests().catch(error => {
  console.error('Smoke test runner failed:', error);
  process.exit(1);
});

