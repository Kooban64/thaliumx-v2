/**
 * Token Compliance Service
 * Main entry point for the Token Compliance Service
 * 
 * This service provides compliance functionality for token operations including:
 * - Wallet screening for sanctions and risk indicators
 * - Risk assessment for token transfers
 * - Travel Rule compliance for high-value transfers
 * - CARF reporting for tax compliance
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
  getEventProducer,
  getEventConsumer,
  getWalletScreeningService,
  getTokenRiskAssessmentService,
  getTokenTravelRuleService,
  getTokenCARFService,
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
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  }));

  // CORS
  app.use(cors({
    origin: config.server.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Tenant-ID'],
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
        userAgent: req.headers['user-agent'],
      });
    });

    next();
  });

  // Health check endpoints
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'token-compliance-service',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    if (!state.isReady) {
      res.status(503).json({
        status: 'not_ready',
        service: 'token-compliance-service',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const db = getDatabaseService();
      await db.query('SELECT 1');

      res.json({
        status: 'ready',
        service: 'token-compliance-service',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        service: 'token-compliance-service',
        error: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/health/live', (_req: Request, res: Response) => {
    if (state.isShuttingDown) {
      res.status(503).json({
        status: 'shutting_down',
        service: 'token-compliance-service',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      status: 'alive',
      service: 'token-compliance-service',
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

  // Wallet Screening endpoints
  router.post('/screening/wallet', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { walletAddress, chainId, tenantId, userId } = req.body;

      if (!walletAddress || !chainId || !tenantId) {
        res.status(400).json({
          error: 'Missing required fields: walletAddress, chainId, tenantId',
        });
        return;
      }

      const screeningService = getWalletScreeningService();
      const result = await screeningService.screenWallet(
        walletAddress,
        chainId,
        tenantId,
        userId
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/screening/wallet/:address', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;
      const { chainId, tenantId } = req.query;

      if (!address || !chainId || !tenantId) {
        res.status(400).json({
          error: 'Missing required parameters: address, chainId, tenantId',
        });
        return;
      }

      const screeningService = getWalletScreeningService();
      const result = await screeningService.getScreeningResult(
        address,
        parseInt(chainId as string, 10),
        tenantId as string
      );

      if (!result) {
        res.status(404).json({
          error: 'Screening result not found',
        });
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Risk Assessment endpoints
  router.post('/risk/assess/transfer', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        id,
        transactionHash,
        contractAddress,
        tokenSymbol,
        chainId,
        fromAddress,
        toAddress,
        amount,
        amountUSD,
        userId,
        tenantId,
        brokerId,
      } = req.body;

      if (!id || !tenantId || !contractAddress || !fromAddress || !toAddress) {
        res.status(400).json({
          error: 'Missing required fields: id, tenantId, contractAddress, fromAddress, toAddress',
        });
        return;
      }

      const riskService = getTokenRiskAssessmentService();
      const result = await riskService.assessTransfer({
        transferId: id,
        transactionHash: transactionHash || '',
        contractAddress,
        tokenSymbol: tokenSymbol || 'UNKNOWN',
        chainId: chainId || 1,
        fromAddress,
        toAddress,
        amount: amount || '0',
        amountUSD: amountUSD || '0',
        userId,
        tenantId,
        brokerId,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/risk/assess/approval', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        id,
        transactionHash,
        contractAddress,
        chainId,
        ownerAddress,
        spenderAddress,
        amount,
        isUnlimited,
        tenantId,
        userId,
      } = req.body;

      if (!id || !tenantId || !contractAddress || !ownerAddress || !spenderAddress) {
        res.status(400).json({
          error: 'Missing required fields: id, tenantId, contractAddress, ownerAddress, spenderAddress',
        });
        return;
      }

      const riskService = getTokenRiskAssessmentService();
      const result = await riskService.assessApproval({
        id,
        transactionHash: transactionHash || '',
        contractAddress,
        chainId: chainId || 1,
        ownerAddress,
        spenderAddress,
        amount: amount || '0',
        isUnlimited: isUnlimited || false,
        tenantId,
        userId,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/risk/assess/presale', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        id,
        contractAddress,
        chainId,
        presaleAddress,
        tenantId,
        userId,
        totalRaised,
        participantCount,
      } = req.body;

      if (!id || !tenantId || !contractAddress || !presaleAddress) {
        res.status(400).json({
          error: 'Missing required fields: id, tenantId, contractAddress, presaleAddress',
        });
        return;
      }

      const riskService = getTokenRiskAssessmentService();
      const result = await riskService.assessPresale({
        id,
        contractAddress,
        chainId: chainId || 1,
        presaleAddress,
        tenantId,
        userId,
        totalRaised: totalRaised || '0',
        participantCount: participantCount || 0,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/risk/assessment/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Missing assessment ID',
        });
        return;
      }

      const riskService = getTokenRiskAssessmentService();
      const result = await riskService.getAssessment(id);

      if (!result) {
        res.status(404).json({
          error: 'Risk assessment not found',
        });
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/risk/wallet/:address', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;
      const { tenantId, limit } = req.query;

      if (!address || !tenantId) {
        res.status(400).json({
          error: 'Missing required parameters: address, tenantId',
        });
        return;
      }

      const riskService = getTokenRiskAssessmentService();
      const results = await riskService.getWalletAssessments(
        address,
        tenantId as string,
        limit ? parseInt(limit as string, 10) : undefined
      );

      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  // Travel Rule endpoints
  router.post('/travel-rule/process', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        id,
        transactionHash,
        contractAddress,
        tokenSymbol,
        chainId,
        fromAddress,
        toAddress,
        amount,
        amountUSD,
        timestamp,
        tenantId,
        brokerId,
        userId,
      } = req.body;

      if (!id || !tenantId || !contractAddress || !fromAddress || !toAddress) {
        res.status(400).json({
          error: 'Missing required fields: id, tenantId, contractAddress, fromAddress, toAddress',
        });
        return;
      }

      const travelRuleService = getTokenTravelRuleService();
      const result = await travelRuleService.processTransfer({
        id,
        transactionHash: transactionHash || '',
        contractAddress,
        tokenSymbol: tokenSymbol || 'UNKNOWN',
        chainId: chainId || 1,
        fromAddress,
        toAddress,
        amount: amount || '0',
        amountUSD: amountUSD || '0',
        timestamp: timestamp ? new Date(timestamp) : undefined,
        tenantId,
        brokerId,
        userId,
      });

      res.json(result || { message: 'Travel Rule not required for this transfer' });
    } catch (error) {
      next(error);
    }
  });

  router.get('/travel-rule/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Missing travel rule ID',
        });
        return;
      }

      const travelRuleService = getTokenTravelRuleService();
      const result = await travelRuleService.getTravelRuleData(id);

      if (!result) {
        res.status(404).json({
          error: 'Travel rule data not found',
        });
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/travel-rule/wallet/:address', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;
      const { tenantId, limit } = req.query;

      if (!address || !tenantId) {
        res.status(400).json({
          error: 'Missing required parameters: address, tenantId',
        });
        return;
      }

      const travelRuleService = getTokenTravelRuleService();
      const results = await travelRuleService.getWalletTravelRuleData(
        address,
        tenantId as string,
        limit ? parseInt(limit as string, 10) : undefined
      );

      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  router.post('/travel-rule/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Missing travel rule ID',
        });
        return;
      }

      const travelRuleService = getTokenTravelRuleService();
      const result = await travelRuleService.retryFailedMessage(id);

      if (!result) {
        res.status(404).json({
          error: 'Travel rule data not found or not in failed state',
        });
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // CARF endpoints
  router.post('/carf/report', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        walletAddress,
        userId,
        tenantId,
        brokerId,
        reportingPeriodStart,
        reportingPeriodEnd,
        fiscalYear,
      } = req.body;

      if (!walletAddress || !tenantId || !reportingPeriodStart || !reportingPeriodEnd) {
        res.status(400).json({
          error: 'Missing required fields: walletAddress, tenantId, reportingPeriodStart, reportingPeriodEnd',
        });
        return;
      }

      const carfService = getTokenCARFService();
      const result = await carfService.generateReport({
        walletAddress,
        userId,
        tenantId,
        brokerId,
        reportingPeriodStart: new Date(reportingPeriodStart),
        reportingPeriodEnd: new Date(reportingPeriodEnd),
        fiscalYear,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/carf/report/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Missing report ID',
        });
        return;
      }

      const carfService = getTokenCARFService();
      const result = await carfService.getReport(id);

      if (!result) {
        res.status(404).json({
          error: 'CARF report not found',
        });
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/carf/wallet/:address', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;
      const { tenantId } = req.query;

      if (!address || !tenantId) {
        res.status(400).json({
          error: 'Missing required parameters: address, tenantId',
        });
        return;
      }

      const carfService = getTokenCARFService();
      const results = await carfService.getWalletReports(address, tenantId as string);

      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  router.post('/carf/report/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { submittedTo } = req.body;

      if (!id || !submittedTo) {
        res.status(400).json({
          error: 'Missing required parameters: id, submittedTo',
        });
        return;
      }

      const carfService = getTokenCARFService();
      const result = await carfService.submitReport(id, submittedTo);

      if (!result) {
        res.status(404).json({
          error: 'CARF report not found',
        });
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Mount router
  app.use('/api/v1/compliance/token', router);
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

  // Initialize event producer
  const producer = getEventProducer();
  await producer.connect();
  appLogger.info('Event producer connected');

  // Initialize event consumer
  const consumer = getEventConsumer();
  await consumer.connect();
  appLogger.info('Event consumer connected');

  // Subscribe to events
  await consumer.subscribe(['token-compliance-events']);
  appLogger.info('Event consumer subscribed');

  // Initialize other services (they initialize lazily)
  getWalletScreeningService();
  getTokenRiskAssessmentService();
  getTokenTravelRuleService();
  getTokenCARFService();

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
    // Disconnect event consumer
    const consumer = getEventConsumer();
    await consumer.disconnect();
    appLogger.info('Event consumer disconnected');

    // Disconnect event producer
    const producer = getEventProducer();
    await producer.disconnect();
    appLogger.info('Event producer disconnected');

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

    appLogger.info('Starting Token Compliance Service', {
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
