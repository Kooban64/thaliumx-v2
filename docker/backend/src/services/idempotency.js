"use strict";
/**
 * Idempotency Service
 *
 * Simple in-memory idempotency store with TTL to ensure safe retries
 * for state-changing endpoints. For production, back this with Redis/DB.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyService = void 0;
const logger_1 = require("./logger");
class IdempotencyService {
    static store = new Map();
    static get(key) {
        const item = this.store.get(key);
        if (!item)
            return null;
        const now = Date.now();
        if (now - item.storedAt > item.ttlMs) {
            this.store.delete(key);
            return null;
        }
        return item;
    }
    static set(key, status, body, ttlSeconds = 600) {
        try {
            const value = {
                status,
                body,
                storedAt: Date.now(),
                ttlMs: ttlSeconds * 1000
            };
            this.store.set(key, value);
        }
        catch (error) {
            logger_1.LoggerService.warn('Failed to set idempotency cache', { error });
        }
    }
    static makeKey(parts) {
        return parts.filter(Boolean).join('::');
    }
}
exports.IdempotencyService = IdempotencyService;
//# sourceMappingURL=idempotency.js.map