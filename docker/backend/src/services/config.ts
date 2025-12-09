/**
 * Configuration Service
 * 
 * Manages application configuration from environment variables and .secrets files.
 * 
 * Features:
 * - Loads configuration from environment variables
 * - Falls back to .secrets directory for sensitive values
 * - Integrates with HashiCorp Vault in production (with .secrets fallback)
 * - Validates required configuration on load
 * - Watches for config changes in development mode
 * - Emits events when configuration is reloaded
 * 
 * Configuration Priority:
 * 1. Environment variables (highest priority)
 * 2. Vault secrets (production only, if configured)
 * 3. .secrets files (fallback)
 * 
 * Security:
 * - Secrets are never logged
 * - .secrets files should be excluded from version control
 * - Production should use Vault for secrets management
 */

import * as dotenv from 'dotenv';
import { AppConfig, DatabaseConfig, RedisConfig, JWTConfig } from '../types';
import { LoggerService } from './logger';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import axios from 'axios';

dotenv.config();

class ConfigEventEmitter extends EventEmitter {}
const configEmitter = new ConfigEventEmitter();

// Vault client configuration
interface VaultConfig {
  url: string;
  token?: string;
  roleId?: string;
  secretId?: string;
  namespace?: string;
  mountPath: string;
}

interface VaultSecret {
  data: Record<string, string>;
  metadata?: {
    created_time: string;
    version: number;
  };
}

export class ConfigService {
  private static config: AppConfig;
  private static watchers: Map<string, fs.FSWatcher> = new Map();
  private static isWatching: boolean = false;
  private static vaultClient: any = null;
  private static vaultConfig: VaultConfig | null = null;
  private static vaultSecrets: Map<string, string> = new Map();

  /**
   * Get application configuration
   * 
   * Loads configuration on first call, then returns cached config.
   * In development mode, starts watching config files for changes.
   * 
   * @returns {AppConfig} Complete application configuration
   */
  public static getConfig(): AppConfig {
    if (!this.config) {
      this.config = this.loadConfig();
      if (process.env.NODE_ENV !== 'production') {
        this.startWatching();
      }
    }
    return this.config;
  }

  /**
   * Reload configuration from environment variables and files
   */
  public static reloadConfig(): void {
    const oldConfig = { ...this.config };
    this.config = this.loadConfig();
    this.validateConfig();
    configEmitter.emit('config:reloaded', { old: oldConfig, new: this.config });
    LoggerService.info('Configuration reloaded successfully');
  }

  /**
   * Get the event emitter instance for listening to config changes
   */
  public static getEventEmitter(): ConfigEventEmitter {
    return configEmitter;
  }

  /**
   * Start watching configuration files for changes (development only)
   */
  private static startWatching(): void {
    if (this.isWatching) return;
    this.isWatching = true;

    // Watch .env file
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      try {
        const watcher = fs.watchFile(envPath, { interval: 1000 }, (curr, prev) => {
          if (curr.mtime !== prev.mtime) {
            LoggerService.info('.env file changed, reloading configuration...');
            dotenv.config({ override: true }); // Re-read .env
            this.reloadConfig();
          }
        });
        this.watchers.set(envPath, watcher as any);
        LoggerService.info('Watching .env file for changes');
      } catch (error) {
        LoggerService.warn('Failed to watch .env file', error);
      }
    }

    // Watch .secrets directory
    const secretsDir = path.join(process.cwd(), '.secrets');
    if (fs.existsSync(secretsDir)) {
      try {
        const watcher = fs.watch(secretsDir, { recursive: true }, (eventType, filename) => {
          if (filename && (eventType === 'change' || eventType === 'rename')) {
            LoggerService.info(`Secrets file changed: ${filename}, reloading configuration...`);
            // Small delay to ensure file write is complete
            setTimeout(() => {
              this.reloadConfig();
            }, 500);
          }
        });
        this.watchers.set(secretsDir, watcher);
        LoggerService.info('Watching .secrets directory for changes');
      } catch (error) {
        LoggerService.warn('Failed to watch .secrets directory', error);
      }
    }
  }

  /**
   * Stop watching configuration files
   */
  public static stopWatching(): void {
    this.watchers.forEach((watcher, path) => {
      try {
        if (typeof watcher.close === 'function') {
          watcher.close();
        } else {
          fs.unwatchFile(path);
        }
      } catch (error) {
        LoggerService.warn(`Failed to stop watching ${path}`, error);
      }
    });
    this.watchers.clear();
    this.isWatching = false;
    LoggerService.info('Stopped watching configuration files');
  }

  private static loadConfig(): AppConfig {
    const dnsOrigins = this.loadDnsOriginsFromSecrets();
    return {
      port: parseInt(process.env.PORT || '3002', 10),
      env: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',

      cors: {
        origin: Array.from(new Set([...(process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000','http://localhost:3001']), ...dnsOrigins])),
        credentials: (process.env.CORS_CREDENTIALS || 'true').toLowerCase() === 'true'
      },

      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
      },

      database: this.getDatabaseConfig(),
      redis: this.getRedisConfig(),
      jwt: this.getJWTConfig(process.env.JWT_SECRET || ''),

      encryption: {
        algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
        key: process.env.ENCRYPTION_KEY || ''
      },

      smtp: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASSWORD || ''
        },
        from: process.env.SMTP_FROM || process.env.SMTP_USER || ''
      },

      external: {
        stripe: {
          secretKey: process.env.STRIPE_SECRET_KEY || '',
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
        },
        twilio: {
          accountSid: process.env.TWILIO_ACCOUNT_SID || '',
          authToken: process.env.TWILIO_AUTH_TOKEN || '',
          phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
        },
        sendgrid: {
          apiKey: process.env.SENDGRID_API_KEY || '',
          fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@thaliumx.com'
        }
      },

      kafka: {
        brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
        ssl: (process.env.KAFKA_SSL || 'false').toLowerCase() === 'true',
        sasl: process.env.KAFKA_SASL_USERNAME ? {
          mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
          username: process.env.KAFKA_SASL_USERNAME,
          password: process.env.KAFKA_SASL_PASSWORD || ''
        } : undefined
      },
      keycloak: {
        baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
        realm: process.env.KEYCLOAK_REALM || 'master',
        clientId: process.env.KEYCLOAK_CLIENT_ID || 'admin-cli',
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
        adminUsername: process.env.KEYCLOAK_ADMIN_USERNAME || 'admin',
        adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
        timeout: parseInt(process.env.KEYCLOAK_TIMEOUT || '30000'),
        retryAttempts: parseInt(process.env.KEYCLOAK_RETRY_ATTEMPTS || '3')
      },
      blockchain: {
        rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545',
        privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '',
        networkId: parseInt(process.env.BLOCKCHAIN_NETWORK_ID || '1'),
        gasLimit: parseInt(process.env.BLOCKCHAIN_GAS_LIMIT || '500000'),
        gasPrice: process.env.BLOCKCHAIN_GAS_PRICE || '20000000000',
        confirmations: parseInt(process.env.BLOCKCHAIN_CONFIRMATIONS || '1'),
        timeout: parseInt(process.env.BLOCKCHAIN_TIMEOUT || '30000')
      }
    };
  }

  /**
   * Initialize HashiCorp Vault integration
   *
   * Supports multiple authentication methods:
   * - Token-based authentication (VAULT_TOKEN)
   * - AppRole authentication (VAULT_ROLE_ID + VAULT_SECRET_ID)
   *
   * Configuration via environment variables:
   * - VAULT_ADDR: Vault server URL (default: http://localhost:8200)
   * - VAULT_TOKEN: Direct token authentication
   * - VAULT_ROLE_ID: AppRole role ID
   * - VAULT_SECRET_ID: AppRole secret ID
   * - VAULT_NAMESPACE: Vault namespace (enterprise feature)
   * - VAULT_MOUNT_PATH: Secret engine mount path (default: secret)
   */
  public static async initializeVault(): Promise<void> {
    const vaultAddr = process.env.VAULT_ADDR || process.env.VAULT_URL;
    
    if (!vaultAddr) {
      LoggerService.info('Vault not configured, using environment variables and .secrets files');
      return;
    }

    try {
      this.vaultConfig = {
        url: vaultAddr,
        token: process.env.VAULT_TOKEN,
        roleId: process.env.VAULT_ROLE_ID,
        secretId: process.env.VAULT_SECRET_ID,
        namespace: process.env.VAULT_NAMESPACE,
        mountPath: process.env.VAULT_MOUNT_PATH || 'secret'
      };

      // Authenticate with Vault
      let token = this.vaultConfig.token;

      if (!token && this.vaultConfig.roleId && this.vaultConfig.secretId) {
        // AppRole authentication
        const appRoleToken = await this.authenticateWithAppRole();
        token = appRoleToken || undefined;
      }

      if (!token) {
        LoggerService.warn('No Vault authentication method available, skipping Vault integration');
        return;
      }

      this.vaultClient = axios.create({
        baseURL: this.vaultConfig.url,
        headers: {
          'X-Vault-Token': token,
          ...(this.vaultConfig.namespace && { 'X-Vault-Namespace': this.vaultConfig.namespace })
        },
        timeout: 10000
      });

      // Test connection
      await this.vaultClient.get('/v1/sys/health');
      LoggerService.info('✅ Vault connection established successfully');

      // Load secrets
      await this.loadVaultSecrets();

    } catch (error: any) {
      LoggerService.error('Failed to initialize Vault:', { error: error.message });
      // Don't throw - fall back to environment variables
    }
  }

  /**
   * Authenticate with Vault using AppRole
   */
  private static async authenticateWithAppRole(): Promise<string | null> {
    try {
      if (!this.vaultConfig) return null;

      const response = await axios.post(
        `${this.vaultConfig.url}/v1/auth/approle/login`,
        {
          role_id: this.vaultConfig.roleId,
          secret_id: this.vaultConfig.secretId
        },
        {
          headers: this.vaultConfig.namespace
            ? { 'X-Vault-Namespace': this.vaultConfig.namespace }
            : {}
        }
      );

      const token = response.data?.auth?.client_token;
      if (token) {
        LoggerService.info('Vault AppRole authentication successful');
        return token;
      }

      return null;
    } catch (error: any) {
      LoggerService.error('Vault AppRole authentication failed:', { error: error.message });
      return null;
    }
  }

  /**
   * Load secrets from Vault
   */
  private static async loadVaultSecrets(): Promise<void> {
    if (!this.vaultClient || !this.vaultConfig) return;

    const secretPaths = [
      'thaliumx/database',
      'thaliumx/redis',
      'thaliumx/jwt',
      'thaliumx/encryption',
      'thaliumx/smtp',
      'thaliumx/stripe',
      'thaliumx/twilio',
      'thaliumx/sendgrid',
      'thaliumx/kafka',
      'thaliumx/keycloak',
      'thaliumx/blockchain',
      'thaliumx/blnk-finance',
      'thaliumx/api-keys',
      'thaliumx/exchange-credentials'
    ];

    for (const secretPath of secretPaths) {
      try {
        const response = await this.vaultClient.get(
          `/v1/${this.vaultConfig.mountPath}/data/${secretPath}`
        );

        const secretData = response.data?.data?.data;
        if (secretData) {
          for (const [key, value] of Object.entries(secretData)) {
            this.vaultSecrets.set(`${secretPath}/${key}`, value as string);
          }
          LoggerService.debug(`Loaded secrets from Vault path: ${secretPath}`);
        }
      } catch (error: any) {
        if (error.response?.status !== 404) {
          LoggerService.warn(`Failed to load Vault secret: ${secretPath}`, { error: error.message });
        }
      }
    }

    LoggerService.info(`Loaded ${this.vaultSecrets.size} secrets from Vault`);
  }

  /**
   * Get a secret value with priority: Vault > Environment > .secrets file
   */
  public static getSecret(key: string, vaultPath?: string): string {
    // Priority 1: Environment variable
    const envValue = process.env[key];
    if (envValue) return envValue;

    // Priority 2: Vault secret
    if (vaultPath) {
      const vaultValue = this.vaultSecrets.get(vaultPath);
      if (vaultValue) return vaultValue;
    }

    // Priority 3: .secrets file
    const secretsFilePath = path.join(process.cwd(), '.secrets', key.toLowerCase().replace(/_/g, '-'));
    if (fs.existsSync(secretsFilePath)) {
      try {
        return fs.readFileSync(secretsFilePath, 'utf8').trim();
      } catch (error) {
        LoggerService.warn(`Failed to read secret file: ${secretsFilePath}`);
      }
    }

    return '';
  }

  /**
   * Write a secret to Vault
   */
  public static async writeVaultSecret(secretPath: string, data: Record<string, string>): Promise<boolean> {
    if (!this.vaultClient || !this.vaultConfig) {
      LoggerService.warn('Vault not configured, cannot write secret');
      return false;
    }

    try {
      await this.vaultClient.post(
        `/v1/${this.vaultConfig.mountPath}/data/${secretPath}`,
        { data }
      );

      // Update local cache
      for (const [key, value] of Object.entries(data)) {
        this.vaultSecrets.set(`${secretPath}/${key}`, value);
      }

      LoggerService.info(`Secret written to Vault: ${secretPath}`);
      return true;
    } catch (error: any) {
      LoggerService.error(`Failed to write Vault secret: ${secretPath}`, { error: error.message });
      return false;
    }
  }

  /**
   * Check if Vault is available and connected
   */
  public static isVaultConnected(): boolean {
    return this.vaultClient !== null;
  }

  private static loadDnsOriginsFromSecrets(): string[] {
    try {
      const filePath = path.join(process.cwd(), '.secrets', 'dns-details');
      if (!fs.existsSync(filePath)) return [];
      const content = fs.readFileSync(filePath, 'utf8');
      const domains = new Set<string>();
      const regex = /\b([a-z0-9.-]*thaliumx\.com)\b/gi;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(content)) !== null) {
        const host = m[1];
        if (host) {
          domains.add(`https://${host.toLowerCase()}`);
          domains.add(`http://${host.toLowerCase()}`);
        }
      }
      return Array.from(domains);
    } catch (err) {
      LoggerService.warn('Failed to load DNS origins from .secrets/dns-details');
      return [];
    }
  }

  private static getDatabaseConfig(): DatabaseConfig {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'thaliumx',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: (process.env.DB_SSL || 'false').toLowerCase() === 'true',
      pool: {
        min: parseInt(process.env.DB_POOL_MIN || '2', 10),
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
        idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10)
      }
    };
  }

  private static getRedisConfig(): RedisConfig {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || '',
      db: parseInt(process.env.REDIS_DB || '0', 10),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10)
    };
  }

  private static getJWTConfig(jwtSecret: string): JWTConfig {
    return {
      secret: jwtSecret,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'thaliumx',
      audience: process.env.JWT_AUDIENCE || 'thaliumx-users'
    };
  }

  public static validateConfig(): void {
    const config = this.getConfig();
    if (!config.jwt.secret || config.jwt.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }
    if (!config.encryption.key || config.encryption.key.length < 32) {
      throw new Error('Encryption key must be at least 32 characters long');
    }
    LoggerService.info('All configuration validation passed');
  }

  public static getExchangeCredentials(): Record<string, { apiKey: string; apiSecret: string; passphrase?: string; username?: string; }> {
    try {
      const raw = process.env.EXCHANGE_CREDENTIALS_JSON;
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (err) {
      LoggerService.warn('Failed to parse EXCHANGE_CREDENTIALS_JSON');
      return {};
    }
  }
}
