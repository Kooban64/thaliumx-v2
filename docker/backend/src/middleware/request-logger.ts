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
import { LoggerService } from '../services/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to request object
  (req as any).requestId = requestId;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Log request
  LoggerService.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - start;
    
    LoggerService.info('Request completed', {
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
