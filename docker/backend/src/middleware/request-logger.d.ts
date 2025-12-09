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
import { Request, Response, NextFunction } from 'express';
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=request-logger.d.ts.map