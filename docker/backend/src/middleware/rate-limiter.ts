import type { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/redis';
import { LoggerService } from '../services/logger';
import { MetricsService } from '../services/metrics';

/**
 * Redis-backed rate limiting middleware following thaliumx patterns
 * Based on the original financial-svc implementation
 */
export const rateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }
    
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
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }
    
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

      // Record security metric
      MetricsService.recordRateLimitExceeded(req.path || req.originalUrl, 'auth');

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
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }
    
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

      // Record security metric
      MetricsService.recordRateLimitExceeded(req.path || req.originalUrl, 'api');

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

/**
 * Stricter rate limiter for public support endpoints
 * Tracks by IP + email combination for better abuse prevention
 */
export const publicSupportRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }

    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const email = req.body?.email || req.query?.email;
    
    // Different limits for different endpoints
    const isChatMessage = req.path.includes('/chat/sessions') && req.method === 'POST' && req.path.includes('/messages');
    const isTicketCreation = req.path.includes('/tickets') && req.method === 'POST';
    const isChatSession = req.path.includes('/chat/sessions') && req.method === 'POST' && !isChatMessage;

    let key: string;
    let maxRequests: number;
    let windowSeconds: number;
    let limitType: string;

    if (isChatMessage) {
      // Chat messages: 5 per 10 minutes per IP
      key = `public_chat_msg:${ip}:${new Date().toISOString().slice(0, 15)}`; // 10-minute bucket
      maxRequests = parseInt(process.env.PUBLIC_CHAT_RATE_LIMIT || '5');
      windowSeconds = 600; // 10 minutes
      limitType = 'chat_message';
    } else if (isTicketCreation) {
      // Ticket creation: 3 per hour per IP + email
      const emailHash = email ? Buffer.from(email).toString('base64').substring(0, 16) : 'noemail';
      key = `public_ticket:${ip}:${emailHash}:${new Date().toISOString().slice(0, 13)}`; // hour bucket
      maxRequests = parseInt(process.env.PUBLIC_TICKET_RATE_LIMIT || '3');
      windowSeconds = 3600; // 1 hour
      limitType = 'ticket_creation';
    } else if (isChatSession) {
      // Chat session creation: 3 per hour per IP
      key = `public_chat_session:${ip}:${new Date().toISOString().slice(0, 13)}`; // hour bucket
      maxRequests = 3;
      windowSeconds = 3600; // 1 hour
      limitType = 'chat_session';
    } else {
      // Default: 10 requests per 10 minutes
      key = `public_support:${ip}:${new Date().toISOString().slice(0, 15)}`;
      maxRequests = 10;
      windowSeconds = 600;
      limitType = 'general';
    }

    if (!RedisService.isConnected()) {
      LoggerService.warn('Redis not connected, skipping public support rate limit');
      return next();
    }

    const current = await RedisService.increment(key);
    if (current === 1) {
      await RedisService.expire(key, windowSeconds);
    }

    if (current > maxRequests) {
      LoggerService.logSecurity('public_support_rate_limit_exceeded', {
        ip,
        email: email ? email.substring(0, 10) + '...' : 'none',
        path: req.path,
        method: req.method,
        limitType,
        current,
        maxRequests,
        userAgent: req.get('User-Agent'),
      });

      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many ${limitType} requests. Please try again later.`,
        code: 'PUBLIC_SUPPORT_RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString(),
        retryAfter: windowSeconds,
      });
      return;
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - current).toString(),
      'X-RateLimit-Reset': new Date(Date.now() + windowSeconds * 1000).toISOString(),
      'X-RateLimit-Type': limitType,
    });

    return next();
  } catch (error: any) {
    LoggerService.error('Public support rate limiter failed (continuing)', { error: error.message });
    return next();
  }
};
