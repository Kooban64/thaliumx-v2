"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestSizeLimit = exports.validateApiKey = exports.xssProtection = exports.sqlInjectionProtection = exports.sanitizeInput = exports.securityHeaders = exports.requestId = exports.asyncHandler = exports.validateRequest = exports.requireTenant = exports.requirePermission = exports.requireRole = exports.authenticateToken = exports.financialRateLimiter = exports.rateLimiter = exports.requestLogger = exports.notFoundHandler = exports.globalErrorHandler = void 0;
const utils_1 = require("../utils");
const logger_1 = require("../services/logger");
// =============================================================================
// GLOBAL ERROR HANDLER
// =============================================================================
const globalErrorHandler = (error, req, res, _next) => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let code = 'INTERNAL_ERROR';
    // Handle known error types
    if (error instanceof utils_1.AppError) {
        statusCode = error.statusCode;
        message = error.message;
        code = error.code;
    }
    else if (error.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
        code = 'VALIDATION_ERROR';
    }
    else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
        code = 'UNAUTHORIZED';
    }
    else if (error.name === 'ForbiddenError') {
        statusCode = 403;
        message = 'Forbidden';
        code = 'FORBIDDEN';
    }
    else if (error.name === 'NotFoundError') {
        statusCode = 404;
        message = 'Not Found';
        code = 'NOT_FOUND';
    }
    // Log error
    logger_1.LoggerService.error('Error occurred:', {
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
exports.globalErrorHandler = globalErrorHandler;
// =============================================================================
// NOT FOUND HANDLER
// =============================================================================
const notFoundHandler = (req, _res, next) => {
    const error = (0, utils_1.createError)(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
    next(error);
};
exports.notFoundHandler = notFoundHandler;
// =============================================================================
// REQUEST LOGGER
// =============================================================================
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || 'unknown';
    // Log request
    logger_1.LoggerService.info('Incoming request:', {
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length')
    });
    // Override res.end to log response
    const originalEnd = res.end.bind(res);
    res.end = function (chunk, encoding, cb) {
        const duration = Date.now() - start;
        logger_1.LoggerService.info('Request completed:', {
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
exports.requestLogger = requestLogger;
// =============================================================================
// RATE LIMITER
// =============================================================================
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Create Redis store for distributed rate limiting
// const redisClient = RedisService.getClient(); // Used in rate limiter configuration
// Enhanced rate limiter with tiered limits
exports.rateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
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
    skip: (req) => {
        // Skip rate limiting for health checks and metrics
        return req.path === '/health' || req.path === '/metrics';
    },
    handler: (req, res) => {
        logger_1.LoggerService.warn('Rate limit exceeded:', {
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
            retryAfter: Math.ceil(res.getHeader('Retry-After') / 1000) || 900
        });
    }
});
// Additional rate limiter for sensitive financial operations
exports.financialRateLimiter = (0, express_rate_limit_1.default)({
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
    handler: (req, res) => {
        logger_1.LoggerService.warn('Financial rate limit exceeded:', {
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
const jwt = __importStar(require("jsonwebtoken"));
// User type imported but not directly used - used in type annotations via req.user
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            throw (0, utils_1.createError)('Access token required', 401, 'MISSING_TOKEN');
        }
        const secret = process.env.JWT_SECRET || '';
        const payload = jwt.verify(token, secret);
        // Add user info to request
        req.user = payload;
        next();
    }
    catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            next((0, utils_1.createError)('Invalid token', 401, 'INVALID_TOKEN'));
        }
        else if (error instanceof jwt.TokenExpiredError) {
            next((0, utils_1.createError)('Token expired', 401, 'TOKEN_EXPIRED'));
        }
        else {
            next(error);
        }
    }
};
exports.authenticateToken = authenticateToken;
// =============================================================================
// AUTHORIZATION MIDDLEWARE
// =============================================================================
const requireRole = (roles) => {
    // Support legacy role names by mapping them to RBAC role IDs
    const roleAliases = {
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
    const expandedAllowed = new Set();
    for (const r of roles) {
        expandedAllowed.add(r);
        const alias = roleAliases[r];
        if (alias)
            alias.forEach(a => expandedAllowed.add(a));
    }
    return (req, _res, next) => {
        if (!req.user) {
            next((0, utils_1.createError)('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
            return;
        }
        const userRole = req.user.role;
        if (!expandedAllowed.has(userRole)) {
            next((0, utils_1.createError)('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
const requirePermission = (resource, action) => {
    return (req, _res, next) => {
        if (!req.user) {
            next((0, utils_1.createError)('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
            return;
        }
        const hasPermission = req.user.permissions.some(permission => permission.resource === resource && permission.action === action);
        if (!hasPermission) {
            next((0, utils_1.createError)('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
            return;
        }
        next();
    };
};
exports.requirePermission = requirePermission;
// =============================================================================
// TENANT MIDDLEWARE
// =============================================================================
const requireTenant = (req, _res, next) => {
    if (!req.user) {
        next((0, utils_1.createError)('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
        return;
    }
    if (!req.user.tenantId) {
        next((0, utils_1.createError)('Tenant context required', 400, 'TENANT_REQUIRED'));
        return;
    }
    next();
};
exports.requireTenant = requireTenant;
const validateRequest = (schema) => {
    return (req, _res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            const errorMessage = error.details.map(detail => detail.message).join(', ');
            next((0, utils_1.createError)(`Validation error: ${errorMessage}`, 400, 'VALIDATION_ERROR'));
            return;
        }
        next();
    };
};
exports.validateRequest = validateRequest;
// =============================================================================
// ASYNC ERROR HANDLER
// =============================================================================
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
// =============================================================================
// REQUEST ID MIDDLEWARE
// =============================================================================
const requestId = (req, res, next) => {
    const id = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-ID', id);
    next();
};
exports.requestId = requestId;
// =============================================================================
// SECURITY HEADERS MIDDLEWARE
// =============================================================================
const securityHeaders = (req, res, next) => {
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
exports.securityHeaders = securityHeaders;
// =============================================================================
// INPUT SANITIZATION MIDDLEWARE
// =============================================================================
const DOMPurifyModule = __importStar(require("dompurify"));
const jsdom_1 = require("jsdom");
const window = new jsdom_1.JSDOM('').window;
const DOMPurify = DOMPurifyModule.default || DOMPurifyModule;
const DOMPurifyInstance = DOMPurify(window);
const sanitizeInput = (req, res, next) => {
    // Sanitize string fields in body
    const sanitizeObject = (obj) => {
        if (typeof obj === 'string') {
            return DOMPurifyInstance.sanitize(obj, { ALLOWED_TAGS: [] });
        }
        else if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }
        else if (obj && typeof obj === 'object') {
            const sanitized = {};
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
exports.sanitizeInput = sanitizeInput;
// =============================================================================
// SQL INJECTION PROTECTION MIDDLEWARE
// =============================================================================
const sqlInjectionProtection = (req, res, next) => {
    const suspiciousPatterns = [
        /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
        /('|(\\x27)|(\\x2D\\x2D)|(\#)|(\%27)|(\%22)|(\%3B)|(\%3C)|(\%3E)|(\%00)|(\%2D\\x2D))/i,
        /('|(\\x27)|(\\x2D\\x2D)|(\#)|(\%27)|(\%22)|(\%3B)|(\%3C)|(\%3E)|(\%00)|(\%2D\\x2D)|(\;)|(\-\-)|(\#)|(\*))/i
    ];
    const checkValue = (value) => {
        if (typeof value === 'string') {
            return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        else if (Array.isArray(value)) {
            return value.some(checkValue);
        }
        else if (value && typeof value === 'object') {
            return Object.values(value).some(checkValue);
        }
        return false;
    };
    const hasSuspiciousContent = checkValue(req.body) || checkValue(req.query) || checkValue(req.params);
    if (hasSuspiciousContent) {
        logger_1.LoggerService.warn('SQL injection attempt detected', {
            ip: req.ip,
            url: req.url,
            userAgent: req.get('User-Agent'),
            userId: req.user?.userId
        });
        return next((0, utils_1.createError)('Invalid input detected', 400, 'INVALID_INPUT'));
    }
    next();
};
exports.sqlInjectionProtection = sqlInjectionProtection;
// =============================================================================
// XSS PROTECTION MIDDLEWARE
// =============================================================================
const xssProtection = (req, res, next) => {
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
    const checkXSS = (value) => {
        if (typeof value === 'string') {
            return xssPatterns.some(pattern => pattern.test(value));
        }
        else if (Array.isArray(value)) {
            return value.some(checkXSS);
        }
        else if (value && typeof value === 'object') {
            return Object.values(value).some(checkXSS);
        }
        return false;
    };
    const hasXSS = checkXSS(req.body) || checkXSS(req.query) || checkXSS(req.params);
    if (hasXSS) {
        logger_1.LoggerService.warn('XSS attempt detected', {
            ip: req.ip,
            url: req.url,
            userAgent: req.get('User-Agent'),
            userId: req.user?.userId
        });
        return next((0, utils_1.createError)('Invalid input detected', 400, 'INVALID_INPUT'));
    }
    next();
};
exports.xssProtection = xssProtection;
// =============================================================================
// API KEY VALIDATION MIDDLEWARE
// =============================================================================
const validateApiKey = (req, _res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return next((0, utils_1.createError)('API key required', 401, 'MISSING_API_KEY'));
    }
    // In production, validate against database or cache
    // For now, accept any key (this should be replaced with proper validation)
    const validKeys = process.env.VALID_API_KEYS?.split(',') || [];
    if (!validKeys.includes(apiKey)) {
        logger_1.LoggerService.warn('Invalid API key attempt', {
            ip: req.ip,
            url: req.url,
            apiKey: apiKey.substring(0, 8) + '...' // Log partial key for debugging
        });
        return next((0, utils_1.createError)('Invalid API key', 401, 'INVALID_API_KEY'));
    }
    next();
};
exports.validateApiKey = validateApiKey;
// =============================================================================
// REQUEST SIZE LIMIT MIDDLEWARE
// =============================================================================
const requestSizeLimit = (req, _res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    // Limit to 10MB for regular requests, 50MB for file uploads
    const maxSize = req.path.includes('/upload') || req.path.includes('/kyc') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (contentLength > maxSize) {
        logger_1.LoggerService.warn('Request size limit exceeded', {
            ip: req.ip,
            url: req.url,
            contentLength,
            maxSize
        });
        return next((0, utils_1.createError)('Request too large', 413, 'REQUEST_TOO_LARGE'));
    }
    next();
};
exports.requestSizeLimit = requestSizeLimit;
//# sourceMappingURL=error-handler.js.map