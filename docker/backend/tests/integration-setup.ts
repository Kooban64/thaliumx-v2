import { DatabaseService } from '../src/services/database';
import { RedisService } from '../src/services/redis';
import { LoggerService } from '../src/services/logger';
import { Sequelize } from 'sequelize';

// Setup integration test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:15432/test_db';
process.env.TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:16379/1';

// Prefer TEST_* URLs for integration tests; ConfigService supports these.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.REDIS_URL = process.env.TEST_REDIS_URL;

// Ensure migrations/DB tooling that relies on DB_PASSWORD/POSTGRES_PASSWORD works in tests.
// (See [`MigrationRunner.initialize()`](docker/backend/src/migrations/runner.ts:47)).
if (!process.env.DB_PASSWORD) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    process.env.DB_PASSWORD = decodeURIComponent(u.password || '');
    process.env.DB_USER = decodeURIComponent(u.username || '');
    process.env.DB_NAME = (u.pathname || '').replace(/^\//, '');
    process.env.DB_HOST = u.hostname || 'localhost';
    process.env.DB_PORT = u.port || '5432';
  } catch {
    // ignore
  }
}

// Global integration test setup
beforeAll(async () => {
  LoggerService.initialize();

  // Initialize database for integration tests
  try {
    await DatabaseService.initialize();
    LoggerService.info('Database initialized for integration tests');
  } catch (error) {
    LoggerService.error('Failed to initialize database for integration tests', error);
    throw error;
  }

  // Initialize Redis for integration tests
  try {
    await RedisService.initialize();
    LoggerService.info('Redis initialized for integration tests');
  } catch (error) {
    LoggerService.error('Failed to initialize Redis for integration tests', error);
    throw error;
  }
}, 60000);

afterAll(async () => {
  // Cleanup
  try {
    await RedisService.close();
    await DatabaseService.close();
    LoggerService.info('Integration test cleanup completed');
  } catch (error) {
    LoggerService.error('Integration test cleanup error', error);
  }
}, 30000);

// Database helpers for integration tests
export class TestDatabaseHelper {
  static async cleanDatabase(): Promise<void> {
    const sequelize = DatabaseService.getSequelize();

    // Disable foreign key checks
    await sequelize.query('SET CONSTRAINTS ALL DEFERRED');

    // Get all table names
    const [tables] = await sequelize.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%' AND tablename NOT LIKE 'sql_%'
    `);

    // Truncate all tables
    for (const table of tables as any[]) {
      await sequelize.query(`TRUNCATE TABLE "${table.tablename}" CASCADE`);
    }

    // Re-enable foreign key checks
    await sequelize.query('SET CONSTRAINTS ALL IMMEDIATE');
  }

  static async seedTestData(): Promise<void> {
    // Seed minimal test data
    const sequelize = DatabaseService.getSequelize();

    // Create test tenant
    await sequelize.query(`
      INSERT INTO tenants (id, name, domain, status, created_at, updated_at)
      VALUES ('test-tenant', 'Test Tenant', 'test.com', 'active', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    // Create test broker
    await sequelize.query(`
      INSERT INTO brokers (id, name, slug, domain, status, tier, created_at, updated_at)
      VALUES ('test-broker', 'Test Broker', 'test-broker', 'test.com', 'active', 'enterprise', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
  }
}
