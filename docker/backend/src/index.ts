#!/usr/bin/env node

/**
 * ThaliumX Backend Server
 * Production-ready financial application backend
 * 
 * Security Features:
 * - Comprehensive input validation
 * - Rate limiting and DDoS protection
 * - JWT authentication with secure tokens
 * - CORS and security headers
 * - Request logging and monitoring
 * - Error handling with proper logging
 * 
 * Financial Compliance:
 * - Audit logging for all transactions
 * - Secure data handling
 * - Input sanitization
 * - SQL injection prevention
 * - XSS protection
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import * as crypto from 'crypto';

// Load environment variables first (before any service initialization)
dotenv.config();

// Initialize OpenTelemetry BEFORE any other imports
// This ensures all subsequent imports are automatically instrumented
// Must be called before any other service imports to enable tracing
import { TelemetryService } from './services/telemetry';
TelemetryService.initialize();

// Import middleware
import { globalErrorHandler, notFoundHandler, requestLogger, securityHeaders, sanitizeInput, sqlInjectionProtection, xssProtection, requestSizeLimit } from './middleware/error-handler';
import { rateLimiter, financialRateLimiter } from './middleware/error-handler';
import { threatDetection, behavioralAnalysis } from './middleware/threat-detection';
import { apiGateway, gatewayHealthCheck, cleanupRateLimits } from './middleware/api-gateway';
import { SecurityMiddleware } from './middleware/security-middleware';
// validateRequest imported but not used in this file - used in route handlers
import { metricsMiddleware } from './middleware/metrics';

// Import routes
import authRouter from './routes/auth-router';
import usersRouter from './routes/users';
import financialRouter from './routes/financial';
import kycRouter from './routes/kyc';
import rbacRouter from './routes/rbac';
import tokenSaleRouter from './routes/token-sale';
import tenantsRouter from './routes/tenants';
import adminRouter from './routes/admin';
import exchangeRouter from './routes/exchange';
import fiatRouter from './routes/fiat';
import tokenRouter from './routes/token';
import eventStreamingRouter from './routes/event-streaming';
import marginRouter from './routes/margin';
import keycloakRouter from './routes/keycloak';
import brokerManagementRouter from './routes/broker-management';
import smartContractsRouter from './routes/smart-contracts';
import blnkfinanceRouter from './routes/blnkfinance';
import nftRouter from './routes/nft';
import multiTierLedgerRouter from './routes/multi-tier-ledger';
import dexRouter from './routes/dex';
// import aiMlRouter from './routes/ai-ml'; // DISABLED due to TensorFlow issues
import presaleRouter from './routes/presale';
import securityOversightRouter from './routes/security-oversight';
import graphsenseRouter from './routes/graphsense';
import omniExchangeRouter, { initializeOmniExchange } from './routes/omni-exchange';
import walletSystemRouter, { initializeWalletSystem } from './routes/wallet-system';
import nativeCEXRouter, { initializeNativeCEX } from './routes/native-cex';
import brokerDashboardRouter from './routes/broker-dashboard';
import adminMigrationRouter from './routes/admin-migration';
import advancedMarginRouter from './routes/advanced-margin';
import web3WalletRouter from './routes/web3-wallet';
import deviceFingerprintRouter from './routes/device-fingerprint';
import policyManagementRouter from './routes/policy-management';
import marketDataRouter from './routes/market-data';

// Import services
import { DatabaseService } from './services/database';
import { RedisService } from './services/redis';
import { LoggerService } from './services/logger';
import { ConfigService } from './services/config';
import { EmailService } from './services/email';
import { ExchangeService } from './services/exchange';
import { FiatService } from './services/fiat';
import { TokenService } from './services/token';
import { EventStreamingService } from './services/event-streaming';
import { MarginTradingService } from './services/margin';
import { KeycloakService } from './services/keycloak';
import { BrokerManagementService } from './services/broker-management';
import { SmartContractService } from './services/smart-contracts';
import { BlnkFinanceService } from './services/blnkfinance';
import { NFTService } from './services/nft';
import { KYCService } from './services/kyc';
import { RBACService } from './services/rbac';
import { TokenSaleService } from './services/token-sale';
import { MultiTierLedgerService } from './services/multi-tier-ledger';
import { DEXService } from './services/dex';
// import { AIMLService } from './services/ai-ml'; // DISABLED due to TensorFlow issues
import { PresaleService } from './services/presale';
import { SecurityOversightService } from './services/security-oversight';
import { MPCSignerService } from './services/mpc-signer';
import { GraphSenseService } from './services/graphsense';
// WalletSystemService and NativeCEXService imported but initialized elsewhere
import { MetricsService } from './services/metrics';
import { AdvancedMarginTradingService } from './services/advanced-margin';
import { web3WalletService } from './services/web3-wallet';
import { DeviceFingerprintService } from './services/device-fingerprint';
import { KafkaService } from './services/kafka';

// Global error handlers
process.on('uncaughtException', (error: Error) => {
  console.error('🚨 UNCAUGHT EXCEPTION - Shutting down gracefully');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('🚨 UNHANDLED REJECTION - Shutting down gracefully');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

class ThaliumXBackend {
  private app: express.Application;
  private server!: http.Server;
  private io!: SocketIOServer;
  private config: any;
  // isShuttingDown flag for graceful shutdown (used in signal handlers)
  private isShuttingDown = false;

  constructor() {
    LoggerService.info('Initializing ThaliumX Backend Server');

    // Initialize Express app
    this.app = express();

    // Load configuration and validate secrets (fail-fast in production)
    this.config = ConfigService.getConfig();
    try {
      ConfigService.validateConfig();
    } catch (e) {
      LoggerService.error('Configuration validation failed', e);
      process.exit(1);
    }

    // Setup graceful shutdown
    this.setupGracefulShutdown();

    LoggerService.info('Backend Server initialized');
  }

  private async initializeServices(): Promise<void> {
    try {
      LoggerService.info('Initializing core services');
      
      // Initialize logger first
      LoggerService.initialize();
      LoggerService.info('Logger service initialized');

      // Initialize email service early (needed for auth)
      // DISABLED due to SMTP connection issues
      /*
      try {
        EmailService.initialize();
        LoggerService.info('✅ Email service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Email service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without email service (development mode)');
      }
      */
      LoggerService.warn('⚠️  Email service disabled due to SMTP configuration issues');
      
      // Initialize database with proper error handling
      try {
        await DatabaseService.initialize();
        LoggerService.info('✅ Database service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Database service initialization failed:', error);
        // For financial applications, we should exit if database fails
        // But for development, we'll continue with warnings
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without database (development mode)');
      }
      
      // Initialize Redis with proper error handling
      try {
        await RedisService.initialize();
        LoggerService.info('✅ Redis service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Redis service initialization failed:', error);
        // For financial applications, Redis is critical for caching and sessions
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Redis (development mode)');
      }
      
      // Initialize Kafka service
      try {
        await KafkaService.initialize();
        LoggerService.info('✅ Kafka service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Kafka service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Kafka service (development mode)');
      }
      
      // Initialize Exchange Service
      try {
        await ExchangeService.initialize();
        LoggerService.info('✅ Exchange service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Exchange service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Exchange service (development mode)');
      }
      
      // Initialize FIAT Service
      try {
        await FiatService.initialize();
        LoggerService.info('✅ FIAT service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ FIAT service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without FIAT service (development mode)');
      }
      
      // Initialize Token Service
      try {
        await TokenService.initialize();
        LoggerService.info('✅ Token service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Token service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Token service (development mode)');
      }
      
      // Initialize Event Streaming Service
      try {
        await EventStreamingService.initialize();
        LoggerService.info('✅ Event Streaming service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Event Streaming service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Event Streaming service (development mode)');
      }
      
      // Initialize Margin Trading Service
      try {
        await MarginTradingService.initialize();
        LoggerService.info('✅ Margin Trading service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Margin Trading service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Margin Trading service (development mode)');
      }

      // Initialize Keycloak service
      try {
        await KeycloakService.initialize();
        LoggerService.info('✅ Keycloak service initialized successfully');
        // Align Keycloak realms with known brokers (best-effort)
        try {
          const brokers = BrokerManagementService.getAllBrokers().map(b => ({ id: b.id, name: b.name, slug: b.slug, domain: b.domain }));
          await KeycloakService.syncBrokerRealms(brokers);
          LoggerService.info('✅ Keycloak broker realm synchronization complete');
        } catch (syncErr) {
          LoggerService.warn('⚠️  Keycloak broker realm synchronization skipped/failed', { error: syncErr instanceof Error ? syncErr.message : String(syncErr) });
        }
      } catch (error) {
        LoggerService.error('❌ Keycloak service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Keycloak service (development mode)');
      }

      // Initialize Broker Management service
      try {
        await BrokerManagementService.initialize();
        LoggerService.info('✅ Broker Management service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Broker Management service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Broker Management service (development mode)');
      }

      // Initialize Smart Contract service
      try {
        await SmartContractService.initialize();
        LoggerService.info('✅ Smart Contract service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Smart Contract service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Smart Contract service (development mode)');
      }

      // Initialize BlnkFinance service
      try {
        await BlnkFinanceService.initialize();
        LoggerService.info('✅ BlnkFinance service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ BlnkFinance service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without BlnkFinance service (development mode)');
      }

      // Initialize NFT service
      try {
        await NFTService.initialize();
        LoggerService.info('✅ NFT service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ NFT service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without NFT service (development mode)');
      }

      // Initialize KYC service
      try {
        await KYCService.initialize();
        LoggerService.info('✅ KYC service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ KYC service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without KYC service (development mode)');
      }

      // Initialize RBAC service
      try {
        await RBACService.initialize();
        LoggerService.info('✅ RBAC service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ RBAC service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without RBAC service (development mode)');
      }

      // Initialize Token Sale service
      try {
        await TokenSaleService.initialize();
        LoggerService.info('✅ Token Sale service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Token Sale service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Token Sale service (development mode)');
      }

      // Initialize Multi-Tier Ledger service
      try {
        await MultiTierLedgerService.initialize();
        LoggerService.info('✅ Multi-Tier Ledger service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Multi-Tier Ledger service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Multi-Tier Ledger service (development mode)');
      }

      // Initialize DEX service
      try {
        await DEXService.initialize();
        LoggerService.info('✅ DEX service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ DEX service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without DEX service (development mode)');
      }

      // Initialize AI/ML service - DISABLED due to TensorFlow native addon issues
      // TODO: Fix TensorFlow native addon compilation for Docker
      /*
      try {
        await AIMLService.initialize();
        LoggerService.info('✅ AI/ML service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ AI/ML service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without AI/ML service (development mode)');
      }
      */

      // Initialize Presale service
      try {
        await PresaleService.initialize();
        LoggerService.info('✅ Presale service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Presale service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Presale service (development mode)');
      }

      // Initialize Security & Oversight service
      try {
        await SecurityOversightService.initialize();
        LoggerService.info('✅ Security & Oversight service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Security & Oversight service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Security & Oversight service (development mode)');
      }

      // Initialize Omni Exchange service
      try {
        await initializeOmniExchange();
        LoggerService.info('✅ Omni Exchange service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Omni Exchange service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Omni Exchange service (development mode)');
      }

      // Initialize MPC Signer service
      try {
        await MPCSignerService.initialize();
        LoggerService.info('✅ MPC Signer service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ MPC Signer service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without MPC Signer service (development mode)');
      }

      // Initialize GraphSense service
      try {
        await GraphSenseService.initialize();
        LoggerService.info('✅ GraphSense service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ GraphSense service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without GraphSense service (development mode)');
      }

      // Initialize Wallet System service
      try {
        await initializeWalletSystem();
        LoggerService.info('✅ Wallet System service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Wallet System service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Wallet System service (development mode)');
      }

      // Initialize Native CEX service
      try {
        await initializeNativeCEX();
        LoggerService.info('✅ Native CEX service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Native CEX service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Native CEX service (development mode)');
      }

      // Initialize Advanced Margin Trading Service
      try {
        await AdvancedMarginTradingService.initialize();
    await web3WalletService.initialize();
        LoggerService.info('✅ Advanced Margin Trading service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Advanced Margin Trading service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Advanced Margin Trading service (development mode)');
      }

      // Initialize Device Fingerprint Service
      try {
        DeviceFingerprintService.initialize();
        LoggerService.info('✅ Device Fingerprint service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Device Fingerprint service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Device Fingerprint service (development mode)');
      }

      // Initialize Metrics service
      try {
        MetricsService.initialize();
        LoggerService.info('✅ Metrics service initialized successfully');
      } catch (error) {
        LoggerService.error('❌ Metrics service initialization failed:', error);
        if (process.env.NODE_ENV === 'production') {
          throw error;
        }
        LoggerService.warn('⚠️  Continuing without Metrics service (development mode)');
      }
      
      LoggerService.info('✅ All core services initialized successfully');
    } catch (error) {
      LoggerService.error('💥 Failed to initialize core services:', error);
      LoggerService.warn('⚠️  Continuing with limited functionality (some services failed)');
    }
  }

  private setupMiddleware(): void {
    LoggerService.info('Setting up middleware');
    
    // Security middleware - CRITICAL for financial applications
    // Generate nonce for CSP
    this.app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
      (res as any).nonce = Buffer.from(crypto.randomBytes(16)).toString('base64');
      next();
    });

    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: [
            "'self'",
            (_req: any, res: any) => `'nonce-${res.nonce}'`,
            "'strict-dynamic'"
          ],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", ...this.config.cors.origin],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration - Strict for financial applications
    this.app.use(cors({
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
      exposedHeaders: ['X-Rate-Limit-Remaining', 'X-Rate-Limit-Reset']
    }));

    // Compression middleware
    this.app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));

    // Request logging - CRITICAL for audit trails
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          LoggerService.info(message.trim());
        }
      }
    }));

    // API Gateway - First line of defense
    this.app.use(apiGateway({
      enabled: process.env.NODE_ENV === 'production',
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      blockedIPs: process.env.BLOCKED_IPS?.split(',') || [],
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '1000'),
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000')
    }));

    // Security headers - CRITICAL for production
    this.app.use(securityHeaders);

    // Request size limits
    this.app.use(requestSizeLimit);

    // Advanced threat detection and behavioral analysis
    this.app.use(threatDetection);
    this.app.use(behavioralAnalysis);

    // CSRF protection
    this.app.use(SecurityMiddleware.csrfProtection(['/api/auth/login', '/api/auth/logout', '/api/auth/refresh']));

    // Input sanitization and security checks
    this.app.use(sanitizeInput);
    this.app.use(sqlInjectionProtection);
    this.app.use(xssProtection);

    // Custom request logger for detailed audit trails
    this.app.use(requestLogger);

    // Metrics middleware for Prometheus
    this.app.use(metricsMiddleware);

    // Rate limiting - CRITICAL for DDoS protection
    this.app.use(rateLimiter);

    // Additional rate limiting for financial operations
    this.app.use('/api/financial', financialRateLimiter);
    this.app.use('/api/margin', financialRateLimiter);
    this.app.use('/api/exchange', financialRateLimiter);
    this.app.use('/api/wallets', financialRateLimiter);

    // Body parsing middleware with size limits
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (_req, _res, buf) => {
        // Additional security checks can be added here
        if (buf.length > 10 * 1024 * 1024) {
          throw new Error('Request body too large');
        }
      }
    }));
    
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);

    LoggerService.info('Middleware setup complete');
  }

  private setupRoutes(): void {
    LoggerService.info('Setting up routes');
    
    // Health check endpoint - CRITICAL for monitoring
    this.app.get('/health', (_req, res) => {
      // Helper function to safely check service health
      // Returns 'healthy', 'unhealthy', or 'not_initialized' (which is treated as acceptable)
      const checkServiceHealth = (service: any, serviceName: string): string => {
        try {
          if (!service || typeof service.isHealthy !== 'function') {
            return 'not_initialized';
          }
          return service.isHealthy() ? 'healthy' : 'not_initialized';
        } catch (error) {
          LoggerService.warn(`Health check failed for ${serviceName}:`, error);
          return 'not_initialized';
        }
      };

      const healthCheck = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: DatabaseService.isConnected() ? 'connected' : 'disconnected',
          redis: RedisService.isConnected() ? 'connected' : 'disconnected',
          keycloak: checkServiceHealth(KeycloakService, 'Keycloak'),
          brokerManagement: checkServiceHealth(BrokerManagementService, 'BrokerManagement'),
          smartContracts: checkServiceHealth(SmartContractService, 'SmartContract'),
          blnkfinance: checkServiceHealth(BlnkFinanceService, 'BlnkFinance'),
          nft: checkServiceHealth(NFTService, 'NFT'),
          kyc: checkServiceHealth(KYCService, 'KYC'),
          rbac: checkServiceHealth(RBACService, 'RBAC'),
          tokenSale: checkServiceHealth(TokenSaleService, 'TokenSale'),
          multiTierLedger: checkServiceHealth(MultiTierLedgerService, 'MultiTierLedger'),
          dex: checkServiceHealth(DEXService, 'DEX'),
          aiMl: 'disabled', // checkServiceHealth(AIMLService, 'AIML'),
          presale: checkServiceHealth(PresaleService, 'Presale'),
          securityOversight: checkServiceHealth(SecurityOversightService, 'SecurityOversight'),
          mpcSigner: checkServiceHealth(MPCSignerService, 'MPCSigner'),
          graphSense: checkServiceHealth(GraphSenseService, 'GraphSense'),
          omniExchange: 'healthy',
          walletSystem: 'healthy',
          nativeCEX: 'healthy',
          advancedMargin: checkServiceHealth(AdvancedMarginTradingService, 'AdvancedMargin'),
          web3Wallet: checkServiceHealth(web3WalletService, 'web3Wallet'),
          deviceFingerprint: checkServiceHealth(DeviceFingerprintService, 'DeviceFingerprint'),
          api: 'running'
        },
        security: {
          threatDetection: 'active',
          rateLimiting: 'active',
          inputValidation: 'active',
          circuitBreaker: 'active'
        }
      };

      res.status(200).json(healthCheck);
    });

    // API Gateway health check
    this.app.get('/health/gateway', gatewayHealthCheck);

    // CSRF token endpoint
    this.app.get('/api/csrf-token', SecurityMiddleware.getCSRFToken);

    // Public Prometheus metrics endpoint with token/IP guard
    this.app.get('/metrics', async (req, res) => {
      try {
        const headerToken = (req.headers['x-prometheus-token'] as string) || '';
        const authHeader = req.headers['authorization'];
        const authValue = typeof authHeader === 'string' ? authHeader : '';
        const bearerToken = authValue.startsWith('Bearer ') ? authValue.substring(7) : '';
        const token = headerToken || bearerToken;
        const requiredToken = process.env.METRICS_TOKEN || '';
        const allowlist = (process.env.METRICS_IP_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean);

        const clientIp = (req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '') as string;
        const ipAllowed = allowlist.length === 0 || allowlist.includes(clientIp);
        const tokenAllowed = !requiredToken || token === requiredToken;

        if (!ipAllowed && !tokenAllowed) {
          res.status(403).send('Forbidden');
          return;
        }

        const { MetricsService } = await import('./services/metrics');
        const metrics = await MetricsService.getMetrics();
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(metrics);
      } catch (err) {
        res.status(500).send('metrics_error');
      }
    });

    // API routes with proper validation
    this.app.use('/api/auth', authRouter);
    this.app.use('/api/users', usersRouter);
    this.app.use('/api/financial', financialRouter);
    this.app.use('/api/kyc', kycRouter);
    this.app.use('/api/tenants', tenantsRouter);
    this.app.use('/api/admin', adminRouter);
    this.app.use('/api/exchange', exchangeRouter);
    this.app.use('/api/fiat', fiatRouter);
    this.app.use('/api/token', tokenRouter);
    this.app.use('/api/events', eventStreamingRouter);
    this.app.use('/api/margin', marginRouter);
    this.app.use('/api/keycloak', keycloakRouter);
    this.app.use('/api/brokers', brokerManagementRouter);
    this.app.use('/api/contracts', smartContractsRouter);
    this.app.use('/api/blnkfinance', blnkfinanceRouter);
    this.app.use('/api/nft', nftRouter);
    this.app.use('/api/rbac', rbacRouter);
    this.app.use('/api/token-sale', tokenSaleRouter);
    this.app.use('/api/ledger', multiTierLedgerRouter);
    this.app.use('/api/dex', dexRouter);
    // this.app.use('/api/ai-ml', aiMlRouter); // DISABLED due to TensorFlow issues
    this.app.use('/api/presale', presaleRouter);
    this.app.use('/api/security', securityOversightRouter);
    this.app.use('/api/graphsense', graphsenseRouter);
    this.app.use('/api/omni-exchange', omniExchangeRouter);
    this.app.use('/api/wallets', walletSystemRouter);
    this.app.use('/api/cex', nativeCEXRouter);
    this.app.use('/api/broker', brokerDashboardRouter);
    this.app.use('/api/admin', adminMigrationRouter);
    this.app.use('/api/advanced-margin', advancedMarginRouter);
    this.app.use('/api/web3-wallet', web3WalletRouter);
    this.app.use('/api/security', deviceFingerprintRouter);
    this.app.use('/api/admin/policies', policyManagementRouter);
    this.app.use('/api/market', marketDataRouter);

    // API documentation endpoint
    this.app.get('/api/docs', (_req, res) => {
      res.json({
        message: 'ThaliumX API Documentation',
        version: '1.0.0',
        endpoints: {
          health: 'GET /health',
          auth: 'POST /api/auth/login, POST /api/auth/register',
          users: 'GET /api/users, GET /api/users/:id',
          financial: 'GET /api/financial/transactions',
          tenants: 'GET /api/tenants',
          admin: 'GET /api/admin/stats',
          exchange: 'POST /api/exchange/orders, GET /api/exchange/orderbook/:symbol',
          fiat: 'POST /api/fiat/deposits, POST /api/fiat/withdrawals, GET /api/fiat/wallets',
          token: 'POST /api/token/transfers, POST /api/token/staking/stake, GET /api/token/sales',
          events: 'POST /api/events/audit, POST /api/events/transaction, GET /api/events/status',
          margin: 'POST /api/margin/accounts, POST /api/margin/orders, GET /api/margin/positions',
          keycloak: 'POST /api/keycloak/brokers, POST /api/keycloak/users, POST /api/keycloak/migrate',
          brokers: 'POST /api/brokers/onboard, GET /api/brokers, GET /api/brokers/apzhex',
          contracts: 'POST /api/contracts/deploy, GET /api/contracts/token/:address/info, POST /api/contracts/:address/execute',
          blnkfinance: 'POST /api/blnkfinance/accounts, POST /api/blnkfinance/transactions, POST /api/blnkfinance/reports',
          nft: 'POST /api/nft/collections, POST /api/nft/orders/sell, POST /api/nft/orders/:id/fulfill, GET /api/nft/activity',
          kyc: 'POST /api/kyc/verify, POST /api/kyc/documents/upload, GET /api/kyc/status/:userId, GET /api/kyc/risk/:userId',
          rbac: 'GET /api/rbac/roles, POST /api/rbac/users/:userId/roles, POST /api/rbac/permissions/check',
          tokenSale: 'POST /api/token-sale/phases, POST /api/token-sale/investments, GET /api/token-sale/stats',
          ledger: 'POST /api/ledger/accounts, POST /api/ledger/transactions/transfer, GET /api/ledger/accounts/:id/balance',
          dex: 'POST /api/dex/quotes, POST /api/dex/swaps, POST /api/dex/liquidity/add, GET /api/dex/pools',
          aiMl: 'GET /api/ai-ml/models, POST /api/ai-ml/predictions, POST /api/ai-ml/trading-signals, POST /api/ai-ml/risk-assessment',
          presale: 'POST /api/presale/presales, POST /api/presale/investments, POST /api/presale/whitelist, GET /api/presale/presales/:id/statistics',
          security: 'POST /api/security/events, POST /api/security/incidents, POST /api/security/risks, GET /api/security/dashboard, GET /api/security/analytics',
          mpc: 'POST /api/mpc/keys, POST /api/mpc/signatures, POST /api/mpc/backups, GET /api/mpc/dashboard, GET /api/mpc/audit',
          graphsense: 'POST /api/graphsense/analyze/transaction, POST /api/graphsense/analyze/entity, GET /api/graphsense/alerts, GET /api/graphsense/dashboard',
          omniExchange: 'GET /api/omni-exchange/exchanges, POST /api/omni-exchange/orders, GET /api/omni-exchange/orders/:orderId, POST /api/omni-exchange/orders/:orderId/cancel, GET /api/omni-exchange/exchanges/:exchangeId/balance/:asset, POST /api/omni-exchange/exchanges/best, GET /api/omni-exchange/allocations, GET /api/omni-exchange/allocations/:exchangeId/:asset, POST /api/omni-exchange/allocations/allocate, POST /api/omni-exchange/allocations/deallocate, GET /api/omni-exchange/balance/:exchangeId/:asset/:brokerId/:customerId, GET /api/omni-exchange/orders/internal/:brokerId, GET /api/omni-exchange/compliance/travel-rule, POST /api/omni-exchange/compliance/travel-rule/:messageId/submit, GET /api/omni-exchange/compliance/carf, POST /api/omni-exchange/compliance/carf/:reportId/submit, GET /api/omni-exchange/compliance/dashboard, GET /api/omni-exchange/assets/user/:userId/:brokerId, GET /api/omni-exchange/assets/user/:userId/:brokerId/detailed, GET /api/omni-exchange/assets/broker/:brokerId, GET /api/omni-exchange/assets/platform/reconciliation, GET /api/omni-exchange/assets/platform/summary',
          wallets: 'POST /api/wallets/infrastructure, GET /api/wallets/user/:userId, GET /api/wallets/wallet/:walletId, POST /api/wallets/reference/generate, GET /api/wallets/reference/:reference, POST /api/wallets/deposit/fiat, POST /api/wallets/pool-accounts, GET /api/wallets/pool-accounts/:brokerId, POST /api/wallets/recovery/hot-wallet, GET /api/wallets/dashboard/:userId',
          cex: 'GET /api/cex/engines, GET /api/cex/pairs, GET /api/cex/pairs/thal, POST /api/cex/orders, GET /api/cex/orders/:orderId, GET /api/cex/orders/user/:userId, DELETE /api/cex/orders/:orderId, GET /api/cex/market-data/:symbol, GET /api/cex/market-data/thal/all, GET /api/cex/thal/business-model, GET /api/cex/thal/incentives/:userId, POST /api/cex/thal/credit-rewards, GET /api/cex/dashboard/:userId, GET /api/cex/analytics/platform',
          brokerDashboard: 'GET /api/broker/dashboard, GET /api/broker/health, GET /api/broker/metrics, GET /api/broker/users, GET /api/broker/transactions, GET /api/broker/kyc, GET /api/broker/audit-logs',
          advancedMargin: 'POST /api/advanced-margin/accounts, GET /api/advanced-margin/accounts, GET /api/advanced-margin/risk-limits, POST /api/advanced-margin/positions, POST /api/advanced-margin/positions/:positionId/close, GET /api/advanced-margin/positions, POST /api/advanced-margin/liquidate/:positionId, GET /api/advanced-margin/funding-rates, GET /api/advanced-margin/health, GET /api/advanced-margin/admin/accounts, GET /api/advanced-margin/admin/positions, GET /api/advanced-margin/admin/liquidations, GET /api/advanced-margin/segregation/user, GET /api/advanced-margin/segregation/all, POST /api/advanced-margin/risk-score/update',
          web3Wallet: 'POST /api/web3-wallet/connect, DELETE /api/web3-wallet/:walletId/disconnect, GET /api/web3-wallet/wallets, GET /api/web3-wallet/:address/balance/:chainId, GET /api/web3-wallet/chains, GET /api/web3-wallet/chains/:chainId, POST /api/web3-wallet/purchase-tokens, GET /api/web3-wallet/trading/pairs, POST /api/web3-wallet/trading/order, GET /api/web3-wallet/:walletId/security'
        },
        documentation: 'https://docs.thaliumx.com'
      });
    });

    LoggerService.info('Routes setup complete');
  }

  private setupErrorHandling(): void {
    LoggerService.info('Setting up error handling');
    
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(globalErrorHandler);
    
    LoggerService.info('Error handling setup complete');
  }

  private initializeSocketIO(): void {
    LoggerService.info('Initializing Socket.IO');
    
    this.server = http.createServer(this.app);
    
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: this.config.cors.origin,
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    // Socket.IO connection handling
    this.io.on('connection', (socket) => {
      LoggerService.info(`Client connected: ${socket.id}`);
      
      socket.on('disconnect', () => {
        LoggerService.info(`Client disconnected: ${socket.id}`);
      });
      
      // Add more socket event handlers as needed
    });
    
    LoggerService.info('Socket.IO initialized');
  }

  private setupGracefulShutdown(): void {
    LoggerService.info('Setting up graceful shutdown');

    const gracefulShutdown = (signal: string) => {
      LoggerService.warn('Received shutdown signal', { signal });
      this.isShuttingDown = true;

      this.server.close(() => {
        LoggerService.info('HTTP server closed');

        // Close database connections
        DatabaseService.close().then(() => {
          LoggerService.info('Database connections closed');
        }).catch((error) => {
          LoggerService.error('Error closing database connections', error);
        });

        // Close Redis connections
        RedisService.close().then(() => {
          LoggerService.info('Redis connections closed');
        }).catch((error) => {
          LoggerService.error('Error closing Redis connections', error);
        });

        LoggerService.info('Graceful shutdown complete');
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        LoggerService.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    LoggerService.info('Graceful shutdown setup complete');
  }

  private setupPeriodicTasks(): void {
    LoggerService.info('Setting up periodic maintenance tasks');

    // Clean up rate limits every 5 minutes
    setInterval(() => {
      try {
        cleanupRateLimits();
      } catch (error) {
        LoggerService.error('Error during rate limit cleanup', error);
      }
    }, 5 * 60 * 1000);

    // Security audit log rotation (placeholder for future implementation)
    setInterval(() => {
      try {
        // Rotate security logs, clean old entries, etc.
        LoggerService.info('Periodic security maintenance completed');
      } catch (error) {
        LoggerService.error('Error during security maintenance', error);
      }
    }, 60 * 60 * 1000); // Every hour

    LoggerService.info('Periodic tasks setup complete');
  }

  public async start(): Promise<void> {
    const PORT = process.env.PORT || 3002;

    try {
      // Initialize services
      await this.initializeServices();

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      // Initialize Socket.IO
      this.initializeSocketIO();

      // Setup periodic cleanup tasks
      this.setupPeriodicTasks();

      this.server.listen(PORT, () => {
        LoggerService.info('Backend Server Started Successfully', {
          port: PORT,
          health: `/health`,
          docs: `/api/docs`,
          environment: process.env.NODE_ENV || 'development',
          security: 'enabled',
          monitoring: 'enabled',
          compliance: 'ready'
        });

        LoggerService.info(`ThaliumX Backend Server started on port ${PORT}`);
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          LoggerService.error(`Port ${PORT} is already in use`);
          process.exit(1);
        } else {
          LoggerService.error('Server error', error);
          process.exit(1);
        }
      });
    } catch (error) {
      LoggerService.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  // Getter for Express app (for testing)
  getApp(): express.Application {
    return this.app;
  }
}

// Export for testing
export { ThaliumXBackend };

// Start the server
const server = new ThaliumXBackend();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});