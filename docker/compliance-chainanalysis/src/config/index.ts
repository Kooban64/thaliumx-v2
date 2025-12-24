/**
 * Configuration management for ChainAnalysis service
 */

import { z } from 'zod';

// Environment schema
const configSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  server: z.object({
    host: z.string().default('0.0.0.0'),
    port: z.number().default(3011),
    corsOrigins: z.array(z.string()).default(['http://localhost:3000']),
  }),
  database: z.object({
    url: z.string().default('postgresql://chainanalysis:password@localhost:5432/chainanalysis'),
    poolSize: z.number().default(10),
    ssl: z.boolean().default(false),
  }),
  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
    password: z.string().optional(),
  }),
  kafka: z.object({
    brokers: z.array(z.string()).default(['localhost:9092']),
    clientId: z.string().default('chainanalysis-service'),
    groupId: z.string().default('chainanalysis-group'),
  }),
  graphsense: z.object({
    apiUrl: z.string().default('http://graphsense:8080'),
    username: z.string().optional(),
    password: z.string().optional(),
    timeout: z.number().default(30000),
  }),
  rpc: z.object({
    ethereum: z.object({
      url: z.string().default('https://mainnet.infura.io/v3/YOUR_PROJECT_ID'),
      timeout: z.number().default(10000),
    }),
    bitcoin: z.object({
      url: z.string().default('https://btc-mainnet.infura.io/v3/YOUR_PROJECT_ID'),
      timeout: z.number().default(10000),
    }),
    polygon: z.object({
      url: z.string().default('https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID'),
      timeout: z.number().default(10000),
    }),
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    format: z.enum(['json', 'simple']).default('json'),
  }),
  security: z.object({
    jwtSecret: z.string().default('your-jwt-secret'),
    apiKey: z.string().optional(),
  }),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  return configSchema.parse({
    environment: process.env['NODE_ENV'] || 'development',
    server: {
      host: process.env['SERVER_HOST'] || '0.0.0.0',
      port: parseInt(process.env['SERVER_PORT'] || '3011', 10),
      corsOrigins: (process.env['CORS_ORIGINS'] || 'http://localhost:3000').split(','),
    },
    database: {
      url: process.env['POSTGRES_URL'] || 'postgresql://chainanalysis:password@localhost:5432/chainanalysis',
      poolSize: parseInt(process.env['DB_POOL_SIZE'] || '10', 10),
      ssl: process.env['DB_SSL'] === 'true',
    },
    redis: {
      url: process.env['REDIS_URL'] || 'redis://localhost:6379',
      password: process.env['REDIS_PASSWORD'],
    },
    kafka: {
      brokers: (process.env['KAFKA_BROKERS'] || 'localhost:9092').split(','),
      clientId: process.env['KAFKA_CLIENT_ID'] || 'chainanalysis-service',
      groupId: process.env['KAFKA_GROUP_ID'] || 'chainanalysis-group',
    },
    graphsense: {
      apiUrl: process.env['GRAPHSENSE_API_URL'] || 'http://graphsense:8080',
      username: process.env['GRAPHSENSE_USERNAME'],
      password: process.env['GRAPHSENSE_PASSWORD'],
      timeout: parseInt(process.env['GRAPHSENSE_TIMEOUT'] || '30000', 10),
    },
    rpc: {
      ethereum: {
        url: process.env['INFURA_ETH_URL'] || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
        timeout: parseInt(process.env['ETH_RPC_TIMEOUT'] || '10000', 10),
      },
      bitcoin: {
        url: process.env['INFURA_BTC_URL'] || 'https://btc-mainnet.infura.io/v3/YOUR_PROJECT_ID',
        timeout: parseInt(process.env['BTC_RPC_TIMEOUT'] || '10000', 10),
      },
      polygon: {
        url: process.env['INFURA_POLYGON_URL'] || 'https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID',
        timeout: parseInt(process.env['POLYGON_RPC_TIMEOUT'] || '10000', 10),
      },
    },
    logging: {
      level: (process.env['LOG_LEVEL'] as 'error' | 'warn' | 'info' | 'debug') || 'info',
      format: (process.env['LOG_FORMAT'] as 'json' | 'simple') || 'json',
    },
    security: {
      jwtSecret: process.env['JWT_SECRET'] || 'your-jwt-secret',
      apiKey: process.env['API_KEY'],
    },
  });
}

/**
 * Get configuration (cached)
 */
let configCache: Config | null = null;

export function getConfig(): Config {
  if (!configCache) {
    configCache = loadConfig();
  }
  return configCache;
}

/**
 * Validate configuration
 */
export function validateConfig(config: Config): string[] {
  const errors: string[] = [];

  // Check required configurations
  if (!config.database.url) {
    errors.push('Database URL is required');
  }

  if (!config.graphsense.apiUrl) {
    errors.push('GraphSense API URL is required');
  }

  if (!config.rpc.ethereum.url || config.rpc.ethereum.url.includes('YOUR_PROJECT_ID')) {
    errors.push('Valid Ethereum RPC URL is required');
  }

  if (!config.security.jwtSecret || config.security.jwtSecret.length < 10) {
    errors.push('JWT secret must be configured and at least 10 characters long');
  }

  return errors;
}