/**
 * Logging utilities for ChainAnalysis service
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
};

// Define colors for different log levels
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Create the logger format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
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
    }),
  ],
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