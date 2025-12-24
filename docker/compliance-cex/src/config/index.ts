/**
 * Configuration Management for CEX Compliance Service
 * Enterprise-grade configuration with validation and environment support
 */

import { z } from 'zod';
import { ComplianceConfig } from '../types/compliance';

// ==================== CONFIGURATION SCHEMAS ====================

/**
 * Environment variables schema
 */
const envSchema = z.object({
  // Service Configuration
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  SERVICE_NAME: z.string().default('cex-compliance-service'),
  SERVICE_VERSION: z.string().default('1.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Database Configuration
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_NAME: z.string().default('thaliumx_compliance'),
  DATABASE_USER: z.string().default('compliance_user'),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_SSL: z.coerce.boolean().default(false),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(20),

  // Redis Configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).default(0),

  // Kafka Configuration
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('cex-compliance-service'),
  KAFKA_GROUP_ID: z.string().default('cex-compliance-group'),
  KAFKA_SSL: z.coerce.boolean().default(false),
  KAFKA_SSL_CA: z.string().optional(),
  KAFKA_SASL_MECHANISM: z.string().optional(),
  KAFKA_SASL_USERNAME: z.string().optional(),
  KAFKA_SASL_PASSWORD: z.string().optional(),

  // Risk Assessment Configuration
  RISK_LOW_THRESHOLD: z.coerce.number().min(0).max(100).default(30),
  RISK_MEDIUM_THRESHOLD: z.coerce.number().min(0).max(100).default(60),
  RISK_HIGH_THRESHOLD: z.coerce.number().min(0).max(100).default(80),

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

  // Keycloak Configuration
  KEYCLOAK_URL: z.string().url().default('http://localhost:8080'),
  KEYCLOAK_REALM: z.string().default('thaliumx'),
  KEYCLOAK_CLIENT_ID: z.string().default('thaliumx-compliance-cex'),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),
  KEYCLOAK_CLIENT_SECRET_FILE: z.string().optional(),

  // External Services
  VASPS_REGISTRY_URL: z.string().url().optional(),
  SANCTIONS_CHECK_URL: z.string().url().optional(),
  REGULATORY_API_BASE_URL: z.string().url().optional(),
});

/**
 * Parsed environment variables
 */
const env = envSchema.parse(process.env);

// ==================== CONFIGURATION OBJECT ====================

/**
 * Main configuration object
 */
export const config: ComplianceConfig = {
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
    ...(env.KAFKA_SSL && { ssl: env.KAFKA_SSL }),
    ...(env.KAFKA_SSL_CA && { sslCa: env.KAFKA_SSL_CA }),
    ...(env.KAFKA_SASL_MECHANISM && { saslMechanism: env.KAFKA_SASL_MECHANISM }),
    ...(env.KAFKA_SASL_USERNAME && { saslUsername: env.KAFKA_SASL_USERNAME }),
    ...(env.KAFKA_SASL_PASSWORD && { saslPassword: env.KAFKA_SASL_PASSWORD }),
  },

  keycloak: {
    url: env.KEYCLOAK_URL,
    realm: env.KEYCLOAK_REALM,
    clientId: env.KEYCLOAK_CLIENT_ID,
    clientSecret: env.KEYCLOAK_CLIENT_SECRET_FILE
      ? require('fs').readFileSync(env.KEYCLOAK_CLIENT_SECRET_FILE, 'utf8').trim()
      : env.KEYCLOAK_CLIENT_SECRET,
  },

  riskThresholds: {
    low: env.RISK_LOW_THRESHOLD,
    medium: env.RISK_MEDIUM_THRESHOLD,
    high: env.RISK_HIGH_THRESHOLD,
    critical: 100,
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
 * Jurisdiction-specific configuration overrides
 */
interface JurisdictionOverride {
  travelRuleThreshold?: number;
  carfReportingPeriodDays?: number;
}

/**
 * Get configuration for a specific jurisdiction
 */
export function getJurisdictionConfig(jurisdiction: string): JurisdictionOverride {
  // Jurisdiction-specific overrides can be implemented here
  const overrides: Record<string, JurisdictionOverride> = {
    'US': {
      travelRuleThreshold: 3000,
      carfReportingPeriodDays: 365,
    },
    'EU': {
      travelRuleThreshold: 1000,
      carfReportingPeriodDays: 365,
    },
    'CA': {
      travelRuleThreshold: 1000,
      carfReportingPeriodDays: 365,
    },
  };

  return overrides[jurisdiction] || {};
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: 'travelRule' | 'carf'): boolean {
  if (feature === 'travelRule') {
    return config.travelRule.enabled;
  }
  if (feature === 'carf') {
    return config.carf.enabled;
  }
  return false;
}

/**
 * Get threshold value for a jurisdiction
 */
export function getThreshold(feature: string, jurisdiction?: string): number | undefined {
  if (!jurisdiction) {
    if (feature === 'travelRule') return config.travelRule.thresholdAmount;
    if (feature === 'riskLow') return config.riskThresholds.low;
    if (feature === 'riskMedium') return config.riskThresholds.medium;
    if (feature === 'riskHigh') return config.riskThresholds.high;
    return undefined;
  }

  const jurisdictionConfig = getJurisdictionConfig(jurisdiction);
  if (feature === 'travelRule') return jurisdictionConfig.travelRuleThreshold;
  if (feature === 'carf') return jurisdictionConfig.carfReportingPeriodDays;
  return undefined;
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