/**
 * Compliance Coordinator
 * Main entry point for the Compliance Coordinator service
 * 
 * This service aggregates compliance data from all platform services:
 * - CEX Compliance Service
 * - DEX Compliance Service
 * - NFT Compliance Service
 * - Token Compliance Service
 * 
 * It provides:
 * - Cross-platform compliance reporting
 * - Unified admin interface
 * - Regulatory submission management
 * - Platform-wide analytics
 * - Alerts management
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';

import { getConfig, validateConfig } from './config';
import { createComponentLogger } from './utils/logger';
import {
  getDatabaseService,
  getAggregationService,
  getReportingService,
  getEventConsumer,
  getAlertsService,
  getRegulatoryService,
  getAdminService,
} from './services';

const appLogger = createComponentLogger('app');

/**
 * Application state
 */
interface AppState {
  isShuttingDown: boolean;
  isReady: boolean;
}

const state: AppState = {
  isShuttingDown: false,
  isReady: false,
};

/**
 * Create Express application
 */
function createApp(): express.Application {
  const app = express();
  const config = getConfig();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }));

  // CORS
  app.use(cors({
    origin: config.server.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Tenant-ID', 'X-Admin-ID'],
    credentials: true,
    maxAge: 86400,
  }));

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      appLogger.info('Request completed', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      });
    });

    next();
  });

  // Health check endpoints
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'compliance-coordinator',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    if (!state.isReady) {
      res.status(503).json({
        status: 'not_ready',
        service: 'compliance-coordinator',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const db = getDatabaseService();
      await db.query('SELECT 1');

      res.json({
        status: 'ready',
        service: 'compliance-coordinator',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        service: 'compliance-coordinator',
        error: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/health/live', (_req: Request, res: Response) => {
    if (state.isShuttingDown) {
      res.status(503).json({
        status: 'shutting_down',
        service: 'compliance-coordinator',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      status: 'alive',
      service: 'compliance-coordinator',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  setupRoutes(app);

  // Error handling
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string;
    appLogger.error('Unhandled error', {
      requestId,
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      error: 'Internal server error',
      requestId,
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

/**
 * Setup API routes
 */
function setupRoutes(app: express.Application): void {
  const router = express.Router();

  // ==================== AGGREGATION ENDPOINTS ====================

  router.get('/risk-assessments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, riskLevel, reviewRequired, sourceService, limit, offset } = req.query;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing required query parameter: tenantId' });
        return;
      }

      const aggregationService = getAggregationService();
      
      // Build options object, only including defined values
      const options: {
        riskLevel?: 'low' | 'medium' | 'high' | 'critical';
        reviewRequired?: boolean;
        sourceService?: 'cex' | 'dex' | 'nft' | 'token';
        limit?: number;
        offset?: number;
      } = {};

      if (riskLevel) {
        options.riskLevel = riskLevel as 'low' | 'medium' | 'high' | 'critical';
      }
      if (reviewRequired !== undefined) {
        options.reviewRequired = reviewRequired === 'true';
      }
      if (sourceService) {
        options.sourceService = sourceService as 'cex' | 'dex' | 'nft' | 'token';
      }
      if (limit) {
        options.limit = parseInt(limit as string, 10);
      }
      if (offset) {
        options.offset = parseInt(offset as string, 10);
      }

      const results = await aggregationService.getRiskAssessments(tenantId as string, options);
      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  router.get('/travel-rules', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, status, sourceService, limit, offset } = req.query;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing required query parameter: tenantId' });
        return;
      }

      const aggregationService = getAggregationService();
      
      const options: {
        status?: string;
        sourceService?: 'cex' | 'dex' | 'nft' | 'token';
        limit?: number;
        offset?: number;
      } = {};

      if (status) {
        options.status = status as string;
      }
      if (sourceService) {
        options.sourceService = sourceService as 'cex' | 'dex' | 'nft' | 'token';
      }
      if (limit) {
        options.limit = parseInt(limit as string, 10);
      }
      if (offset) {
        options.offset = parseInt(offset as string, 10);
      }

      const results = await aggregationService.getTravelRules(tenantId as string, options);
      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  router.get('/statistics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, periodStart, periodEnd } = req.query;

      if (!tenantId || !periodStart || !periodEnd) {
        res.status(400).json({
          error: 'Missing required query parameters: tenantId, periodStart, periodEnd',
        });
        return;
      }

      const aggregationService = getAggregationService();
      const stats = await aggregationService.getPlatformStatistics(
        tenantId as string,
        new Date(periodStart as string),
        new Date(periodEnd as string)
      );

      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // ==================== REPORTING ENDPOINTS ====================

  router.post('/reports/platform', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        reportType,
        tenantId,
        brokerId,
        periodStart,
        periodEnd,
        format,
        generatedBy,
      } = req.body;

      if (!reportType || !tenantId || !periodStart || !periodEnd) {
        res.status(400).json({
          error: 'Missing required fields: reportType, tenantId, periodStart, periodEnd',
        });
        return;
      }

      const reportingService = getReportingService();
      const report = await reportingService.generatePlatformReport(
        reportType,
        {
          tenantId,
          brokerId,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          format,
          generatedBy,
        }
      );

      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  router.get('/reports/platform/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      const reportingService = getReportingService();
      const report = await reportingService.getPlatformReport(id);

      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  router.post('/reports/user', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        userId,
        tenantId,
        brokerId,
        periodStart,
        periodEnd,
        format,
      } = req.body;

      if (!userId || !tenantId || !periodStart || !periodEnd) {
        res.status(400).json({
          error: 'Missing required fields: userId, tenantId, periodStart, periodEnd',
        });
        return;
      }

      const reportingService = getReportingService();
      const report = await reportingService.generateUserReport({
        userId,
        tenantId,
        brokerId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        format,
      });

      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  router.get('/reports/user/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      const reportingService = getReportingService();
      const report = await reportingService.getUserReport(id);

      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  // ==================== ALERTS ENDPOINTS ====================

  router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, status, severity, alertType, sourceService, assignedTo, limit, offset } = req.query;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing required query parameter: tenantId' });
        return;
      }

      const alertsService = getAlertsService();
      const alerts = await alertsService.getAlerts(tenantId as string, {
        status: status as 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'dismissed' | undefined,
        severity: severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
        alertType: alertType as 'high_risk' | 'sanctions_match' | 'travel_rule_failure' | 'threshold_breach' | 'pattern_detected' | 'system_error' | undefined,
        sourceService: sourceService as 'cex' | 'dex' | 'nft' | 'token' | undefined,
        assignedTo: assignedTo as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json(alerts);
    } catch (error) {
      next(error);
    }
  });

  router.get('/alerts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      const alertsService = getAlertsService();
      const alert = await alertsService.getAlert(id);

      if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }

      res.json(alert);
    } catch (error) {
      next(error);
    }
  });

  router.post('/alerts/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];
      const { acknowledgedBy } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      if (!acknowledgedBy) {
        res.status(400).json({ error: 'Missing required field: acknowledgedBy' });
        return;
      }

      const alertsService = getAlertsService();
      const alert = await alertsService.acknowledgeAlert(id, acknowledgedBy);

      if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }

      res.json(alert);
    } catch (error) {
      next(error);
    }
  });

  router.post('/alerts/:id/investigate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];
      const { assignedTo } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      if (!assignedTo) {
        res.status(400).json({ error: 'Missing required field: assignedTo' });
        return;
      }

      const alertsService = getAlertsService();
      const alert = await alertsService.investigateAlert(id, assignedTo);

      if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }

      res.json(alert);
    } catch (error) {
      next(error);
    }
  });

  router.post('/alerts/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];
      const { resolvedBy, resolution } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      if (!resolvedBy || !resolution) {
        res.status(400).json({ error: 'Missing required fields: resolvedBy, resolution' });
        return;
      }

      const alertsService = getAlertsService();
      const alert = await alertsService.resolveAlert(id, resolvedBy, resolution);

      if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }

      res.json(alert);
    } catch (error) {
      next(error);
    }
  });

  router.post('/alerts/:id/dismiss', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];
      const { dismissedBy, reason } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      if (!dismissedBy || !reason) {
        res.status(400).json({ error: 'Missing required fields: dismissedBy, reason' });
        return;
      }

      const alertsService = getAlertsService();
      const alert = await alertsService.dismissAlert(id, dismissedBy, reason);

      if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }

      res.json(alert);
    } catch (error) {
      next(error);
    }
  });

  router.get('/alerts/statistics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, periodStart, periodEnd } = req.query;

      if (!tenantId || !periodStart || !periodEnd) {
        res.status(400).json({
          error: 'Missing required query parameters: tenantId, periodStart, periodEnd',
        });
        return;
      }

      const alertsService = getAlertsService();
      const stats = await alertsService.getAlertStatistics(
        tenantId as string,
        new Date(periodStart as string),
        new Date(periodEnd as string)
      );

      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // ==================== REGULATORY ENDPOINTS ====================

  router.get('/regulatory/submissions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, submissionType, jurisdiction, status, limit, offset } = req.query;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing required query parameter: tenantId' });
        return;
      }

      const regulatoryService = getRegulatoryService();
      const submissions = await regulatoryService.getSubmissions(tenantId as string, {
        submissionType: submissionType as 'carf' | 'sar' | 'ctr' | 'str' | 'custom' | undefined,
        jurisdiction: jurisdiction as string | undefined,
        status: status as 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected' | 'accepted' | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json(submissions);
    } catch (error) {
      next(error);
    }
  });

  router.get('/regulatory/submissions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      const regulatoryService = getRegulatoryService();
      const submission = await regulatoryService.getSubmission(id);

      if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
      }

      res.json(submission);
    } catch (error) {
      next(error);
    }
  });

  router.post('/regulatory/submissions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        submissionType,
        jurisdiction,
        authority,
        tenantId,
        brokerId,
        reportingPeriod,
        data,
        submittedBy,
      } = req.body;

      if (!submissionType || !jurisdiction || !authority || !tenantId || !data) {
        res.status(400).json({
          error: 'Missing required fields: submissionType, jurisdiction, authority, tenantId, data',
        });
        return;
      }

      const regulatoryService = getRegulatoryService();
      const submission = await regulatoryService.createSubmission({
        submissionType,
        jurisdiction,
        authority,
        tenantId,
        brokerId,
        reportingPeriod: reportingPeriod ? {
          startDate: new Date(reportingPeriod.startDate),
          endDate: new Date(reportingPeriod.endDate),
        } : undefined,
        data,
        submittedBy,
      });

      res.status(201).json(submission);
    } catch (error) {
      next(error);
    }
  });

  router.post('/regulatory/submissions/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      const regulatoryService = getRegulatoryService();
      const submission = await regulatoryService.submitToAuthority(id);

      if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
      }

      res.json(submission);
    } catch (error) {
      next(error);
    }
  });

  router.post('/regulatory/submissions/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];
      const { responseCode, responseMessage } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      if (!responseCode || !responseMessage) {
        res.status(400).json({ error: 'Missing required fields: responseCode, responseMessage' });
        return;
      }

      const regulatoryService = getRegulatoryService();
      const submission = await regulatoryService.acknowledgeSubmission(id, responseCode, responseMessage);

      if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
      }

      res.json(submission);
    } catch (error) {
      next(error);
    }
  });

  router.get('/regulatory/statistics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, periodStart, periodEnd } = req.query;

      if (!tenantId || !periodStart || !periodEnd) {
        res.status(400).json({
          error: 'Missing required query parameters: tenantId, periodStart, periodEnd',
        });
        return;
      }

      const regulatoryService = getRegulatoryService();
      const stats = await regulatoryService.getSubmissionStatistics(
        tenantId as string,
        new Date(periodStart as string),
        new Date(periodEnd as string)
      );

      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // ==================== ADMIN ENDPOINTS ====================

  router.get('/admin/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, role, active, brokerId, limit, offset } = req.query;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing required query parameter: tenantId' });
        return;
      }

      const adminService = getAdminService();
      const admins = await adminService.getAdmins(tenantId as string, {
        role: role as 'admin' | 'compliance_officer' | 'analyst' | 'viewer' | undefined,
        active: active !== undefined ? active === 'true' : undefined,
        brokerId: brokerId as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json(admins);
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      const adminService = getAdminService();
      const admin = await adminService.getAdmin(id);

      if (!admin) {
        res.status(404).json({ error: 'Admin user not found' });
        return;
      }

      res.json(admin);
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, role, permissions, tenantId, brokerId } = req.body;

      if (!email || !name || !role || !permissions || !tenantId) {
        res.status(400).json({
          error: 'Missing required fields: email, name, role, permissions, tenantId',
        });
        return;
      }

      const adminService = getAdminService();
      const admin = await adminService.createAdmin({
        email,
        name,
        role,
        permissions,
        tenantId,
        brokerId,
      });

      res.status(201).json(admin);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/admin/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];
      const { name, role, permissions, active } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      const adminService = getAdminService();
      const admin = await adminService.updateAdmin(id, {
        name,
        role,
        permissions,
        active,
      });

      if (!admin) {
        res.status(404).json({ error: 'Admin user not found' });
        return;
      }

      res.json(admin);
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/users/:id/deactivate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      const adminService = getAdminService();
      const admin = await adminService.deactivateAdmin(id);

      if (!admin) {
        res.status(404).json({ error: 'Admin user not found' });
        return;
      }

      res.json(admin);
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/users/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params['id'];

      if (!id) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      const adminService = getAdminService();
      const admin = await adminService.activateAdmin(id);

      if (!admin) {
        res.status(404).json({ error: 'Admin user not found' });
        return;
      }

      res.json(admin);
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/action-logs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, adminId, action, entityType, startDate, endDate, limit, offset } = req.query;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing required query parameter: tenantId' });
        return;
      }

      const adminService = getAdminService();
      const logs = await adminService.getActionLogs(tenantId as string, {
        adminId: adminId as string | undefined,
        action: action as string | undefined,
        entityType: entityType as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/statistics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.query;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing required query parameter: tenantId' });
        return;
      }

      const adminService = getAdminService();
      const stats = await adminService.getAdminStatistics(tenantId as string);

      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Mount router
  app.use('/api/v1/compliance/coordinator', router);
}

/**
 * Initialize services
 */
async function initializeServices(): Promise<void> {
  appLogger.info('Initializing services...');

  // Initialize database
  const db = getDatabaseService();
  await db.connect();
  appLogger.info('Database connected');

  // Initialize other services (they initialize lazily)
  getAggregationService();
  getReportingService();
  getAlertsService();
  getRegulatoryService();
  getAdminService();

  // Start event consumer
  try {
    const eventConsumer = getEventConsumer();
    await eventConsumer.start();
    appLogger.info('Event consumer started');
  } catch (error) {
    appLogger.warn('Failed to start event consumer - continuing without Kafka', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  appLogger.info('All services initialized');
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string): Promise<void> {
  appLogger.info(`Received ${signal}, starting graceful shutdown...`);
  state.isShuttingDown = true;

  // Give time for health checks to fail
  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    // Stop event consumer
    try {
      const eventConsumer = getEventConsumer();
      await eventConsumer.stop();
      appLogger.info('Event consumer stopped');
    } catch (error) {
      appLogger.warn('Error stopping event consumer', { error });
    }

    // Disconnect database
    const db = getDatabaseService();
    await db.disconnect();
    appLogger.info('Database disconnected');

    appLogger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    appLogger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Validate configuration
    const config = getConfig();
    const errors = validateConfig(config);
    if (errors.length > 0) {
      appLogger.error('Configuration validation failed', { errors });
      process.exit(1);
    }

    appLogger.info('Starting Compliance Coordinator', {
      environment: config.environment,
      version: process.env['npm_package_version'] || 'unknown',
    });

    // Initialize services
    await initializeServices();

    // Create and start Express app
    const app = createApp();
    const server = app.listen(config.server.port, config.server.host, () => {
      state.isReady = true;
      appLogger.info(`Server listening on ${config.server.host}:${config.server.port}`);
    });

    // Configure server timeouts
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Setup signal handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      appLogger.error('Uncaught exception', { error: error.message, stack: error.stack });
      shutdown('uncaughtException');
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      appLogger.error('Unhandled rejection', { reason, promise });
    });

  } catch (error) {
    appLogger.error('Failed to start service', { error });
    process.exit(1);
  }
}

// Start the service
main();
