"use strict";
/**
 * Event Streaming Routes
 *
 * REST API endpoints for event streaming management:
 * - Event emission endpoints
 * - Event subscription management
 * - System monitoring
 * - Compliance reporting
 *
 * Production-ready with comprehensive validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const event_streaming_1 = require("../services/event-streaming");
const logger_1 = require("../services/logger");
const error_handler_1 = require("../middleware/error-handler");
const validation_1 = require("../middleware/validation");
const utils_1 = require("../utils");
const router = (0, express_1.Router)();
// =============================================================================
// EVENT EMISSION ENDPOINTS
// =============================================================================
/**
 * Emit audit event
 * POST /api/events/audit
 */
router.post('/audit', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const { action, resource, resourceId, payload, metadata } = req.body;
        if (!action || !resource || !resourceId) {
            throw (0, utils_1.createError)('Missing required fields: action, resource, resourceId', 400, 'MISSING_REQUIRED_FIELDS');
        }
        await event_streaming_1.EventStreamingService.emitAuditEvent(action, resource, resourceId, payload, {
            ...metadata,
            userId: req.user?.userId,
            tenantId: req.user?.tenantId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(201).json({
            success: true,
            message: 'Audit event emitted successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Audit event emission API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
/**
 * Emit transaction event
 * POST /api/events/transaction
 */
router.post('/transaction', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const { transactionType, transactionId, amount, currency, status, additionalPayload, metadata } = req.body;
        if (!transactionType || !transactionId || amount === undefined || !currency || !status) {
            throw (0, utils_1.createError)('Missing required fields: transactionType, transactionId, amount, currency, status', 400, 'MISSING_REQUIRED_FIELDS');
        }
        await event_streaming_1.EventStreamingService.emitTransactionEvent(transactionType, transactionId, amount, currency, status, {
            ...metadata,
            userId: req.user?.userId,
            tenantId: req.user?.tenantId
        }, additionalPayload);
        res.status(201).json({
            success: true,
            message: 'Transaction event emitted successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Transaction event emission API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
/**
 * Emit system event
 * POST /api/events/system
 */
router.post('/system', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const { eventType, component, level, payload, metadata } = req.body;
        if (!eventType || !component || !level || !payload) {
            throw (0, utils_1.createError)('Missing required fields: eventType, component, level, payload', 400, 'MISSING_REQUIRED_FIELDS');
        }
        if (!['info', 'warn', 'error', 'critical'].includes(level)) {
            throw (0, utils_1.createError)('Invalid level. Must be: info, warn, error, critical', 400, 'INVALID_LEVEL');
        }
        await event_streaming_1.EventStreamingService.emitSystemEvent(eventType, component, level, payload, {
            ...metadata,
            userId: req.user?.userId,
            tenantId: req.user?.tenantId
        });
        res.status(201).json({
            success: true,
            message: 'System event emitted successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('System event emission API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
/**
 * Emit compliance event
 * POST /api/events/compliance
 */
router.post('/compliance', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const { regulation, requirement, data, status, notes, metadata } = req.body;
        if (!regulation || !requirement || !data || !status) {
            throw (0, utils_1.createError)('Missing required fields: regulation, requirement, data, status', 400, 'MISSING_REQUIRED_FIELDS');
        }
        if (!['compliant', 'non-compliant', 'pending'].includes(status)) {
            throw (0, utils_1.createError)('Invalid status. Must be: compliant, non-compliant, pending', 400, 'INVALID_STATUS');
        }
        await event_streaming_1.EventStreamingService.emitComplianceEvent(regulation, requirement, data, status, {
            ...metadata,
            userId: req.user?.userId,
            tenantId: req.user?.tenantId
        }, notes);
        res.status(201).json({
            success: true,
            message: 'Compliance event emitted successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Compliance event emission API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
// =============================================================================
// EVENT SUBSCRIPTION MANAGEMENT
// =============================================================================
/**
 * Subscribe to events
 * POST /api/events/subscribe
 */
router.post('/subscribe', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const { topic, groupId, handlerType } = req.body;
        if (!topic || !groupId || !handlerType) {
            throw (0, utils_1.createError)('Missing required fields: topic, groupId, handlerType', 400, 'MISSING_REQUIRED_FIELDS');
        }
        // Map handler type to actual handler function
        let handler;
        switch (handlerType) {
            case 'audit':
                handler = event_streaming_1.EventHandlers.handleAuditEvent;
                break;
            case 'transaction':
                handler = event_streaming_1.EventHandlers.handleTransactionEvent;
                break;
            case 'system':
                handler = event_streaming_1.EventHandlers.handleSystemEvent;
                break;
            case 'compliance':
                handler = event_streaming_1.EventHandlers.handleComplianceEvent;
                break;
            default:
                throw (0, utils_1.createError)('Invalid handler type', 400, 'INVALID_HANDLER_TYPE');
        }
        await event_streaming_1.EventStreamingService.subscribeToEvents(topic, groupId, handler);
        res.status(201).json({
            success: true,
            message: 'Successfully subscribed to events',
            data: {
                topic,
                groupId,
                handlerType
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Event subscription API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
// =============================================================================
// SYSTEM MONITORING
// =============================================================================
/**
 * Get event streaming service status
 * GET /api/events/status
 */
router.get('/status', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const isHealthy = event_streaming_1.EventStreamingService.isHealthy();
        res.json({
            success: true,
            data: {
                status: isHealthy ? 'healthy' : 'unhealthy',
                service: 'event-streaming',
                timestamp: new Date().toISOString(),
                features: {
                    auditEvents: 'active',
                    transactionEvents: 'active',
                    systemEvents: 'active',
                    complianceEvents: 'active',
                    eventSubscriptions: 'active',
                    realTimeMonitoring: 'active'
                }
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Event streaming status API error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});
/**
 * Get available topics
 * GET /api/events/topics
 */
router.get('/topics', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const topics = {
            'thaliumx.audit': 'Audit events for compliance and security',
            'thaliumx.transactions': 'Financial transaction events',
            'thaliumx.system': 'System health and performance events',
            'thaliumx.compliance': 'Regulatory compliance events',
            'thaliumx.alerts': 'System alerts and notifications',
            'thaliumx.health': 'Service health check events'
        };
        res.json({
            success: true,
            data: {
                topics,
                totalTopics: Object.keys(topics).length
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get topics API error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});
/**
 * Get event type mappings
 * GET /api/events/mappings
 */
router.get('/mappings', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const mappings = {
            'user.login': 'AUDIT',
            'user.logout': 'AUDIT',
            'user.kyc.submitted': 'AUDIT',
            'user.kyc.approved': 'AUDIT',
            'user.kyc.rejected': 'AUDIT',
            'transaction.created': 'TRANSACTIONS',
            'transaction.completed': 'TRANSACTIONS',
            'transaction.failed': 'TRANSACTIONS',
            'exchange.order.created': 'TRANSACTIONS',
            'exchange.order.filled': 'TRANSACTIONS',
            'fiat.deposit.initiated': 'TRANSACTIONS',
            'fiat.withdrawal.completed': 'TRANSACTIONS',
            'token.transfer': 'TRANSACTIONS',
            'token.stake': 'TRANSACTIONS',
            'token.unstake': 'TRANSACTIONS',
            'system.health.check': 'SYSTEM',
            'system.error': 'SYSTEM',
            'system.performance': 'SYSTEM',
            'compliance.kyc.check': 'COMPLIANCE',
            'compliance.ofac.screening': 'COMPLIANCE',
            'compliance.report.generated': 'COMPLIANCE'
        };
        res.json({
            success: true,
            data: {
                mappings,
                totalMappings: Object.keys(mappings).length
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get mappings API error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});
// =============================================================================
// HEALTH CHECK
// =============================================================================
/**
 * Event streaming service health check
 * GET /api/events/health
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = event_streaming_1.EventStreamingService.isHealthy();
        res.status(isHealthy ? 200 : 503).json({
            success: isHealthy,
            data: {
                status: isHealthy ? 'healthy' : 'unhealthy',
                service: 'event-streaming',
                timestamp: new Date().toISOString(),
                features: {
                    kafkaConnection: isHealthy ? 'active' : 'inactive',
                    eventEmission: isHealthy ? 'active' : 'inactive',
                    eventSubscription: isHealthy ? 'active' : 'inactive',
                    auditTrails: isHealthy ? 'active' : 'inactive',
                    complianceMonitoring: isHealthy ? 'active' : 'inactive',
                    realTimeAlerts: isHealthy ? 'active' : 'inactive'
                }
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Event streaming health check error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Event streaming service unhealthy',
                code: 'SERVICE_UNHEALTHY'
            }
        });
    }
});
exports.default = router;
//# sourceMappingURL=event-streaming.js.map