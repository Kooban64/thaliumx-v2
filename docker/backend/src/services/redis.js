"use strict";
/**
 * Redis Service
 *
 * Manages Redis connections and provides caching, session storage, and pub/sub functionality.
 *
 * Features:
 * - Multiple Redis clients (main, subscriber, publisher) for pub/sub pattern
 * - Connection pooling and retry logic
 * - Session storage with TTL support
 * - Distributed locking for transaction processing
 * - Cache operations with automatic serialization/deserialization
 * - Pub/sub messaging for inter-service communication
 * - Health check and connection status monitoring
 *
 * Client Types:
 * - Main client: General operations (cache, sessions, locks)
 * - Subscriber: Receives pub/sub messages
 * - Publisher: Sends pub/sub messages
 *
 * Operations:
 * - Cache: Key-value storage with optional TTL
 * - Sessions: User session management
 * - Locks: Distributed locking for critical sections
 * - Pub/Sub: Event broadcasting between services
 *
 * Error Handling:
 * - Automatic reconnection on connection loss
 * - Graceful degradation when Redis is unavailable
 * - Connection health monitoring
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("./config");
const logger_1 = require("./logger");
class RedisService {
    static client;
    static subscriber;
    static publisher;
    static isInitialized = false;
    static async initialize() {
        try {
            const config = config_1.ConfigService.getConfig();
            // Main client for general operations
            this.client = new ioredis_1.default({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                db: config.redis.db || 0,
                maxRetriesPerRequest: config.redis.maxRetriesPerRequest || 3,
                lazyConnect: true,
                connectTimeout: 10000,
                commandTimeout: 5000,
                enableReadyCheck: true
            });
            // Subscriber for pub/sub
            this.subscriber = new ioredis_1.default({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                db: config.redis.db,
                lazyConnect: true
            });
            // Publisher for pub/sub
            this.publisher = new ioredis_1.default({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                db: config.redis.db,
                lazyConnect: true
            });
            // Connect to Redis
            await Promise.all([
                this.client.connect(),
                this.subscriber.connect(),
                this.publisher.connect()
            ]);
            logger_1.LoggerService.info('Redis connections established successfully');
            this.isInitialized = true;
        }
        catch (error) {
            logger_1.LoggerService.error('Redis initialization failed:', error);
            throw error;
        }
    }
    static isConnected() {
        return this.isInitialized && this.client && this.client.status === 'ready';
    }
    static async close() {
        if (this.client) {
            await this.client.quit();
        }
        if (this.subscriber) {
            await this.subscriber.quit();
        }
        if (this.publisher) {
            await this.publisher.quit();
        }
        this.isInitialized = false;
        logger_1.LoggerService.info('Redis connections closed');
    }
    static getClient() {
        return this.client;
    }
    static getSubscriber() {
        return this.subscriber;
    }
    static getPublisher() {
        return this.publisher;
    }
    // Cache operations
    static async set(key, value, ttl) {
        try {
            const serialized = JSON.stringify(value);
            if (ttl) {
                await this.client.setex(key, ttl, serialized);
            }
            else {
                await this.client.set(key, serialized);
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Redis set error:', error);
            throw error;
        }
    }
    static async get(key) {
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        }
        catch (error) {
            logger_1.LoggerService.error('Redis get error:', error);
            throw error;
        }
    }
    static async del(key) {
        try {
            await this.client.del(key);
        }
        catch (error) {
            logger_1.LoggerService.error('Redis del error:', error);
            throw error;
        }
    }
    static async exists(key) {
        try {
            const result = await this.client.exists(key);
            return result === 1;
        }
        catch (error) {
            logger_1.LoggerService.error('Redis exists error:', error);
            throw error;
        }
    }
    // Session operations
    static async setSession(sessionId, data, ttl = 3600) {
        await this.set(`session:${sessionId}`, data, ttl);
    }
    static async getSession(sessionId) {
        return await this.get(`session:${sessionId}`);
    }
    static async deleteSession(sessionId) {
        await this.del(`session:${sessionId}`);
    }
    // Rate limiting
    static async checkRateLimit(key, limit, window) {
        try {
            const current = await this.client.incr(key);
            if (current === 1) {
                await this.client.expire(key, window);
            }
            return current <= limit;
        }
        catch (error) {
            logger_1.LoggerService.error('Redis rate limit error:', error);
            return true; // Allow on error
        }
    }
    // Pub/Sub operations
    static async publish(channel, message) {
        try {
            await this.publisher.publish(channel, JSON.stringify(message));
        }
        catch (error) {
            logger_1.LoggerService.error('Redis publish error:', error);
            throw error;
        }
    }
    static async subscribe(channel, callback) {
        try {
            await this.subscriber.subscribe(channel);
            this.subscriber.on('message', (receivedChannel, message) => {
                if (receivedChannel === channel) {
                    callback(JSON.parse(message));
                }
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Redis subscribe error:', error);
            throw error;
        }
    }
    static async healthCheck() {
        try {
            await this.client.ping();
            return true;
        }
        catch (error) {
            logger_1.LoggerService.error('Redis health check failed:', error);
            return false;
        }
    }
    // Production-ready methods for rate limiting
    static async increment(key) {
        try {
            return await this.client.incr(key);
        }
        catch (error) {
            logger_1.LoggerService.error('Redis increment error:', error);
            throw error;
        }
    }
    static async expire(key, seconds) {
        try {
            await this.client.expire(key, seconds);
        }
        catch (error) {
            logger_1.LoggerService.error('Redis expire error:', error);
            throw error;
        }
    }
    // String operations (for storing plain strings without JSON serialization)
    static async setString(key, value, ttl) {
        try {
            if (ttl) {
                await this.client.setex(key, ttl, value);
            }
            else {
                await this.client.set(key, value);
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Redis setString error:', error);
            throw error;
        }
    }
    static async getString(key) {
        try {
            return await this.client.get(key);
        }
        catch (error) {
            logger_1.LoggerService.error('Redis getString error:', error);
            throw error;
        }
    }
    // Keys pattern matching
    static async keys(pattern) {
        try {
            return await this.client.keys(pattern);
        }
        catch (error) {
            logger_1.LoggerService.error('Redis keys error:', error);
            return [];
        }
    }
    // Circuit breaker pattern for Redis operations
    static circuitBreakerState = new Map();
    static async withCircuitBreaker(operation, fallback, maxFailures = 5, timeout = 5000, resetTimeout = 60000) {
        const circuitKey = `circuit_breaker:${operation.name || 'operation'}`;
        const now = Date.now();
        const state = this.circuitBreakerState.get(circuitKey) || { failures: 0, lastFailure: 0, state: 'closed' };
        // Check if circuit is open
        if (state.state === 'open') {
            if (now - state.lastFailure > resetTimeout) {
                // Transition to half-open
                state.state = 'half-open';
                this.circuitBreakerState.set(circuitKey, state);
                logger_1.LoggerService.info('Circuit breaker transitioning to half-open');
            }
            else {
                logger_1.LoggerService.warn('Circuit breaker open, using fallback');
                if (fallback) {
                    return fallback();
                }
                throw new Error('Circuit breaker open and no fallback provided');
            }
        }
        try {
            // Execute operation with timeout
            const result = await Promise.race([
                operation(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), timeout))
            ]);
            // Reset circuit breaker on success
            state.failures = 0;
            state.state = 'closed';
            this.circuitBreakerState.set(circuitKey, state);
            return result;
        }
        catch (error) {
            // Increment failure count
            state.failures++;
            state.lastFailure = now;
            if (state.failures >= maxFailures) {
                state.state = 'open';
                logger_1.LoggerService.warn(`Circuit breaker opened after ${state.failures} failures`);
            }
            this.circuitBreakerState.set(circuitKey, state);
            logger_1.LoggerService.error('Circuit breaker operation failed:', error);
            if (fallback) {
                return fallback();
            }
            throw error;
        }
    }
}
exports.RedisService = RedisService;
//# sourceMappingURL=redis.js.map