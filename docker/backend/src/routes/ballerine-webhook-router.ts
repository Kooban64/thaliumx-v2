/**
 * Ballerine Webhook Router
 * 
 * Handles webhook callbacks from Ballerine workflow service
 * for automatic KYC level updates when workflows complete.
 * 
 * Endpoints:
 * - POST /api/ballerine/webhook - Main webhook endpoint
 * - POST /api/ballerine/webhook/workflow/:workflowId - Specific workflow callback
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { LoggerService } from '../services/logger';
import { KYCWorkflowTriggerService } from '../services/kyc-workflow-trigger.service';
import { AppError } from '../utils';
import * as crypto from 'crypto';

const router: Router = Router();

// =============================================================================
// WEBHOOK VERIFICATION
// =============================================================================

/**
 * Verify webhook signature (if configured)
 */
function verifyWebhookSignature(req: Request, payload: string): boolean {
  const webhookSecret = process.env.BALLERINE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // If no secret configured, skip verification (not recommended for production)
    LoggerService.warn('BALLERINE_WEBHOOK_SECRET not configured, skipping signature verification');
    return true;
  }

  const signature = req.headers['x-ballerine-signature'] as string;
  if (!signature) {
    LoggerService.warn('Missing webhook signature header');
    return false;
  }

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSignature)
  );
}

// =============================================================================
// WEBHOOK ENDPOINTS
// =============================================================================

/**
 * POST /api/ballerine/webhook
 * Main webhook endpoint for Ballerine workflow callbacks
 */
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = JSON.stringify(req.body);
    
    // Verify webhook signature
    if (!verifyWebhookSignature(req, payload)) {
      res.status(401).json({
        success: false,
        error: 'Invalid webhook signature',
        code: 'INVALID_SIGNATURE'
      });
      return;
    }

    const { workflowId, caseId, state, status, decision, documents, metadata } = req.body;

    if (!workflowId) {
      res.status(400).json({
        success: false,
        error: 'Missing workflowId in webhook payload',
        code: 'MISSING_WORKFLOW_ID'
      });
      return;
    }

    LoggerService.info('Received Ballerine webhook', {
      workflowId,
      caseId,
      state,
      status,
      decision: decision?.status
    });

    // Handle workflow callback (this automatically updates KYC level for both platforms)
    await KYCWorkflowTriggerService.handleWorkflowCallback(
      workflowId,
      status || state,
      decision,
      {
        ...metadata,
        caseId,
        documents,
        receivedAt: new Date().toISOString()
      }
    );

    // Also update KYC service webhook handler for backward compatibility
    try {
      // KYC service webhook handler is called via KYCWorkflowTriggerService above
      // This ensures unified KYC level updates across both presale and main platform
    } catch (error) {
      LoggerService.warn('KYC service webhook handler not available', { error });
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to process Ballerine webhook:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
});

/**
 * POST /api/ballerine/webhook/workflow/:workflowId
 * Specific workflow callback endpoint
 */
router.post('/webhook/workflow/:workflowId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { workflowId } = req.params;
    const payload = JSON.stringify(req.body);
    
    // Verify webhook signature
    if (!verifyWebhookSignature(req, payload)) {
      res.status(401).json({
        success: false,
        error: 'Invalid webhook signature',
        code: 'INVALID_SIGNATURE'
      });
      return;
    }

    const { workflowId: workflowIdParam } = req.params;
    const { state, status, decision, documents, metadata } = req.body;

    LoggerService.info('Received Ballerine workflow webhook', {
      workflowId: workflowIdParam,
      state,
      status,
      decision: decision?.status
    });

    // Handle workflow callback
    await KYCWorkflowTriggerService.handleWorkflowCallback(
      workflowId || 'unknown',
      status || state || 'unknown',
      decision || {},
      {
        ...metadata,
        documents,
        receivedAt: new Date().toISOString()
      }
    );

    res.json({
      success: true,
      message: 'Workflow webhook processed successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to process Ballerine workflow webhook:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
});

/**
 * GET /api/ballerine/webhook/health
 * Health check endpoint
 */
router.get('/webhook/health', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    service: 'Ballerine Webhook Handler',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
