/**
 * Enterprise Logger for Compliance Coordinator
 * Structured logging with Winston - Standardized format
 */

import winston from 'winston';
import { getConfig } from '../config';
import type { ComplianceServiceType } from '../types/coordinator';

function stringifyLogPart(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Create base logger
 */
function createBaseLogger(): winston.Logger {
  const config = getConfig();

  const formats = [
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), // ISO 8601 with milliseconds
    winston.format.errors({ stack: true }),
  ];

  if (config.environment === 'development') {
    formats.push(winston.format.colorize());
    formats.push(winston.format.printf(({ level, message, timestamp, component, ...meta }) => {
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      const componentStr = typeof component === 'string' && component.length > 0 ? `[${component}]` : '';
      return `${stringifyLogPart(timestamp)} ${stringifyLogPart(level)} ${componentStr} ${stringifyLogPart(message)}${metaStr}`;
    }));
  } else {
    formats.push(winston.format.json());
  }

  return winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(...formats),
    defaultMeta: {
      service: config.serviceName,
      version: config.version,
      environment: config.environment,
    },
    transports: [
      new winston.transports.Console({
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
}

/**
 * Base logger instance
 */
export const logger = createBaseLogger();

/**
 * Create component-specific logger
 */
export function createComponentLogger(component: string): winston.Logger {
  return logger.child({ component });
}

/**
 * Log aggregation event
 */
export function logAggregationEvent(
  action: 'aggregated' | 'updated' | 'failed',
  entityType: string,
  sourceService: ComplianceServiceType,
  sourceId: string,
  aggregatedId?: string,
  metadata?: Record<string, unknown>
): void {
  logger.info('Aggregation event', {
    action,
    entityType,
    sourceService,
    sourceId,
    aggregatedId,
    ...metadata,
  });
}

/**
 * Log report generation event
 */
export function logReportEvent(
  action: 'generated' | 'submitted' | 'failed',
  reportType: string,
  reportId: string,
  format?: string,
  metadata?: Record<string, unknown>
): void {
  logger.info('Report event', {
    action,
    reportType,
    reportId,
    format,
    ...metadata,
  });
}

/**
 * Log alert event
 */
export function logAlertEvent(
  action: 'created' | 'acknowledged' | 'resolved' | 'dismissed',
  alertId: string,
  alertType: string,
  severity: string,
  metadata?: Record<string, unknown>
): void {
  const logLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
  logger.log(logLevel, 'Alert event', {
    action,
    alertId,
    alertType,
    severity,
    ...metadata,
  });
}

/**
 * Log service status event
 */
export function logServiceStatusEvent(
  service: ComplianceServiceType,
  status: string,
  latency: number,
  metadata?: Record<string, unknown>
): void {
  const logLevel = status === 'unhealthy' ? 'error' : status === 'degraded' ? 'warn' : 'info';
  logger.log(logLevel, 'Service status', {
    service,
    status,
    latency,
    ...metadata,
  });
}

/**
 * Log regulatory submission event
 */
export function logRegulatoryEvent(
  action: 'created' | 'submitted' | 'acknowledged' | 'rejected' | 'failed',
  submissionId: string,
  submissionType: string,
  jurisdiction: string,
  metadata?: Record<string, unknown>
): void {
  logger.info('Regulatory submission event', {
    action,
    submissionId,
    submissionType,
    jurisdiction,
    ...metadata,
  });
}

/**
 * Log admin action
 */
export function logAdminAction(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
): void {
  logger.info('Admin action', {
    adminId,
    action,
    entityType,
    entityId,
    ...metadata,
  });
}

/**
 * Log event processing
 */
export function logEventProcessing(
  eventType: string,
  sourceService: string,
  duration: number,
  success: boolean,
  error?: string
): void {
  const logLevel = success ? 'info' : 'error';
  logger.log(logLevel, 'Event processing', {
    eventType,
    sourceService,
    duration,
    success,
    error,
  });
}

export default logger;
