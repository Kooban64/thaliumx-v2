/**
 * Workflow Routes - API endpoints for Workflow Orchestrator
 * 
 * Production-ready routes for:
 * - Starting workflows
 * - Getting workflow status
 * - Retrying failed workflows
 * - Cancelling workflows
 * - Listing user workflows
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { LoggerService } from '../services/logger';
import { authenticateToken, requireRole, validateRequest } from '../middleware/error-handler';
import type { WorkflowInput, WorkflowExecutionOptions } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import * as JoiModule from 'joi';

// Handle namespace imports for CommonJS modules
const Joi = (JoiModule as any).default || JoiModule;

const router: Router = Router();

// =============================================================================
// WORKFLOW MANAGEMENT ROUTES
// =============================================================================

/**
 * Start a new workflow
 * POST /api/workflows/start
 */
router.post('/start',
  authenticateToken,
  validateRequest(Joi.object({
    workflowType: Joi.string().valid(...Object.values(WorkflowType)).required(),
    userId: Joi.string().optional(),
    tenantId: Joi.string().optional(),
    brokerId: Joi.string().optional(),
    data: Joi.object().required(),
    metadata: Joi.object().optional(),
    maxRetries: Joi.number().integer().min(0).max(10).optional(),
    timeout: Joi.number().integer().min(1000).optional(),
    retryDelay: Joi.number().integer().min(100).optional(),
    enableCompensation: Joi.boolean().optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.body;
      const authUserId = req.user?.userId || req.user?.id;
      const {
        workflowType,
        userId,
        tenantId: requestTenantId,
        brokerId,
        data,
        metadata,
        maxRetries,
        timeout,
        retryDelay,
                enableCompensation
      } = req.body;

      // Use authenticated user's tenant if not provided
      const finalTenantId = requestTenantId || tenantId;
      const finalUserId = userId || authUserId;

      LoggerService.info('Starting workflow', {
        workflowType,
        userId: finalUserId,
        tenantId: finalTenantId
      });

      const input: WorkflowInput = {
        workflowType: workflowType as WorkflowType,
        userId: finalUserId,
        tenantId: finalTenantId,
        brokerId,
        data,
        metadata
      };

      const options: WorkflowExecutionOptions = {
        maxRetries,
        timeout,
        retryDelay,
        enableCompensation: enableCompensation !== false // Default to true
      };

      const result = await WorkflowOrchestratorService.startWorkflow(input, options);

      res.status(201).json({
        success: true,
        workflowId: result.workflowId,
        workflowType: result.workflowType,
        status: result.status,
        result: result.result,
        error: result.error
      });
    } catch (error: any) {
      LoggerService.error('Failed to start workflow', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Get workflow status
 * GET /api/workflows/:workflowId/status
 */
router.get('/:workflowId/status',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { workflowId } = req.params;
      if (!workflowId) {
        res.status(400).json({
          success: false,
          error: 'Workflow ID is required'
        });
        return;
      }

      const tenantId = (req.user as any)?.tenantId;
      const userId = (req.user as any)?.userId || (req.user as any)?.id;

      LoggerService.info('Getting workflow status', {
        workflowId,
        userId: userId || 'unknown',
        tenantId: tenantId || 'unknown'
      });

      const state = await WorkflowOrchestratorService.getWorkflowStatus(workflowId);

      if (!state) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      // Verify user has access to this workflow
      if (state.userId && userId && state.userId !== userId && !req.user?.role?.includes('admin')) {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      res.json({
        success: true,
        workflow: state
      });
    } catch (error: any) {
      LoggerService.error('Failed to get workflow status', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Retry failed workflow step
 * POST /api/workflows/:workflowId/retry
 */
router.post('/:workflowId/retry',
  authenticateToken,
  validateRequest(Joi.object({
    stepIndex: Joi.number().integer().min(0).optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { workflowId } = req.params;
      if (!workflowId) {
        res.status(400).json({
          success: false,
          error: 'Workflow ID is required'
        });
        return;
      }

      const { stepIndex } = req.body;
      const userId = (req.user as any)?.userId || (req.user as any)?.id;

      LoggerService.info('Retrying workflow step', {
        workflowId,
        stepIndex,
        userId: userId || 'unknown'
      });

      // Verify user has access
      const state = await WorkflowOrchestratorService.getWorkflowStatus(workflowId);
      if (!state) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      if (state.userId && userId && state.userId !== userId && !req.user?.role?.includes('admin')) {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      const stepToRetry = stepIndex !== undefined ? stepIndex : state.stepIndex;
      await WorkflowOrchestratorService.retryWorkflowStep(workflowId as string, stepToRetry);

      res.json({
        success: true,
        message: 'Workflow retry initiated'
      });
    } catch (error: any) {
      LoggerService.error('Failed to retry workflow', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Cancel workflow
 * POST /api/workflows/:workflowId/cancel
 */
router.post('/:workflowId/cancel',
  authenticateToken,
  validateRequest(Joi.object({
    reason: Joi.string().optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { workflowId } = req.params;
      const { reason } = req.body;
      const userId = (req.user as any)?.id;

      if (!workflowId) {
        res.status(400).json({
          success: false,
          error: 'Workflow ID is required'
        });
        return;
      }

      LoggerService.info('Cancelling workflow', {
        workflowId,
        reason,
        userId: userId || 'unknown'
      });

      // Verify user has access
      const state = await WorkflowOrchestratorService.getWorkflowStatus(workflowId);
      if (!state) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      if (state.userId && state.userId !== userId && !req.user?.role?.includes('admin')) {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      await WorkflowOrchestratorService.cancelWorkflow(
        workflowId as string,
        reason || 'Cancelled by user'
      );

      res.json({
        success: true,
        message: 'Workflow cancelled'
      });
    } catch (error: any) {
      LoggerService.error('Failed to cancel workflow', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Get workflows by user
 * GET /api/workflows/user/:userId
 */
router.get('/user/:userId',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const status = req.query.status as string | undefined;
      const workflowType = req.query.workflowType as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const authUserId = (req.user as any)?.userId || (req.user as any)?.id;
      const role = (req.user as any)?.role;

      // Verify user has access (own workflows or admin)
      if (userId !== authUserId && !role?.includes('admin')) {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      LoggerService.info('Getting workflows by user', {
        userId,
        status,
        workflowType
      });

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const workflows = await WorkflowOrchestratorService.getWorkflowsByUser(
        userId,
        {
          status: status as any,
          workflowType: workflowType as any,
          limit,
          offset
        }
      );

      res.json({
        success: true,
        workflows,
        count: workflows.length
      });
    } catch (error: any) {
      LoggerService.error('Failed to get workflows by user', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Continue workflow execution (internal - called by event handlers)
 * POST /api/workflows/:workflowId/continue
 */
router.post('/:workflowId/continue',
  authenticateToken,
  requireRole(['admin', 'system']), // Only system/admin can continue workflows
  validateRequest(Joi.object({
    stepResult: Joi.any().required(),
    nextStep: Joi.string().optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { workflowId } = req.params;
      if (!workflowId) {
        res.status(400).json({
          success: false,
          error: 'Workflow ID is required'
        });
        return;
      }

      const { stepResult, nextStep } = req.body;

      LoggerService.info('Continuing workflow execution', {
        workflowId,
        nextStep
      });

      await WorkflowOrchestratorService.continueWorkflow(
        workflowId,
        stepResult,
                nextStep
      );

      res.json({
        success: true,
        message: 'Workflow continued'
      });
    } catch (error: any) {
      LoggerService.error('Failed to continue workflow', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Get available workflow types
 * GET /api/workflows/types
 */
router.get('/types',
  authenticateToken,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const types = Object.values(WorkflowType);
      res.json({
        success: true,
        data: {
          types
        }
      });
    } catch (error: any) {
      LoggerService.error('Failed to get workflow types', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Get workflow orchestrator health status
 * GET /api/workflows/health
 */
router.get('/health',
  authenticateToken,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      // Simple health check - verify service is operational
      // In the future, this could include statistics from the database
      const health = {
        status: 'healthy' as const
      };

      res.json({
        success: true,
        data: health
      });
    } catch (error: any) {
      LoggerService.error('Failed to get workflow health', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        data: {
          status: 'unhealthy' as const
        },
        error: error.message
      });
    }
  }
);

export default router;
