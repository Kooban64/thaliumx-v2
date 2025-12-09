/**
 * Idempotency Service
 *
 * Simple in-memory idempotency store with TTL to ensure safe retries
 * for state-changing endpoints. For production, back this with Redis/DB.
 */
type CachedValue = {
    status: number;
    body: any;
    storedAt: number;
    ttlMs: number;
};
export declare class IdempotencyService {
    private static store;
    static get(key: string): CachedValue | null;
    static set(key: string, status: number, body: any, ttlSeconds?: number): void;
    static makeKey(parts: Array<string | number | undefined | null>): string;
}
export {};
//# sourceMappingURL=idempotency.d.ts.map