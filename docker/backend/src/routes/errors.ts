/**
 * Error Logging Routes
 * 
 * API endpoints for client-side error reporting
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/error-handler';
import { LoggerService } from '../services/logger';
import { EventStreamingService } from '../services/event-streaming';
import { validateRequest } from '../middleware/error-handler';
import Joi from 'joi';

const router: Router = Router();

/**
 * POST /api/errors/log
 * Log client-side errors
 */
router.post('/log',
  authenticateToken,
  validateRequest(Joi.object({
    errors: Joi.array().items(Joi.object({
      message: Joi.string().required(),
      error: Joi.string().optional(),
      category: Joi.string().valid('api', 'auth', 'validation', 'network', 'runtime', 'ui', 'unknown').optional(),
      severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
      context: Joi.object().optional(),
      stack: Joi.string().optional(),
    })).min(1).required(),
  })),
  async (req: any, res: any): Promise<void> => {
    try {
      const { errors } = req.body;
      const userId = req.user?.userId || req.user?.id;
      const tenantId = req.user?.tenantId;

      // Log each error
      for (const errorLog of errors) {
        const logLevel = errorLog.severity === 'critical' ? 'error' :
                         errorLog.severity === 'high' ? 'error' :
                         errorLog.severity === 'medium' ? 'warn' : 'info';

        LoggerService[logLevel]('Client-side error reported', {
          userId,
          tenantId,
          message: errorLog.message,
          category: errorLog.category || 'unknown',
          severity: errorLog.severity || 'medium',
          stack: errorLog.stack,
          context: {
            ...errorLog.context,
            url: errorLog.context?.url,
            userAgent: errorLog.context?.userAgent,
            component: errorLog.context?.component,
            action: errorLog.context?.action,
          },
        });

        // Emit audit event for critical/high severity errors
        if (errorLog.severity === 'critical' || errorLog.severity === 'high') {
          await EventStreamingService.emitAuditEvent(
            'client_error_reported',
            'error',
            `error_${Date.now()}`,
            {
              userId,
              tenantId,
              message: errorLog.message,
              category: errorLog.category,
              severity: errorLog.severity,
              component: errorLog.context?.component,
            },
            { userId, tenantId }
          );
        }
      }

      res.json({
        success: true,
        message: 'Errors logged successfully',
        count: errors.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      LoggerService.error('Error logging endpoint failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to log errors',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
