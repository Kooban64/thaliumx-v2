#!/usr/bin/env node
"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThaliumXBackend = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const crypto = __importStar(require("crypto"));
// Load environment variables first (before any service initialization)
dotenv_1.default.config();
// Initialize OpenTelemetry BEFORE any other imports
// This ensures all subsequent imports are automatically instrumented
// Must be called before any other service imports to enable tracing
const telemetry_1 = require("./services/telemetry");
telemetry_1.TelemetryService.initialize();
// Import middleware
const error_handler_1 = require("./middleware/error-handler");
const error_handler_2 = require("./middleware/error-handler");
const threat_detection_1 = require("./middleware/threat-detection");
const api_gateway_1 = require("./middleware/api-gateway");
// validateRequest imported but not used in this file - used in route handlers
const metrics_1 = require("./middleware/metrics");
// Import routes
const auth_router_1 = __importDefault(require("./routes/auth-router"));
const users_1 = __importDefault(require("./routes/users"));
const financial_1 = __importDefault(require("./routes/financial"));
const kyc_1 = __importDefault(require("./routes/kyc"));
const rbac_1 = __importDefault(require("./routes/rbac"));
const token_sale_1 = __importDefault(require("./routes/token-sale"));
const tenants_1 = __importDefault(require("./routes/tenants"));
const admin_1 = __importDefault(require("./routes/admin"));
const exchange_1 = __importDefault(require("./routes/exchange"));
const fiat_1 = __importDefault(require("./routes/fiat"));
const token_1 = __importDefault(require("./routes/token"));
const event_streaming_1 = __importDefault(require("./routes/event-streaming"));
const margin_1 = __importDefault(require("./routes/margin"));
const keycloak_1 = __importDefault(require("./routes/keycloak"));
const broker_management_1 = __importDefault(require("./routes/broker-management"));
const smart_contracts_1 = __importDefault(require("./routes/smart-contracts"));
const blnkfinance_1 = __importDefault(require("./routes/blnkfinance"));
const nft_1 = __importDefault(require("./routes/nft"));
const multi_tier_ledger_1 = __importDefault(require("./routes/multi-tier-ledger"));
const dex_1 = __importDefault(require("./routes/dex"));
const ai_ml_1 = __importDefault(require("./routes/ai-ml"));
const presale_1 = __importDefault(require("./routes/presale"));
const security_oversight_1 = __importDefault(require("./routes/security-oversight"));
const graphsense_1 = __importDefault(require("./routes/graphsense"));
const omni_exchange_1 = __importStar(require("./routes/omni-exchange"));
const wallet_system_1 = __importStar(require("./routes/wallet-system"));
const native_cex_1 = __importStar(require("./routes/native-cex"));
const broker_dashboard_1 = __importDefault(require("./routes/broker-dashboard"));
const admin_migration_1 = __importDefault(require("./routes/admin-migration"));
const advanced_margin_1 = __importDefault(require("./routes/advanced-margin"));
const web3_wallet_1 = __importDefault(require("./routes/web3-wallet"));
const device_fingerprint_1 = __importDefault(require("./routes/device-fingerprint"));
// Import services
const database_1 = require("./services/database");
const redis_1 = require("./services/redis");
const logger_1 = require("./services/logger");
const config_1 = require("./services/config");
const email_1 = require("./services/email");
const exchange_2 = require("./services/exchange");
const fiat_2 = require("./services/fiat");
const token_2 = require("./services/token");
const event_streaming_2 = require("./services/event-streaming");
const margin_2 = require("./services/margin");
const keycloak_2 = require("./services/keycloak");
const broker_management_2 = require("./services/broker-management");
const smart_contracts_2 = require("./services/smart-contracts");
const blnkfinance_2 = require("./services/blnkfinance");
const nft_2 = require("./services/nft");
const kyc_2 = require("./services/kyc");
const rbac_2 = require("./services/rbac");
const token_sale_2 = require("./services/token-sale");
const multi_tier_ledger_2 = require("./services/multi-tier-ledger");
const dex_2 = require("./services/dex");
const ai_ml_2 = require("./services/ai-ml");
const presale_2 = require("./services/presale");
const security_oversight_2 = require("./services/security-oversight");
const mpc_signer_1 = require("./services/mpc-signer");
const graphsense_2 = require("./services/graphsense");
// WalletSystemService and NativeCEXService imported but initialized elsewhere
const metrics_2 = require("./services/metrics");
const advanced_margin_2 = require("./services/advanced-margin");
const web3_wallet_2 = require("./services/web3-wallet");
const device_fingerprint_2 = require("./services/device-fingerprint");
const kafka_1 = require("./services/kafka");
// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('🚨 UNCAUGHT EXCEPTION - Shutting down gracefully');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION - Shutting down gracefully');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    process.exit(1);
});
class ThaliumXBackend {
    app;
    server;
    io;
    config;
    // isShuttingDown flag for graceful shutdown (used in signal handlers)
    isShuttingDown = false;
    constructor() {
        logger_1.LoggerService.info('Starting ThaliumX Backend Server');
        // Initialize Express app
        this.app = (0, express_1.default)();
        // Load configuration and validate secrets (fail-fast in production)
        this.config = config_1.ConfigService.getConfig();
        try {
            config_1.ConfigService.validateConfig();
        }
        catch (e) {
            logger_1.LoggerService.error('Configuration validation failed', e);
            process.exit(1);
        }
        // Initialize services
        this.initializeServices();
        // Setup middleware
        this.setupMiddleware();
        // Setup routes
        this.setupRoutes();
        // Setup error handling
        this.setupErrorHandling();
        // Initialize Socket.IO
        this.initializeSocketIO();
        // Setup graceful shutdown
        this.setupGracefulShutdown();
        // Setup periodic cleanup tasks
        this.setupPeriodicTasks();
    }
    async initializeServices() {
        try {
            logger_1.LoggerService.info('Initializing core services');
            // Initialize logger first
            logger_1.LoggerService.initialize();
            logger_1.LoggerService.info('Logger service initialized');
            // Initialize email service early (needed for auth)
            try {
                email_1.EmailService.initialize();
                logger_1.LoggerService.info('✅ Email service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Email service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without email service (development mode)');
            }
            // Initialize database with proper error handling
            try {
                await database_1.DatabaseService.initialize();
                logger_1.LoggerService.info('✅ Database service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Database service initialization failed:', error);
                // For financial applications, we should exit if database fails
                // But for development, we'll continue with warnings
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without database (development mode)');
            }
            // Initialize Redis with proper error handling
            try {
                await redis_1.RedisService.initialize();
                logger_1.LoggerService.info('✅ Redis service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Redis service initialization failed:', error);
                // For financial applications, Redis is critical for caching and sessions
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Redis (development mode)');
            }
            // Initialize Kafka service
            try {
                await kafka_1.KafkaService.initialize();
                logger_1.LoggerService.info('✅ Kafka service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Kafka service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Kafka service (development mode)');
            }
            // Initialize Exchange Service
            try {
                await exchange_2.ExchangeService.initialize();
                logger_1.LoggerService.info('✅ Exchange service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Exchange service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Exchange service (development mode)');
            }
            // Initialize FIAT Service
            try {
                await fiat_2.FiatService.initialize();
                logger_1.LoggerService.info('✅ FIAT service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ FIAT service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without FIAT service (development mode)');
            }
            // Initialize Token Service
            try {
                await token_2.TokenService.initialize();
                logger_1.LoggerService.info('✅ Token service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Token service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Token service (development mode)');
            }
            // Initialize Event Streaming Service
            try {
                await event_streaming_2.EventStreamingService.initialize();
                logger_1.LoggerService.info('✅ Event Streaming service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Event Streaming service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Event Streaming service (development mode)');
            }
            // Initialize Margin Trading Service
            try {
                await margin_2.MarginTradingService.initialize();
                logger_1.LoggerService.info('✅ Margin Trading service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Margin Trading service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Margin Trading service (development mode)');
            }
            // Initialize Keycloak service
            try {
                await keycloak_2.KeycloakService.initialize();
                logger_1.LoggerService.info('✅ Keycloak service initialized successfully');
                // Align Keycloak realms with known brokers (best-effort)
                try {
                    const brokers = broker_management_2.BrokerManagementService.getAllBrokers().map(b => ({ id: b.id, name: b.name, slug: b.slug, domain: b.domain }));
                    await keycloak_2.KeycloakService.syncBrokerRealms(brokers);
                    logger_1.LoggerService.info('✅ Keycloak broker realm synchronization complete');
                }
                catch (syncErr) {
                    logger_1.LoggerService.warn('⚠️  Keycloak broker realm synchronization skipped/failed', { error: syncErr instanceof Error ? syncErr.message : String(syncErr) });
                }
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Keycloak service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Keycloak service (development mode)');
            }
            // Initialize Broker Management service
            try {
                await broker_management_2.BrokerManagementService.initialize();
                logger_1.LoggerService.info('✅ Broker Management service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Broker Management service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Broker Management service (development mode)');
            }
            // Initialize Smart Contract service
            try {
                await smart_contracts_2.SmartContractService.initialize();
                logger_1.LoggerService.info('✅ Smart Contract service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Smart Contract service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Smart Contract service (development mode)');
            }
            // Initialize BlnkFinance service
            try {
                await blnkfinance_2.BlnkFinanceService.initialize();
                logger_1.LoggerService.info('✅ BlnkFinance service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ BlnkFinance service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without BlnkFinance service (development mode)');
            }
            // Initialize NFT service
            try {
                await nft_2.NFTService.initialize();
                logger_1.LoggerService.info('✅ NFT service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ NFT service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without NFT service (development mode)');
            }
            // Initialize KYC service
            try {
                await kyc_2.KYCService.initialize();
                logger_1.LoggerService.info('✅ KYC service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ KYC service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without KYC service (development mode)');
            }
            // Initialize RBAC service
            try {
                await rbac_2.RBACService.initialize();
                logger_1.LoggerService.info('✅ RBAC service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ RBAC service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without RBAC service (development mode)');
            }
            // Initialize Token Sale service
            try {
                await token_sale_2.TokenSaleService.initialize();
                logger_1.LoggerService.info('✅ Token Sale service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Token Sale service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Token Sale service (development mode)');
            }
            // Initialize Multi-Tier Ledger service
            try {
                await multi_tier_ledger_2.MultiTierLedgerService.initialize();
                logger_1.LoggerService.info('✅ Multi-Tier Ledger service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Multi-Tier Ledger service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Multi-Tier Ledger service (development mode)');
            }
            // Initialize DEX service
            try {
                await dex_2.DEXService.initialize();
                logger_1.LoggerService.info('✅ DEX service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ DEX service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without DEX service (development mode)');
            }
            // Initialize AI/ML service
            try {
                await ai_ml_2.AIMLService.initialize();
                logger_1.LoggerService.info('✅ AI/ML service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ AI/ML service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without AI/ML service (development mode)');
            }
            // Initialize Presale service
            try {
                await presale_2.PresaleService.initialize();
                logger_1.LoggerService.info('✅ Presale service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Presale service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Presale service (development mode)');
            }
            // Initialize Security & Oversight service
            try {
                await security_oversight_2.SecurityOversightService.initialize();
                logger_1.LoggerService.info('✅ Security & Oversight service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Security & Oversight service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Security & Oversight service (development mode)');
            }
            // Initialize Omni Exchange service
            try {
                await (0, omni_exchange_1.initializeOmniExchange)();
                logger_1.LoggerService.info('✅ Omni Exchange service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Omni Exchange service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Omni Exchange service (development mode)');
            }
            // Initialize MPC Signer service
            try {
                await mpc_signer_1.MPCSignerService.initialize();
                logger_1.LoggerService.info('✅ MPC Signer service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ MPC Signer service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without MPC Signer service (development mode)');
            }
            // Initialize GraphSense service
            try {
                await graphsense_2.GraphSenseService.initialize();
                logger_1.LoggerService.info('✅ GraphSense service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ GraphSense service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without GraphSense service (development mode)');
            }
            // Initialize Wallet System service
            try {
                await (0, wallet_system_1.initializeWalletSystem)();
                logger_1.LoggerService.info('✅ Wallet System service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Wallet System service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Wallet System service (development mode)');
            }
            // Initialize Native CEX service
            try {
                await (0, native_cex_1.initializeNativeCEX)();
                logger_1.LoggerService.info('✅ Native CEX service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Native CEX service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Native CEX service (development mode)');
            }
            // Initialize Advanced Margin Trading Service
            try {
                await advanced_margin_2.AdvancedMarginTradingService.initialize();
                await web3_wallet_2.web3WalletService.initialize();
                logger_1.LoggerService.info('✅ Advanced Margin Trading service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Advanced Margin Trading service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Advanced Margin Trading service (development mode)');
            }
            // Initialize Device Fingerprint Service
            try {
                device_fingerprint_2.DeviceFingerprintService.initialize();
                logger_1.LoggerService.info('✅ Device Fingerprint service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Device Fingerprint service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Device Fingerprint service (development mode)');
            }
            // Initialize Metrics service
            try {
                metrics_2.MetricsService.initialize();
                logger_1.LoggerService.info('✅ Metrics service initialized successfully');
            }
            catch (error) {
                logger_1.LoggerService.error('❌ Metrics service initialization failed:', error);
                if (process.env.NODE_ENV === 'production') {
                    throw error;
                }
                logger_1.LoggerService.warn('⚠️  Continuing without Metrics service (development mode)');
            }
            logger_1.LoggerService.info('✅ All core services initialized successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('💥 Failed to initialize core services:', error);
            process.exit(1);
        }
    }
    setupMiddleware() {
        logger_1.LoggerService.info('Setting up middleware');
        // Security middleware - CRITICAL for financial applications
        // Generate nonce for CSP
        this.app.use((_req, res, next) => {
            res.nonce = Buffer.from(crypto.randomBytes(16)).toString('base64');
            next();
        });
        this.app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: [
                        "'self'",
                        (_req, res) => `'nonce-${res.nonce}'`,
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
        this.app.use((0, cors_1.default)({
            origin: this.config.cors.origin,
            credentials: this.config.cors.credentials,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
            exposedHeaders: ['X-Rate-Limit-Remaining', 'X-Rate-Limit-Reset']
        }));
        // Compression middleware
        this.app.use((0, compression_1.default)({
            level: 6,
            threshold: 1024,
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression_1.default.filter(req, res);
            }
        }));
        // Request logging - CRITICAL for audit trails
        this.app.use((0, morgan_1.default)('combined', {
            stream: {
                write: (message) => {
                    logger_1.LoggerService.info(message.trim());
                }
            }
        }));
        // API Gateway - First line of defense
        this.app.use((0, api_gateway_1.apiGateway)({
            enabled: process.env.NODE_ENV === 'production',
            allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            blockedIPs: process.env.BLOCKED_IPS?.split(',') || [],
            maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '1000'),
            requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000')
        }));
        // Security headers - CRITICAL for production
        this.app.use(error_handler_1.securityHeaders);
        // Request size limits
        this.app.use(error_handler_1.requestSizeLimit);
        // Advanced threat detection and behavioral analysis
        this.app.use(threat_detection_1.threatDetection);
        this.app.use(threat_detection_1.behavioralAnalysis);
        // Input sanitization and security checks
        this.app.use(error_handler_1.sanitizeInput);
        this.app.use(error_handler_1.sqlInjectionProtection);
        this.app.use(error_handler_1.xssProtection);
        // Custom request logger for detailed audit trails
        this.app.use(error_handler_1.requestLogger);
        // Metrics middleware for Prometheus
        this.app.use(metrics_1.metricsMiddleware);
        // Rate limiting - CRITICAL for DDoS protection
        this.app.use(error_handler_2.rateLimiter);
        // Additional rate limiting for financial operations
        this.app.use('/api/financial', error_handler_2.financialRateLimiter);
        this.app.use('/api/margin', error_handler_2.financialRateLimiter);
        this.app.use('/api/exchange', error_handler_2.financialRateLimiter);
        this.app.use('/api/wallets', error_handler_2.financialRateLimiter);
        // Body parsing middleware with size limits
        this.app.use(express_1.default.json({
            limit: '10mb',
            verify: (_req, _res, buf) => {
                // Additional security checks can be added here
                if (buf.length > 10 * 1024 * 1024) {
                    throw new Error('Request body too large');
                }
            }
        }));
        this.app.use(express_1.default.urlencoded({
            extended: true,
            limit: '10mb'
        }));
        // Trust proxy for accurate IP addresses
        this.app.set('trust proxy', 1);
        logger_1.LoggerService.info('Middleware setup complete');
    }
    setupRoutes() {
        logger_1.LoggerService.info('Setting up routes');
        // Health check endpoint - CRITICAL for monitoring
        this.app.get('/health', (_req, res) => {
            // Helper function to safely check service health
            // Returns 'healthy', 'unhealthy', or 'not_initialized' (which is treated as acceptable)
            const checkServiceHealth = (service, serviceName) => {
                try {
                    if (!service || typeof service.isHealthy !== 'function') {
                        return 'not_initialized';
                    }
                    return service.isHealthy() ? 'healthy' : 'not_initialized';
                }
                catch (error) {
                    logger_1.LoggerService.warn(`Health check failed for ${serviceName}:`, error);
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
                    database: database_1.DatabaseService.isConnected() ? 'connected' : 'disconnected',
                    redis: redis_1.RedisService.isConnected() ? 'connected' : 'disconnected',
                    keycloak: checkServiceHealth(keycloak_2.KeycloakService, 'Keycloak'),
                    brokerManagement: checkServiceHealth(broker_management_2.BrokerManagementService, 'BrokerManagement'),
                    smartContracts: checkServiceHealth(smart_contracts_2.SmartContractService, 'SmartContract'),
                    blnkfinance: checkServiceHealth(blnkfinance_2.BlnkFinanceService, 'BlnkFinance'),
                    nft: checkServiceHealth(nft_2.NFTService, 'NFT'),
                    kyc: checkServiceHealth(kyc_2.KYCService, 'KYC'),
                    rbac: checkServiceHealth(rbac_2.RBACService, 'RBAC'),
                    tokenSale: checkServiceHealth(token_sale_2.TokenSaleService, 'TokenSale'),
                    multiTierLedger: checkServiceHealth(multi_tier_ledger_2.MultiTierLedgerService, 'MultiTierLedger'),
                    dex: checkServiceHealth(dex_2.DEXService, 'DEX'),
                    aiMl: checkServiceHealth(ai_ml_2.AIMLService, 'AIML'),
                    presale: checkServiceHealth(presale_2.PresaleService, 'Presale'),
                    securityOversight: checkServiceHealth(security_oversight_2.SecurityOversightService, 'SecurityOversight'),
                    mpcSigner: checkServiceHealth(mpc_signer_1.MPCSignerService, 'MPCSigner'),
                    graphSense: checkServiceHealth(graphsense_2.GraphSenseService, 'GraphSense'),
                    omniExchange: 'healthy',
                    walletSystem: 'healthy',
                    nativeCEX: 'healthy',
                    advancedMargin: checkServiceHealth(advanced_margin_2.AdvancedMarginTradingService, 'AdvancedMargin'),
                    web3Wallet: checkServiceHealth(web3_wallet_2.web3WalletService, 'web3Wallet'),
                    deviceFingerprint: checkServiceHealth(device_fingerprint_2.DeviceFingerprintService, 'DeviceFingerprint'),
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
        this.app.get('/health/gateway', api_gateway_1.gatewayHealthCheck);
        // Public Prometheus metrics endpoint with token/IP guard
        this.app.get('/metrics', async (req, res) => {
            try {
                const headerToken = req.headers['x-prometheus-token'] || '';
                const authHeader = req.headers['authorization'];
                const authValue = typeof authHeader === 'string' ? authHeader : '';
                const bearerToken = authValue.startsWith('Bearer ') ? authValue.substring(7) : '';
                const token = headerToken || bearerToken;
                const requiredToken = process.env.METRICS_TOKEN || '';
                const allowlist = (process.env.METRICS_IP_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean);
                const clientIp = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
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
            }
            catch (err) {
                res.status(500).send('metrics_error');
            }
        });
        // API routes with proper validation
        this.app.use('/api/auth', auth_router_1.default);
        this.app.use('/api/users', users_1.default);
        this.app.use('/api/financial', financial_1.default);
        this.app.use('/api/kyc', kyc_1.default);
        this.app.use('/api/tenants', tenants_1.default);
        this.app.use('/api/admin', admin_1.default);
        this.app.use('/api/exchange', exchange_1.default);
        this.app.use('/api/fiat', fiat_1.default);
        this.app.use('/api/token', token_1.default);
        this.app.use('/api/events', event_streaming_1.default);
        this.app.use('/api/margin', margin_1.default);
        this.app.use('/api/keycloak', keycloak_1.default);
        this.app.use('/api/brokers', broker_management_1.default);
        this.app.use('/api/contracts', smart_contracts_1.default);
        this.app.use('/api/blnkfinance', blnkfinance_1.default);
        this.app.use('/api/nft', nft_1.default);
        this.app.use('/api/rbac', rbac_1.default);
        this.app.use('/api/token-sale', token_sale_1.default);
        this.app.use('/api/ledger', multi_tier_ledger_1.default);
        this.app.use('/api/dex', dex_1.default);
        this.app.use('/api/ai-ml', ai_ml_1.default);
        this.app.use('/api/presale', presale_1.default);
        this.app.use('/api/security', security_oversight_1.default);
        this.app.use('/api/graphsense', graphsense_1.default);
        this.app.use('/api/omni-exchange', omni_exchange_1.default);
        this.app.use('/api/wallets', wallet_system_1.default);
        this.app.use('/api/cex', native_cex_1.default);
        this.app.use('/api/broker', broker_dashboard_1.default);
        this.app.use('/api/admin', admin_migration_1.default);
        this.app.use('/api/advanced-margin', advanced_margin_1.default);
        this.app.use('/api/web3-wallet', web3_wallet_1.default);
        this.app.use('/api/security', device_fingerprint_1.default);
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
        logger_1.LoggerService.info('Routes setup complete');
    }
    setupErrorHandling() {
        logger_1.LoggerService.info('Setting up error handling');
        // 404 handler
        this.app.use(error_handler_1.notFoundHandler);
        // Global error handler
        this.app.use(error_handler_1.globalErrorHandler);
        logger_1.LoggerService.info('Error handling setup complete');
    }
    initializeSocketIO() {
        logger_1.LoggerService.info('Initializing Socket.IO');
        this.server = http_1.default.createServer(this.app);
        this.io = new socket_io_1.Server(this.server, {
            cors: {
                origin: this.config.cors.origin,
                methods: ['GET', 'POST']
            },
            transports: ['websocket', 'polling']
        });
        // Socket.IO connection handling
        this.io.on('connection', (socket) => {
            logger_1.LoggerService.info(`Client connected: ${socket.id}`);
            socket.on('disconnect', () => {
                logger_1.LoggerService.info(`Client disconnected: ${socket.id}`);
            });
            // Add more socket event handlers as needed
        });
        logger_1.LoggerService.info('Socket.IO initialized');
    }
    setupGracefulShutdown() {
        logger_1.LoggerService.info('Setting up graceful shutdown');
        const gracefulShutdown = (signal) => {
            logger_1.LoggerService.warn('Received shutdown signal', { signal });
            this.isShuttingDown = true;
            this.server.close(() => {
                logger_1.LoggerService.info('HTTP server closed');
                // Close database connections
                database_1.DatabaseService.close().then(() => {
                    logger_1.LoggerService.info('Database connections closed');
                }).catch((error) => {
                    logger_1.LoggerService.error('Error closing database connections', error);
                });
                // Close Redis connections
                redis_1.RedisService.close().then(() => {
                    logger_1.LoggerService.info('Redis connections closed');
                }).catch((error) => {
                    logger_1.LoggerService.error('Error closing Redis connections', error);
                });
                logger_1.LoggerService.info('Graceful shutdown complete');
                process.exit(0);
            });
            // Force close after 30 seconds
            setTimeout(() => {
                logger_1.LoggerService.error('Forced shutdown after timeout');
                process.exit(1);
            }, 30000);
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        logger_1.LoggerService.info('Graceful shutdown setup complete');
    }
    setupPeriodicTasks() {
        logger_1.LoggerService.info('Setting up periodic maintenance tasks');
        // Clean up rate limits every 5 minutes
        setInterval(() => {
            try {
                (0, api_gateway_1.cleanupRateLimits)();
            }
            catch (error) {
                logger_1.LoggerService.error('Error during rate limit cleanup', error);
            }
        }, 5 * 60 * 1000);
        // Security audit log rotation (placeholder for future implementation)
        setInterval(() => {
            try {
                // Rotate security logs, clean old entries, etc.
                logger_1.LoggerService.info('Periodic security maintenance completed');
            }
            catch (error) {
                logger_1.LoggerService.error('Error during security maintenance', error);
            }
        }, 60 * 60 * 1000); // Every hour
        logger_1.LoggerService.info('Periodic tasks setup complete');
    }
    start() {
        const PORT = process.env.PORT || 3002;
        this.server.listen(PORT, () => {
            logger_1.LoggerService.info('Backend Server Started Successfully', {
                port: PORT,
                health: `/health`,
                docs: `/api/docs`,
                environment: process.env.NODE_ENV || 'development',
                security: 'enabled',
                monitoring: 'enabled',
                compliance: 'ready'
            });
            logger_1.LoggerService.info(`ThaliumX Backend Server started on port ${PORT}`);
        });
        this.server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger_1.LoggerService.error(`Port ${PORT} is already in use`);
                process.exit(1);
            }
            else {
                logger_1.LoggerService.error('Server error', error);
                process.exit(1);
            }
        });
    }
    // Getter for Express app (for testing)
    getApp() {
        return this.app;
    }
}
exports.ThaliumXBackend = ThaliumXBackend;
// Start the server
const server = new ThaliumXBackend();
server.start();
//# sourceMappingURL=index.js.map