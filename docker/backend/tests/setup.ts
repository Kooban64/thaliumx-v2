import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.KAFKA_BROKERS = 'localhost:9092';

// Global test setup
beforeAll(async () => {
  // Setup test database
  // Setup test Redis
  // Setup test Kafka
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Cleanup test database
  // Cleanup test Redis
  // Cleanup test Kafka
  console.log('Cleaning up test environment...');
});

// Mock external dependencies
jest.mock('../src/services/redis', () => ({
  RedisService: {
    // Connection
    initialize: jest.fn(),
    isConnected: jest.fn(() => false),
    close: jest.fn(),
    getClient: jest.fn(() => null),

    // Common ops used across services
    getString: jest.fn(async () => null),
    setString: jest.fn(async () => undefined),
    del: jest.fn(async () => undefined),
    keys: jest.fn(async () => []),
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    publish: jest.fn(async () => undefined),
    subscribe: jest.fn(async () => undefined),
  },
}));

jest.mock('../src/services/kafka', () => ({
  KafkaService: {
    initialize: jest.fn(),
    produce: jest.fn(async () => undefined),
    close: jest.fn(),
  },
}));

jest.mock('../src/services/secrets', () => ({
  SecretsService: {
    initialize: jest.fn(),
    isConnected: jest.fn(() => false),
    getSecret: jest.fn(async () => ''),
    getSecrets: jest.fn(async () => ({})),
    writeSecret: jest.fn(async () => true),
    deleteSecret: jest.fn(async () => true),
    listSecrets: jest.fn(async () => []),
  },
}));

jest.mock('../src/services/keycloak', () => ({
  KeycloakService: {
    initialize: jest.fn(),
    isHealthy: jest.fn(() => true),
    validateToken: jest.fn(async () => ({ sub: 'test-user' })),
  },
}));

// Custom matchers
expect.extend({
  toBeValidUUID(received: unknown) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    return {
      message: () => `expected ${String(received)} to be a valid UUID`,
      pass,
    };
  },

  toBeValidEmail(received: unknown) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = typeof received === 'string' && emailRegex.test(received);
    return {
      message: () => `expected ${String(received)} to be a valid email`,
      pass,
    };
  },
});

// Test utilities
export const createTestUser = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  status: 'active',
  kycStatus: 'approved',
  ...overrides,
});

export const createTestWallet = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174001',
  userId: '123e4567-e89b-12d3-a456-426614174000',
  currency: 'BTC',
  balance: '1.5',
  availableBalance: '1.5',
  ...overrides,
});

export const createTestOrder = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174002',
  userId: '123e4567-e89b-12d3-a456-426614174000',
  symbol: 'BTC/USDT',
  side: 'buy',
  type: 'limit',
  quantity: '0.1',
  price: '50000',
  status: 'pending',
  ...overrides,
});

// Database test helpers
export const clearDatabase = async () => {
  // Clear all test data
  const tables = [
    'audit_logs',
    'security_events',
    'notifications',
    'aml_checks',
    'kyc_documents',
    'kyc_submissions',
    'margin_positions',
    'margin_accounts',
    'trades',
    'orders',
    'wallet_transactions',
    'wallets',
    'token_sale_investments',
    'token_sales',
    'tenant_users',
    'tenants',
    'user_sessions',
    'users',
  ];

  for (const table of tables) {
    await (globalThis as any).db.query(`TRUNCATE TABLE ${table} CASCADE;`);
  }
};

export const seedTestData = async () => {
  // Insert test data
  await (globalThis as any).db.query(`
    INSERT INTO users (id, email, first_name, last_name, status, kyc_status)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    '123e4567-e89b-12d3-a456-426614174000',
    'test@example.com',
    'Test',
    'User',
    'active',
    'approved'
  ]);
};

// API test helpers
export const createAuthenticatedRequest = (token = 'test-token') => ({
  headers: {
    authorization: `Bearer ${token}`,
    'x-request-id': 'test-request-id',
  },
});

export const createUnauthenticatedRequest = () => ({
  headers: {
    'x-request-id': 'test-request-id',
  },
});

// Performance test helpers
export const measurePerformance = async (fn: () => Promise<any>, iterations = 100) => {
  const startTime = Date.now();
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const iterationStart = Date.now();
    await fn();
    const iterationEnd = Date.now();
    results.push(iterationEnd - iterationStart);
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;
  const minTime = Math.min(...results);
  const maxTime = Math.max(...results);
  const p95Time = results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)];

  return {
    totalTime,
    avgTime,
    minTime,
    maxTime,
    p95Time,
    iterations,
  };
};
