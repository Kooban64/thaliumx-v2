/**
 * Logger Service
 *
 * Centralized logging service using Winston with OpenTelemetry integration.
 *
 * Features:
 * - Structured JSON logging with timestamps
 * - Multiple log levels (error, warn, info, debug)
 * - File-based logging with rotation (error.log, combined.log)
 * - Console logging with colorized output
 * - OpenTelemetry trace integration
 * - System metrics collection (memory, CPU)
 * - Uncaught exception and unhandled rejection logging
 * - Security event logging for audit compliance
 * - Database query logging with performance metrics
 *
 * Log Files:
 * - error.log: Error-level logs only
 * - combined.log: All logs
 * - exceptions.log: Uncaught exceptions
 * - rejections.log: Unhandled promise rejections
 *
 * Metrics:
 * - Tracks HTTP requests, DB queries, Redis operations
 * - Monitors Kafka message production/consumption
 * - Tracks transaction counts and security events
 *
 * OpenTelemetry:
 * - Automatically creates spans for log operations
 * - Integrates with distributed tracing
 */
import * as winston from 'winston';
export declare class LoggerService {
    private static logger;
    private static tracer;
    private static metrics;
    static initialize(): void;
    private static initializeMetrics;
    private static startSystemMetricsCollection;
    static info(message: string, meta?: any): void;
    static warn(message: string, meta?: any): void;
    static error(message: string, meta?: any): void;
    static debug(message: string, meta?: any): void;
    static verbose(message: string, meta?: any): void;
    static silly(message: string, meta?: any): void;
    static logRequest(req: any, res: any, duration: number): void;
    static logError(error: Error, context?: any): void;
    static logSecurity(event: string, details: any): void;
    static logDatabase(query: string, duration: number, error?: Error): void;
    static logAuth(action: string, userId?: string, success?: boolean): void;
    static logTransaction(transactionId: string, action: string, details: any): void;
    static logKYC(userId: string, action: string, details: any): void;
    static logTenant(tenantId: string, action: string, details: any): void;
    static logPerformance(operation: string, duration: number, details?: any): void;
    static logBusiness(event: string, details: any): void;
    static getLogger(): winston.Logger;
    static getMetrics(): Record<string, number>;
    static resetMetrics(): void;
    static logRedisOperation(operation: string, duration: number, success: boolean): void;
    static logKafkaMessage(topic: string, action: 'produced' | 'consumed', duration?: number): void;
    static logAudit(action: string, subject: string, actor?: {
        userId?: string;
        tenantId?: string;
        brokerId?: string;
    }, details?: any): Promise<void>;
}
//# sourceMappingURL=logger.d.ts.map