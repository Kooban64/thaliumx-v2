import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/redis';
import { LoggerService } from '../services/logger';
import { ConfigService } from '../services/config';

/**
 * Redis-backed rate limiting middleware following thaliumx patterns
 * Based on the original financial-svc implementation
 */
export const rateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Health endpoints are exempt
    if (req.path.includes('/health') || req.path.includes('/ready') || req.path.includes('/live')) {
      return next();
    }

    const tenantId = (req.headers['x-tenant-id'] as string) || 'global';
    const userId = req.user?.userId;
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const rateKey = userId ? `user:${userId}` : `ip:${ip}`;
    const key = `ratelimit:${tenantId}:${rateKey}:${new Date().toISOString().slice(0, 16)}`; // minute bucket
    const maxRequests = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '120');

    // If Redis not ready yet, fail-open
    if (!RedisService.isConnected()) {
      return next();
    }

    const current = await RedisService.increment(key);
    if (current === 1) {
      await RedisService.expire(key, 60);
    }
    
    if (current > maxRequests) {
      LoggerService.warn('Rate limit exceeded', {
        key: rateKey,
        tenantId,
        path: req.path,
        method: req.method,
        current,
        maxRequests
      });

      res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'rate_limited'
      });
      return;
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - current).toString(),
      'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString()
    });

    return next();
  } catch (error: any) {
    LoggerService.error('Rate limiter failed (continuing)', { error: error.message });
    return next();
  }
};

/**
 * Stricter rate limiter for authentication endpoints
 */
export const authRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const key = `auth_ratelimit:${ip}:${new Date().toISOString().slice(0, 16)}`; // minute bucket
    const maxRequests = 5; // 5 auth attempts per minute

    if (!RedisService.isConnected()) {
      return next();
    }

    const current = await RedisService.increment(key);
    if (current === 1) {
      await RedisService.expire(key, 60);
    }
    
    if (current > maxRequests) {
      LoggerService.logSecurity('auth_rate_limit_exceeded', {
        ip,
        path: req.path,
        method: req.method,
        current,
        maxRequests
      });

      res.status(429).json({
        success: false,
        error: 'Too many authentication attempts',
        message: 'Please wait before trying again.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'auth_rate_limited'
      });
      return;
    }

    return next();
  } catch (error: any) {
    LoggerService.error('Auth rate limiter failed (continuing)', { error: error.message });
    return next();
  }
};

/**
 * API rate limiter for general API endpoints
 */
export const apiRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = (req.headers['x-tenant-id'] as string) || 'global';
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const key = `api_ratelimit:${tenantId}:${ip}:${new Date().toISOString().slice(0, 16)}`; // minute bucket
    const maxRequests = 100; // 100 API requests per minute

    if (!RedisService.isConnected()) {
      return next();
    }

    const current = await RedisService.increment(key);
    if (current === 1) {
      await RedisService.expire(key, 60);
    }
    
    if (current > maxRequests) {
      LoggerService.warn('API rate limit exceeded', {
        ip,
        tenantId,
        path: req.path,
        method: req.method,
        current,
        maxRequests
      });

      res.status(429).json({
        success: false,
        error: 'API rate limit exceeded',
        message: 'Please try again later.',
        code: 'API_RATE_LIMIT_EXCEEDED',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'api_rate_limited'
      });
      return;
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - current).toString(),
      'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString()
    });

    return next();
  } catch (error: any) {
    LoggerService.error('API rate limiter failed (continuing)', { error: error.message });
    return next();
  }
};
