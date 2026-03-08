import { DatabaseService } from '../src/services/database';
import { RedisService } from '../src/services/redis';
import { LoggerService } from '../src/services/logger';
import { afterAll, beforeAll } from '@jest/globals';

// Setup integration test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:15432/test_db';
process.env.TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:16379/1';

// Prefer TEST_* URLs for integration tests; ConfigService supports these.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.REDIS_URL = process.env.TEST_REDIS_URL;
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9094';
process.env.KAFKA_REPLICATION_FACTOR = process.env.KAFKA_REPLICATION_FACTOR || '1';
process.env.KAFKA_MIN_INSYNC_REPLICAS = process.env.KAFKA_MIN_INSYNC_REPLICAS || '1';
process.env.SCHEMA_REGISTRY_URL = process.env.SCHEMA_REGISTRY_URL || 'http://localhost:8085';

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
    LoggerService.shutdown();
    await RedisService.close();
    await DatabaseService.close();
    LoggerService.info('Integration test cleanup completed');
  } catch (error) {
    LoggerService.error('Integration test cleanup error', error);
  }
}, 30000);

// Database helpers for integration tests
export class TestDatabaseHelper {
  private static readonly TEST_TENANT_ID = '00000000-0000-0000-0000-000000000101';
  private static readonly TEST_BROKER_ID = '00000000-0000-0000-0000-000000000201';

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
    try {
      await sequelize.query(`
        INSERT INTO tenants (id, name, slug, domain, "tenantType", "isActive", settings, "createdAt", "updatedAt")
        VALUES ('${TestDatabaseHelper.TEST_TENANT_ID}', 'Test Tenant', 'test-tenant', 'test.com', 'regular', true, '{}'::jsonb, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);
    } catch (error) {
      console.error('Failed to seed test tenant', error);
      LoggerService.error('Failed to seed test tenant', error);
      throw error;
    }

    // Create test broker
    try {
      await sequelize.query(`
        INSERT INTO brokers (id, name, slug, domain, status, tier, "tenantId", settings, "createdAt", "updatedAt")
        VALUES ('${TestDatabaseHelper.TEST_BROKER_ID}', 'Test Broker', 'test-broker', 'test.com', 'active', 'enterprise', '${TestDatabaseHelper.TEST_TENANT_ID}', '{}'::jsonb, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);
    } catch (error) {
      console.error('Failed to seed test broker', error);
      LoggerService.error('Failed to seed test broker', error);
      throw error;
    }
  }
}
