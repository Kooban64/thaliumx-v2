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
import { Request, Response, NextFunction } from 'express';
export declare const metricsMiddleware: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=metrics.d.ts.map