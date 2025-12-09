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

import { Router, Request, Response } from 'express';
import { EventStreamingService, EventHandlers } from '../services/event-streaming';
import { LoggerService } from '../services/logger';
import { authenticateToken } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { AppError, createError } from '../utils';
import { UserRole } from '../types';

const router: Router = Router();

// =============================================================================
// EVENT EMISSION ENDPOINTS
// =============================================================================

/**
 * Emit audit event
 * POST /api/events/audit
 */
router.post('/audit', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, resource, resourceId, payload, metadata } = req.body;
    
    if (!action || !resource || !resourceId) {
      throw createError('Missing required fields: action, resource, resourceId', 400, 'MISSING_REQUIRED_FIELDS');
    }
    
    await EventStreamingService.emitAuditEvent(action, resource, resourceId, payload, {
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
  } catch (error) {
    LoggerService.error('Audit event emission API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
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
router.post('/transaction', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionType, transactionId, amount, currency, status, additionalPayload, metadata } = req.body;
    
    if (!transactionType || !transactionId || amount === undefined || !currency || !status) {
      throw createError('Missing required fields: transactionType, transactionId, amount, currency, status', 400, 'MISSING_REQUIRED_FIELDS');
    }
    
    await EventStreamingService.emitTransactionEvent(
      transactionType,
      transactionId,
      amount,
      currency,
      status,
      {
        ...metadata,
        userId: req.user?.userId,
        tenantId: req.user?.tenantId
      },
      additionalPayload
    );
    
    res.status(201).json({
      success: true,
      message: 'Transaction event emitted successfully'
    });
  } catch (error) {
    LoggerService.error('Transaction event emission API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
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
router.post('/system', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventType, component, level, payload, metadata } = req.body;
    
    if (!eventType || !component || !level || !payload) {
      throw createError('Missing required fields: eventType, component, level, payload', 400, 'MISSING_REQUIRED_FIELDS');
    }
    
    if (!['info', 'warn', 'error', 'critical'].includes(level)) {
      throw createError('Invalid level. Must be: info, warn, error, critical', 400, 'INVALID_LEVEL');
    }
    
    await EventStreamingService.emitSystemEvent(
      eventType,
      component,
      level,
      payload,
      {
        ...metadata,
        userId: req.user?.userId,
        tenantId: req.user?.tenantId
      }
    );
    
    res.status(201).json({
      success: true,
      message: 'System event emitted successfully'
    });
  } catch (error) {
    LoggerService.error('System event emission API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
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
router.post('/compliance', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const { regulation, requirement, data, status, notes, metadata } = req.body;
    
    if (!regulation || !requirement || !data || !status) {
      throw createError('Missing required fields: regulation, requirement, data, status', 400, 'MISSING_REQUIRED_FIELDS');
    }
    
    if (!['compliant', 'non-compliant', 'pending'].includes(status)) {
      throw createError('Invalid status. Must be: compliant, non-compliant, pending', 400, 'INVALID_STATUS');
    }
    
    await EventStreamingService.emitComplianceEvent(
      regulation,
      requirement,
      data,
      status,
      {
        ...metadata,
        userId: req.user?.userId,
        tenantId: req.user?.tenantId
      },
      notes
    );
    
    res.status(201).json({
      success: true,
      message: 'Compliance event emitted successfully'
    });
  } catch (error) {
    LoggerService.error('Compliance event emission API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
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
router.post('/subscribe', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const { topic, groupId, handlerType } = req.body;
    
    if (!topic || !groupId || !handlerType) {
      throw createError('Missing required fields: topic, groupId, handlerType', 400, 'MISSING_REQUIRED_FIELDS');
    }
    
    // Map handler type to actual handler function
    let handler: (event: any) => Promise<void>;
    switch (handlerType) {
      case 'audit':
        handler = EventHandlers.handleAuditEvent;
        break;
      case 'transaction':
        handler = EventHandlers.handleTransactionEvent;
        break;
      case 'system':
        handler = EventHandlers.handleSystemEvent;
        break;
      case 'compliance':
        handler = EventHandlers.handleComplianceEvent;
        break;
      default:
        throw createError('Invalid handler type', 400, 'INVALID_HANDLER_TYPE');
    }
    
    await EventStreamingService.subscribeToEvents(topic, groupId, handler);
    
    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to events',
      data: {
        topic,
        groupId,
        handlerType
      }
    });
  } catch (error) {
    LoggerService.error('Event subscription API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
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
router.get('/status', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = EventStreamingService.isHealthy();
    
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
  } catch (error) {
    LoggerService.error('Event streaming status API error:', error);
    
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
router.get('/topics', authenticateToken, async (req: Request, res: Response): Promise<void> => {
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
  } catch (error) {
    LoggerService.error('Get topics API error:', error);
    
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
router.get('/mappings', authenticateToken, async (req: Request, res: Response): Promise<void> => {
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
  } catch (error) {
    LoggerService.error('Get mappings API error:', error);
    
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
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = EventStreamingService.isHealthy();
    
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
  } catch (error) {
    LoggerService.error('Event streaming health check error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Event streaming service unhealthy',
        code: 'SERVICE_UNHEALTHY'
      }
    });
  }
});

export default router;
