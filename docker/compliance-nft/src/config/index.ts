/**
 * NFT Compliance Service Configuration
 * Environment-based configuration management
 */

import type { NFTComplianceConfig } from '../types/compliance';

function hasNonEmptyValue(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function parseJsonRecord(value: string, envKey: string): Record<string, string> {
  const parsed: unknown = JSON.parse(value);

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Environment variable ${envKey} must be a JSON object`);
  }

  const entries = Object.entries(parsed);
  for (const [entryKey, entryValue] of entries) {
    if (typeof entryValue !== 'string') {
      throw new Error(`Environment variable ${envKey} must contain only string values. Invalid key: ${entryKey}`);
    }
  }

  return Object.fromEntries(entries) as Record<string, string>;
}

function parseProvidersJson(value: string): NFTComplianceConfig['blockchain']['providers'] {
  const parsed: unknown = JSON.parse(value);

  if (!Array.isArray(parsed)) {
    throw new Error('Environment variable BLOCKCHAIN_PROVIDERS must be a JSON array');
  }

  return parsed.map((provider, index) => {
    if (provider === null || typeof provider !== 'object' || Array.isArray(provider)) {
      throw new Error(`BLOCKCHAIN_PROVIDERS[${index}] must be an object`);
    }

    const candidate = provider as Record<string, unknown>;
    const { chainId, name, rpcUrl, wsUrl } = candidate;

    if (typeof chainId !== 'number' || !Number.isInteger(chainId)) {
      throw new Error(`BLOCKCHAIN_PROVIDERS[${index}].chainId must be an integer`);
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error(`BLOCKCHAIN_PROVIDERS[${index}].name must be a non-empty string`);
    }

    if (typeof rpcUrl !== 'string' || rpcUrl.trim().length === 0) {
      throw new Error(`BLOCKCHAIN_PROVIDERS[${index}].rpcUrl must be a non-empty string`);
    }

    if (wsUrl !== undefined && (typeof wsUrl !== 'string' || wsUrl.trim().length === 0)) {
      throw new Error(`BLOCKCHAIN_PROVIDERS[${index}].wsUrl must be a non-empty string when provided`);
    }

    return {
      chainId,
      name,
      rpcUrl,
      ...(typeof wsUrl === 'string' ? { wsUrl } : {}),
    };
  });
}

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
function parseBlockchainProviders(): NFTComplianceConfig['blockchain']['providers'] {
  const providersJson = process.env['BLOCKCHAIN_PROVIDERS'];
  if (hasNonEmptyValue(providersJson)) {
    return parseProvidersJson(providersJson);
  }

  // Default providers for common NFT chains
  const providers: NFTComplianceConfig['blockchain']['providers'] = [];
  
  const ethWsUrl = process.env['ETH_WS_URL'];
  providers.push({
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: getEnv('ETH_RPC_URL', 'https://eth.llamarpc.com'),
    ...(hasNonEmptyValue(ethWsUrl) ? { wsUrl: ethWsUrl } : {}),
  });
  
  const polygonWsUrl = process.env['POLYGON_WS_URL'];
  providers.push({
    chainId: 137,
    name: 'Polygon',
    rpcUrl: getEnv('POLYGON_RPC_URL', 'https://polygon.llamarpc.com'),
    ...(hasNonEmptyValue(polygonWsUrl) ? { wsUrl: polygonWsUrl } : {}),
  });
  
  const arbitrumWsUrl = process.env['ARBITRUM_WS_URL'];
  providers.push({
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: getEnv('ARBITRUM_RPC_URL', 'https://arbitrum.llamarpc.com'),
    ...(hasNonEmptyValue(arbitrumWsUrl) ? { wsUrl: arbitrumWsUrl } : {}),
  });
  
  const optimismWsUrl = process.env['OPTIMISM_WS_URL'];
  providers.push({
    chainId: 10,
    name: 'Optimism',
    rpcUrl: getEnv('OPTIMISM_RPC_URL', 'https://optimism.llamarpc.com'),
    ...(hasNonEmptyValue(optimismWsUrl) ? { wsUrl: optimismWsUrl } : {}),
  });
  
  const bscWsUrl = process.env['BSC_WS_URL'];
  providers.push({
    chainId: 56,
    name: 'BNB Chain',
    rpcUrl: getEnv('BSC_RPC_URL', 'https://bsc.llamarpc.com'),
    ...(hasNonEmptyValue(bscWsUrl) ? { wsUrl: bscWsUrl } : {}),
  });
  
  const baseWsUrl = process.env['BASE_WS_URL'];
  providers.push({
    chainId: 8453,
    name: 'Base',
    rpcUrl: getEnv('BASE_RPC_URL', 'https://base.llamarpc.com'),
    ...(hasNonEmptyValue(baseWsUrl) ? { wsUrl: baseWsUrl } : {}),
  });
  
  return providers;
}

/**
 * Parse regulatory submission endpoints from environment
 */
function parseSubmissionEndpoints(): Record<string, string> {
  const endpointsJson = process.env['REGULATORY_SUBMISSION_ENDPOINTS'];
  if (hasNonEmptyValue(endpointsJson)) {
    return parseJsonRecord(endpointsJson, 'REGULATORY_SUBMISSION_ENDPOINTS');
  }
  return {};
}

/**
 * Build configuration from environment variables
 */
export function buildConfig(): NFTComplianceConfig {
  const environment = getEnv('NODE_ENV', 'development') as NFTComplianceConfig['environment'];

  return {
    serviceName: getEnv('SERVICE_NAME', 'nft-compliance-service'),
    version: getEnv('SERVICE_VERSION', '1.0.0'),
    environment,
    logLevel: getEnv('LOG_LEVEL', 'info') as NFTComplianceConfig['logLevel'],
    port: getEnvInt('PORT', 3003),

    database: {
      host: getEnv('DATABASE_HOST', 'thaliumx-postgres'),
      port: getEnvInt('DB_PORT', 5432),
      database: getEnv('DATABASE_NAME', 'nft_compliance'),
      user: getEnv('DATABASE_USER', 'thaliumx'),
      // Required: injected by Vault/secret manager in production.
      password: getEnv('DATABASE_PASSWORD'),
      ssl: getEnvBool('DATABASE_SSL', environment === 'production'),
      maxConnections: getEnvInt('DB_MAX_CONNECTIONS', 20),
    },

    redis: {
      host: getEnv('REDIS_HOST', 'localhost'),
      port: getEnvInt('REDIS_PORT', 6379),
      ...(hasNonEmptyValue(process.env['REDIS_PASSWORD']) ? { password: process.env['REDIS_PASSWORD'] } : {}),
      db: getEnvInt('REDIS_DB', 2), // Different DB from CEX and DEX
    },

    kafka: {
      brokers: getEnvArray('KAFKA_BROKERS', ['localhost:9092']),
      clientId: getEnv('KAFKA_CLIENT_ID', 'nft-compliance-service'),
      groupId: getEnv('KAFKA_GROUP_ID', 'nft-compliance-group'),
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

    contentScreening: {
      enabled: getEnvBool('CONTENT_SCREENING_ENABLED', true),
      provider: getEnv('CONTENT_SCREENING_PROVIDER', 'internal'),
      apiKey: getEnv('CONTENT_SCREENING_API_KEY', ''),
      autoFlag: getEnvBool('CONTENT_SCREENING_AUTO_FLAG', true),
    },

    washTradingDetection: {
      enabled: getEnvBool('WASH_TRADING_DETECTION_ENABLED', true),
      lookbackDays: getEnvInt('WASH_TRADING_LOOKBACK_DAYS', 30),
      minConfidence: getEnvFloat('WASH_TRADING_MIN_CONFIDENCE', 70),
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
let configInstance: NFTComplianceConfig | null = null;

/**
 * Get configuration instance
 */
export function getConfig(): NFTComplianceConfig {
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
export function validateConfig(config: NFTComplianceConfig): string[] {
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

  // Validate content screening configuration
  if (config.contentScreening.enabled && config.contentScreening.provider !== 'internal' && !config.contentScreening.apiKey) {
    errors.push('Content screening API key is required for external providers');
  }

  return errors;
}

export default getConfig;
