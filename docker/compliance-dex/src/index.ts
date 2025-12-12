/**
 * DEX Compliance Service
 * Main entry point for the decentralized exchange compliance service
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config, validateConfig } from './config';
import { logger, requestLogging } from './utils/logger';
import {
  databaseService,
  eventProducer,
  eventConsumer,
  walletScreeningService,
  dexRiskAssessmentService,
  dexTravelRuleService,
  dexCARFService,
  DEX_COMPLIANCE_TOPICS,
} from './services';
import { ServiceHealth } from './types/compliance';

// ==================== APPLICATION SETUP ====================

const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogging());

// ==================== HEALTH CHECK ENDPOINTS ====================

/**
 * Basic health check
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: config.serviceName, version: config.version });
});

/**
 * Detailed health check
 */
app.get('/health/detailed', async (_req: Request, res: Response) => {
  try {
    const dbHealth = await databaseService.healthCheck();
    const memoryUsage = process.memoryUsage();

    const health: ServiceHealth = {
      status: dbHealth.status === 'connected' ? 'healthy' : 'degraded',
      timestamp: new Date(),
      version: config.version,
      uptime: process.uptime(),
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
      database: dbHealth,
      redis: {
        status: 'connected', // Would check actual Redis connection
        latency: 0,
      },
      kafka: {
        status: eventProducer.getStatus() ? 'connected' : 'disconnected',
        topics: Object.values(DEX_COMPLIANCE_TOPICS),
      },
      blockchain: {
        status: 'connected',
        chains: config.blockchain.providers.map((p) => ({
          chainId: p.chainId,
          name: p.name,
          blockNumber: 0, // Would fetch actual block number
          latency: 0,
        })),
      },
      compliance: {
        pendingScreenings: 0, // Would query actual counts
        pendingAssessments: 0,
        highRiskAlerts: 0,
      },
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ==================== API ROUTES ====================

/**
 * Wallet screening endpoint
 */
app.post('/api/v1/wallet/screen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress, chainId, tenantId, userId, brokerId, reason } = req.body;

    if (!walletAddress || !chainId || !tenantId) {
      res.status(400).json({ error: 'Missing required fields: walletAddress, chainId, tenantId' });
      return;
    }

    const options: { userId?: string; brokerId?: string; reason?: 'connection' | 'transaction' | 'periodic' | 'manual' } = {};
    if (userId) options.userId = userId;
    if (brokerId) options.brokerId = brokerId;
    if (reason) options.reason = reason;

    const result = await walletScreeningService.screenWallet(
      walletAddress,
      chainId,
      tenantId,
      options
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Get wallet screening history
 */
app.get('/api/v1/wallet/:address/screenings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = req.params['address'];
    if (!address) {
      res.status(400).json({ error: 'Missing address parameter' });
      return;
    }
    const chainIdParam = req.query['chainId'];
    const limitParam = req.query['limit'];
    const chainId = chainIdParam ? parseInt(chainIdParam as string) : 1;
    const limit = limitParam ? parseInt(limitParam as string) : 10;

    const results = await walletScreeningService.getScreeningHistory(address, chainId, limit);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * Get risk assessment
 */
app.get('/api/v1/assessment/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'];
    if (!id) {
      res.status(400).json({ error: 'Missing id parameter' });
      return;
    }
    const result = await dexRiskAssessmentService.getAssessment(id);

    if (!result) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Get wallet assessments
 */
app.get('/api/v1/wallet/:address/assessments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = req.params['address'];
    if (!address) {
      res.status(400).json({ error: 'Missing address parameter' });
      return;
    }
    const limitParam = req.query['limit'];
    const limit = limitParam ? parseInt(limitParam as string) : 10;

    const results = await dexRiskAssessmentService.getWalletAssessments(address, limit);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * Get Travel Rule message
 */
app.get('/api/v1/travel-rule/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'];
    if (!id) {
      res.status(400).json({ error: 'Missing id parameter' });
      return;
    }
    const result = await dexTravelRuleService.getTravelRuleMessage(id);

    if (!result) {
      res.status(404).json({ error: 'Travel Rule message not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Generate CARF report
 */
app.post('/api/v1/carf/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress, tenantId, userId, brokerId, startDate, endDate, fiscalYear } = req.body;

    if (!walletAddress || !tenantId) {
      res.status(400).json({ error: 'Missing required fields: walletAddress, tenantId' });
      return;
    }

    const options: { userId?: string; brokerId?: string; startDate?: Date; endDate?: Date; fiscalYear?: string } = {};
    if (userId) options.userId = userId;
    if (brokerId) options.brokerId = brokerId;
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (fiscalYear) options.fiscalYear = fiscalYear;

    const result = await dexCARFService.generateReport(walletAddress, tenantId, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Get CARF report
 */
app.get('/api/v1/carf/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'];
    if (!id) {
      res.status(400).json({ error: 'Missing id parameter' });
      return;
    }
    const result = await dexCARFService.getReport(id);

    if (!result) {
      res.status(404).json({ error: 'CARF report not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Get wallet CARF reports
 */
app.get('/api/v1/wallet/:address/carf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = req.params['address'];
    if (!address) {
      res.status(400).json({ error: 'Missing address parameter' });
      return;
    }
    const limitParam = req.query['limit'];
    const limit = limitParam ? parseInt(limitParam as string) : 10;

    const results = await dexCARFService.getWalletReports(address, limit);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * Submit CARF report
 */
app.post('/api/v1/carf/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'];
    if (!id) {
      res.status(400).json({ error: 'Missing id parameter' });
      return;
    }
    const { jurisdiction } = req.body;

    if (!jurisdiction) {
      res.status(400).json({ error: 'Missing required field: jurisdiction' });
      return;
    }

    await dexCARFService.submitReport(id, jurisdiction);
    res.json({ success: true, message: 'Report submitted successfully' });
  } catch (error) {
    next(error);
  }
});

// ==================== ERROR HANDLING ====================

/**
 * Error handler middleware
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: config.environment === 'development' ? err.message : undefined,
  });
});

/**
 * 404 handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ==================== SERVICE INITIALIZATION ====================

/**
 * Initialize all services
 */
async function initializeServices(): Promise<void> {
  logger.info('Initializing DEX Compliance Service...');

  // Validate configuration
  validateConfig();

  // Initialize database
  await databaseService.initialize();
  logger.info('Database initialized');

  // Initialize event producer
  await eventProducer.initialize();
  logger.info('Event producer initialized');

  // Initialize event consumer
  await eventConsumer.initialize();
  await eventConsumer.subscribeToAllTopics();
  logger.info('Event consumer initialized');

  // Initialize wallet screening service
  await walletScreeningService.initialize();
  logger.info('Wallet screening service initialized');

  // Initialize risk assessment service
  await dexRiskAssessmentService.initialize();
  logger.info('Risk assessment service initialized');

  // Initialize travel rule service
  await dexTravelRuleService.initialize();
  logger.info('Travel rule service initialized');

  // Initialize CARF service
  await dexCARFService.initialize();
  logger.info('CARF service initialized');

  // Start event consumer
  await eventConsumer.start();
  logger.info('Event consumer started');

  logger.info('All services initialized successfully');
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  logger.info('Shutting down DEX Compliance Service...');

  try {
    await eventConsumer.close();
    await eventProducer.close();
    await walletScreeningService.close();
    await dexRiskAssessmentService.close();
    await dexTravelRuleService.close();
    await dexCARFService.close();
    await databaseService.close();

    logger.info('All services shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// ==================== MAIN ====================

/**
 * Start the server
 */
async function main(): Promise<void> {
  try {
    // Initialize services
    await initializeServices();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`DEX Compliance Service started`, {
        port: config.port,
        environment: config.environment,
        version: config.version,
      });
    });

    // Handle graceful shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      shutdown();
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      shutdown();
    });

    // Keep reference to server for testing
    return server as unknown as Promise<void>;
  } catch (error) {
    logger.error('Failed to start DEX Compliance Service', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Start the application
main();

export { app };
