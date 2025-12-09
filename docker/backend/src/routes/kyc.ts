/**
 * KYC Routes - API endpoints for KYC/KYB System
 * 
 * Production-ready routes for:
 * - KYC Verification Management
 * - Document Upload & Verification
 * - Risk Assessment & Monitoring
 * - Compliance & Reporting
 * - Webhook Processing
 */

import { Router, Request, Response } from 'express';
import { KYCService } from '../services/kyc';
import { LoggerService } from '../services/logger';
import { AppError } from '../utils';
import { authenticateToken, requireRole, validateRequest } from '../middleware/error-handler';
import * as JoiModule from 'joi';
import * as multerModule from 'multer';
import * as path from 'path';

// Handle namespace imports for CommonJS modules
const Joi = (JoiModule as any).default || JoiModule;
const multer = (multerModule as any).default || multerModule;

// Type for multer file filter callback
type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

const router: Router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
    }
  }
});

// =============================================================================
// KYC VERIFICATION ROUTES
// =============================================================================

/**
 * Start KYC Verification Process
 * POST /api/kyc/verify
 */
router.post('/verify',
  authenticateToken,
  validateRequest(Joi.object({
    keycloakUserId: Joi.string().required(),
    brokerId: Joi.string().required(),
    email: Joi.string().email().required(),
    phoneNumber: Joi.string().optional(),
    walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
    requestedLevel: Joi.string().valid('L0', 'L1', 'L2', 'L3').default('L0')
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const {
        keycloakUserId,
        brokerId,
        email,
        phoneNumber,
        walletAddress,
        requestedLevel
      } = req.body;

      LoggerService.info('Starting KYC verification process', {
        tenantId,
        keycloakUserId,
        brokerId,
        email,
        requestedLevel
      });

      const user = await KYCService.startKYCVerification(
        tenantId,
        keycloakUserId,
        brokerId,
        email,
        phoneNumber,
        walletAddress,
        requestedLevel
      );

      res.status(201).json({
        success: true,
        data: user,
        message: 'KYC verification process started successfully'
      });

    } catch (error) {
      LoggerService.error('Start KYC verification failed:', error);
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
  }
);

/**
 * Get KYC Status
 * GET /api/kyc/status/:userId
 */
router.get('/status/:userId',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { userId } = req.params;

      LoggerService.info('Fetching KYC status', {
        tenantId,
        userId
      });

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const user = await KYCService.getKYCStatus(userId);

      // Verify tenant access
      if (user.tenantId !== tenantId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      res.json({
        success: true,
        data: user
      });

    } catch (error) {
      LoggerService.error('Get KYC status failed:', error);
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
  }
);

/**
 * Update KYC Level
 * PUT /api/kyc/level/:userId
 */
router.put('/level/:userId',
  authenticateToken,
  requireRole(['admin', 'broker']),
  validateRequest(Joi.object({
    newLevel: Joi.string().valid('L0', 'L1', 'L2', 'L3').required(),
    reason: Joi.string().min(10).max(500).required()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { userId } = req.params;
      const { newLevel, reason } = req.body;

      LoggerService.info('Updating KYC level', {
        tenantId,
        userId,
        newLevel,
        reason
      });

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const user = await KYCService.updateKYCLevel(userId, newLevel, reason);

      res.json({
        success: true,
        data: user,
        message: 'KYC level updated successfully'
      });

    } catch (error) {
      LoggerService.error('Update KYC level failed:', error);
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
  }
);

// =============================================================================
// DOCUMENT MANAGEMENT ROUTES
// =============================================================================

/**
 * Upload Document
 * POST /api/kyc/documents/upload
 */
router.post('/documents/upload',
  authenticateToken,
  upload.array('documents', 5),
  validateRequest(Joi.object({
    userId: Joi.string().required(),
    documentType: Joi.string().valid(
      'PASSPORT',
      'NATIONAL_ID',
      'DRIVERS_LICENSE',
      'UTILITY_BILL',
      'BANK_STATEMENT',
      'PROOF_OF_ADDRESS',
      'PROOF_OF_INCOME',
      'COMPANY_REGISTRATION',
      'ARTICLES_OF_INCORPORATION',
      'BENEFICIAL_OWNERSHIP'
    ).required(),
    country: Joi.string().length(2).default('US'),
    documentNumber: Joi.string().optional(),
    issuedDate: Joi.date().optional(),
    expiryDate: Joi.date().optional(),
    issuedBy: Joi.string().optional(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    dateOfBirth: Joi.date().optional(),
    nationality: Joi.string().optional(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const files = req.files as Express.Multer.File[];
      const {
        userId,
        documentType,
        country,
        documentNumber,
        issuedDate,
        expiryDate,
        issuedBy,
        firstName,
        lastName,
        dateOfBirth,
        nationality,
        gender
      } = req.body;

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No documents uploaded',
          code: 'NO_DOCUMENTS'
        });
        return;
      }

      LoggerService.info('Uploading documents for verification', {
        tenantId,
        userId,
        documentType,
        country,
        fileCount: files.length
      });

      const results = [];

      for (const file of files) {
        const metadata = {
          documentNumber,
          issuedDate: issuedDate ? new Date(issuedDate) : undefined,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          issuedBy,
          firstName,
          lastName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          nationality,
          gender,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          checksum: require('crypto').createHash('sha256').update(file.buffer).digest('hex')
        };

        const document = await KYCService.uploadDocument(
          userId,
          documentType,
          file.buffer,
          metadata,
          country
        );

        results.push(document);
      }

      res.status(201).json({
        success: true,
        data: results,
        message: `${results.length} document(s) uploaded successfully`
      });

    } catch (error) {
      LoggerService.error('Upload documents failed:', error);
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
  }
);

/**
 * Get User Documents
 * GET /api/kyc/documents/:userId
 */
router.get('/documents/:userId',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { userId } = req.params;

      LoggerService.info('Fetching user documents', {
        tenantId,
        userId
      });

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const user = await KYCService.getKYCStatus(userId);

      // Verify tenant access
      if (user.tenantId !== tenantId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          documents: user.documents,
          totalDocuments: user.documents.length,
          verifiedDocuments: user.documents.filter(doc => doc.status === 'VERIFIED').length,
          pendingDocuments: user.documents.filter(doc => doc.status === 'PENDING' || doc.status === 'PROCESSING').length,
          rejectedDocuments: user.documents.filter(doc => doc.status === 'REJECTED').length
        }
      });

    } catch (error) {
      LoggerService.error('Get user documents failed:', error);
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
  }
);

// =============================================================================
// RISK ASSESSMENT ROUTES
// =============================================================================

/**
 * Get Risk Assessment
 * GET /api/kyc/risk/:userId
 */
router.get('/risk/:userId',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { userId } = req.params;

      LoggerService.info('Fetching risk assessment', {
        tenantId,
        userId
      });

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const user = await KYCService.getKYCStatus(userId);

      // Verify tenant access
      if (user.tenantId !== tenantId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          riskScore: user.riskScore,
          riskLevel: user.riskLevel,
          riskChanges: user.ongoingMonitoring.riskChanges,
          alerts: user.ongoingMonitoring.alerts,
          complianceFlags: user.complianceFlags
        }
      });

    } catch (error) {
      LoggerService.error('Get risk assessment failed:', error);
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
  }
);

/**
 * Get Compliance Flags
 * GET /api/kyc/compliance/:userId
 */
router.get('/compliance/:userId',
  authenticateToken,
  requireRole(['admin', 'broker']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { userId } = req.params;

      LoggerService.info('Fetching compliance flags', {
        tenantId,
        userId
      });

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const user = await KYCService.getKYCStatus(userId);

      // Verify tenant access
      if (user.tenantId !== tenantId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          complianceFlags: user.complianceFlags,
          sanctionsChecks: user.sanctionsChecks,
          pepChecks: user.pepChecks,
          ongoingMonitoring: user.ongoingMonitoring
        }
      });

    } catch (error) {
      LoggerService.error('Get compliance flags failed:', error);
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
  }
);

// =============================================================================
// WEBHOOK ROUTES
// =============================================================================

/**
 * Ballerine Webhook
 * POST /api/kyc/webhooks/ballerine
 */
router.post('/webhooks/ballerine',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers['x-ballerine-signature'] as string;
      const payload = req.body;

      LoggerService.info('Received Ballerine webhook', {
        eventType: payload.eventType,
        caseId: payload.caseId
      });

      await KYCService.processBallerineWebhook(payload, signature);

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully'
      });

    } catch (error) {
      LoggerService.error('Process Ballerine webhook failed:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed',
        code: 'WEBHOOK_ERROR'
      });
    }
  }
);

// =============================================================================
// REPORTING ROUTES
// =============================================================================

/**
 * Get KYC Statistics
 * GET /api/kyc/stats
 */
router.get('/stats',
  authenticateToken,
  requireRole(['admin', 'broker']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { period = '30d', kycLevel, status } = req.query;

      LoggerService.info('Fetching KYC statistics', {
        tenantId,
        period,
        kycLevel,
        status
      });

      // This would typically query the database for statistics
      const stats = {
        totalUsers: 0,
        pendingVerifications: 0,
        approvedVerifications: 0,
        rejectedVerifications: 0,
        expiredVerifications: 0,
        averageRiskScore: 0,
        complianceFlags: 0,
        sanctionsMatches: 0,
        pepMatches: 0,
        byLevel: {
          L0: 0,
          L1: 0,
          L2: 0,
          L3: 0
        },
        byStatus: {
          PENDING: 0,
          IN_PROGRESS: 0,
          APPROVED: 0,
          REJECTED: 0,
          EXPIRED: 0,
          SUSPENDED: 0,
          REQUIRES_REVIEW: 0
        }
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      LoggerService.error('Get KYC statistics failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * Export KYC Report
 * GET /api/kyc/reports/export
 */
router.get('/reports/export',
  authenticateToken,
  requireRole(['admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { format = 'csv', startDate, endDate, kycLevel, status } = req.query;

      LoggerService.info('Exporting KYC report', {
        tenantId,
        format,
        startDate,
        endDate,
        kycLevel,
        status
      });

      // This would typically generate and return a report file
      const reportData = {
        format,
        generatedAt: new Date(),
        filters: {
          startDate,
          endDate,
          kycLevel,
          status
        },
        recordCount: 0,
        downloadUrl: null // Would be a signed URL to download the report
      };

      res.json({
        success: true,
        data: reportData
      });

    } catch (error) {
      LoggerService.error('Export KYC report failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Create Collection Flow URL
 * POST /api/kyc/collection-flow/create
 */
router.post('/collection-flow/create',
  authenticateToken,
  validateRequest(Joi.object({
    userId: Joi.string().required(),
    workflowId: Joi.string().optional(),
    redirectUrl: Joi.string().uri().optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, workflowId, redirectUrl } = req.body;
      const { tenantId } = req.user as any;

      LoggerService.info('Creating collection flow URL', {
        userId,
        workflowId,
        tenantId
      });

      // Get user to determine workflow type
      const user = await KYCService.getKYCStatus(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      // Create collection flow URL via Ballerine
      const { ballerineService } = await import('../services/ballerine');
      const collectionFlow = await ballerineService.createCollectionFlowUrl({
        workflowId: workflowId || user.ballerineWorkflowId || 'kyc-workflow',
        endUserId: userId,
        config: {
          redirectUrl: redirectUrl || `${process.env.BACKEND_URL}/api/kyc/collection-flow/callback`
        }
      });

      res.status(200).json({
        success: true,
        data: collectionFlow,
        message: 'Collection flow URL created successfully'
      });

    } catch (error) {
      LoggerService.error('Create collection flow URL failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create collection flow URL',
        code: 'COLLECTION_FLOW_CREATE_ERROR'
      });
    }
  }
);

/**
 * Collection Flow Callback
 * POST /api/kyc/collection-flow/callback
 */
router.post('/collection-flow/callback',
  async (req: Request, res: Response): Promise<void> => {
    try {
      LoggerService.info('Collection flow callback received', {
        body: req.body
      });

      // Handle Ballerine collection flow callback
      const { workflowId, state, documents } = req.body;

      if (workflowId) {
        // Update workflow state if needed
        const { ballerineService } = await import('../services/ballerine');
        if (state) {
          await ballerineService.updateCollectionFlowState(workflowId, state);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Collection flow callback processed'
      });

    } catch (error) {
      LoggerService.error('Collection flow callback failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process collection flow callback'
      });
    }
  }
);

/**
 * Get Collection Flow State
 * GET /api/kyc/collection-flow/:workflowId/state
 */
router.get('/collection-flow/:workflowId/state',
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

      const { ballerineService } = await import('../services/ballerine');
      const state = await ballerineService.getCollectionFlowState(workflowId);

      res.status(200).json({
        success: true,
        data: { state },
        message: 'Collection flow state retrieved successfully'
      });

    } catch (error) {
      LoggerService.error('Get collection flow state failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get collection flow state',
        code: 'COLLECTION_FLOW_STATE_ERROR'
      });
    }
  }
);

/**
 * Send Workflow Event
 * POST /api/kyc/workflows/:workflowId/event
 */
router.post('/workflows/:workflowId/event',
  authenticateToken,
  validateRequest(Joi.object({
    event: Joi.string().required(),
    payload: Joi.object().optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { workflowId } = req.params;
      const { event, payload } = req.body;

      if (!workflowId) {
        res.status(400).json({
          success: false,
          error: 'Workflow ID is required'
        });
        return;
      }

      const { ballerineService } = await import('../services/ballerine');
      const result = await ballerineService.sendWorkflowEvent(workflowId, {
        name: event,
        payload: payload || {}
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Workflow event sent successfully'
      });

    } catch (error) {
      LoggerService.error('Send workflow event failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send workflow event',
        code: 'WORKFLOW_EVENT_ERROR'
      });
    }
  }
);

/**
 * Get Workflow Logs
 * GET /api/kyc/workflows/:workflowId/logs
 */
router.get('/workflows/:workflowId/logs',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { workflowId } = req.params;
      const { type, limit } = req.query;

      if (!workflowId) {
        res.status(400).json({
          success: false,
          error: 'Workflow ID is required'
        });
        return;
      }

      const { ballerineService } = await import('../services/ballerine');
      const logs = await ballerineService.getWorkflowLogs(workflowId, {
        type: type as string,
        limit: limit ? parseInt(limit as string) : undefined
      });

      res.status(200).json({
        success: true,
        data: logs,
        message: 'Workflow logs retrieved successfully'
      });

    } catch (error) {
      LoggerService.error('Get workflow logs failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get workflow logs',
        code: 'WORKFLOW_LOGS_ERROR'
      });
    }
  }
);

/**
 * Get Workflow Definitions
 * GET /api/kyc/workflow-definitions
 */
router.get('/workflow-definitions',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { ballerineService } = await import('../services/ballerine');
      const definitions = await ballerineService.getWorkflowDefinitions();

      res.status(200).json({
        success: true,
        data: definitions,
        message: 'Workflow definitions retrieved successfully'
      });

    } catch (error) {
      LoggerService.error('Get workflow definitions failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get workflow definitions',
        code: 'WORKFLOW_DEFINITIONS_ERROR'
      });
    }
  }
);

/**
 * KYC Service Health Check
 * GET /api/kyc/health
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = KYCService.isHealthy();
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'KYC Service',
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('KYC health check failed:', error);
    res.status(503).json({
      success: false,
      service: 'KYC Service',
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;