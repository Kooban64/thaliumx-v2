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
import { z } from 'zod';

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

const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
const sourceServiceSchema = z.enum(['cex', 'dex', 'nft', 'token']);
const alertStatusSchema = z.enum(['new', 'acknowledged', 'investigating', 'resolved', 'dismissed']);
const alertSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
const alertTypeSchema = z.enum([
  'high_risk',
  'sanctions_match',
  'travel_rule_failure',
  'threshold_breach',
  'pattern_detected',
  'system_error',
]);
const submissionTypeSchema = z.enum(['carf', 'sar', 'ctr', 'str', 'custom']);
const submissionStatusSchema = z.enum(['draft', 'pending', 'submitted', 'acknowledged', 'rejected', 'accepted']);
const adminRoleSchema = z.enum(['admin', 'compliance_officer', 'analyst', 'viewer']);
const platformReportTypeSchema = z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom']);
const reportFormatSchema = z.enum(['json', 'pdf', 'csv']).optional();
const requiredStringSchema = z.string().min(1);
const optionalStringSchema = z.string().min(1).optional();
const booleanStringSchema = z.enum(['true', 'false']).transform((value) => value === 'true');
const integerStringSchema = z.string().regex(/^\d+$/).transform((value) => Number.parseInt(value, 10));
const dateStringSchema = z.string().datetime({ offset: true }).or(z.string().datetime({ local: true }));

type InputSchema<TOutput, TInput = TOutput> = z.ZodType<TOutput, z.ZodTypeDef, TInput>;

function withDefinedProperties<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function buildRiskAssessmentOptions(query: z.infer<typeof riskAssessmentsQuerySchema>): {
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  reviewRequired?: boolean;
  sourceService?: 'cex' | 'dex' | 'nft' | 'token';
  limit?: number;
  offset?: number;
} {
  const options: {
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    reviewRequired?: boolean;
    sourceService?: 'cex' | 'dex' | 'nft' | 'token';
    limit?: number;
    offset?: number;
  } = {};

  if (query.riskLevel !== undefined) {
    options.riskLevel = query.riskLevel;
  }
  if (query.reviewRequired !== undefined) {
    options.reviewRequired = query.reviewRequired;
  }
  if (query.sourceService !== undefined) {
    options.sourceService = query.sourceService;
  }
  if (query.limit !== undefined) {
    options.limit = query.limit;
  }
  if (query.offset !== undefined) {
    options.offset = query.offset;
  }

  return options;
}

function buildTravelRuleOptions(query: z.infer<typeof travelRulesQuerySchema>): {
  status?: string;
  sourceService?: 'cex' | 'dex' | 'nft' | 'token';
  limit?: number;
  offset?: number;
} {
  const options: {
    status?: string;
    sourceService?: 'cex' | 'dex' | 'nft' | 'token';
    limit?: number;
    offset?: number;
  } = {};

  if (query.status !== undefined) {
    options.status = query.status;
  }
  if (query.sourceService !== undefined) {
    options.sourceService = query.sourceService;
  }
  if (query.limit !== undefined) {
    options.limit = query.limit;
  }
  if (query.offset !== undefined) {
    options.offset = query.offset;
  }

  return options;
}

function sendValidationError(res: Response, error: z.ZodError): void {
  const issue = error.issues[0];
  res.status(400).json({
    error: issue?.message ?? 'Invalid request',
  });
}

function parseRequestPart<TOutput, TInput = TOutput>(
  res: Response,
  schema: InputSchema<TOutput, TInput>,
  input: unknown,
): TOutput | null {
  const result = schema.safeParse(input);
  if (!result.success) {
    sendValidationError(res, result.error);
    return null;
  }

  return result.data;
}

function requiredPathIdSchema(fieldName: string): z.ZodObject<{ id: z.ZodString }> {
  return z.object({
    id: z.string().min(1, `Missing required parameter: ${fieldName}`),
  });
}

const riskAssessmentsQuerySchema = z.object({
  tenantId: requiredStringSchema,
  riskLevel: riskLevelSchema.optional(),
  reviewRequired: booleanStringSchema.optional(),
  sourceService: sourceServiceSchema.optional(),
  limit: integerStringSchema.optional(),
  offset: integerStringSchema.optional(),
});

const travelRulesQuerySchema = z.object({
  tenantId: requiredStringSchema,
  status: optionalStringSchema,
  sourceService: sourceServiceSchema.optional(),
  limit: integerStringSchema.optional(),
  offset: integerStringSchema.optional(),
});

const periodQuerySchema = z.object({
  tenantId: requiredStringSchema,
  periodStart: dateStringSchema,
  periodEnd: dateStringSchema,
});

const platformReportBodySchema = z.object({
  reportType: platformReportTypeSchema,
  tenantId: requiredStringSchema,
  brokerId: optionalStringSchema,
  periodStart: dateStringSchema,
  periodEnd: dateStringSchema,
  format: reportFormatSchema,
  generatedBy: optionalStringSchema,
});

const userReportBodySchema = z.object({
  userId: requiredStringSchema,
  tenantId: requiredStringSchema,
  brokerId: optionalStringSchema,
  periodStart: dateStringSchema,
  periodEnd: dateStringSchema,
  format: reportFormatSchema,
});

const alertsQuerySchema = z.object({
  tenantId: requiredStringSchema,
  status: alertStatusSchema.optional(),
  severity: alertSeveritySchema.optional(),
  alertType: alertTypeSchema.optional(),
  sourceService: sourceServiceSchema.optional(),
  assignedTo: optionalStringSchema,
  limit: integerStringSchema.optional(),
  offset: integerStringSchema.optional(),
});

const acknowledgeAlertBodySchema = z.object({
  acknowledgedBy: requiredStringSchema,
});

const investigateAlertBodySchema = z.object({
  assignedTo: requiredStringSchema,
});

const resolveAlertBodySchema = z.object({
  resolvedBy: requiredStringSchema,
  resolution: requiredStringSchema,
});

const dismissAlertBodySchema = z.object({
  dismissedBy: requiredStringSchema,
  reason: requiredStringSchema,
});

const submissionsQuerySchema = z.object({
  tenantId: requiredStringSchema,
  submissionType: submissionTypeSchema.optional(),
  jurisdiction: optionalStringSchema,
  status: submissionStatusSchema.optional(),
  limit: integerStringSchema.optional(),
  offset: integerStringSchema.optional(),
});

const reportingPeriodSchema = z.object({
  startDate: dateStringSchema,
  endDate: dateStringSchema,
});

const createSubmissionBodySchema = z.object({
  submissionType: submissionTypeSchema,
  jurisdiction: requiredStringSchema,
  authority: requiredStringSchema,
  tenantId: requiredStringSchema,
  brokerId: optionalStringSchema,
  reportingPeriod: reportingPeriodSchema.optional(),
  data: z.record(z.unknown()),
  submittedBy: optionalStringSchema,
});

const acknowledgeSubmissionBodySchema = z.object({
  responseCode: requiredStringSchema,
  responseMessage: requiredStringSchema,
});

const adminUsersQuerySchema = z.object({
  tenantId: requiredStringSchema,
  role: adminRoleSchema.optional(),
  active: booleanStringSchema.optional(),
  brokerId: optionalStringSchema,
  limit: integerStringSchema.optional(),
  offset: integerStringSchema.optional(),
});

const createAdminBodySchema = z.object({
  email: requiredStringSchema,
  name: requiredStringSchema,
  role: adminRoleSchema,
  permissions: z.array(z.string().min(1)).min(1),
  tenantId: requiredStringSchema,
  brokerId: optionalStringSchema,
});

const updateAdminBodySchema = z.object({
  name: optionalStringSchema,
  role: adminRoleSchema.optional(),
  permissions: z.array(z.string().min(1)).min(1).optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: 'At least one field must be provided',
});

const actionLogsQuerySchema = z.object({
  tenantId: requiredStringSchema,
  adminId: optionalStringSchema,
  action: optionalStringSchema,
  entityType: optionalStringSchema,
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  limit: integerStringSchema.optional(),
  offset: integerStringSchema.optional(),
});

const tenantQuerySchema = z.object({
  tenantId: requiredStringSchema,
});

function buildActionLogsOptions(query: z.infer<typeof actionLogsQuerySchema>): {
  adminId?: string;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
} {
  const options: {
    adminId?: string;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {};

  if (query.adminId !== undefined) {
    options.adminId = query.adminId;
  }
  if (query.action !== undefined) {
    options.action = query.action;
  }
  if (query.entityType !== undefined) {
    options.entityType = query.entityType;
  }
  if (query.startDate !== undefined) {
    options.startDate = new Date(query.startDate);
  }
  if (query.endDate !== undefined) {
    options.endDate = new Date(query.endDate);
  }
  if (query.limit !== undefined) {
    options.limit = query.limit;
  }
  if (query.offset !== undefined) {
    options.offset = query.offset;
  }

  return options;
}

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
      const query = parseRequestPart(res, riskAssessmentsQuerySchema, req.query);
      if (!query) {
        return;
      }

      const aggregationService = getAggregationService();

      const results = await aggregationService.getRiskAssessments(
        query.tenantId,
        buildRiskAssessmentOptions(query),
      );
      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  router.get('/travel-rules', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseRequestPart(res, travelRulesQuerySchema, req.query);
      if (!query) {
        return;
      }

      const aggregationService = getAggregationService();

      const results = await aggregationService.getTravelRules(
        query.tenantId,
        buildTravelRuleOptions(query),
      );
      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  router.get('/statistics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseRequestPart(res, periodQuerySchema, req.query);
      if (!query) {
        return;
      }

      const aggregationService = getAggregationService();
      const stats = await aggregationService.getPlatformStatistics(
        query.tenantId,
        new Date(query.periodStart),
        new Date(query.periodEnd)
      );

      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // ==================== REPORTING ENDPOINTS ====================

  router.post('/reports/platform', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = parseRequestPart(res, platformReportBodySchema, req.body);
      if (!body) {
        return;
      }

      const reportingService = getReportingService();
      const report = await reportingService.generatePlatformReport(
        body.reportType,
        {
          tenantId: body.tenantId,
          brokerId: body.brokerId,
          periodStart: new Date(body.periodStart),
          periodEnd: new Date(body.periodEnd),
          format: body.format,
          generatedBy: body.generatedBy,
        }
      );

      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  router.get('/reports/platform/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const reportingService = getReportingService();
      const report = await reportingService.getPlatformReport(params.id);

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
      const body = parseRequestPart(res, userReportBodySchema, req.body);
      if (!body) {
        return;
      }

      const reportingService = getReportingService();
      const report = await reportingService.generateUserReport({
        userId: body.userId,
        tenantId: body.tenantId,
        brokerId: body.brokerId,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        format: body.format,
      });

      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  router.get('/reports/user/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const reportingService = getReportingService();
      const report = await reportingService.getUserReport(params.id);

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
      const query = parseRequestPart(res, alertsQuerySchema, req.query);
      if (!query) {
        return;
      }

      const alertsService = getAlertsService();
      const { tenantId, ...options } = query;
      const alerts = await alertsService.getAlerts(tenantId, withDefinedProperties(options));

      res.json(alerts);
    } catch (error) {
      next(error);
    }
  });

  router.get('/alerts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const alertsService = getAlertsService();
      const alert = await alertsService.getAlert(params.id);

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
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const body = parseRequestPart(res, acknowledgeAlertBodySchema, req.body);
      if (!body) {
        return;
      }

      const alertsService = getAlertsService();
      const alert = await alertsService.acknowledgeAlert(params.id, body.acknowledgedBy);

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
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const body = parseRequestPart(res, investigateAlertBodySchema, req.body);
      if (!body) {
        return;
      }

      const alertsService = getAlertsService();
      const alert = await alertsService.investigateAlert(params.id, body.assignedTo);

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
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const body = parseRequestPart(res, resolveAlertBodySchema, req.body);
      if (!body) {
        return;
      }

      const alertsService = getAlertsService();
      const alert = await alertsService.resolveAlert(params.id, body.resolvedBy, body.resolution);

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
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const body = parseRequestPart(res, dismissAlertBodySchema, req.body);
      if (!body) {
        return;
      }

      const alertsService = getAlertsService();
      const alert = await alertsService.dismissAlert(params.id, body.dismissedBy, body.reason);

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
      const query = parseRequestPart(res, periodQuerySchema, req.query);
      if (!query) {
        return;
      }

      const alertsService = getAlertsService();
      const stats = await alertsService.getAlertStatistics(
        query.tenantId,
        new Date(query.periodStart),
        new Date(query.periodEnd)
      );

      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // ==================== REGULATORY ENDPOINTS ====================

  router.get('/regulatory/submissions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseRequestPart(res, submissionsQuerySchema, req.query);
      if (!query) {
        return;
      }

      const regulatoryService = getRegulatoryService();
      const { tenantId, ...options } = query;
      const submissions = await regulatoryService.getSubmissions(tenantId, withDefinedProperties(options));

      res.json(submissions);
    } catch (error) {
      next(error);
    }
  });

  router.get('/regulatory/submissions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const regulatoryService = getRegulatoryService();
      const submission = await regulatoryService.getSubmission(params.id);

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
      const body = parseRequestPart(res, createSubmissionBodySchema, req.body);
      if (!body) {
        return;
      }

      const regulatoryService = getRegulatoryService();
      const submission = await regulatoryService.createSubmission({
        submissionType: body.submissionType,
        jurisdiction: body.jurisdiction,
        authority: body.authority,
        tenantId: body.tenantId,
        brokerId: body.brokerId,
        reportingPeriod: body.reportingPeriod ? {
          startDate: new Date(body.reportingPeriod.startDate),
          endDate: new Date(body.reportingPeriod.endDate),
        } : undefined,
        data: body.data,
        submittedBy: body.submittedBy,
      });

      res.status(201).json(submission);
    } catch (error) {
      next(error);
    }
  });

  router.post('/regulatory/submissions/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const regulatoryService = getRegulatoryService();
      const submission = await regulatoryService.submitToAuthority(params.id);

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
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const body = parseRequestPart(res, acknowledgeSubmissionBodySchema, req.body);
      if (!body) {
        return;
      }

      const regulatoryService = getRegulatoryService();
      const submission = await regulatoryService.acknowledgeSubmission(
        params.id,
        body.responseCode,
        body.responseMessage,
      );

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
      const query = parseRequestPart(res, periodQuerySchema, req.query);
      if (!query) {
        return;
      }

      const regulatoryService = getRegulatoryService();
      const stats = await regulatoryService.getSubmissionStatistics(
        query.tenantId,
        new Date(query.periodStart),
        new Date(query.periodEnd)
      );

      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // ==================== ADMIN ENDPOINTS ====================

  router.get('/admin/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseRequestPart(res, adminUsersQuerySchema, req.query);
      if (!query) {
        return;
      }

      const adminService = getAdminService();
      const { tenantId, ...options } = query;
      const admins = await adminService.getAdmins(tenantId, withDefinedProperties(options));

      res.json(admins);
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const adminService = getAdminService();
      const admin = await adminService.getAdmin(params.id);

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
      const body = parseRequestPart(res, createAdminBodySchema, req.body);
      if (!body) {
        return;
      }

      const adminService = getAdminService();
      const admin = await adminService.createAdmin({
        email: body.email,
        name: body.name,
        role: body.role,
        permissions: body.permissions,
        tenantId: body.tenantId,
        brokerId: body.brokerId,
      });

      res.status(201).json(admin);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/admin/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const body = parseRequestPart(res, updateAdminBodySchema, req.body);
      if (!body) {
        return;
      }

      const adminService = getAdminService();
      const admin = await adminService.updateAdmin(params.id, body);

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
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const adminService = getAdminService();
      const admin = await adminService.deactivateAdmin(params.id);

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
      const params = parseRequestPart(res, requiredPathIdSchema('id'), req.params);
      if (!params) {
        return;
      }

      const adminService = getAdminService();
      const admin = await adminService.activateAdmin(params.id);

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
      const query = parseRequestPart(res, actionLogsQuerySchema, req.query);
      if (!query) {
        return;
      }

      const adminService = getAdminService();
      const logs = await adminService.getActionLogs(query.tenantId, buildActionLogsOptions(query));

      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/statistics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseRequestPart(res, tenantQuerySchema, req.query);
      if (!query) {
        return;
      }

      const adminService = getAdminService();
      const stats = await adminService.getAdminStatistics(query.tenantId);

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
