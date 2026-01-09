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

import type { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger';
import { LogCorrelation } from '../utils/log-correlation';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Extract and set correlation context
  const correlationContext = LogCorrelation.extractFromRequest(req);
  LogCorrelation.setCorrelationContext(correlationContext);
  
  // Get updated context with trace IDs from OpenTelemetry
  const updatedContext = LogCorrelation.getCorrelationContext() || correlationContext;
  const requestId = updatedContext.requestId || updatedContext.correlationId;
  
  // Add request ID to request object
  (req as any).requestId = requestId;
  
  // Add correlation ID to response headers for downstream services
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Correlation-ID', updatedContext.correlationId);
  if (updatedContext.traceId) {
    res.setHeader('X-Trace-ID', updatedContext.traceId);
  }
  if (updatedContext.spanId) {
    res.setHeader('X-Span-ID', updatedContext.spanId);
  }
  
  // Log request with correlation context
  LoggerService.info('Incoming request', {
    ...LogCorrelation.getLogMetadata(),
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
      ...LogCorrelation.getLogMetadata(),
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
