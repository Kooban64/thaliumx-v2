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
import { ConfigService } from './config';
import { LoggerService } from './logger';

export class RedisService {
  private static client: Redis;
  private static subscriber: Redis;
  private static publisher: Redis;
  private static isInitialized = false;

  public static async initialize(): Promise<void> {
    try {
      const config = ConfigService.getConfig();
      
      // Main client for general operations
      this.client = new Redis({
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
      this.subscriber = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        lazyConnect: true
      });

      // Publisher for pub/sub
      this.publisher = new Redis({
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

      LoggerService.info('Redis connections established successfully');
      this.isInitialized = true;
    } catch (error) {
      LoggerService.error('Redis initialization failed:', error);
      throw error;
    }
  }

  public static isConnected(): boolean {
    return this.isInitialized && this.client && this.client.status === 'ready';
  }

  public static async close(): Promise<void> {
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
    LoggerService.info('Redis connections closed');
  }

  public static getClient(): Redis {
    return this.client;
  }

  public static getSubscriber(): Redis {
    return this.subscriber;
  }

  public static getPublisher(): Redis {
    return this.publisher;
  }

  // Cache operations
  public static async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      LoggerService.error('Redis set error:', error);
      throw error;
    }
  }

  public static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      LoggerService.error('Redis get error:', error);
      throw error;
    }
  }

  public static async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      LoggerService.error('Redis del error:', error);
      throw error;
    }
  }

  public static async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      LoggerService.error('Redis exists error:', error);
      throw error;
    }
  }

  // Session operations
  public static async setSession(sessionId: string, data: any, ttl: number = 3600): Promise<void> {
    await this.set(`session:${sessionId}`, data, ttl);
  }

  public static async getSession<T>(sessionId: string): Promise<T | null> {
    return await this.get<T>(`session:${sessionId}`);
  }

  public static async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  // Rate limiting
  public static async checkRateLimit(key: string, limit: number, window: number, failOpen: boolean = false): Promise<boolean> {
    try {
      const current = await this.client.incr(key);
      if (current === 1) {
        await this.client.expire(key, window);
      }
      return current <= limit;
    } catch (error) {
      LoggerService.error('Redis rate limit error:', error);
      // SECURITY: Default to fail-closed (deny) for rate limiting
      // Set failOpen=true only for non-security-critical endpoints
      if (failOpen) {
        LoggerService.warn('Rate limiting failed open due to Redis error');
        return true;
      }
      LoggerService.warn('Rate limiting failed closed due to Redis error');
      return false; // Fail closed - deny request when Redis is unavailable
    }
  }

  // Rate limiting with fail-open behavior for non-critical endpoints
  public static async checkRateLimitFailOpen(key: string, limit: number, window: number): Promise<boolean> {
    return this.checkRateLimit(key, limit, window, true);
  }

  // Pub/Sub operations
  public static async publish(channel: string, message: any): Promise<void> {
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      LoggerService.error('Redis publish error:', error);
      throw error;
    }
  }

  public static async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          callback(JSON.parse(message));
        }
      });
    } catch (error) {
      LoggerService.error('Redis subscribe error:', error);
      throw error;
    }
  }


  public static async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      LoggerService.error('Redis health check failed:', error);
      return false;
    }
  }

  // Production-ready methods for rate limiting
  public static async increment(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      LoggerService.error('Redis increment error:', error);
      throw error;
    }
  }

  public static async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      LoggerService.error('Redis expire error:', error);
      throw error;
    }
  }

  // String operations (for storing plain strings without JSON serialization)
  public static async setString(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      LoggerService.error('Redis setString error:', error);
      throw error;
    }
  }

  public static async getString(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      LoggerService.error('Redis getString error:', error);
      throw error;
    }
  }

  // Keys pattern matching
  public static async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      LoggerService.error('Redis keys error:', error);
      return [];
    }
  }


  // Circuit breaker pattern for Redis operations
  private static circuitBreakerState: Map<string, { failures: number; lastFailure: number; state: 'closed' | 'open' | 'half-open' }> = new Map();

  public static async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    fallback?: () => T,
    maxFailures: number = 5,
    timeout: number = 5000,
    resetTimeout: number = 60000
  ): Promise<T> {
    const circuitKey = `circuit_breaker:${operation.name || 'operation'}`;

    const now = Date.now();
    const state = this.circuitBreakerState.get(circuitKey) || { failures: 0, lastFailure: 0, state: 'closed' as const };

    // Check if circuit is open
    if (state.state === 'open') {
      if (now - state.lastFailure > resetTimeout) {
        // Transition to half-open
        state.state = 'half-open';
        this.circuitBreakerState.set(circuitKey, state);
        LoggerService.info('Circuit breaker transitioning to half-open');
      } else {
        LoggerService.warn('Circuit breaker open, using fallback');
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
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), timeout)
        )
      ]);

      // Reset circuit breaker on success
      state.failures = 0;
      state.state = 'closed';
      this.circuitBreakerState.set(circuitKey, state);

      return result;
    } catch (error) {
      // Increment failure count
      state.failures++;
      state.lastFailure = now;

      if (state.failures >= maxFailures) {
        state.state = 'open';
        LoggerService.warn(`Circuit breaker opened after ${state.failures} failures`);
      }

      this.circuitBreakerState.set(circuitKey, state);

      LoggerService.error('Circuit breaker operation failed:', error);

      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }
}
