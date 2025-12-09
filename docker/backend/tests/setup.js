"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../src/services/database");
const redis_1 = require("../src/services/redis");
const logger_1 = require("../src/services/logger");
// Setup test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';
// Global test setup
beforeAll(async () => {
    // Initialize minimal services for testing
    try {
        logger_1.LoggerService.initialize();
        // Note: Database and Redis initialization skipped in unit tests
        // Use integration tests for full service testing
    }
    catch (error) {
        console.warn('Test setup warning:', error);
    }
});
afterAll(async () => {
    // Cleanup
    try {
        await redis_1.RedisService.close();
        await database_1.DatabaseService.close();
    }
    catch (error) {
        console.warn('Test cleanup warning:', error);
    }
});
// Mock external dependencies
jest.mock('../src/services/email', () => ({
    EmailService: {
        initialize: jest.fn().mockResolvedValue(undefined),
        sendPasswordReset: jest.fn().mockResolvedValue(undefined)
    }
}));
jest.mock('../src/services/kafka', () => ({
    KafkaService: {
        initialize: jest.fn().mockResolvedValue(undefined),
        produce: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
    }
}));
// Custom matchers
expect.extend({
    toBeValidUUID(received) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const pass = uuidRegex.test(received);
        return {
            message: () => `expected ${received} to be a valid UUID`,
            pass
        };
    }
});
//# sourceMappingURL=setup.js.map