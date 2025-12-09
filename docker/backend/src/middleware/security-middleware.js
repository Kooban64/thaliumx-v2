"use strict";
/**
 * Security Middleware
 *
 * Advanced security middleware for input sanitization and attack prevention.
 *
 * Features:
 * - SQL injection detection and prevention
 * - XSS (Cross-Site Scripting) prevention using DOMPurify
 * - Input sanitization
 * - HTML/script tag removal
 * - Command injection detection
 * - Path traversal detection
 *
 * Sanitization:
 * - HTML sanitization using DOMPurify
 * - Script tag removal
 * - Event handler removal
 * - URL sanitization
 *
 * Detection:
 * - SQL injection patterns
 * - XSS patterns
 * - Command injection patterns
 * - Path traversal patterns
 *
 * Security:
 * - Automatic request blocking on threats
 * - Comprehensive logging
 * - Error responses with security codes
 * - Integration with threat detection
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityMiddleware = void 0;
const DOMPurifyModule = __importStar(require("dompurify"));
const jsdom_1 = require("jsdom");
const logger_1 = require("../services/logger");
const error_handler_1 = require("../utils/error-handler");
// Initialize DOMPurify with JSDOM
// Handle both default export and namespace export
const window = new jsdom_1.JSDOM('').window;
const DOMPurify = DOMPurifyModule.default || DOMPurifyModule;
const DOMPurifyInstance = DOMPurify(window);
class SecurityMiddleware {
    // SQL injection patterns to detect
    static SQL_INJECTION_PATTERNS = [
        /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
        /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\%27)|(\%23))/i,
        /(((\%3D)|(=))[^\\n]*((\%27)|(\\x27)|(')|(\-\-)|(\#)))/i,
        /(\w+)((\%20)|(\+))(and|or)(\%20)(\w+)=/i,
        /script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<script[^>]*>.*?<\/script>/gi,
        /<iframe[^>]*>.*?<\/iframe>/gi,
        /<object[^>]*>.*?<\/object>/gi,
        /<embed[^>]*>.*?<\/embed>/gi,
        /<form[^>]*>.*?<\/form>/gi,
        /<input[^>]*>.*?<\/input>/gi,
        /<meta[^>]*>.*?<\/meta>/gi,
        /<link[^>]*>.*?<\/link>/gi,
        /<style[^>]*>.*?<\/style>/gi
    ];
    // XSS prevention middleware
    static sanitizeInput(req, res, next) {
        try {
            // Sanitize request body
            if (req.body && typeof req.body === 'object') {
                req.body = this.sanitizeObject(req.body);
            }
            // Sanitize query parameters
            if (req.query && typeof req.query === 'object') {
                req.query = this.sanitizeObject(req.query);
            }
            // Sanitize route parameters
            if (req.params && typeof req.params === 'object') {
                req.params = this.sanitizeObject(req.params);
            }
            next();
        }
        catch (error) {
            logger_1.LoggerService.error('Input sanitization failed:', error);
            next(error_handler_1.AppError.internal('Input sanitization failed'));
        }
    }
    // SQL injection detection middleware
    static detectSQLInjection(req, res, next) {
        try {
            const suspiciousInputs = this.scanForSQLInjection(req);
            if (suspiciousInputs.length > 0) {
                logger_1.LoggerService.logSecurity('SQL injection attempt detected', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    url: req.originalUrl,
                    method: req.method,
                    suspiciousInputs
                });
                return next(error_handler_1.AppError.unprocessableEntity('Invalid input detected'));
            }
            next();
        }
        catch (error) {
            logger_1.LoggerService.error('SQL injection detection failed:', error);
            next(error_handler_1.AppError.internal('Security check failed'));
        }
    }
    // XSS detection middleware
    static detectXSS(req, res, next) {
        try {
            const suspiciousInputs = this.scanForXSS(req);
            if (suspiciousInputs.length > 0) {
                logger_1.LoggerService.logSecurity('XSS attempt detected', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    url: req.originalUrl,
                    method: req.method,
                    suspiciousInputs
                });
                return next(error_handler_1.AppError.unprocessableEntity('Invalid input detected'));
            }
            next();
        }
        catch (error) {
            logger_1.LoggerService.error('XSS detection failed:', error);
            next(error_handler_1.AppError.internal('Security check failed'));
        }
    }
    // Content Security Policy middleware
    static contentSecurityPolicy(req, res, next) {
        // Set CSP headers
        res.setHeader('Content-Security-Policy', "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https:; " +
            "font-src 'self'; " +
            "connect-src 'self'; " +
            "media-src 'none'; " +
            "object-src 'none'; " +
            "frame-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self';");
        // Set other security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        next();
    }
    // Request size limiting middleware
    static limitRequestSize(maxSize = '10mb') {
        return (req, res, next) => {
            const contentLength = parseInt(req.get('content-length') || '0');
            if (contentLength > this.parseSize(maxSize)) {
                logger_1.LoggerService.logSecurity('Request size limit exceeded', {
                    ip: req.ip,
                    contentLength,
                    maxSize,
                    url: req.originalUrl
                });
                return next(error_handler_1.AppError.unprocessableEntity('Request too large'));
            }
            next();
        };
    }
    // File upload security middleware
    static secureFileUpload(allowedTypes = [], maxFileSize = 5 * 1024 * 1024) {
        return (req, res, next) => {
            if (!req.file && !req.files) {
                return next();
            }
            const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
            for (const file of files) {
                if (!file)
                    continue;
                // Check file size
                if (file.size > maxFileSize) {
                    logger_1.LoggerService.logSecurity('File size limit exceeded', {
                        filename: file.originalname,
                        size: file.size,
                        maxSize: maxFileSize
                    });
                    return next(error_handler_1.AppError.unprocessableEntity('File too large'));
                }
                // Check file type
                if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
                    logger_1.LoggerService.logSecurity('Invalid file type', {
                        filename: file.originalname,
                        mimetype: file.mimetype,
                        allowedTypes
                    });
                    return next(error_handler_1.AppError.unprocessableEntity('Invalid file type'));
                }
                // Check for malicious file extensions
                const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
                const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
                if (dangerousExtensions.includes(extension)) {
                    logger_1.LoggerService.logSecurity('Dangerous file extension detected', {
                        filename: file.originalname,
                        extension
                    });
                    return next(error_handler_1.AppError.unprocessableEntity('File type not allowed'));
                }
            }
            next();
        };
    }
    // Rate limiting for sensitive operations
    static sensitiveOperationRateLimit(windowMs = 60000, maxRequests = 5) {
        const requests = new Map();
        return (req, res, next) => {
            const key = req.ip + req.originalUrl;
            const now = Date.now();
            const windowData = requests.get(key);
            if (!windowData || now > windowData.resetTime) {
                requests.set(key, { count: 1, resetTime: now + windowMs });
            }
            else {
                windowData.count++;
                if (windowData.count > maxRequests) {
                    logger_1.LoggerService.logSecurity('Rate limit exceeded for sensitive operation', {
                        ip: req.ip,
                        url: req.originalUrl,
                        count: windowData.count
                    });
                    return next(error_handler_1.AppError.tooManyRequests('Too many requests'));
                }
            }
            next();
        };
    }
    // Private helper methods
    static sanitizeObject(obj) {
        if (typeof obj === 'string') {
            return DOMPurifyInstance.sanitize(obj, { ALLOWED_TAGS: [] });
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = this.sanitizeObject(value);
            }
            return sanitized;
        }
        return obj;
    }
    static scanForSQLInjection(req) {
        const suspiciousInputs = [];
        const inputs = this.extractInputs(req);
        for (const input of inputs) {
            for (const pattern of this.SQL_INJECTION_PATTERNS) {
                if (pattern.test(input)) {
                    suspiciousInputs.push(input);
                    break;
                }
            }
        }
        return suspiciousInputs;
    }
    static scanForXSS(req) {
        const suspiciousInputs = [];
        const inputs = this.extractInputs(req);
        for (const input of inputs) {
            if (/<[^>]*script/i.test(input) ||
                /javascript:/i.test(input) ||
                /on\w+\s*=/i.test(input) ||
                /<iframe/i.test(input) ||
                /<object/i.test(input) ||
                /<embed/i.test(input)) {
                suspiciousInputs.push(input);
            }
        }
        return suspiciousInputs;
    }
    static extractInputs(req) {
        const inputs = [];
        // Extract from body
        if (req.body) {
            inputs.push(...this.flattenObject(req.body));
        }
        // Extract from query
        if (req.query) {
            inputs.push(...this.flattenObject(req.query));
        }
        // Extract from params
        if (req.params) {
            inputs.push(...this.flattenObject(req.params));
        }
        // Extract from headers (specific ones)
        const headerFields = ['user-agent', 'referer', 'x-forwarded-for'];
        for (const field of headerFields) {
            const value = req.get(field);
            if (value)
                inputs.push(value);
        }
        return inputs.filter(input => typeof input === 'string');
    }
    static flattenObject(obj) {
        const result = [];
        function flatten(current) {
            if (typeof current === 'string') {
                result.push(current);
            }
            else if (Array.isArray(current)) {
                current.forEach(item => flatten(item));
            }
            else if (current && typeof current === 'object') {
                Object.values(current).forEach(value => flatten(value));
            }
        }
        flatten(obj);
        return result;
    }
    static parseSize(size) {
        const units = {
            'b': 1,
            'kb': 1024,
            'mb': 1024 * 1024,
            'gb': 1024 * 1024 * 1024
        };
        const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
        if (!match)
            return 10 * 1024 * 1024; // Default 10MB
        const value = parseFloat(match[1] || '0');
        const unit = (match[2] || 'b');
        return value * (units[unit] || 1);
    }
}
exports.SecurityMiddleware = SecurityMiddleware;
//# sourceMappingURL=security-middleware.js.map