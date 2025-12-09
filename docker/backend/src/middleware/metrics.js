"use strict";
/**
 * Metrics Middleware
 *
 * HTTP request metrics collection middleware for Prometheus.
 *
 * Features:
 * - Records HTTP request counts
 * - Measures request duration
 * - Tracks by method, route, and status code
 * - Integrates with MetricsService
 *
 * Metrics Collected:
 * - Request count (counter)
 * - Request duration (histogram)
 * - Method, route, status code labels
 *
 * Usage:
 * - Applied to all routes automatically
 * - Exposes metrics via /metrics endpoint
 * - Used for performance monitoring and alerting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = void 0;
const metrics_1 = require("../services/metrics");
const metricsMiddleware = (req, res, next) => {
    const startTime = Date.now();
    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const duration = Date.now() - startTime;
        const route = req.route?.path || req.path;
        const method = req.method;
        const statusCode = res.statusCode;
        metrics_1.MetricsService.recordHttpRequest(method, route, statusCode, duration);
        return originalEnd.call(this, chunk, encoding);
    };
    next();
};
exports.metricsMiddleware = metricsMiddleware;
//# sourceMappingURL=metrics.js.map