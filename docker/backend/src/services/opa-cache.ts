/**
 * OPA Cache Service
 * 
 * Multi-tier caching for OPA policy evaluation results:
 * - L1: In-memory LRU cache (fast, short TTL: 30-60s)
 * - L2: Redis cache (distributed, longer TTL: 5-10min)
 * 
 * Cache Strategy:
 * - Security policies: 30s (memory), 5min (Redis)
 * - AML policies: 60s (memory), 10min (Redis)
 * - RBAC policies: 5min (memory), 15min (Redis)
 */

import crypto from 'crypto';
import { LoggerService } from './logger';
import { RedisService } from './redis';
import type { OPAInput, OPADecision } from './opa';

interface CacheEntry {
  value: OPADecision[];
  expires: number;
}

export class OPACacheService {
  private static instance: OPACacheService | null = null;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private maxMemoryEntries = 1000; // Limit memory cache size
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start cleanup interval to remove expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Cleanup every minute
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): OPACacheService {
    if (!OPACacheService.instance) {
      OPACacheService.instance = new OPACacheService();
    }
    return OPACacheService.instance;
  }

  /**
   * Normalize OPA input for consistent cache keys
   * Removes volatile fields and normalizes structure
   */
  private normalizeInput(input: OPAInput): OPAInput {
    const normalized: OPAInput = {
      action: input.action,
      user: {
        id: input.user?.id,
        role: input.user?.role,
        roles: input.user?.roles,
        tenantId: input.user?.tenantId,
        brokerId: input.user?.brokerId,
        kyc_level: input.user?.kyc_level,
        kyc_limit: input.user?.kyc_limit,
        kyc_usage: input.user?.kyc_usage,
        kyc_usage_percentage: input.user?.kyc_usage_percentage,
        required_kyc_level: input.user?.required_kyc_level
      },
      resource: {
        type: input.resource?.type,
        id: input.resource?.id
      },
      transaction: {
        amount: input.transaction?.amount,
        currency: input.transaction?.currency,
        type: input.transaction?.type
      }
    };
    return normalized;
  }

  /**
   * Generate cache key from normalized input
   */
  public generateCacheKey(input: OPAInput, policyType: 'aml' | 'security' | 'rbac' = 'security'): string {
    const normalized = this.normalizeInput(input);
    const keyString = JSON.stringify({ policyType, input: normalized });
    return `opa:${policyType}:${crypto.createHash('sha256').update(keyString).digest('hex')}`;
  }

  /**
   * Get cached result (checks memory first, then Redis)
   */
  public async get(key: string): Promise<OPADecision[] | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && memoryEntry.expires > Date.now()) {
      LoggerService.debug('OPA cache hit (memory)', { key });
      return memoryEntry.value;
    }
    if (memoryEntry) {
      // Expired, remove it
      this.memoryCache.delete(key);
    }

    // Check Redis cache
    if (RedisService.isConnected()) {
      try {
        const cached = await RedisService.getString(key);
        if (cached) {
          const entry = JSON.parse(cached) as CacheEntry;
          if (entry.expires > Date.now()) {
            LoggerService.debug('OPA cache hit (Redis)', { key });
            // Also store in memory cache for faster access
            this.setMemoryCache(key, entry.value, entry.expires - Date.now());
            return entry.value;
          }
        }
      } catch (error) {
        LoggerService.debug('OPA Redis cache read failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    LoggerService.debug('OPA cache miss', { key });
    return null;
  }

  /**
   * Set cached result (stores in both memory and Redis)
   */
  public async set(key: string, value: OPADecision[], policyType: 'aml' | 'security' | 'rbac' = 'security'): Promise<void> {
    // Determine TTL based on policy type
    const memoryTTL = policyType === 'rbac' ? 300000 : policyType === 'aml' ? 60000 : 30000; // 5min, 1min, 30s
    const redisTTL = policyType === 'rbac' ? 900 : policyType === 'aml' ? 600 : 300; // 15min, 10min, 5min

    // Store in memory cache
    this.setMemoryCache(key, value, memoryTTL);

    // Store in Redis cache
    if (RedisService.isConnected()) {
      try {
        const entry: CacheEntry = { value, expires: Date.now() + (redisTTL * 1000) };
        await RedisService.setString(key, JSON.stringify(entry), redisTTL);
      } catch (error) {
        LoggerService.debug('OPA Redis cache write failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  /**
   * Set memory cache entry with size limit
   */
  private setMemoryCache(key: string, value: OPADecision[], ttl: number): void {
    // Evict oldest entries if cache is full
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }

  /**
   * Cleanup expired memory cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expires <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Invalidate cache for a specific key or pattern
   */
  public async invalidate(keyOrPattern: string): Promise<void> {
    // Remove from memory cache
    if (this.memoryCache.has(keyOrPattern)) {
      this.memoryCache.delete(keyOrPattern);
    }

    // Remove from Redis (if exact key match)
    if (RedisService.isConnected() && !keyOrPattern.includes('*')) {
      try {
        await RedisService.del(keyOrPattern);
      } catch (error) {
        LoggerService.debug('OPA cache invalidation failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  /**
   * Clear all caches
   */
  public async clear(): Promise<void> {
    this.memoryCache.clear();
    // Redis clear would require pattern matching - implement if needed
  }

  /**
   * Get cache statistics
   */
  public getStats(): { memorySize: number; memoryEntries: number } {
    return {
      memorySize: this.memoryCache.size,
      memoryEntries: this.memoryCache.size
    };
  }
}

// Export singleton instance
export const opaCacheService = OPACacheService.getInstance();
