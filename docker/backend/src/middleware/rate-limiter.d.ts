import { Request, Response, NextFunction } from 'express';
/**
 * Redis-backed rate limiting middleware following thaliumx patterns
 * Based on the original financial-svc implementation
 */
export declare const rateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Stricter rate limiter for authentication endpoints
 */
export declare const authRateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * API rate limiter for general API endpoints
 */
export declare const apiRateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=rate-limiter.d.ts.map