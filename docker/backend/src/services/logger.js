"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const winston = __importStar(require("winston"));
const path = __importStar(require("path"));
const api_1 = require("@opentelemetry/api");
class LoggerService {
    static logger;
    static tracer = api_1.trace.getTracer('thaliumx-logger');
    static metrics = new Map();
    static initialize() {
        const logDir = process.env.LOG_DIR || 'logs';
        // Initialize metrics tracking
        this.initializeMetrics();
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }), winston.format.errors({ stack: true }), winston.format.json()),
            defaultMeta: {
                service: 'thaliumx-backend',
                version: process.env.npm_package_version || '1.0.0'
            },
            transports: [
                // Console transport
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
                }),
                // File transports
                new winston.transports.File({
                    filename: path.join(logDir, 'error.log'),
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                new winston.transports.File({
                    filename: path.join(logDir, 'combined.log'),
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                })
            ],
            // Handle uncaught exceptions
            exceptionHandlers: [
                new winston.transports.File({
                    filename: path.join(logDir, 'exceptions.log')
                })
            ],
            // Handle unhandled promise rejections
            rejectionHandlers: [
                new winston.transports.File({
                    filename: path.join(logDir, 'rejections.log')
                })
            ]
        });
        // Create logs directory if it doesn't exist
        const fs = require('fs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        // Start system metrics collection
        this.startSystemMetricsCollection();
    }
    static initializeMetrics() {
        // Initialize basic metrics tracking
        this.metrics.set('http_requests_total', 0);
        this.metrics.set('db_queries_total', 0);
        this.metrics.set('redis_operations_total', 0);
        this.metrics.set('kafka_messages_produced', 0);
        this.metrics.set('kafka_messages_consumed', 0);
        this.metrics.set('transactions_total', 0);
        this.metrics.set('security_events_total', 0);
        this.metrics.set('errors_total', 0);
    }
    static startSystemMetricsCollection() {
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            // Log system metrics
            const os = require('os');
            this.info('System Metrics', {
                memory: {
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    external: memUsage.external,
                    rss: memUsage.rss
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                uptime: process.uptime(),
                platform: os.platform(),
                arch: os.arch(),
                loadAverage: os.loadavg()
            });
        }, 30000); // Every 30 seconds
    }
    static info(message, meta) {
        if (!this.logger) {
            console.log(`[Logger not initialized] ${message}`, meta);
            return;
        }
        this.logger.info(message, meta);
    }
    static warn(message, meta) {
        if (!this.logger) {
            console.warn(`[Logger not initialized] ${message}`, meta);
            return;
        }
        this.logger.warn(message, meta);
    }
    static error(message, meta) {
        if (!this.logger) {
            console.error(`[Logger not initialized] ${message}`, meta);
            return;
        }
        this.logger.error(message, meta);
    }
    static debug(message, meta) {
        this.logger.debug(message, meta);
    }
    static verbose(message, meta) {
        this.logger.verbose(message, meta);
    }
    static silly(message, meta) {
        this.logger.silly(message, meta);
    }
    // Enhanced structured logging methods with OpenTelemetry
    static logRequest(req, res, duration) {
        const span = this.tracer.startSpan('http_request', {
            kind: api_1.SpanKind.SERVER,
            attributes: {
                'http.method': req.method,
                'http.url': req.url,
                'http.status_code': res.statusCode,
                'http.duration_ms': duration,
                'http.user_agent': req.get('User-Agent'),
                'http.request_id': req.headers['x-request-id']
            }
        });
        // Record metrics
        const currentCount = this.metrics.get('http_requests_total') || 0;
        this.metrics.set('http_requests_total', currentCount + 1);
        this.info('HTTP Request', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            requestId: req.headers['x-request-id'],
            metrics: {
                totalRequests: this.metrics.get('http_requests_total')
            }
        });
        span.setStatus({ code: api_1.SpanStatusCode.OK });
        span.end();
    }
    static logError(error, context) {
        this.error('Application Error', {
            message: error.message,
            stack: error.stack,
            context
        });
    }
    static logSecurity(event, details) {
        const span = this.tracer.startSpan('security_event', {
            kind: api_1.SpanKind.INTERNAL,
            attributes: {
                'security.event': event,
                'security.severity': details.severity || 'medium',
                'security.user_id': details.userId || 'unknown'
            }
        });
        // Record metrics
        const currentCount = this.metrics.get('security_events_total') || 0;
        this.metrics.set('security_events_total', currentCount + 1);
        this.warn('Security Event', {
            event,
            details,
            timestamp: new Date().toISOString(),
            metrics: {
                totalSecurityEvents: this.metrics.get('security_events_total')
            }
        });
        span.setStatus({ code: api_1.SpanStatusCode.OK });
        span.end();
    }
    static logDatabase(query, duration, error) {
        const queryParts = query.split(' ');
        const operation = queryParts[0] ? queryParts[0].toLowerCase() : 'unknown';
        const span = this.tracer.startSpan('database_query', {
            kind: api_1.SpanKind.CLIENT,
            attributes: {
                'db.operation': operation,
                'db.duration_ms': duration,
                'db.error': error ? 'true' : 'false'
            }
        });
        // Record metrics
        const currentCount = this.metrics.get('db_queries_total') || 0;
        this.metrics.set('db_queries_total', currentCount + 1);
        if (error) {
            const errorCount = this.metrics.get('errors_total') || 0;
            this.metrics.set('errors_total', errorCount + 1);
            span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: error.message });
            this.error('Database Error', {
                query,
                duration: `${duration}ms`,
                error: error.message,
                metrics: {
                    totalQueries: this.metrics.get('db_queries_total'),
                    totalErrors: this.metrics.get('errors_total')
                }
            });
        }
        else {
            span.setStatus({ code: api_1.SpanStatusCode.OK });
            this.debug('Database Query', {
                query,
                duration: `${duration}ms`,
                metrics: {
                    totalQueries: this.metrics.get('db_queries_total')
                }
            });
        }
        span.end();
    }
    static logAuth(action, userId, success = true) {
        this.info('Authentication Event', {
            action,
            userId,
            success,
            timestamp: new Date().toISOString()
        });
    }
    static logTransaction(transactionId, action, details) {
        const span = this.tracer.startSpan('transaction', {
            kind: api_1.SpanKind.INTERNAL,
            attributes: {
                'transaction.id': transactionId,
                'transaction.action': action,
                'transaction.amount': details.amount || 0,
                'transaction.currency': details.currency || 'unknown'
            }
        });
        // Record metrics
        const currentCount = this.metrics.get('transactions_total') || 0;
        this.metrics.set('transactions_total', currentCount + 1);
        this.info('Transaction Event', {
            transactionId,
            action,
            details,
            timestamp: new Date().toISOString(),
            metrics: {
                totalTransactions: this.metrics.get('transactions_total')
            }
        });
        span.setStatus({ code: api_1.SpanStatusCode.OK });
        span.end();
    }
    static logKYC(userId, action, details) {
        this.info('KYC Event', {
            userId,
            action,
            details,
            timestamp: new Date().toISOString()
        });
    }
    static logTenant(tenantId, action, details) {
        this.info('Tenant Event', {
            tenantId,
            action,
            details,
            timestamp: new Date().toISOString()
        });
    }
    // Performance logging
    static logPerformance(operation, duration, details) {
        this.info('Performance Metric', {
            operation,
            duration: `${duration}ms`,
            details
        });
    }
    // Business logic logging
    static logBusiness(event, details) {
        this.info('Business Event', {
            event,
            details,
            timestamp: new Date().toISOString()
        });
    }
    // Get logger instance for custom usage
    static getLogger() {
        return this.logger;
    }
    // Get current metrics
    static getMetrics() {
        return Object.fromEntries(this.metrics);
    }
    // Reset metrics (useful for testing)
    static resetMetrics() {
        this.metrics.forEach((_, key) => {
            this.metrics.set(key, 0);
        });
    }
    // Enhanced logging methods for specific services
    static logRedisOperation(operation, duration, success) {
        const currentCount = this.metrics.get('redis_operations_total') || 0;
        this.metrics.set('redis_operations_total', currentCount + 1);
        this.debug('Redis Operation', {
            operation,
            duration: `${duration}ms`,
            success,
            metrics: {
                totalRedisOperations: this.metrics.get('redis_operations_total')
            }
        });
    }
    static logKafkaMessage(topic, action, duration) {
        const key = action === 'produced' ? 'kafka_messages_produced' : 'kafka_messages_consumed';
        const currentCount = this.metrics.get(key) || 0;
        this.metrics.set(key, currentCount + 1);
        this.info(`Kafka Message ${action}`, {
            topic,
            duration: duration ? `${duration}ms` : undefined,
            metrics: {
                [`totalKafkaMessages${action.charAt(0).toUpperCase() + action.slice(1)}`]: this.metrics.get(key)
            }
        });
    }
    // Structured audit logging helper
    static async logAudit(action, subject, actor, details) {
        const entry = {
            action,
            subject,
            actor: actor || {},
            details: details || {},
            at: new Date().toISOString()
        };
        try {
            const { DatabaseService } = await import('./database');
            const Model = DatabaseService.getModel && DatabaseService.getModel('AuditLog');
            if (Model) {
                await Model.create({
                    action,
                    subject,
                    userId: actor?.userId || null,
                    tenantId: actor?.tenantId || null,
                    brokerId: actor?.brokerId || null,
                    details,
                    createdAt: new Date()
                });
            }
        }
        catch { }
        this.info('Audit Event', entry);
    }
}
exports.LoggerService = LoggerService;
//# sourceMappingURL=logger.js.map