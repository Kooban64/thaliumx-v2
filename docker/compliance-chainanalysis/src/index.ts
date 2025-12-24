/**
 * ChainAnalysis Service
 * Main entry point for the ChainAnalysis service
 *
 * This service provides advanced blockchain forensic analysis:
 * - Entity clustering and wallet analysis
 * - Transaction flow tracing and pattern detection
 * - Risk scoring and compliance monitoring
 * - Multi-chain blockchain analytics
 *
 * Integrates with:
 * - Self-hosted GraphSense analytics platform
 * - Multiple blockchain RPC endpoints (Infura → Self-hosted)
 * - Compliance Coordinator for unified risk assessment
 * - Kafka for event streaming and real-time analysis
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
  getGraphSenseService,
  getRpcService,
  getEntityService,
  getRiskService,
  getEventConsumer,
  getMetricsService,
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
      });
    });

    next();
  });

  // Health check endpoints
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'compliance-chainanalysis',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    if (!state.isReady) {
      res.status(503).json({
        status: 'not_ready',
        service: 'compliance-chainanalysis',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const db = getDatabaseService();
      await db.query('SELECT 1');

      res.json({
        status: 'ready',
        service: 'compliance-chainanalysis',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        service: 'compliance-chainanalysis',
        error: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/health/live', (_req: Request, res: Response) => {
    if (state.isShuttingDown) {
      res.status(503).json({
        status: 'shutting_down',
        service: 'compliance-chainanalysis',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      status: 'alive',
      service: 'compliance-chainanalysis',
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

  // ==================== ENTITY ANALYSIS ENDPOINTS ====================

  router.get('/entities/cluster/:address', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;
      const { chain = 'ethereum' } = req.query;

      if (!address) {
        res.status(400).json({ error: 'Missing required parameter: address' });
        return;
      }

      const entityService = getEntityService();
      const cluster = await entityService.getEntityCluster(address as string, chain as string);

      res.json(cluster);
    } catch (error) {
      next(error);
    }
  });

  router.get('/entities/:entityId/transactions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entityId } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      if (!entityId) {
        res.status(400).json({ error: 'Missing required parameter: entityId' });
        return;
      }

      const entityService = getEntityService();
      const transactions = await entityService.getEntityTransactions(
        entityId,
        { limit: parseInt(limit as string, 10), offset: parseInt(offset as string, 10) }
      );

      res.json(transactions);
    } catch (error) {
      next(error);
    }
  });

  // ==================== RISK ANALYSIS ENDPOINTS ====================

  router.post('/risk/score-address', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address, chain = 'ethereum', context } = req.body;

      if (!address) {
        res.status(400).json({ error: 'Missing required field: address' });
        return;
      }

      const riskService = getRiskService();
      const riskScore = await riskService.scoreAddress(address, chain, context);

      res.json(riskScore);
    } catch (error) {
      next(error);
    }
  });

  router.post('/risk/score-transaction', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { txHash, chain = 'ethereum', context } = req.body;

      if (!txHash) {
        res.status(400).json({ error: 'Missing required field: txHash' });
        return;
      }

      const riskService = getRiskService();
      const riskScore = await riskService.scoreTransaction(txHash, chain, context);

      res.json(riskScore);
    } catch (error) {
      next(error);
    }
  });

  router.get('/risk/alerts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { severity, status, limit = 50, offset = 0 } = req.query;

      const riskService = getRiskService();
      const alerts = await riskService.getAlerts({
        severity: severity as 'low' | 'medium' | 'high' | 'critical',
        status: status as 'active' | 'resolved' | 'dismissed',
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });

      res.json(alerts);
    } catch (error) {
      next(error);
    }
  });

  // ==================== BLOCKCHAIN DATA ENDPOINTS ====================

  router.get('/blockchain/:chain/transactions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { chain } = req.params;
      const { address, limit = 100, offset = 0 } = req.query;

      if (!chain) {
        res.status(400).json({ error: 'Missing required parameter: chain' });
        return;
      }

      const rpcService = getRpcService();
      const transactions = await rpcService.getAddressTransactions(
        chain,
        address as string,
        { limit: parseInt(limit as string, 10), offset: parseInt(offset as string, 10) }
      );

      res.json(transactions);
    } catch (error) {
      next(error);
    }
  });

  router.get('/blockchain/:chain/blocks/:height', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { chain, height } = req.params;

      if (!chain || !height) {
        res.status(400).json({ error: 'Missing required parameters: chain, height' });
        return;
      }

      const rpcService = getRpcService();
      const block = await rpcService.getBlock(chain, parseInt(height, 10));

      res.json(block);
    } catch (error) {
      next(error);
    }
  });

  // ==================== ANALYTICS ENDPOINTS ====================

  router.post('/analytics/transaction-trace', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { txHash, chain = 'ethereum', depth = 3 } = req.body;

      if (!txHash) {
        res.status(400).json({ error: 'Missing required field: txHash' });
        return;
      }

      const graphSenseService = getGraphSenseService();
      const trace = await graphSenseService.traceTransaction(txHash, chain, depth);

      res.json(trace);
    } catch (error) {
      next(error);
    }
  });

  router.get('/analytics/patterns', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { chain = 'ethereum', patternType, timeRange } = req.query;

      const graphSenseService = getGraphSenseService();
      const patterns = await graphSenseService.detectPatterns(chain as string, {
        type: patternType as string,
        timeRange: timeRange as string,
      });

      res.json(patterns);
    } catch (error) {
      next(error);
    }
  });

  // ==================== METRICS ENDPOINTS ====================

  router.get('/metrics', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const metricsService = getMetricsService();
      const metrics = await metricsService.getMetrics();

      res.json(metrics);
    } catch (error) {
      next(error);
    }
  });

  // Mount router
  app.use('/api/v1/chainanalysis', router);
}

/**
 * Initialize services
 */
async function initializeServices(): Promise<void> {
  appLogger.info('Initializing ChainAnalysis services...');

  // Initialize database
  const db = getDatabaseService();
  await db.connect();
  appLogger.info('Database connected');

  // Initialize other services (they initialize lazily)
  getGraphSenseService();
  getRpcService();
  getEntityService();
  getRiskService();
  getMetricsService();

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

  appLogger.info('All ChainAnalysis services initialized');
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

    appLogger.info('Starting ChainAnalysis Service', {
      environment: config.environment,
      version: process.env['npm_package_version'] || '1.0.0',
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