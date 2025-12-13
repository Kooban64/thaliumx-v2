/**
 * Logger Utility for Token Compliance Service
 * Structured logging with Winston
 */

import winston from 'winston';
import { getConfig } from '../config';

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
  tokenSymbol?: string;
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
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
  ];

  // Add JSON format for production, pretty print for development
  if (config.environment === 'production') {
    formats.push(winston.format.json());
  } else {
    formats.push(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta, (_key, value) => {
          if (typeof value === 'bigint') return value.toString();
          return value;
        })}` : '';
        return `${timestamp} [${level}] ${message}${metaStr}`;
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
      new winston.transports.Console(),
    ],
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
   * Log token contract event
   */
  logContractEvent(
    action: string,
    contractAddress: string,
    chainId: number,
    tokenSymbol: string,
    meta?: LogContext
  ): void {
    this.info(`Token Contract ${action}`, {
      ...meta,
      contractAddress,
      chainId,
      tokenSymbol,
      eventType: 'contract',
    });
  }

  /**
   * Log token transfer event
   */
  logTransferEvent(
    action: string,
    transferId: string,
    transactionHash: string,
    amountUSD: string,
    meta?: LogContext
  ): void {
    this.info(`Token Transfer ${action}`, {
      ...meta,
      transferId,
      transactionHash,
      amountUSD,
      eventType: 'transfer',
    });
  }

  /**
   * Log token holder event
   */
  logHolderEvent(
    action: string,
    holderId: string,
    holderAddress: string,
    contractAddress: string,
    meta?: LogContext
  ): void {
    this.info(`Token Holder ${action}`, {
      ...meta,
      holderId,
      holderAddress,
      contractAddress,
      eventType: 'holder',
    });
  }

  /**
   * Log wallet screening event
   */
  logWalletScreeningEvent(
    action: string,
    screeningId: string,
    walletAddress: string,
    riskScore: number,
    riskLevel: string,
    meta?: LogContext
  ): void {
    this.info(`Wallet Screening ${action}`, {
      ...meta,
      screeningId,
      walletAddress,
      riskScore,
      riskLevel,
      eventType: 'wallet_screening',
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
    transferId: string,
    status: string,
    meta?: LogContext
  ): void {
    this.info(`Travel Rule ${action}`, {
      ...meta,
      travelRuleId,
      transferId,
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
   * Log presale event
   */
  logPresaleEvent(
    action: string,
    presaleId: string,
    contractAddress: string,
    status: string,
    meta?: LogContext
  ): void {
    this.info(`Presale ${action}`, {
      ...meta,
      presaleId,
      contractAddress,
      status,
      eventType: 'presale',
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

  /**
   * Log sanctions match
   */
  logSanctionsMatch(
    walletAddress: string,
    matchedLists: string[],
    matchScore: number,
    meta?: LogContext
  ): void {
    this.error(`SANCTIONS MATCH DETECTED`, {
      ...meta,
      walletAddress,
      matchedLists,
      matchScore,
      eventType: 'sanctions',
      severity: 'critical',
    });
  }

  /**
   * Log whale movement
   */
  logWhaleMovement(
    holderAddress: string,
    contractAddress: string,
    movementType: 'accumulation' | 'distribution',
    amount: string,
    amountUSD: string,
    meta?: LogContext
  ): void {
    this.warn(`Whale Movement Detected`, {
      ...meta,
      holderAddress,
      contractAddress,
      movementType,
      amount,
      amountUSD,
      eventType: 'whale_movement',
    });
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger({ component: 'token-compliance' });

/**
 * Create component-specific logger
 */
export function createComponentLogger(component: string): Logger {
  return new Logger({ component });
}

export default logger;
