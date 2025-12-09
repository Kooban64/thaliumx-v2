"use strict";
/**
 * Request Logger Middleware
 *
 * Comprehensive HTTP request and response logging middleware.
 *
 * Features:
 * - Request ID generation and tracking
 * - Request logging (method, URL, IP, user agent)
 * - Response logging (status, duration)
 * - Error logging with stack traces
 * - Request/response correlation via request ID
 *
 * Logging:
 * - Incoming requests logged at info level
 * - Responses logged with duration
 * - Errors logged with full context
 * - Request ID included in all logs
 *
 * Request ID:
 * - Generated if not provided in headers
 * - Added to response headers
 * - Used for log correlation
 * - Supports distributed tracing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const logger_1 = require("../services/logger");
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Add request ID to request object
    req.requestId = requestId;
    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);
    // Log request
    logger_1.LoggerService.info('Incoming request', {
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });
    // Override res.end to log response
    const originalEnd = res.end.bind(res);
    res.end = function (chunk, encoding, cb) {
        const duration = Date.now() - start;
        logger_1.LoggerService.info('Request completed', {
            requestId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        });
        return originalEnd(chunk, encoding, cb);
    };
    next();
};
exports.requestLogger = requestLogger;
//# sourceMappingURL=request-logger.js.map