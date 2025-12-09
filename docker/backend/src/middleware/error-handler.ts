/**
 * Error Handler Middleware
 * 
 * Comprehensive error handling, authentication, and validation middleware.
 * 
 * Features:
 * - Global error handler for all Express errors
 * - JWT token authentication middleware
 * - Role-based access control (RBAC)
 * - Permission-based access control
 * - Input validation and sanitization
 * - Rate limiting (general and financial)
 * - Security headers
 * - SQL injection protection
 * - XSS protection
 * - Request size limiting
 * 
 * Authentication:
 * - authenticateToken - Validates JWT tokens
 * - requireRole - Enforces role requirements
 * - requirePermission - Enforces permission requirements
 * 
 * Security:
 * - Input sanitization
 * - SQL injection detection
 * - XSS prevention
 * - Security headers (helmet)
 * - Rate limiting
 * 
 * Error Handling:
 * - Structured error responses
 * - Error logging
 * - Request ID tracking
 * - Stack traces in development only
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, createError } from '../utils';
import { LoggerService } from '../services/logger';
import { JWTPayload } from '../types';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// =============================================================================
// GLOBAL ERROR HANDLER
// =============================================================================

export const globalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';

  // Handle known error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
    code = 'FORBIDDEN';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not Found';
    code = 'NOT_FOUND';
  }

  // Log error
  LoggerService.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    },
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown'
  });
};

// =============================================================================
// NOT FOUND HANDLER
// =============================================================================

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const error = createError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
};

// =============================================================================
// REQUEST LOGGER
// =============================================================================

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || 'unknown';

  // Log request
  LoggerService.info('Incoming request:', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length')
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - start;
    
    LoggerService.info('Request completed:', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length')
    });
    
    return originalEnd(chunk, encoding, cb);
  };

  next();
};

// =============================================================================
// RATE LIMITER
// =============================================================================

import rateLimit from 'express-rate-limit';
import { RedisService } from '../services/redis';

// Create Redis store for distributed rate limiting
// const redisClient = RedisService.getClient(); // Used in rate limiter configuration

// Enhanced rate limiter with tiered limits
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: Request) => {
    // Dynamic limits based on user role and endpoint
    const user = req.user;
    const path = req.path;

    // Financial endpoints get stricter limits
    if (path.includes('/financial') || path.includes('/margin') || path.includes('/exchange')) {
      if (user?.role === 'super_admin' || user?.role === 'admin') {
        return 1000; // High limit for admins
      }
      return 50; // Stricter for financial operations
    }

    // Auth endpoints
    if (path.includes('/auth')) {
      return 10; // Very strict for auth
    }

    // Default limits
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      return 500;
    }

    return 100; // Standard limit
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for health checks and metrics
    return req.path === '/health' || req.path === '/metrics';
  },
  handler: (req: Request, res: Response) => {
    LoggerService.warn('Rate limit exceeded:', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId,
      role: req.user?.role
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.'
      },
      timestamp: new Date().toISOString(),
      retryAfter: Math.ceil(res.getHeader('Retry-After') as number / 1000) || 900
    });
  }
});

// Additional rate limiter for sensitive financial operations
export const financialRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute for financial operations
  message: {
    success: false,
    error: {
      code: 'FINANCIAL_RATE_LIMIT_EXCEEDED',
      message: 'Too many financial operations, please slow down.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    LoggerService.warn('Financial rate limit exceeded:', {
      ip: req.ip,
      url: req.url,
      userId: req.user?.userId,
      role: req.user?.role
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'FINANCIAL_RATE_LIMIT_EXCEEDED',
        message: 'Too many financial operations, please slow down.'
      },
      timestamp: new Date().toISOString(),
      retryAfter: 60
    });
  }
});

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

import * as jwt from 'jsonwebtoken';
// User type imported but not directly used - used in type annotations via req.user

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw createError('Access token required', 401, 'MISSING_TOKEN');
    }

    const secret = process.env.JWT_SECRET || '';
    const payload = jwt.verify(token, secret) as JWTPayload;

    // Add user info to request
    req.user = payload;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError('Invalid token', 401, 'INVALID_TOKEN'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(createError('Token expired', 401, 'TOKEN_EXPIRED'));
    } else {
      next(error);
    }
  }
};

// =============================================================================
// AUTHORIZATION MIDDLEWARE
// =============================================================================

export const requireRole = (roles: string[]) => {
  // Support legacy role names by mapping them to RBAC role IDs
  const roleAliases: Record<string, string[]> = {
    admin: ['platform-admin', 'broker-admin'],
    super_admin: ['master_system_admin', 'platform-admin'],
    finance: ['platform-finance', 'broker-finance'],
    compliance: ['platform-compliance', 'broker-compliance'],
    operations: ['platform-operations', 'broker-ops', 'broker-operations'],
    support: ['platform-support', 'broker-support'],
    risk: ['platform-risk', 'broker-risk'],
    content: ['platform-content', 'broker-content'],
    trading: ['broker-trading'],
    security_officer: ['platform-security']
  };

  // Expand provided roles with aliases
  const expandedAllowed = new Set<string>();
  for (const r of roles) {
    expandedAllowed.add(r);
    const alias = roleAliases[r];
    if (alias) alias.forEach(a => expandedAllowed.add(a));
  }

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
      return;
    }

    const userRole = req.user.role;
    if (!expandedAllowed.has(userRole)) {
      next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
      return;
    }

    next();
  };
};

export const requirePermission = (resource: string, action: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
      return;
    }

    const hasPermission = req.user.permissions.some(
      permission => permission.resource === resource && permission.action === action
    );

    if (!hasPermission) {
      next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
      return;
    }

    next();
  };
};

// =============================================================================
// TENANT MIDDLEWARE
// =============================================================================

export const requireTenant = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    return;
  }

  if (!req.user.tenantId) {
    next(createError('Tenant context required', 400, 'TENANT_REQUIRED'));
    return;
  }

  next();
};

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

import * as Joi from 'joi';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      next(createError(`Validation error: ${errorMessage}`, 400, 'VALIDATION_ERROR'));
      return;
    }

    next();
  };
};

// =============================================================================
// ASYNC ERROR HANDLER
// =============================================================================

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// =============================================================================
// REQUEST ID MIDDLEWARE
// =============================================================================

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
};

// =============================================================================
// SECURITY HEADERS MIDDLEWARE
// =============================================================================

export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Strict-Transport-Security (only for HTTPS)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

// =============================================================================
// INPUT SANITIZATION MIDDLEWARE
// =============================================================================

import * as DOMPurifyModule from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = (DOMPurifyModule as any).default || DOMPurifyModule;
const DOMPurifyInstance = DOMPurify(window as any);

export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize string fields in body
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return DOMPurifyInstance.sanitize(obj, { ALLOWED_TAGS: [] });
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// =============================================================================
// SQL INJECTION PROTECTION MIDDLEWARE
// =============================================================================

export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  const suspiciousPatterns = [
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
    /('|(\\x27)|(\\x2D\\x2D)|(\#)|(\%27)|(\%22)|(\%3B)|(\%3C)|(\%3E)|(\%00)|(\%2D\\x2D))/i,
    /('|(\\x27)|(\\x2D\\x2D)|(\#)|(\%27)|(\%22)|(\%3B)|(\%3C)|(\%3E)|(\%00)|(\%2D\\x2D)|(\;)|(\-\-)|(\#)|(\*))/i
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    } else if (Array.isArray(value)) {
      return value.some(checkValue);
    } else if (value && typeof value === 'object') {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  const hasSuspiciousContent = checkValue(req.body) || checkValue(req.query) || checkValue(req.params);

  if (hasSuspiciousContent) {
    LoggerService.warn('SQL injection attempt detected', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId
    });

    return next(createError('Invalid input detected', 400, 'INVALID_INPUT'));
  }

  next();
};

// =============================================================================
// XSS PROTECTION MIDDLEWARE
// =============================================================================

export const xssProtection = (req: Request, res: Response, next: NextFunction): void => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
  ];

  const checkXSS = (value: any): boolean => {
    if (typeof value === 'string') {
      return xssPatterns.some(pattern => pattern.test(value));
    } else if (Array.isArray(value)) {
      return value.some(checkXSS);
    } else if (value && typeof value === 'object') {
      return Object.values(value).some(checkXSS);
    }
    return false;
  };

  const hasXSS = checkXSS(req.body) || checkXSS(req.query) || checkXSS(req.params);

  if (hasXSS) {
    LoggerService.warn('XSS attempt detected', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId
    });

    return next(createError('Invalid input detected', 400, 'INVALID_INPUT'));
  }

  next();
};

// =============================================================================
// API KEY VALIDATION MIDDLEWARE
// =============================================================================

export const validateApiKey = (req: Request, _res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return next(createError('API key required', 401, 'MISSING_API_KEY'));
  }

  // In production, validate against database or cache
  // For now, accept any key (this should be replaced with proper validation)
  const validKeys = process.env.VALID_API_KEYS?.split(',') || [];
  if (!validKeys.includes(apiKey)) {
    LoggerService.warn('Invalid API key attempt', {
      ip: req.ip,
      url: req.url,
      apiKey: apiKey.substring(0, 8) + '...' // Log partial key for debugging
    });

    return next(createError('Invalid API key', 401, 'INVALID_API_KEY'));
  }

  next();
};

// =============================================================================
// REQUEST SIZE LIMIT MIDDLEWARE
// =============================================================================

export const requestSizeLimit = (req: Request, _res: Response, next: NextFunction): void => {
  const contentLength = parseInt(req.headers['content-length'] || '0');

  // Limit to 10MB for regular requests, 50MB for file uploads
  const maxSize = req.path.includes('/upload') || req.path.includes('/kyc') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

  if (contentLength > maxSize) {
    LoggerService.warn('Request size limit exceeded', {
      ip: req.ip,
      url: req.url,
      contentLength,
      maxSize
    });

    return next(createError('Request too large', 413, 'REQUEST_TOO_LARGE'));
  }

  next();
};
