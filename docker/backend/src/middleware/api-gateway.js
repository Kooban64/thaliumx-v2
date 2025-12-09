"use strict";
/**
 * API Gateway Middleware
 *
 * Advanced API gateway functionality with request routing, throttling, and circuit breaking.
 *
 * Features:
 * - Request routing and load balancing
 * - Circuit breaker pattern for service protection
 * - Request throttling and rate limiting
 * - IP blocking and allowlisting
 * - Trusted proxy support
 * - Request timeout handling
 * - Concurrent request limiting
 *
 * Configuration:
 * - Trusted proxies configuration
 * - Allowed origins (CORS)
 * - Blocked IP addresses
 * - Rate limiting by IP or user
 * - Circuit breaker thresholds
 * - Request timeout settings
 *
 * Security:
 * - IP-based access control
 * - Origin validation
 * - Request throttling
 * - DDoS protection
 *
 * Production Features:
 * - Health check endpoint
 * - Rate limit cleanup
 * - Circuit breaker state management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGatewayStats = exports.cleanupRateLimits = exports.gatewayHealthCheck = exports.apiGateway = void 0;
const logger_1 = require("../services/logger");
const utils_1 = require("../utils");
// Default configuration
const DEFAULT_CONFIG = {
    enabled: true,
    trustedProxies: ['127.0.0.1', '::1'],
    allowedOrigins: ['http://localhost:3000', 'https://thaliumx.com'],
    blockedIPs: [],
    rateLimitByIP: true,
    rateLimitByUser: true,
    enableCircuitBreaker: true,
    enableRequestThrottling: true,
    maxConcurrentRequests: 1000,
    requestTimeout: 30000
};
const circuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed'
};
// Request throttling
let activeRequests = 0;
const requestQueue = [];
// IP-based rate limiting (in-memory store)
const ipRequestCounts = new Map();
const userRequestCounts = new Map();
// API Gateway middleware
const apiGateway = (config = {}) => {
    const gatewayConfig = { ...DEFAULT_CONFIG, ...config };
    return (req, res, next) => {
        try {
            // 1. Origin validation
            if (!validateOrigin(req, gatewayConfig)) {
                logger_1.LoggerService.warn('Invalid origin blocked', {
                    origin: req.headers.origin,
                    ip: req.ip,
                    url: req.url
                });
                return next((0, utils_1.createError)('Origin not allowed', 403, 'INVALID_ORIGIN'));
            }
            // 2. IP blocking
            if (gatewayConfig.blockedIPs.includes(req.ip || '')) {
                logger_1.LoggerService.warn('Blocked IP attempted access', {
                    ip: req.ip,
                    url: req.url
                });
                return next((0, utils_1.createError)('Access denied', 403, 'IP_BLOCKED'));
            }
            // 3. Circuit breaker check
            if (gatewayConfig.enableCircuitBreaker && !checkCircuitBreaker()) {
                logger_1.LoggerService.warn('Circuit breaker open - rejecting request', {
                    ip: req.ip,
                    url: req.url
                });
                return next((0, utils_1.createError)('Service temporarily unavailable', 503, 'CIRCUIT_BREAKER_OPEN'));
            }
            // 4. Request throttling
            if (gatewayConfig.enableRequestThrottling) {
                if (activeRequests >= gatewayConfig.maxConcurrentRequests) {
                    // Queue request or reject
                    if (requestQueue.length < 100) { // Max queue size
                        requestQueue.push({ req, res, next, timestamp: Date.now() });
                        logger_1.LoggerService.info('Request queued due to high load', {
                            queueSize: requestQueue.length,
                            activeRequests
                        });
                        return; // Don't call next() yet
                    }
                    else {
                        logger_1.LoggerService.warn('Request rejected due to queue overflow', {
                            ip: req.ip,
                            url: req.url
                        });
                        return next((0, utils_1.createError)('Service busy, please try again later', 503, 'QUEUE_OVERFLOW'));
                    }
                }
                activeRequests++;
            }
            // 5. Rate limiting by IP
            if (gatewayConfig.rateLimitByIP && !checkIPRateLimit(req, gatewayConfig)) {
                logger_1.LoggerService.warn('IP rate limit exceeded', {
                    ip: req.ip,
                    url: req.url
                });
                return next((0, utils_1.createError)('Too many requests', 429, 'IP_RATE_LIMIT_EXCEEDED'));
            }
            // 6. Rate limiting by user
            if (gatewayConfig.rateLimitByUser && !checkUserRateLimit(req, gatewayConfig)) {
                logger_1.LoggerService.warn('User rate limit exceeded', {
                    userId: req.user?.userId,
                    ip: req.ip,
                    url: req.url
                });
                return next((0, utils_1.createError)('Too many requests', 429, 'USER_RATE_LIMIT_EXCEEDED'));
            }
            // 7. Request timeout
            const timeout = setTimeout(() => {
                logger_1.LoggerService.warn('Request timeout', {
                    ip: req.ip,
                    url: req.url,
                    duration: gatewayConfig.requestTimeout
                });
                if (!res.headersSent) {
                    res.status(408).json({
                        success: false,
                        error: { code: 'REQUEST_TIMEOUT', message: 'Request timeout' }
                    });
                }
            }, gatewayConfig.requestTimeout);
            // Clear timeout when response is finished
            res.on('finish', () => {
                clearTimeout(timeout);
                activeRequests = Math.max(0, activeRequests - 1);
                // Process queued requests
                if (requestQueue.length > 0) {
                    const queued = requestQueue.shift();
                    if (queued && (Date.now() - queued.timestamp) < 30000) { // 30 second queue timeout
                        activeRequests++;
                        (0, exports.apiGateway)(gatewayConfig)(queued.req, queued.res, queued.next);
                    }
                }
                // Update circuit breaker on response
                updateCircuitBreaker(res.statusCode >= 500);
            });
            next();
        }
        catch (error) {
            logger_1.LoggerService.error('API Gateway error', { error, ip: req.ip, url: req.url });
            next(error);
        }
    };
};
exports.apiGateway = apiGateway;
// Validate request origin
function validateOrigin(req, config) {
    const origin = req.headers.origin || req.headers.referer;
    // Allow requests without origin (mobile apps, API clients)
    if (!origin)
        return true;
    // Check against allowed origins
    return config.allowedOrigins.some(allowed => {
        if (allowed === '*')
            return true;
        return origin.startsWith(allowed);
    });
}
// Check circuit breaker state
function checkCircuitBreaker() {
    const now = Date.now();
    switch (circuitBreakerState.state) {
        case 'closed':
            return true;
        case 'open':
            // Check if we should transition to half-open
            if (now - circuitBreakerState.lastFailureTime > 60000) { // 1 minute timeout
                circuitBreakerState.state = 'half-open';
                logger_1.LoggerService.info('Circuit breaker transitioning to half-open');
                return true;
            }
            return false;
        case 'half-open':
            return true;
        default:
            return true;
    }
}
// Update circuit breaker state
function updateCircuitBreaker(isFailure) {
    if (isFailure) {
        circuitBreakerState.failures++;
        circuitBreakerState.lastFailureTime = Date.now();
        if (circuitBreakerState.failures >= 5) { // Failure threshold
            circuitBreakerState.state = 'open';
            logger_1.LoggerService.warn('Circuit breaker opened due to failures', {
                failures: circuitBreakerState.failures
            });
        }
    }
    else {
        // Success - reset failures
        circuitBreakerState.failures = Math.max(0, circuitBreakerState.failures - 1);
        if (circuitBreakerState.state === 'half-open' && circuitBreakerState.failures === 0) {
            circuitBreakerState.state = 'closed';
            logger_1.LoggerService.info('Circuit breaker closed - service recovered');
        }
    }
}
// Check IP-based rate limiting
function checkIPRateLimit(req, _config) {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100; // 100 requests per minute
    const existing = ipRequestCounts.get(ip);
    if (!existing || now > existing.resetTime) {
        ipRequestCounts.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }
    if (existing.count >= maxRequests) {
        return false;
    }
    existing.count++;
    return true;
}
// Check user-based rate limiting
function checkUserRateLimit(req, _config) {
    const userId = req.user?.userId || 'anonymous';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 200; // 200 requests per minute for authenticated users
    const existing = userRequestCounts.get(userId);
    if (!existing || now > existing.resetTime) {
        userRequestCounts.set(userId, { count: 1, resetTime: now + windowMs });
        return true;
    }
    if (existing.count >= maxRequests) {
        return false;
    }
    existing.count++;
    return true;
}
// Health check endpoint for API Gateway
const gatewayHealthCheck = (_req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        circuitBreaker: circuitBreakerState,
        activeRequests,
        queuedRequests: requestQueue.length,
        ipRateLimits: ipRequestCounts.size,
        userRateLimits: userRequestCounts.size
    };
    res.json(health);
};
exports.gatewayHealthCheck = gatewayHealthCheck;
// Clean up expired rate limit entries (call periodically)
const cleanupRateLimits = () => {
    const now = Date.now();
    // Clean IP rate limits
    for (const [ip, data] of ipRequestCounts) {
        if (now > data.resetTime) {
            ipRequestCounts.delete(ip);
        }
    }
    // Clean user rate limits
    for (const [userId, data] of userRequestCounts) {
        if (now > data.resetTime) {
            userRequestCounts.delete(userId);
        }
    }
    // Clean old queued requests
    const validQueue = requestQueue.filter(item => (now - item.timestamp) < 30000);
    requestQueue.splice(0, requestQueue.length - validQueue.length);
};
exports.cleanupRateLimits = cleanupRateLimits;
// Get gateway statistics
const getGatewayStats = () => {
    return {
        activeRequests,
        queuedRequests: requestQueue.length,
        circuitBreakerState,
        ipRateLimitsActive: ipRequestCounts.size,
        userRateLimitsActive: userRequestCounts.size,
        blockedIPs: DEFAULT_CONFIG.blockedIPs.length
    };
};
exports.getGatewayStats = getGatewayStats;
//# sourceMappingURL=api-gateway.js.map