/**
 * Shared Logger Factory
 * 
 * Provides standardized Winston logger configuration for use across all services
 * (backend, compliance services, etc.) to ensure consistency.
 * 
 * Features:
 * - Standardized log format (JSON with ISO 8601 timestamps)
 * - Consistent log levels
 * - Standard file rotation (10MB, 5 files)
 * - Service-specific metadata
 * - Correlation ID support
 * 
 * Usage:
 * - Import and use createLogger() to create standardized loggers
 * - All loggers follow the same format and structure
 */

import * as winston from 'winston';
import * as path from 'path';

export interface SharedLoggerConfig {
  serviceName: string;
  version?: string;
  environment?: string;
  logLevel?: string;
  logDir?: string;
  enableFileLogging?: boolean;
}

/**
 * Create a standardized Winston logger
 * 
 * @param config - Logger configuration
 * @returns Configured Winston logger instance
 */
export function createSharedLogger(config: SharedLoggerConfig): winston.Logger {
  const {
    serviceName,
    version = '1.0.0',
    environment = process.env.NODE_ENV || 'development',
    logLevel = process.env.LOG_LEVEL || 'info',
    logDir = process.env.LOG_DIR || 'logs',
    enableFileLogging = environment === 'production',
  } = config;

  // Create log directory if needed
  const fs = require('fs');
  if (enableFileLogging && !fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Standard log format: JSON with ISO 8601 timestamps
  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DDTHH:mm:ss.SSSZ', // ISO 8601 with milliseconds
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  // Development format: human-readable
  const devFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length > 0
        ? ` ${JSON.stringify(meta, null, 2)}`
        : '';
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
  );

  const transports: winston.transport[] = [
    // Console transport (always enabled)
    new winston.transports.Console({
      format: environment === 'production' ? logFormat : devFormat,
    }),
  ];

  // File transports (production only)
  if (enableFileLogging) {
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, `${serviceName}-error.log`),
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10, // Keep more error history
        format: logFormat,
      }),
      new winston.transports.File({
        filename: path.join(logDir, `${serviceName}-combined.log`),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        format: logFormat,
      })
    );
  }

  return winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: {
      service: serviceName,
      version,
      environment,
    },
    transports,
    exceptionHandlers: enableFileLogging
      ? [
          new winston.transports.File({
            filename: path.join(logDir, `${serviceName}-exceptions.log`),
            format: logFormat,
          }),
        ]
      : undefined,
    rejectionHandlers: enableFileLogging
      ? [
          new winston.transports.File({
            filename: path.join(logDir, `${serviceName}-rejections.log`),
            format: logFormat,
          }),
        ]
      : undefined,
    exitOnError: false,
  });
}

/**
 * Standard logger interface for consistency
 */
export interface ILogger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  audit(action: string, resource: string, actor: string, details?: Record<string, unknown>): void;
  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, unknown>): void;
  performance(operation: string, duration: number, details?: Record<string, unknown>): void;
}

/**
 * Create a logger that implements ILogger interface
 */
export function createStandardLogger(config: SharedLoggerConfig): ILogger {
  const winstonLogger = createSharedLogger(config);

  return {
    error: (message: string, meta?: Record<string, unknown>) => {
      winstonLogger.error(message, meta);
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      winstonLogger.warn(message, meta);
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      winstonLogger.info(message, meta);
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      winstonLogger.debug(message, meta);
    },
    audit: (action: string, resource: string, actor: string, details?: Record<string, unknown>) => {
      winstonLogger.info('Audit Event', {
        action,
        resource,
        actor,
        details,
        timestamp: new Date().toISOString(),
        complianceFlags: ['AUDIT'],
      });
    },
    security: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, unknown>) => {
      winstonLogger.warn('Security Event', {
        event,
        severity,
        details,
        timestamp: new Date().toISOString(),
      });
    },
    performance: (operation: string, duration: number, details?: Record<string, unknown>) => {
      winstonLogger.info('Performance Metric', {
        operation,
        duration: `${duration}ms`,
        details,
        timestamp: new Date().toISOString(),
      });
    },
  };
}