/*
  Basic test suite for Moderation + Analytics API
*/

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function runRequest(endpoint, method = 'GET', body = null) {
  const config = {
    method,
    headers: { 'content-type': 'application/json' },
  };
  if (body) config.body = JSON.stringify(body);

  const response = await fetch(`${API_URL}${endpoint}`, config);
  return response.json();
}

async function testHealth() {
  console.log('Testing health endpoint...');
  try {
    const result = await runRequest('/health');
    if (result.ok) {
      console.log('✓ Health check passed');
      return true;
    } else {
      console.log('✗ Health check failed:', result);
      return false;
    }
  } catch (error) {
    console.log('✗ Health check error:', error.message);
    return false;
  }
}

async function testModeration() {
  console.log('Testing moderation endpoint...');
  try {
    const testMessage = 'Hello, my credit card is 4111-1111-1111-1111';
    const result = await runRequest('/moderate', 'POST', {
      userId: 'test-user',
      chatId: 'test-chat',
      message: testMessage
    });

    if (result.action && result.maskedMessage) {
      console.log('✓ Moderation request passed');
      console.log('  Action:', result.action);
      console.log('  PII detected:', result.piiDetected);
      return true;
    } else {
      console.log('✗ Moderation failed:', result);
      return false;
    }
  } catch (error) {
    console.log('✗ Moderation error:', error.message);
    return false;
  }
}

async function testAnalytics() {
  console.log('Testing analytics endpoint...');
  try {
    const result = await runRequest('/analytics/summary?windowSeconds=60');
    if (result.counts && result.latency) {
      console.log('✓ Analytics request passed');
      return true;
    } else {
      console.log('✗ Analytics failed:', result);
      return false;
    }
  } catch (error) {
    console.log('✗ Analytics error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('Starting Moderation + Analytics API tests...\n');

  const tests = [
    testHealth,
    testModeration,
    testAnalytics,
  ];

  let passed = 0;
  for (const test of tests) {
    if (await test()) passed++;
    console.log('');
  }

  console.log(`Results: ${passed}/${tests.length} tests passed`);

  if (passed === tests.length) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});