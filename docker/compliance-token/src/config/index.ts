/**
 * Token Compliance Service Configuration
 * Environment-based configuration management
 */

import type { TokenComplianceConfig } from '../types/compliance';

/**
 * Get environment variable with optional default
 */
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get environment variable as integer
 */
function getEnvInt(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid integer value for ${key}: ${value}`);
  }
  return parsed;
}

/**
 * Get environment variable as float
 */
function getEnvFloat(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Invalid float value for ${key}: ${value}`);
  }
  return parsed;
}

/**
 * Get environment variable as boolean
 */
function getEnvBool(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get environment variable as array
 */
function getEnvArray(key: string, defaultValue?: string[]): string[] {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Parse blockchain providers from environment
 */
function parseBlockchainProviders(): TokenComplianceConfig['blockchain']['providers'] {
  const providersJson = process.env['BLOCKCHAIN_PROVIDERS'];
  if (providersJson) {
    try {
      return JSON.parse(providersJson);
    } catch {
      // Fall back to default providers
    }
  }

  // Default providers for common token chains
  const providers: TokenComplianceConfig['blockchain']['providers'] = [
    {
      chainId: 1,
      name: 'Ethereum Mainnet',
      rpcUrl: getEnv('ETH_RPC_URL', 'https://eth.llamarpc.com'),
      ...(process.env['ETH_WS_URL'] && { wsUrl: process.env['ETH_WS_URL'] }),
    },
    {
      chainId: 137,
      name: 'Polygon',
      rpcUrl: getEnv('POLYGON_RPC_URL', 'https://polygon.llamarpc.com'),
      ...(process.env['POLYGON_WS_URL'] && { wsUrl: process.env['POLYGON_WS_URL'] }),
    },
    {
      chainId: 42161,
      name: 'Arbitrum One',
      rpcUrl: getEnv('ARBITRUM_RPC_URL', 'https://arbitrum.llamarpc.com'),
      ...(process.env['ARBITRUM_WS_URL'] && { wsUrl: process.env['ARBITRUM_WS_URL'] }),
    },
    {
      chainId: 10,
      name: 'Optimism',
      rpcUrl: getEnv('OPTIMISM_RPC_URL', 'https://optimism.llamarpc.com'),
      ...(process.env['OPTIMISM_WS_URL'] && { wsUrl: process.env['OPTIMISM_WS_URL'] }),
    },
    {
      chainId: 56,
      name: 'BNB Chain',
      rpcUrl: getEnv('BSC_RPC_URL', 'https://bsc.llamarpc.com'),
      ...(process.env['BSC_WS_URL'] && { wsUrl: process.env['BSC_WS_URL'] }),
    },
    {
      chainId: 8453,
      name: 'Base',
      rpcUrl: getEnv('BASE_RPC_URL', 'https://base.llamarpc.com'),
      ...(process.env['BASE_WS_URL'] && { wsUrl: process.env['BASE_WS_URL'] }),
    },
    {
      chainId: 43114,
      name: 'Avalanche C-Chain',
      rpcUrl: getEnv('AVAX_RPC_URL', 'https://avalanche.llamarpc.com'),
      ...(process.env['AVAX_WS_URL'] && { wsUrl: process.env['AVAX_WS_URL'] }),
    },
  ];

  return providers;
}

/**
 * Parse regulatory submission endpoints from environment
 */
function parseSubmissionEndpoints(): Record<string, string> {
  const endpointsJson = process.env['REGULATORY_SUBMISSION_ENDPOINTS'];
  if (endpointsJson) {
    try {
      return JSON.parse(endpointsJson);
    } catch {
      // Fall back to empty object
    }
  }
  return {};
}

/**
 * Build configuration from environment variables
 */
export function buildConfig(): TokenComplianceConfig {
  const environment = getEnv('NODE_ENV', 'development') as TokenComplianceConfig['environment'];

  const port = getEnvInt('PORT', 3004);

  return {
    serviceName: getEnv('SERVICE_NAME', 'token-compliance-service'),
    version: getEnv('SERVICE_VERSION', '1.0.0'),
    environment,
    logLevel: getEnv('LOG_LEVEL', 'info') as TokenComplianceConfig['logLevel'],
    port,

    server: {
      host: getEnv('HOST', '0.0.0.0'),
      port,
      corsOrigins: getEnvArray('CORS_ORIGINS', ['http://localhost:3000']),
    },

    database: {
      host: getEnv('DB_HOST', 'localhost'),
      port: getEnvInt('DB_PORT', 5432),
      database: getEnv('DB_NAME', 'token_compliance'),
      user: getEnv('DB_USER', 'postgres'),
      password: getEnv('DB_PASSWORD', ''),
      ssl: getEnvBool('DB_SSL', environment === 'production'),
      maxConnections: getEnvInt('DB_MAX_CONNECTIONS', 20),
    },

    redis: {
      host: getEnv('REDIS_HOST', 'localhost'),
      port: getEnvInt('REDIS_PORT', 6379),
      ...(process.env['REDIS_PASSWORD'] && { password: process.env['REDIS_PASSWORD'] }),
      db: getEnvInt('REDIS_DB', 3), // Different DB from other services
    },

    kafka: {
      brokers: getEnvArray('KAFKA_BROKERS', ['localhost:9092']),
      clientId: getEnv('KAFKA_CLIENT_ID', 'token-compliance-service'),
      groupId: getEnv('KAFKA_GROUP_ID', 'token-compliance-group'),
    },

    blockchain: {
      providers: parseBlockchainProviders(),
      confirmations: getEnvInt('BLOCKCHAIN_CONFIRMATIONS', 12),
      pollingInterval: getEnvInt('BLOCKCHAIN_POLLING_INTERVAL', 15000),
    },

    riskThresholds: {
      low: getEnvFloat('RISK_THRESHOLD_LOW', 25),
      medium: getEnvFloat('RISK_THRESHOLD_MEDIUM', 50),
      high: getEnvFloat('RISK_THRESHOLD_HIGH', 75),
      critical: getEnvFloat('RISK_THRESHOLD_CRITICAL', 90),
    },

    walletScreening: {
      enabled: getEnvBool('WALLET_SCREENING_ENABLED', true),
      provider: getEnv('WALLET_SCREENING_PROVIDER', 'internal'),
      apiKey: getEnv('WALLET_SCREENING_API_KEY', ''),
      cacheExpiry: getEnvInt('WALLET_SCREENING_CACHE_EXPIRY', 3600), // 1 hour
    },

    travelRule: {
      enabled: getEnvBool('TRAVEL_RULE_ENABLED', true),
      thresholdAmount: getEnvFloat('TRAVEL_RULE_THRESHOLD', 3000), // USD
      autoSend: getEnvBool('TRAVEL_RULE_AUTO_SEND', true),
      maxRetries: getEnvInt('TRAVEL_RULE_MAX_RETRIES', 3),
      retryDelayMs: getEnvInt('TRAVEL_RULE_RETRY_DELAY_MS', 60000),
    },

    carf: {
      enabled: getEnvBool('CARF_ENABLED', true),
      autoGenerate: getEnvBool('CARF_AUTO_GENERATE', true),
      reportingPeriodDays: getEnvInt('CARF_REPORTING_PERIOD_DAYS', 365),
      retentionYears: getEnvInt('CARF_RETENTION_YEARS', 7),
    },

    regulatory: {
      jurisdictions: getEnvArray('REGULATORY_JURISDICTIONS', ['US', 'EU', 'UK', 'SG']),
      autoSubmit: getEnvBool('REGULATORY_AUTO_SUBMIT', false),
      submissionEndpoints: parseSubmissionEndpoints(),
    },
  };
}

/**
 * Singleton configuration instance
 */
let configInstance: TokenComplianceConfig | null = null;

/**
 * Get configuration instance
 */
export function getConfig(): TokenComplianceConfig {
  if (!configInstance) {
    configInstance = buildConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * Validate configuration
 */
export function validateConfig(config: TokenComplianceConfig): string[] {
  const errors: string[] = [];

  // Validate database configuration
  if (!config.database.host) {
    errors.push('Database host is required');
  }
  if (!config.database.database) {
    errors.push('Database name is required');
  }
  if (!config.database.user) {
    errors.push('Database user is required');
  }

  // Validate Kafka configuration
  if (config.kafka.brokers.length === 0) {
    errors.push('At least one Kafka broker is required');
  }

  // Validate blockchain configuration
  if (config.blockchain.providers.length === 0) {
    errors.push('At least one blockchain provider is required');
  }

  // Validate risk thresholds
  if (config.riskThresholds.low >= config.riskThresholds.medium) {
    errors.push('Low risk threshold must be less than medium');
  }
  if (config.riskThresholds.medium >= config.riskThresholds.high) {
    errors.push('Medium risk threshold must be less than high');
  }
  if (config.riskThresholds.high >= config.riskThresholds.critical) {
    errors.push('High risk threshold must be less than critical');
  }

  // Validate Travel Rule configuration
  if (config.travelRule.enabled && config.travelRule.thresholdAmount <= 0) {
    errors.push('Travel Rule threshold must be positive');
  }

  // Validate wallet screening configuration
  if (config.walletScreening.enabled && config.walletScreening.provider !== 'internal' && !config.walletScreening.apiKey) {
    errors.push('Wallet screening API key is required for external providers');
  }

  return errors;
}

export default getConfig;
