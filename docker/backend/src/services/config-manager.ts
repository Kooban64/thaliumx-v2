/**
 * Configuration Manager
 * 
 * Alternative configuration management interface (legacy/complementary to ConfigService).
 * 
 * Features:
 * - Type-safe configuration interface
 * - Environment variable loading
 * - Configuration validation
 * - Type definitions for all configuration sections
 * 
 * Configuration Sections:
 * - Server: Port, host, environment, trust proxy
 * - Database: Connection settings, pool configuration
 * - Redis: Connection settings, key prefix
 * - JWT: Secret, expiration, issuer
 * - And other service configurations
 * 
 * Note: This service provides type definitions and interfaces.
 * Actual configuration loading is handled by ConfigService.
 */

import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from './logger';

// Load environment variables
dotenv.config();

export interface AppConfiguration {
  // Server Configuration
  server: {
    port: number;
    host: string;
    environment: 'development' | 'staging' | 'production';
    trustProxy: boolean;
  };

  // Database Configuration
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
    pool: {
      max: number;
      min: number;
      acquire: number;
      idle: number;
    };
  };

  // Redis Configuration
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };

  // JWT Configuration
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    issuer: string;
  };

  // CORS Configuration
  cors: {
    origin: string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };

  // Security Configuration
  security: {
    bcryptRounds: number;
    sessionTimeout: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
  };

  // External Services
  services: {
    quantlib: {
      url: string;
      timeout: number;
    };
    ballerine: {
      apiKey: string;
      webhookSecret: string;
      baseUrl: string;
    };
    blnkfinance: {
      apiKey: string;
      baseUrl: string;
    };
  };

  // Monitoring
  monitoring: {
    enabled: boolean;
    metricsToken: string;
    metricsIpAllowlist: string[];
  };

  // Feature Flags
  features: {
    marginTrading: boolean;
    kyc: boolean;
    compliance: boolean;
    multiTenant: boolean;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfiguration;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'app.config.json');
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfig(): AppConfiguration {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<AppConfiguration>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfiguration();
    this.validateConfiguration();
    LoggerService.info('Configuration updated successfully');
  }

  public get<T>(path: string): T {
    return path.split('.').reduce((obj: any, key: string) => obj?.[key], this.config) as T;
  }

  public set(path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((obj: any, key: string) => {
      if (!obj[key]) obj[key] = {};
      return obj[key];
    }, this.config);

    target[lastKey] = value;
    this.saveConfiguration();
    this.validateConfiguration();
  }

  private loadConfiguration(): AppConfiguration {
    // Try to load from file first
    if (fs.existsSync(this.configPath)) {
      try {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const fileConfig = JSON.parse(configData);
        LoggerService.info('Configuration loaded from file');
        return this.mergeWithEnvironment(fileConfig);
      } catch (error) {
        LoggerService.warn('Failed to load configuration from file, using defaults:', error);
      }
    }

    // Fallback to environment variables
    return this.createDefaultConfiguration();
  }

  private mergeWithEnvironment(fileConfig: Partial<AppConfiguration>): AppConfiguration {
    const defaultConfig = this.createDefaultConfiguration();

    // Deep merge with environment overrides
    return {
      ...defaultConfig,
      ...fileConfig,
      server: {
        ...defaultConfig.server,
        ...fileConfig.server,
        port: parseInt(process.env.PORT || '3002'),
        environment: (process.env.NODE_ENV as any) || 'development',
      },
      database: {
        ...defaultConfig.database,
        ...fileConfig.database,
        host: process.env.DB_HOST || fileConfig.database?.host || defaultConfig.database.host,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || fileConfig.database?.database || defaultConfig.database.database,
        username: process.env.DB_USER || fileConfig.database?.username || defaultConfig.database.username,
        password: process.env.DB_PASSWORD || fileConfig.database?.password || defaultConfig.database.password,
      },
      redis: {
        ...defaultConfig.redis,
        ...fileConfig.redis,
        host: process.env.REDIS_HOST || fileConfig.redis?.host || defaultConfig.redis.host,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || fileConfig.redis?.password,
      },
      jwt: {
        ...defaultConfig.jwt,
        ...fileConfig.jwt,
        secret: process.env.JWT_SECRET || fileConfig.jwt?.secret || defaultConfig.jwt.secret,
      },
      security: {
        ...defaultConfig.security,
        ...fileConfig.security,
      },
      services: {
        ...defaultConfig.services,
        ...fileConfig.services,
        ballerine: {
          ...defaultConfig.services.ballerine,
          ...fileConfig.services?.ballerine,
          apiKey: process.env.BALLERINE_API_KEY || fileConfig.services?.ballerine?.apiKey || '',
          webhookSecret: process.env.BALLERINE_WEBHOOK_SECRET || fileConfig.services?.ballerine?.webhookSecret || '',
        },
        blnkfinance: {
          ...defaultConfig.services.blnkfinance,
          ...fileConfig.services?.blnkfinance,
          apiKey: process.env.BLNK_FINANCE_API_KEY || fileConfig.services?.blnkfinance?.apiKey || '',
        },
      },
      monitoring: {
        ...defaultConfig.monitoring,
        ...fileConfig.monitoring,
        metricsToken: process.env.METRICS_TOKEN || fileConfig.monitoring?.metricsToken || '',
        metricsIpAllowlist: (process.env.METRICS_IP_ALLOWLIST || '').split(',').filter(Boolean),
      },
    };
  }

  private createDefaultConfiguration(): AppConfiguration {
    return {
      server: {
        port: 3002,
        host: '0.0.0.0',
        environment: 'development',
        trustProxy: true,
      },
      database: {
        host: 'localhost',
        port: 5432,
        database: 'thaliumx',
        username: 'thaliumx',
        password: 'password',
        ssl: false,
        pool: {
          max: 20,
          min: 5,
          acquire: 30000,
          idle: 10000,
        },
      },
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        keyPrefix: 'thaliumx:',
      },
      jwt: {
        secret: 'default-jwt-secret-change-in-production',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        issuer: 'thaliumx-backend',
      },
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:5173'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
      },
      security: {
        bcryptRounds: 12,
        sessionTimeout: 3600000, // 1 hour
        maxLoginAttempts: 5,
        lockoutDuration: 900000, // 15 minutes
        rateLimit: {
          windowMs: 900000, // 15 minutes
          maxRequests: 100,
        },
      },
      services: {
        quantlib: {
          url: 'http://localhost:3010',
          timeout: 30000,
        },
        ballerine: {
          apiKey: 'ballerine_oss_api_key_12345',
          webhookSecret: 'ballerine_webhook_secret_67890',
          baseUrl: 'http://localhost:4000',
        },
        blnkfinance: {
          apiKey: 'default-blnk-key',
          baseUrl: 'http://localhost:5001',
        },
      },
      monitoring: {
        enabled: true,
        metricsToken: 'default-metrics-token',
        metricsIpAllowlist: ['127.0.0.1', '::1'],
      },
      features: {
        marginTrading: true,
        kyc: true,
        compliance: true,
        multiTenant: true,
      },
    };
  }

  private saveConfiguration(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      LoggerService.info('Configuration saved to file');
    } catch (error) {
      LoggerService.error('Failed to save configuration:', error);
    }
  }

  private validateConfiguration(): void {
    const errors: string[] = [];

    // Server validation
    if (!this.config.server.port || this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('Invalid server port');
    }

    // Database validation
    if (!this.config.database.host) {
      errors.push('Database host is required');
    }
    if (!this.config.database.database) {
      errors.push('Database name is required');
    }
    if (!this.config.database.username) {
      errors.push('Database username is required');
    }

    // JWT validation
    if (!this.config.jwt.secret || this.config.jwt.secret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long');
    }

    // Security validation
    if (this.config.security.bcryptRounds < 10) {
      errors.push('Bcrypt rounds should be at least 10');
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed:\n${errors.join('\n')}`;
      LoggerService.error(errorMessage);
      throw new Error(errorMessage);
    }

    LoggerService.info('Configuration validation passed');
  }

  public getEnvironmentInfo(): any {
    return {
      nodeVersion: process.version,
      environment: this.config.server.environment,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  public reloadConfiguration(): void {
    LoggerService.info('Reloading configuration...');
    this.config = this.loadConfiguration();
    this.validateConfiguration();
    LoggerService.info('Configuration reloaded successfully');
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();