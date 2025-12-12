/**
 * Configuration Management for DEX Compliance Service
 * Enterprise-grade configuration with validation and environment support
 */

import { z } from 'zod';
import { DEXComplianceConfig } from '../types/compliance';

// ==================== CONFIGURATION SCHEMAS ====================

/**
 * Environment variables schema
 */
const envSchema = z.object({
  // Service Configuration
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  SERVICE_NAME: z.string().default('dex-compliance-service'),
  SERVICE_VERSION: z.string().default('1.0.0'),
  PORT: z.coerce.number().int().positive().default(3002),

  // Database Configuration
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_NAME: z.string().default('thaliumx_compliance_dex'),
  DATABASE_USER: z.string().default('compliance_user'),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_SSL: z.coerce.boolean().default(true),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(20),

  // Redis Configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).default(1),

  // Kafka Configuration
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('dex-compliance-service'),
  KAFKA_GROUP_ID: z.string().default('dex-compliance-group'),

  // Blockchain Configuration
  BLOCKCHAIN_PROVIDERS: z.string().default('[]'), // JSON array of providers
  BLOCKCHAIN_CONFIRMATIONS: z.coerce.number().int().positive().default(12),
  BLOCKCHAIN_POLLING_INTERVAL: z.coerce.number().int().positive().default(15000),

  // Risk Assessment Configuration
  RISK_LOW_THRESHOLD: z.coerce.number().min(0).max(100).default(30),
  RISK_MEDIUM_THRESHOLD: z.coerce.number().min(0).max(100).default(60),
  RISK_HIGH_THRESHOLD: z.coerce.number().min(0).max(100).default(80),

  // Wallet Screening Configuration
  WALLET_SCREENING_ENABLED: z.coerce.boolean().default(true),
  WALLET_SCREENING_PROVIDER: z.string().default('chainalysis'),
  WALLET_SCREENING_API_KEY: z.string().optional(),
  WALLET_SCREENING_CACHE_TIMEOUT: z.coerce.number().int().positive().default(3600000), // 1 hour

  // Travel Rule Configuration
  TRAVEL_RULE_ENABLED: z.coerce.boolean().default(true),
  TRAVEL_RULE_THRESHOLD: z.coerce.number().min(0).default(3000), // USD
  TRAVEL_RULE_AUTO_SEND: z.coerce.boolean().default(false),
  TRAVEL_RULE_MAX_RETRIES: z.coerce.number().int().positive().default(3),
  TRAVEL_RULE_RETRY_DELAY_MS: z.coerce.number().int().positive().default(300000), // 5 minutes

  // CARF Configuration
  CARF_ENABLED: z.coerce.boolean().default(true),
  CARF_AUTO_GENERATE: z.coerce.boolean().default(true),
  CARF_REPORTING_PERIOD_DAYS: z.coerce.number().int().positive().default(365),
  CARF_RETENTION_YEARS: z.coerce.number().int().positive().default(7),

  // Regulatory Configuration
  REGULATORY_JURISDICTIONS: z.string().default('US,CA,EU'),
  REGULATORY_AUTO_SUBMIT: z.coerce.boolean().default(false),
  REGULATORY_SUBMISSION_ENDPOINTS: z.string().optional(),

  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Security Configuration
  JWT_SECRET: z.string().min(32),
  API_KEY: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
});

/**
 * Parsed environment variables
 */
const env = envSchema.parse(process.env);

/**
 * Parse blockchain providers from environment
 */
function parseBlockchainProviders(): DEXComplianceConfig['blockchain']['providers'] {
  try {
    const providers = JSON.parse(env.BLOCKCHAIN_PROVIDERS);
    if (Array.isArray(providers) && providers.length > 0) {
      return providers;
    }
  } catch {
    // Use default providers
  }
  
  // Default providers for development
  return [
    { chainId: 1, name: 'Ethereum Mainnet', rpcUrl: 'https://eth.llamarpc.com' },
    { chainId: 137, name: 'Polygon', rpcUrl: 'https://polygon.llamarpc.com' },
    { chainId: 42161, name: 'Arbitrum One', rpcUrl: 'https://arb1.arbitrum.io/rpc' },
    { chainId: 10, name: 'Optimism', rpcUrl: 'https://mainnet.optimism.io' },
    { chainId: 56, name: 'BNB Chain', rpcUrl: 'https://bsc-dataseed.binance.org' },
  ];
}

// ==================== CONFIGURATION OBJECT ====================

/**
 * Main configuration object
 */
export const config: DEXComplianceConfig = {
  serviceName: env.SERVICE_NAME,
  version: env.SERVICE_VERSION,
  environment: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
  port: env.PORT,

  database: {
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    database: env.DATABASE_NAME,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    ssl: env.DATABASE_SSL,
    maxConnections: env.DATABASE_MAX_CONNECTIONS,
  },

  redis: env.REDIS_PASSWORD !== undefined
    ? {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        db: env.REDIS_DB,
      }
    : {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        db: env.REDIS_DB,
      },

  kafka: {
    brokers: env.KAFKA_BROKERS.split(','),
    clientId: env.KAFKA_CLIENT_ID,
    groupId: env.KAFKA_GROUP_ID,
  },

  blockchain: {
    providers: parseBlockchainProviders(),
    confirmations: env.BLOCKCHAIN_CONFIRMATIONS,
    pollingInterval: env.BLOCKCHAIN_POLLING_INTERVAL,
  },

  riskThresholds: {
    low: env.RISK_LOW_THRESHOLD,
    medium: env.RISK_MEDIUM_THRESHOLD,
    high: env.RISK_HIGH_THRESHOLD,
    critical: 100,
  },

  walletScreening: {
    enabled: env.WALLET_SCREENING_ENABLED,
    provider: env.WALLET_SCREENING_PROVIDER,
    apiKey: env.WALLET_SCREENING_API_KEY ?? '',
    cacheTimeout: env.WALLET_SCREENING_CACHE_TIMEOUT,
  },

  travelRule: {
    enabled: env.TRAVEL_RULE_ENABLED,
    thresholdAmount: env.TRAVEL_RULE_THRESHOLD,
    autoSend: env.TRAVEL_RULE_AUTO_SEND,
    maxRetries: env.TRAVEL_RULE_MAX_RETRIES,
    retryDelayMs: env.TRAVEL_RULE_RETRY_DELAY_MS,
  },

  carf: {
    enabled: env.CARF_ENABLED,
    autoGenerate: env.CARF_AUTO_GENERATE,
    reportingPeriodDays: env.CARF_REPORTING_PERIOD_DAYS,
    retentionYears: env.CARF_RETENTION_YEARS,
  },

  regulatory: {
    jurisdictions: env.REGULATORY_JURISDICTIONS.split(','),
    autoSubmit: env.REGULATORY_AUTO_SUBMIT,
    submissionEndpoints: env.REGULATORY_SUBMISSION_ENDPOINTS
      ? JSON.parse(env.REGULATORY_SUBMISSION_ENDPOINTS)
      : {},
  },
};

// ==================== CONFIGURATION VALIDATION ====================

/**
 * Validate configuration on startup
 */
export function validateConfig(): void {
  try {
    // Validate risk thresholds are in correct order
    const { low, medium, high } = config.riskThresholds;
    if (low >= medium || medium >= high) {
      throw new Error('Risk thresholds must be in ascending order: low < medium < high');
    }

    // Validate database connection parameters
    if (config.database.password.length < 8) {
      throw new Error('Database password must be at least 8 characters long');
    }

    // Validate blockchain providers
    if (config.blockchain.providers.length === 0) {
      throw new Error('At least one blockchain provider must be configured');
    }

    // Validate regulatory jurisdictions
    const validJurisdictions = ['US', 'CA', 'EU', 'UK', 'AU', 'JP', 'SG'];
    for (const jurisdiction of config.regulatory.jurisdictions) {
      if (!validJurisdictions.includes(jurisdiction)) {
        throw new Error(`Invalid jurisdiction: ${jurisdiction}. Valid jurisdictions: ${validJurisdictions.join(', ')}`);
      }
    }

    console.log('✅ Configuration validation passed');
  } catch (error) {
    console.error('❌ Configuration validation failed:', error);
    throw error;
  }
}

// ==================== CONFIGURATION UTILITIES ====================

/**
 * Get chain configuration by chain ID
 */
export function getChainConfig(chainId: number): DEXComplianceConfig['blockchain']['providers'][0] | undefined {
  return config.blockchain.providers.find((p) => p.chainId === chainId);
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return config.blockchain.providers.some((p) => p.chainId === chainId);
}

/**
 * Get supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return config.blockchain.providers.map((p) => p.chainId);
}

// ==================== ENVIRONMENT HELPERS ====================

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return config.environment === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return config.environment === 'development';
}

/**
 * Get current environment
 */
export function getEnvironment(): string {
  return config.environment;
}

// Validate configuration on module load
validateConfig();
