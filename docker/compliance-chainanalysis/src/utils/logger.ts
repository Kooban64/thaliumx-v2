/**
 * Enterprise Logger for ChainAnalysis Compliance Service
 * Structured logging with Winston - Standardized format
 */

import winston from 'winston';
import { getConfig } from '../config';

const config = getConfig();

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

// Define colors for different log levels
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Create the logger format - standardized to ISO 8601
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), // ISO 8601 with milliseconds
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.colorize({ all: true })
);

// Create the logger
const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  format,
  defaultMeta: {
    service: 'compliance-chainanalysis',
    environment: config.environment,
    version: process.env['npm_package_version'] || '1.0.0',
  },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format: config.logging.format === 'simple'
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : format,
      handleExceptions: true,
      handleRejections: true,
    }),
    // File transport for production (standardized)
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

/**
 * Create a component-specific logger
 */
export function createComponentLogger(component: string): winston.Logger {
  return logger.child({ component });
}

/**
 * Export the main logger
 */
export { logger };
