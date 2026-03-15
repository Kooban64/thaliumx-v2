/**
 * Logger Utility for NFT Compliance Service
 * Structured logging with Winston
 */

import winston from 'winston';
import { getConfig } from '../config';

function stringifyLogPart(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Log levels
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Log context interface
 */
export interface LogContext {
  service?: string;
  component?: string;
  tenantId?: string;
  brokerId?: string;
  userId?: string;
  contractAddress?: string;
  tokenId?: string;
  chainId?: number;
  transactionHash?: string;
  correlationId?: string;
  [key: string]: unknown;
}

/**
 * Create Winston logger instance
 */
function createLogger(): winston.Logger {
  const config = getConfig();

  const formats = [
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), // ISO 8601 with milliseconds
    winston.format.errors({ stack: true }),
  ];

  // Add JSON format for production, pretty print for development
  if (config.environment === 'production') {
    formats.push(winston.format.json());
  } else {
    formats.push(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${stringifyLogPart(timestamp)} [${stringifyLogPart(level)}] ${stringifyLogPart(message)}${metaStr}`;
      })
    );
  }

  return winston.createLogger({
    level: config.logLevel,
    defaultMeta: {
      service: config.serviceName,
      version: config.version,
      environment: config.environment,
    },
    format: winston.format.combine(...formats),
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
 * Logger singleton
 */
let loggerInstance: winston.Logger | null = null;

/**
 * Get logger instance
 */
function getLogger(): winston.Logger {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
}

/**
 * Logger class with context support
 */
export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Log error message
   */
  error(message: string, meta?: LogContext | Error): void {
    const logger = getLogger();
    if (meta instanceof Error) {
      logger.error(message, {
        ...this.context,
        error: {
          name: meta.name,
          message: meta.message,
          stack: meta.stack,
        },
      });
    } else {
      logger.error(message, { ...this.context, ...meta });
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: LogContext): void {
    getLogger().warn(message, { ...this.context, ...meta });
  }

  /**
   * Log info message
   */
  info(message: string, meta?: LogContext): void {
    getLogger().info(message, { ...this.context, ...meta });
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: LogContext): void {
    getLogger().debug(message, { ...this.context, ...meta });
  }

  /**
   * Log NFT collection event
   */
  logCollectionEvent(
    action: string,
    collectionId: string,
    contractAddress: string,
    chainId: number,
    meta?: LogContext
  ): void {
    this.info(`NFT Collection ${action}`, {
      ...meta,
      collectionId,
      contractAddress,
      chainId,
      eventType: 'collection',
    });
  }

  /**
   * Log NFT token event
   */
  logTokenEvent(
    action: string,
    tokenId: string,
    contractAddress: string,
    chainId: number,
    meta?: LogContext
  ): void {
    this.info(`NFT Token ${action}`, {
      ...meta,
      tokenId,
      contractAddress,
      chainId,
      eventType: 'token',
    });
  }

  /**
   * Log NFT sale event
   */
  logSaleEvent(
    action: string,
    saleId: string,
    transactionHash: string,
    priceUSD: string,
    meta?: LogContext
  ): void {
    this.info(`NFT Sale ${action}`, {
      ...meta,
      saleId,
      transactionHash,
      priceUSD,
      eventType: 'sale',
    });
  }

  /**
   * Log wash trading detection event
   */
  logWashTradingEvent(
    action: string,
    detectionId: string,
    contractAddress: string,
    tokenId: string,
    confidence: number,
    meta?: LogContext
  ): void {
    this.info(`Wash Trading ${action}`, {
      ...meta,
      detectionId,
      contractAddress,
      tokenId,
      confidence,
      eventType: 'wash_trading',
    });
  }

  /**
   * Log content screening event
   */
  logContentScreeningEvent(
    action: string,
    screeningId: string,
    contractAddress: string,
    tokenId: string,
    isFlagged: boolean,
    meta?: LogContext
  ): void {
    this.info(`Content Screening ${action}`, {
      ...meta,
      screeningId,
      contractAddress,
      tokenId,
      isFlagged,
      eventType: 'content_screening',
    });
  }

  /**
   * Log risk assessment event
   */
  logRiskAssessmentEvent(
    action: string,
    assessmentId: string,
    riskScore: number,
    riskLevel: string,
    meta?: LogContext
  ): void {
    this.info(`Risk Assessment ${action}`, {
      ...meta,
      assessmentId,
      riskScore,
      riskLevel,
      eventType: 'risk_assessment',
    });
  }

  /**
   * Log Travel Rule event
   */
  logTravelRuleEvent(
    action: string,
    travelRuleId: string,
    saleId: string,
    status: string,
    meta?: LogContext
  ): void {
    this.info(`Travel Rule ${action}`, {
      ...meta,
      travelRuleId,
      saleId,
      status,
      eventType: 'travel_rule',
    });
  }

  /**
   * Log CARF event
   */
  logCARFEvent(
    action: string,
    carfId: string,
    reportId: string,
    status: string,
    meta?: LogContext
  ): void {
    this.info(`CARF ${action}`, {
      ...meta,
      carfId,
      reportId,
      status,
      eventType: 'carf',
    });
  }

  /**
   * Log royalty compliance event
   */
  logRoyaltyEvent(
    action: string,
    collectionId: string,
    contractAddress: string,
    isCompliant: boolean,
    meta?: LogContext
  ): void {
    this.info(`Royalty Compliance ${action}`, {
      ...meta,
      collectionId,
      contractAddress,
      isCompliant,
      eventType: 'royalty',
    });
  }

  /**
   * Log compliance alert
   */
  logAlert(
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    meta?: LogContext
  ): void {
    const logMethod = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    this[logMethod](`ALERT [${severity.toUpperCase()}] ${alertType}: ${message}`, {
      ...meta,
      alertType,
      severity,
      eventType: 'alert',
    });
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    meta?: LogContext
  ): void {
    this.debug(`Database ${operation} on ${table}`, {
      ...meta,
      operation,
      table,
      durationMs: duration,
      eventType: 'database',
    });
  }

  /**
   * Log Kafka event
   */
  logKafkaEvent(
    action: string,
    topic: string,
    meta?: LogContext
  ): void {
    this.debug(`Kafka ${action} on ${topic}`, {
      ...meta,
      topic,
      eventType: 'kafka',
    });
  }

  /**
   * Log blockchain event
   */
  logBlockchainEvent(
    action: string,
    chainId: number,
    blockNumber?: number,
    meta?: LogContext
  ): void {
    this.debug(`Blockchain ${action}`, {
      ...meta,
      chainId,
      blockNumber,
      eventType: 'blockchain',
    });
  }

  /**
   * Log HTTP request
   */
  logHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    meta?: LogContext
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this[level](`${method} ${path} ${statusCode}`, {
      ...meta,
      method,
      path,
      statusCode,
      durationMs: duration,
      eventType: 'http',
    });
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger({ component: 'nft-compliance' });

/**
 * Create component-specific logger
 */
export function createComponentLogger(component: string): Logger {
  return new Logger({ component });
}

export default logger;
