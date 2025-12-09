/**
 * Idempotency Service
 *
 * Simple in-memory idempotency store with TTL to ensure safe retries
 * for state-changing endpoints. For production, back this with Redis/DB.
 */

import { LoggerService } from './logger';

type CachedValue = {
  status: number;
  body: any;
  storedAt: number;
  ttlMs: number;
};

export class IdempotencyService {
  private static store: Map<string, CachedValue> = new Map();

  public static get(key: string): CachedValue | null {
    const item = this.store.get(key);
    if (!item) return null;
    const now = Date.now();
    if (now - item.storedAt > item.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return item;
  }

  public static set(key: string, status: number, body: any, ttlSeconds = 600): void {
    try {
      const value: CachedValue = {
        status,
        body,
        storedAt: Date.now(),
        ttlMs: ttlSeconds * 1000
      };
      this.store.set(key, value);
    } catch (error) {
      LoggerService.warn('Failed to set idempotency cache', { error });
    }
  }

  public static makeKey(parts: Array<string | number | undefined | null>): string {
    return parts.filter(Boolean).join('::');
  }
}


