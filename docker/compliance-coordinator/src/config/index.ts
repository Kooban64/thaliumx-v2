/**
 * Compliance Coordinator Configuration
 */

import type { CoordinatorConfig } from '../types/coordinator';

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
  return value.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
}

/**
 * Parse submission endpoints from environment
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
export function buildConfig(): CoordinatorConfig {
  const environment = getEnv('NODE_ENV', 'development') as CoordinatorConfig['environment'];
  const port = getEnvInt('PORT', 3005);

  return {
    serviceName: getEnv('SERVICE_NAME', 'compliance-coordinator'),
    version: getEnv('SERVICE_VERSION', '1.0.0'),
    environment,
    logLevel: getEnv('LOG_LEVEL', 'info') as CoordinatorConfig['logLevel'],

    server: {
      host: getEnv('HOST', '0.0.0.0'),
      port,
      corsOrigins: getEnvArray('CORS_ORIGINS', ['http://localhost:3000']),
    },

    database: {
      host: getEnv('DB_HOST', 'localhost'),
      port: getEnvInt('DB_PORT', 5432),
      database: getEnv('DB_NAME', 'compliance_coordinator'),
      user: getEnv('DB_USER', 'postgres'),
      password: getEnv('DB_PASSWORD', ''),
      ssl: getEnvBool('DB_SSL', environment === 'production'),
      maxConnections: getEnvInt('DB_MAX_CONNECTIONS', 20),
    },

    kafka: {
      brokers: getEnvArray('KAFKA_BROKERS', ['localhost:9092']),
      clientId: getEnv('KAFKA_CLIENT_ID', 'compliance-coordinator'),
      groupId: getEnv('KAFKA_GROUP_ID', 'compliance-coordinator-group'),
    },

    services: {
      cex: {
        url: getEnv('CEX_COMPLIANCE_URL', 'http://localhost:3001'),
        enabled: getEnvBool('CEX_COMPLIANCE_ENABLED', true),
      },
      dex: {
        url: getEnv('DEX_COMPLIANCE_URL', 'http://localhost:3002'),
        enabled: getEnvBool('DEX_COMPLIANCE_ENABLED', true),
      },
      nft: {
        url: getEnv('NFT_COMPLIANCE_URL', 'http://localhost:3003'),
        enabled: getEnvBool('NFT_COMPLIANCE_ENABLED', true),
      },
      token: {
        url: getEnv('TOKEN_COMPLIANCE_URL', 'http://localhost:3004'),
        enabled: getEnvBool('TOKEN_COMPLIANCE_ENABLED', true),
      },
      chainanalysis: {
        url: getEnv('CHAINANALYSIS_URL', 'http://thaliumx-compliance-chainanalysis:3011'),
        enabled: getEnvBool('CHAINANALYSIS_ENABLED', true),
      },
    },

    reporting: {
      defaultFormat: getEnv('REPORTING_DEFAULT_FORMAT', 'json') as 'json' | 'pdf' | 'csv',
      retentionDays: getEnvInt('REPORTING_RETENTION_DAYS', 365),
      autoGenerateDaily: getEnvBool('REPORTING_AUTO_DAILY', true),
      autoGenerateWeekly: getEnvBool('REPORTING_AUTO_WEEKLY', true),
      autoGenerateMonthly: getEnvBool('REPORTING_AUTO_MONTHLY', true),
    },

    regulatory: {
      jurisdictions: getEnvArray('REGULATORY_JURISDICTIONS', ['US', 'EU', 'UK', 'SG']),
      autoSubmit: getEnvBool('REGULATORY_AUTO_SUBMIT', false),
      submissionEndpoints: parseSubmissionEndpoints(),
    },

    alerts: {
      enabled: getEnvBool('ALERTS_ENABLED', true),
      emailNotifications: getEnvBool('ALERTS_EMAIL_ENABLED', false),
      slackNotifications: getEnvBool('ALERTS_SLACK_ENABLED', false),
      webhookUrl: process.env['ALERTS_WEBHOOK_URL'],
    },
  };
}

/**
 * Singleton configuration instance
 */
let configInstance: CoordinatorConfig | null = null;

/**
 * Get configuration instance
 */
export function getConfig(): CoordinatorConfig {
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
export function validateConfig(config: CoordinatorConfig): string[] {
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

  // Validate at least one service is enabled
  const enabledServices = Object.values(config.services).filter((s) => s.enabled);
  if (enabledServices.length === 0) {
    errors.push('At least one compliance service must be enabled');
  }

  return errors;
}

export default getConfig;
