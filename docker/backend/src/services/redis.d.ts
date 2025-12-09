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
import Redis from 'ioredis';
export declare class RedisService {
    private static client;
    private static subscriber;
    private static publisher;
    private static isInitialized;
    static initialize(): Promise<void>;
    static isConnected(): boolean;
    static close(): Promise<void>;
    static getClient(): Redis;
    static getSubscriber(): Redis;
    static getPublisher(): Redis;
    static set(key: string, value: any, ttl?: number): Promise<void>;
    static get<T>(key: string): Promise<T | null>;
    static del(key: string): Promise<void>;
    static exists(key: string): Promise<boolean>;
    static setSession(sessionId: string, data: any, ttl?: number): Promise<void>;
    static getSession<T>(sessionId: string): Promise<T | null>;
    static deleteSession(sessionId: string): Promise<void>;
    static checkRateLimit(key: string, limit: number, window: number): Promise<boolean>;
    static publish(channel: string, message: any): Promise<void>;
    static subscribe(channel: string, callback: (message: any) => void): Promise<void>;
    static healthCheck(): Promise<boolean>;
    static increment(key: string): Promise<number>;
    static expire(key: string, seconds: number): Promise<void>;
    static setString(key: string, value: string, ttl?: number): Promise<void>;
    static getString(key: string): Promise<string | null>;
    static keys(pattern: string): Promise<string[]>;
    private static circuitBreakerState;
    static withCircuitBreaker<T>(operation: () => Promise<T>, fallback?: () => T, maxFailures?: number, timeout?: number, resetTimeout?: number): Promise<T>;
}
//# sourceMappingURL=redis.d.ts.map