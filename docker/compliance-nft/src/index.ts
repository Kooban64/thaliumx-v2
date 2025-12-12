/**
 * NFT Compliance Service
 * Main entry point for the NFT compliance microservice
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { getConfig, validateConfig } from './config';
import { createComponentLogger } from './utils/logger';
import {
  getDatabaseService,
  getEventProducer,
  getEventConsumer,
  subscribeToNFTEvents,
  getWashTradingService,
  getContentScreeningService,
  getNFTRiskAssessmentService,
  getNFTTravelRuleService,
  getNFTCARFService,
} from './services';
import { ServiceHealth } from './types/compliance';
import { NFT_COMPLIANCE_TOPICS } from './types/events';

const appLogger = createComponentLogger('app');

/**
 * Create Express application
 */
function createApp(): Express {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = uuidv4();

    res.setHeader('X-Request-ID', requestId);

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      appLogger.logHttpRequest(req.method, req.path, res.statusCode, duration, {
        requestId,
        tenantId: req.headers['x-tenant-id'] as string,
      });
    });

    next();
  });

  // Health check endpoint
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      const health = await getServiceHealth();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: (error as Error).message,
      });
    }
  });

  // Readiness check endpoint
  app.get('/ready', async (_req: Request, res: Response) => {
    try {
      const db = getDatabaseService();
      const producer = getEventProducer();

      if (db.isHealthy() && producer.isHealthy()) {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ ready: false });
      }
    } catch {
      res.status(503).json({ ready: false });
    }
  });

  // API routes
  setupRoutes(app);

  // Error handling
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    appLogger.error('Unhandled error', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}

/**
 * Setup API routes
 */
function setupRoutes(app: Express): void {
  const config = getConfig();

  // Wash Trading Detection endpoints
  app.post('/api/v1/wash-trading/analyze', async (req: Request, res: Response) => {
    try {
      const { saleId, contractAddress, tokenId, chainId, sellerAddress, buyerAddress, price, priceUSD, tenantId } = req.body;

      const service = getWashTradingService();
      const result = await service.analyzeSale(
        saleId,
        contractAddress,
        tokenId,
        chainId,
        sellerAddress,
        buyerAddress,
        price,
        priceUSD,
        tenantId
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/v1/wash-trading/token/:contractAddress/:tokenId/:chainId', async (req: Request, res: Response) => {
    try {
      const { contractAddress, tokenId, chainId } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!contractAddress || !tokenId || !chainId || !tenantId) {
        res.status(400).json({ error: 'Missing required parameters' });
        return;
      }

      const service = getWashTradingService();
      const history = await service.getTokenHistory(
        contractAddress,
        tokenId,
        parseInt(chainId, 10),
        tenantId
      );

      res.json(history);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Content Screening endpoints
  app.post('/api/v1/content/screen', async (req: Request, res: Response) => {
    try {
      const { contractAddress, tokenId, chainId, contentUrl, contentType, tenantId } = req.body;

      const service = getContentScreeningService();
      const result = await service.screenContent(
        contractAddress,
        tokenId,
        chainId,
        contentUrl,
        contentType,
        tenantId
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/v1/content/review/:screeningId', async (req: Request, res: Response) => {
    try {
      const { screeningId } = req.params;
      const { reviewedBy, approved, reviewNotes, actionTaken } = req.body;

      if (!screeningId) {
        res.status(400).json({ error: 'Missing screening ID' });
        return;
      }

      const service = getContentScreeningService();
      const result = await service.reviewContent(
        screeningId,
        reviewedBy,
        approved,
        reviewNotes,
        actionTaken
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/v1/content/pending', async (req: Request, res: Response) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const limit = parseInt(req.query['limit'] as string, 10) || 100;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant ID' });
        return;
      }

      const service = getContentScreeningService();
      const pending = await service.getPendingReviews(tenantId, limit);

      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Risk Assessment endpoints
  app.post('/api/v1/risk/assess', async (req: Request, res: Response) => {
    try {
      const service = getNFTRiskAssessmentService();
      const result = await service.assessTransaction(req.body);

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/v1/risk/assessment/:assessmentId', async (req: Request, res: Response) => {
    try {
      const { assessmentId } = req.params;

      if (!assessmentId) {
        res.status(400).json({ error: 'Missing assessment ID' });
        return;
      }

      const service = getNFTRiskAssessmentService();
      const assessment = await service.getAssessment(assessmentId);

      if (!assessment) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      res.json(assessment);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/v1/risk/review/:assessmentId', async (req: Request, res: Response) => {
    try {
      const { assessmentId } = req.params;
      const { reviewedBy, approved, reviewNotes, overrideReason, newRiskLevel } = req.body;

      if (!assessmentId) {
        res.status(400).json({ error: 'Missing assessment ID' });
        return;
      }

      const service = getNFTRiskAssessmentService();
      const result = await service.reviewAssessment(
        assessmentId,
        reviewedBy,
        approved,
        reviewNotes,
        overrideReason,
        newRiskLevel
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/v1/risk/pending', async (req: Request, res: Response) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const limit = parseInt(req.query['limit'] as string, 10) || 100;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant ID' });
        return;
      }

      const service = getNFTRiskAssessmentService();
      const pending = await service.getPendingReviews(tenantId, limit);

      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Travel Rule endpoints
  if (config.travelRule.enabled) {
    app.post('/api/v1/travel-rule/create', async (req: Request, res: Response) => {
      try {
        const service = getNFTTravelRuleService();
        const result = await service.createTravelRuleMessage(req.body);

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.post('/api/v1/travel-rule/send/:travelRuleId', async (req: Request, res: Response) => {
      try {
        const { travelRuleId } = req.params;

        if (!travelRuleId) {
          res.status(400).json({ error: 'Missing travel rule ID' });
          return;
        }

        const service = getNFTTravelRuleService();
        await service.sendTravelRuleMessage(travelRuleId);

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.get('/api/v1/travel-rule/:travelRuleId', async (req: Request, res: Response) => {
      try {
        const { travelRuleId } = req.params;

        if (!travelRuleId) {
          res.status(400).json({ error: 'Missing travel rule ID' });
          return;
        }

        const service = getNFTTravelRuleService();
        const message = await service.getTravelRuleMessage(travelRuleId);

        if (!message) {
          res.status(404).json({ error: 'Travel Rule message not found' });
          return;
        }

        res.json(message);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.get('/api/v1/travel-rule/pending', async (req: Request, res: Response) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const limit = parseInt(req.query['limit'] as string, 10) || 100;

        if (!tenantId) {
          res.status(400).json({ error: 'Missing tenant ID' });
          return;
        }

        const service = getNFTTravelRuleService();
        const pending = await service.getPendingMessages(tenantId, limit);

        res.json(pending);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
  }

  // CARF endpoints
  if (config.carf.enabled) {
    app.post('/api/v1/carf/generate', async (req: Request, res: Response) => {
      try {
        const service = getNFTCARFService();
        const result = await service.generateReport(req.body);

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.get('/api/v1/carf/report/:reportId', async (req: Request, res: Response) => {
      try {
        const { reportId } = req.params;

        if (!reportId) {
          res.status(400).json({ error: 'Missing report ID' });
          return;
        }

        const service = getNFTCARFService();
        const report = await service.getReport(reportId);

        if (!report) {
          res.status(404).json({ error: 'Report not found' });
          return;
        }

        res.json(report);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.post('/api/v1/carf/submit/:reportId', async (req: Request, res: Response) => {
      try {
        const { reportId } = req.params;
        const { submittedTo } = req.body;

        if (!reportId) {
          res.status(400).json({ error: 'Missing report ID' });
          return;
        }

        const service = getNFTCARFService();
        const result = await service.submitReport(reportId, submittedTo);

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.get('/api/v1/carf/wallet/:walletAddress', async (req: Request, res: Response) => {
      try {
        const { walletAddress } = req.params;
        const tenantId = req.headers['x-tenant-id'] as string;

        if (!walletAddress || !tenantId) {
          res.status(400).json({ error: 'Missing required parameters' });
          return;
        }

        const service = getNFTCARFService();
        const reports = await service.getWalletReports(walletAddress, tenantId);

        res.json(reports);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
  }
}

/**
 * Get service health status
 */
async function getServiceHealth(): Promise<ServiceHealth> {
  const config = getConfig();
  const db = getDatabaseService();
  const producer = getEventProducer();
  const consumer = getEventConsumer();

  const dbHealth = await db.healthCheck();

  const memUsage = process.memoryUsage();

  return {
    status: dbHealth.healthy && producer.isHealthy() ? 'healthy' : 'degraded',
    timestamp: new Date(),
    version: config.version,
    uptime: process.uptime(),
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    },
    database: {
      status: dbHealth.healthy ? 'connected' : 'disconnected',
      latency: dbHealth.latency,
    },
    redis: {
      status: 'connected', // Would check Redis connection
      latency: 0,
    },
    kafka: {
      status: producer.isHealthy() && consumer.isHealthy() ? 'connected' : 'disconnected',
      topics: Object.values(NFT_COMPLIANCE_TOPICS),
    },
    blockchain: {
      status: 'connected', // Would check blockchain connections
      chains: config.blockchain.providers.map((p) => ({
        chainId: p.chainId,
        name: p.name,
        blockNumber: 0,
        latency: 0,
      })),
    },
    compliance: {
      pendingScreenings: 0, // Would query database
      pendingAssessments: 0,
      highRiskAlerts: 0,
    },
  };
}

/**
 * Initialize services
 */
async function initializeServices(): Promise<void> {
  appLogger.info('Initializing services...');

  // Connect to database
  const db = getDatabaseService();
  await db.connect();

  // Connect to Kafka producer
  const producer = getEventProducer();
  await producer.connect();

  // Connect to Kafka consumer
  const consumer = getEventConsumer();
  await consumer.connect();

  // Subscribe to NFT events
  await subscribeToNFTEvents(consumer);

  // Register event handlers
  registerEventHandlers(consumer);

  // Start consuming
  await consumer.start();

  appLogger.info('Services initialized successfully');
}

/**
 * Register event handlers
 */
function registerEventHandlers(consumer: ReturnType<typeof getEventConsumer>): void {
  // Handle NFT sale events
  consumer.registerHandler('nft.sale.created', async (event) => {
    const payload = event.payload as {
      saleId: string;
      transactionHash: string;
      contractAddress: string;
      tokenId: string;
      chainId: number;
      sellerAddress: string;
      buyerAddress: string;
      price: string;
      priceUSD: string;
      marketplace: string;
      userId?: string;
    };

    appLogger.info('Processing NFT sale event', {
      saleId: payload.saleId,
      contractAddress: payload.contractAddress,
    });

    // Assess risk
    const riskService = getNFTRiskAssessmentService();
    const riskInput: any = {
      transactionId: payload.saleId,
      transactionHash: payload.transactionHash,
      contractAddress: payload.contractAddress,
      tokenId: payload.tokenId,
      chainId: payload.chainId,
      sellerAddress: payload.sellerAddress,
      buyerAddress: payload.buyerAddress,
      price: payload.price,
      priceUSD: payload.priceUSD,
      marketplace: payload.marketplace,
      tenantId: event.tenantId,
    };

    if (payload.userId) riskInput.userId = payload.userId;
    if (event.brokerId) riskInput.brokerId = event.brokerId;

    await riskService.assessTransaction(riskInput);

    // Check Travel Rule
    const travelRuleService = getNFTTravelRuleService();
    const priceUSD = parseFloat(payload.priceUSD);
    if (travelRuleService.isTravelRuleRequired(priceUSD)) {
      const travelInput: any = {
        saleId: payload.saleId,
        contractAddress: payload.contractAddress,
        tokenId: payload.tokenId,
        chainId: payload.chainId,
        sellerAddress: payload.sellerAddress,
        buyerAddress: payload.buyerAddress,
        price: payload.price,
        priceUSD: payload.priceUSD,
        currency: 'USD',
        timestamp: new Date(),
        tenantId: event.tenantId,
      };

      if (event.brokerId) travelInput.brokerId = event.brokerId;
      if (payload.userId) travelInput.userId = payload.userId;

      await travelRuleService.createTravelRuleMessage(travelInput);
    }
  });

  // Handle NFT token minted events
  consumer.registerHandler('nft.token.minted', async (event) => {
    const payload = event.payload as {
      tokenId: string;
      contractAddress: string;
      chainId: number;
      tokenUri: string;
    };

    appLogger.info('Processing NFT mint event', {
      tokenId: payload.tokenId,
      contractAddress: payload.contractAddress,
    });

    // Screen content
    const contentService = getContentScreeningService();
    await contentService.screenContent(
      payload.contractAddress,
      payload.tokenId,
      payload.chainId,
      payload.tokenUri,
      'image', // Default to image, would detect from URI
      event.tenantId
    );
  });
}

/**
 * Shutdown services
 */
async function shutdownServices(): Promise<void> {
  appLogger.info('Shutting down services...');

  const consumer = getEventConsumer();
  await consumer.disconnect();

  const producer = getEventProducer();
  await producer.disconnect();

  const db = getDatabaseService();
  await db.disconnect();

  appLogger.info('Services shut down successfully');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const config = getConfig();

  // Validate configuration
  const configErrors = validateConfig(config);
  if (configErrors.length > 0) {
    appLogger.error('Configuration validation failed', { errors: configErrors });
    process.exit(1);
  }

  appLogger.info('Starting NFT Compliance Service', {
    version: config.version,
    environment: config.environment,
  });

  try {
    // Initialize services
    await initializeServices();

    // Create and start Express app
    const app = createApp();
    const server = app.listen(config.port, () => {
      appLogger.info(`NFT Compliance Service listening on port ${config.port}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      appLogger.info(`Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        await shutdownServices();
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        appLogger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    appLogger.error('Failed to start NFT Compliance Service', error as Error);
    process.exit(1);
  }
}

// Start the service
main();
