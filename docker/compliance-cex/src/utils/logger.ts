/**
 * Enterprise Logger for CEX Compliance Service
 * Structured logging with Winston and performance monitoring
 */

import winston from 'winston';
import { config } from '../config';

// ==================== LOG LEVELS ====================

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

// ==================== LOG FORMATTERS ====================

/**
 * Structured log formatter for JSON output
 * Standardized to ISO 8601 format with milliseconds for consistency
 */
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), // ISO 8601 with milliseconds
  winston.format.errors({ stack: true }),
  winston.format.json({
    space: config.environment === 'development' ? 2 : 0,
  }),
);

/**
 * Human-readable formatter for development
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  }),
);

// ==================== LOGGER CONFIGURATION ====================

/**
 * Create Winston logger instance
 */
const winstonLogger = winston.createLogger({
  level: config.logLevel,
  levels: logLevels,
  format: config.environment === 'production' ? structuredFormat : developmentFormat,
  defaultMeta: {
    service: config.serviceName,
    version: config.version,
    environment: config.environment,
  },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),

    // File transport for production
    ...(config.environment === 'production' ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB (standardized)
        maxFiles: 5, // Standardized
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10 * 1024 * 1024, // 10MB (standardized)
        maxFiles: 5, // Standardized
      }),
    ] : []),
  ],
  exitOnError: false,
});

// ==================== LOGGER INTERFACE ====================

/**
 * Logger interface with structured logging methods
 */
export interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;

  // Performance logging
  logPerformance(operation: string, duration: number, meta?: Record<string, unknown>): void;

  // Audit logging
  logAudit(action: string, resource: string, actor: string, details?: Record<string, unknown>): void;

  // Compliance logging
  logCompliance(event: string, entityId: string, details?: Record<string, unknown>): void;
}

/**
 * Winston-based logger implementation
 */
class WinstonLogger implements Logger {
  error(message: string, meta?: Record<string, unknown>): void {
    winstonLogger.error(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    winstonLogger.warn(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    winstonLogger.info(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    winstonLogger.debug(message, meta);
  }

  logPerformance(operation: string, duration: number, meta?: Record<string, unknown>): void {
    winstonLogger.info(`Performance: ${operation}`, {
      operation,
      duration,
      durationUnit: 'ms',
      ...meta,
    });
  }

  logAudit(action: string, resource: string, actor: string, details?: Record<string, unknown>): void {
    winstonLogger.info(`Audit: ${action}`, {
      action,
      resource,
      actor,
      category: 'audit',
      ...details,
    });
  }

  logCompliance(event: string, entityId: string, details?: Record<string, unknown>): void {
    winstonLogger.info(`Compliance: ${event}`, {
      event,
      entityId,
      category: 'compliance',
      ...details,
    });
  }
}

// ==================== EXPORT ====================

/**
 * Default logger instance
 */
export const logger: Logger = new WinstonLogger();

// ==================== UTILITIES ====================

/**
 * Create a child logger with additional context
 */
export function createChildLogger(_context: Record<string, unknown>): Logger {
  // In a real implementation, you'd create a child logger with context
  // For now, we'll just return the main logger
  return logger;
}

/**
 * Log with correlation ID for request tracing
 */
export function logWithCorrelation(
  correlationId: string,
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  meta?: Record<string, unknown>
): void {
  logger[level](message, {
    correlationId,
    ...meta,
  });
}

/**
 * Performance monitoring decorator
 */
export function withPerformanceLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  operation: string,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      logger.logPerformance(operation, duration, { success: true });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logPerformance(operation, duration, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }) as T;
}

// ==================== LOGGING MIDDLEWARE ====================

import type { Request, Response, NextFunction, RequestHandler } from 'express';

// Extend Express Request to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Express middleware for request logging
 */
export function requestLogging(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const correlationId = (req.headers['x-correlation-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add correlation ID to request
    req.correlationId = correlationId;

    // Log request
    logger.info('Request received', {
      method: req.method,
      url: req.url,
      correlationId,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        correlationId,
      });
    });

    next();
  };
}
