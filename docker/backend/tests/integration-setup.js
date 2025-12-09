"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDatabaseHelper = void 0;
const database_1 = require("../src/services/database");
const redis_1 = require("../src/services/redis");
const logger_1 = require("../src/services/logger");
// Setup integration test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
// Global integration test setup
beforeAll(async () => {
    logger_1.LoggerService.initialize();
    // Initialize database for integration tests
    try {
        await database_1.DatabaseService.initialize();
        logger_1.LoggerService.info('Database initialized for integration tests');
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to initialize database for integration tests', error);
        throw error;
    }
    // Initialize Redis for integration tests
    try {
        await redis_1.RedisService.initialize();
        logger_1.LoggerService.info('Redis initialized for integration tests');
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to initialize Redis for integration tests', error);
        throw error;
    }
}, 60000);
afterAll(async () => {
    // Cleanup
    try {
        await redis_1.RedisService.close();
        await database_1.DatabaseService.close();
        logger_1.LoggerService.info('Integration test cleanup completed');
    }
    catch (error) {
        logger_1.LoggerService.error('Integration test cleanup error', error);
    }
}, 30000);
// Database helpers for integration tests
class TestDatabaseHelper {
    static async cleanDatabase() {
        const sequelize = database_1.DatabaseService.getSequelize();
        // Disable foreign key checks
        await sequelize.query('SET CONSTRAINTS ALL DEFERRED');
        // Get all table names
        const [tables] = await sequelize.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%' AND tablename NOT LIKE 'sql_%'
    `);
        // Truncate all tables
        for (const table of tables) {
            await sequelize.query(`TRUNCATE TABLE "${table.tablename}" CASCADE`);
        }
        // Re-enable foreign key checks
        await sequelize.query('SET CONSTRAINTS ALL IMMEDIATE');
    }
    static async seedTestData() {
        // Seed minimal test data
        const sequelize = database_1.DatabaseService.getSequelize();
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
exports.TestDatabaseHelper = TestDatabaseHelper;
//# sourceMappingURL=integration-setup.js.map