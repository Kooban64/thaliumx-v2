/**
 * CEX Compliance Service - Main Orchestrator
 * Enterprise-grade compliance processing for ThaliumX CEX
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';
import { config } from '../config';
import { logger, requestLogging } from '../utils/logger';
import { databaseService } from './database';
import { eventProducer, eventConsumer } from './events';
import { travelRuleService } from './travel-rule';
import { riskAssessmentService } from './risk-assessment';
import { carfService } from './carf';
import { ServiceHealth } from '../types/compliance';
import {
  TransactionCreatedEvent,
  TransactionCompletedEvent,
  UserRegisteredEvent,
  UserKYCUpdatedEvent,
  WalletDepositEvent,
  WalletWithdrawalEvent,
} from '../types/events';

// ==================== INPUT VALIDATION SCHEMAS ====================

const TravelRuleCheckSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().min(1).max(10),
  originatorCountry: z.string().length(2, 'Country code must be 2 characters'),
  beneficiaryCountry: z.string().length(2, 'Country code must be 2 characters'),
});

const TenantIdSchema = z.string().uuid().optional();

const LimitOffsetSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

// ==================== CEX COMPLIANCE SERVICE ====================

/**
 * CEX Compliance Service - Main service orchestrator
 */
export class CEXComplianceService {
  private app: Express;
  private server: ReturnType<Express['listen']> | null = null;
  private isInitialized = false;
  private isRunning = false;
  private startTime: Date | null = null;

  constructor() {
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Initialize all service dependencies
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('CEX Compliance Service already initialized');
      return;
    }

    logger.info('Initializing CEX Compliance Service...');

    try {
      // Initialize database
      logger.info('Initializing database connection...');
      await databaseService.initialize();

      // Initialize event producer
      logger.info('Initializing event producer...');
      await eventProducer.initialize();

      // Initialize event consumer
      logger.info('Initializing event consumer...');
      await eventConsumer.initialize();

      // Register event handlers
      this.registerEventHandlers();

      this.isInitialized = true;
      logger.info('CEX Compliance Service initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize CEX Compliance Service', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      logger.warn('CEX Compliance Service already running');
      return;
    }

    logger.info('Starting CEX Compliance Service...');

    try {
      // Start event consumer
      await eventConsumer.start();

      // Start HTTP server
      this.server = this.app.listen(config.port, () => {
        logger.info(`CEX Compliance Service listening on port ${config.port}`);
      });

      this.isRunning = true;
      this.startTime = new Date();

      // Start background tasks
      this.startBackgroundTasks();

      logger.info('CEX Compliance Service started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start CEX Compliance Service', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down CEX Compliance Service...');

    try {
      // Stop HTTP server
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server?.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        this.server = null;
      }

      // Stop event consumer
      await eventConsumer.shutdown();

      // Stop event producer
      await eventProducer.shutdown();

      // Close database connections
      await databaseService.shutdown();

      this.isRunning = false;
      this.isInitialized = false;

      logger.info('CEX Compliance Service shutdown complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error during shutdown', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<ServiceHealth> {
    const dbLatency = await databaseService.getLatency();
    // Pool stats available via databaseService.getPoolStats() for detailed health checks
    const eventMetrics = eventConsumer.getMetrics();

    const memoryUsage = process.memoryUsage();
    const uptime = this.startTime
      ? Math.floor((Date.now() - this.startTime.getTime()) / 1000)
      : 0;

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!databaseService.isHealthy() || !eventConsumer.isHealthy()) {
      status = 'unhealthy';
    } else if (dbLatency > 100 || eventMetrics.eventsFailed > 0) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date(),
      version: config.version,
      uptime,
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      database: {
        status: databaseService.isHealthy() ? 'connected' : 'disconnected',
        latency: dbLatency,
      },
      redis: {
        status: 'connected', // TODO: Implement Redis health check
        latency: 0,
      },
      kafka: {
        status: eventConsumer.isHealthy() ? 'connected' : 'disconnected',
        topics: eventConsumer.getSubscribedTopics(),
      },
      compliance: {
        pendingTravelRule: 0, // TODO: Get from repository
        pendingCARF: 0, // TODO: Get from repository
        highRiskAlerts: 0, // TODO: Get from repository
      },
    };
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: config.environment === 'production'
        ? ['https://thaliumx.com', 'https://admin.thaliumx.com']
        : '*',
      credentials: true,
    }));

    // Rate limiting
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogging());

    // Error handling
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });
      res.status(500).json({
        error: 'Internal server error',
        message: config.environment === 'development' ? err.message : undefined,
      });
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (_req: Request, res: Response) => {
      try {
        const health = await this.getHealth();
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(503).json({ status: 'unhealthy', error: 'Health check failed' });
      }
    });

    // Readiness check endpoint
    this.app.get('/ready', (_req: Request, res: Response) => {
      if (this.isRunning && databaseService.isHealthy()) {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ ready: false });
      }
    });

    // Liveness check endpoint
    this.app.get('/live', (_req: Request, res: Response) => {
      res.status(200).json({ alive: true });
    });

    // API version endpoint
    this.app.get('/version', (_req: Request, res: Response) => {
      res.json({
        service: config.serviceName,
        version: config.version,
        environment: config.environment,
      });
    });

    // Travel Rule endpoints
    this.app.post('/api/v1/travel-rule/check', authenticateJWT, async (req: Request, res: Response) => {
      try {
        const validatedData = TravelRuleCheckSchema.parse(req.body);
        const result = travelRuleService.checkTravelRuleRequired(
          validatedData.amount,
          validatedData.currency,
          validatedData.originatorCountry,
          validatedData.beneficiaryCountry
        );
        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            error: 'Validation failed',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          });
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          res.status(400).json({ error: errorMessage });
        }
      }
    });

    this.app.get('/api/v1/travel-rule/:id', authenticateJWT, async (req: Request, res: Response) => {
      try {
        const result = await travelRuleService.getTravelRuleById(req.params['id'] ?? '');
        if (result) {
          res.json(result);
        } else {
          res.status(404).json({ error: 'Travel Rule message not found' });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(400).json({ error: errorMessage });
      }
    });

    this.app.get('/api/v1/travel-rule/stats', authenticateJWT, async (req: Request, res: Response) => {
      try {
        const tenantId = TenantIdSchema.parse(req.query['tenantId']);
        const stats = await travelRuleService.getStatistics(tenantId);
        res.json(stats);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            error: 'Validation failed',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          });
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          res.status(400).json({ error: errorMessage });
        }
      }
    });

    // Risk Assessment endpoints
    this.app.get('/api/v1/risk-assessment/:id', authenticateJWT, async (req: Request, res: Response) => {
      try {
        const result = await riskAssessmentService.getRiskAssessmentById(req.params['id'] ?? '');
        if (result) {
          res.json(result);
        } else {
          res.status(404).json({ error: 'Risk assessment not found' });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(400).json({ error: errorMessage });
      }
    });

    this.app.get('/api/v1/risk-assessment/stats', authenticateJWT, async (req: Request, res: Response) => {
      try {
        const tenantId = TenantIdSchema.parse(req.query['tenantId']);
        const stats = await riskAssessmentService.getStatistics(tenantId);
        res.json(stats);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            error: 'Validation failed',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          });
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          res.status(400).json({ error: errorMessage });
        }
      }
    });

    this.app.get('/api/v1/risk-assessment/review-required', authenticateJWT, async (req: Request, res: Response) => {
      try {
        const tenantId = TenantIdSchema.parse(req.query['tenantId']);
        const assessments = await riskAssessmentService.getAssessmentsRequiringReview(tenantId);
        res.json(assessments);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            error: 'Validation failed',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          });
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          res.status(400).json({ error: errorMessage });
        }
      }
    });

    // CARF endpoints
    this.app.get('/api/v1/carf/:id', authenticateJWT, async (req: Request, res: Response) => {
      try {
        const result = await carfService.getReportById(req.params['id'] ?? '');
        if (result) {
          res.json(result);
        } else {
          res.status(404).json({ error: 'CARF report not found' });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(400).json({ error: errorMessage });
      }
    });

    this.app.get('/api/v1/carf/user/:userId', authenticateJWT, async (req: Request, res: Response) => {
      try {
        const validatedParams = LimitOffsetSchema.parse(req.query);
        const result = await carfService.getUserReports(req.params['userId'] ?? '', validatedParams);
        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            error: 'Validation failed',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          });
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          res.status(400).json({ error: errorMessage });
        }
      }
    });

    this.app.get('/api/v1/carf/stats', authenticateJWT, async (req: Request, res: Response) => {
      try {
        const tenantId = TenantIdSchema.parse(req.query['tenantId']);
        const stats = await carfService.getStatistics(tenantId);
        res.json(stats);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            error: 'Validation failed',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          });
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          res.status(400).json({ error: errorMessage });
        }
      }
    });

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Register event handlers for compliance processing
   */
  private registerEventHandlers(): void {
    // Transaction created handler
    eventConsumer.registerHandler<TransactionCreatedEvent>(
      'transaction.created',
      async (event) => {
        logger.info('Processing transaction.created event', {
          transactionId: event.data.transactionId,
          correlationId: event.correlationId,
        });

        // Perform risk assessment
        // In production, fetch user profile from user service
        const mockUserProfile = {
          userId: event.data.userId,
          country: 'US',
          kycStatus: 'approved' as const,
          riskRating: 'medium' as const,
          politicallyExposed: false,
          sanctionsStatus: 'passed' as const,
          accountAge: 365,
          totalTransactions: 100,
          totalVolume: 50000,
          averageTransactionSize: 500,
        };

        const transactionData: import('./risk-assessment').TransactionRiskData = {
          transactionId: event.data.transactionId,
          userId: event.data.userId,
          brokerId: event.data.brokerId ?? 'default',
          tenantId: event.tenantId,
          amount: parseFloat(event.data.amount),
          currency: event.data.symbol.split('/')[1] ?? 'USD',
          type: event.data.side === 'buy' ? 'buy' : 'sell',
          timestamp: event.timestamp,
          platform: event.data.platform,
        };
        if (event.data.counterparty) transactionData.counterparty = event.data.counterparty;

        await riskAssessmentService.assessTransaction(transactionData, mockUserProfile);
      }
    );

    // Transaction completed handler
    eventConsumer.registerHandler<TransactionCompletedEvent>(
      'transaction.completed',
      async (event) => {
        logger.info('Processing transaction.completed event', {
          transactionId: event.data.transactionId,
          correlationId: event.correlationId,
        });

        // Check if Travel Rule applies
        const amount = parseFloat(event.data.amount);
        const currency = event.data.symbol.split('/')[1] ?? 'USD';
        
        const travelRuleCheck = travelRuleService.checkTravelRuleRequired(
          amount,
          currency,
          'US', // In production, get from user profile
          'US'  // In production, get from counterparty
        );

        if (travelRuleCheck.required) {
          logger.info('Travel Rule required for transaction', {
            transactionId: event.data.transactionId,
            amount,
            threshold: travelRuleCheck.threshold,
          });
          // Generate Travel Rule message
          // In production, fetch full originator/beneficiary details
        }
      }
    );

    // User registered handler
    eventConsumer.registerHandler<UserRegisteredEvent>(
      'user.registered',
      async (event) => {
        logger.info('Processing user.registered event', {
          userId: event.data.userId,
          correlationId: event.correlationId,
        });

        // Initial user risk assessment
        const userRisk = await riskAssessmentService.assessUserProfile({
          userId: event.data.userId,
          country: event.data.country,
          kycStatus: event.data.kycStatus,
          riskRating: 'medium',
          politicallyExposed: false,
          sanctionsStatus: 'not_checked',
          accountAge: 0,
          totalTransactions: 0,
          totalVolume: 0,
          averageTransactionSize: 0,
        });

        logger.info('Initial user risk assessment completed', {
          userId: event.data.userId,
          riskScore: userRisk.riskScore,
          riskLevel: userRisk.riskLevel,
        });
      }
    );

    // User KYC updated handler
    eventConsumer.registerHandler<UserKYCUpdatedEvent>(
      'user.kyc.updated',
      async (event) => {
        logger.info('Processing user.kyc.updated event', {
          userId: event.data.userId,
          newStatus: event.data.newStatus,
          correlationId: event.correlationId,
        });

        // Re-assess user risk based on KYC status change
        if (event.data.newStatus === 'approved' || event.data.newStatus === 'rejected') {
          logger.info('KYC status change requires risk re-assessment', {
            userId: event.data.userId,
            newStatus: event.data.newStatus,
          });
        }
      }
    );

    // Wallet deposit handler
    eventConsumer.registerHandler<WalletDepositEvent>(
      'wallet.deposit',
      async (event) => {
        logger.info('Processing wallet.deposit event', {
          userId: event.data.userId,
          amount: event.data.amount,
          asset: event.data.asset,
          correlationId: event.correlationId,
        });

        // Assess deposit risk
        // Check for suspicious patterns, source of funds, etc.
      }
    );

    // Wallet withdrawal handler
    eventConsumer.registerHandler<WalletWithdrawalEvent>(
      'wallet.withdrawal',
      async (event) => {
        logger.info('Processing wallet.withdrawal event', {
          userId: event.data.userId,
          amount: event.data.amount,
          asset: event.data.asset,
          destination: event.data.destination,
          correlationId: event.correlationId,
        });

        // Check Travel Rule for withdrawals
        // Assess withdrawal risk
      }
    );

    logger.info('Event handlers registered');
  }

  /**
   * Start background tasks
   */
  private startBackgroundTasks(): void {
    // Process pending Travel Rule retries every 5 minutes
    setInterval(async () => {
      try {
        await travelRuleService.processPendingRetries();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error processing Travel Rule retries', { error: errorMessage });
      }
    }, 5 * 60 * 1000);

    // Submit pending CARF reports every hour
    setInterval(async () => {
      try {
        await carfService.submitPendingReports();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error submitting CARF reports', { error: errorMessage });
      }
    }, 60 * 60 * 1000);

    logger.info('Background tasks started');
  }
}
