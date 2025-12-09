/**
 * Enhanced Configuration Service
 * 
 * Production-ready configuration management with comprehensive Vault integration.
 * 
 * Features:
 * - Full HashiCorp Vault integration with AppRole authentication
 * - Automatic token renewal
 * - Secret caching with TTL
 * - Graceful fallback to environment variables and .secrets files
 * - Configuration validation
 * - Hot-reload support in development
 * - Event-driven configuration updates
 * 
 * Configuration Priority:
 * 1. Environment variables (highest priority)
 * 2. Vault secrets (production)
 * 3. .secrets files (development fallback)
 * 
 * @module ConfigService
 */

import * as dotenv from 'dotenv';
import { AppConfig, DatabaseConfig, RedisConfig, JWTConfig } from '../types';
import { LoggerService } from './logger';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';

dotenv.config();

// ============================================
// Types and Interfaces
// ============================================

interface VaultConfig {
  url: string;
  token?: string;
  roleId?: string;
  secretId?: string;
  namespace?: string;
  mountPath: string;
  tokenTTL?: number;
  renewThreshold?: number;
}

interface VaultTokenInfo {
  token: string;
  expiresAt: Date;
  renewable: boolean;
}

interface CachedSecret {
  value: string;
  expiresAt: Date;
}

interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  username?: string;
  subaccount?: string;
}

interface BlockchainProviderConfig {
  apiKey: string;
  endpoint?: string;
  projectId?: string;
}

interface BankingCredentials {
  apiKey: string;
  apiSecret: string;
  merchantId?: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
}

interface ComplianceCredentials {
  apiKey: string;
  apiSecret?: string;
  endpoint: string;
}

interface WalletConfig {
  address: string;
  privateKey: string;
  network: string;
  chainId: number;
}

// ============================================
// Event Emitter
// ============================================

class ConfigEventEmitter extends EventEmitter {}
const configEmitter = new ConfigEventEmitter();

// ============================================
// Vault Secret Paths
// ============================================

const VAULT_SECRET_PATHS = {
  // Core infrastructure
  database: 'thaliumx/database/postgres',
  redis: 'thaliumx/cache/redis',
  mongodb: 'thaliumx/database/mongodb',
  
  // Authentication & Security
  jwt: 'thaliumx/jwt/signing',
  encryption: 'thaliumx/encryption/keys',
  keycloak: 'thaliumx/oauth/keycloak',
  
  // Messaging
  smtp: 'thaliumx/smtp/config',
  kafka: 'thaliumx/messaging/kafka',
  twilio: 'thaliumx/messaging/twilio',
  sendgrid: 'thaliumx/messaging/sendgrid',
  
  // Exchanges
  binance: 'thaliumx/exchanges/binance',
  bybit: 'thaliumx/exchanges/bybit',
  kucoin: 'thaliumx/exchanges/kucoin',
  kraken: 'thaliumx/exchanges/kraken',
  okx: 'thaliumx/exchanges/okx',
  valr: 'thaliumx/exchanges/valr',
  bitstamp: 'thaliumx/exchanges/bitstamp',
  
  // Blockchain providers
  bscscan: 'thaliumx/blockchain/bscscan',
  etherscan: 'thaliumx/blockchain/etherscan',
  alchemy: 'thaliumx/blockchain/alchemy',
  infura: 'thaliumx/blockchain/infura',
  ankr: 'thaliumx/blockchain/ankr',
  
  // Wallets
  testnetWallet: 'thaliumx/wallets/testnet-admin',
  mainnetWallet: 'thaliumx/wallets/mainnet-admin',
  
  // Banking
  nedbankDeposit: 'thaliumx/banking/nedbank-deposit',
  nedbankPayshap: 'thaliumx/banking/nedbank-payshap',
  stripe: 'thaliumx/payments/stripe',
  
  // Compliance
  ofac: 'thaliumx/compliance/ofac',
  secureCitizen: 'thaliumx/compliance/secure-citizen',
  
  // External APIs
  blnkFinance: 'thaliumx/api-keys/blnk-finance',
} as const;

// ============================================
// ConfigService Class
// ============================================

export class ConfigService {
  private static config: AppConfig;
  private static watchers: Map<string, fs.FSWatcher> = new Map();
  private static isWatching: boolean = false;
  private static vaultClient: AxiosInstance | null = null;
  private static vaultConfig: VaultConfig | null = null;
  private static vaultToken: VaultTokenInfo | null = null;
  private static secretCache: Map<string, CachedSecret> = new Map();
  private static tokenRenewalTimer: NodeJS.Timeout | null = null;
  
  // Secret cache TTL (5 minutes)
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
  // Token renewal threshold (renew when 20% of TTL remains)
  private static readonly TOKEN_RENEWAL_THRESHOLD = 0.2;

  // ============================================
  // Public API
  // ============================================

  /**
   * Initialize the configuration service
   * Should be called once at application startup
   */
  public static async initialize(): Promise<void> {
    LoggerService.info('Initializing ConfigService...');
    
    // Initialize Vault if configured
    await this.initializeVault();
    
    // Load configuration
    this.config = await this.loadConfig();
    
    // Validate configuration
    this.validateConfig();
    
    // Start watching in development
    if (process.env.NODE_ENV !== 'production') {
      this.startWatching();
    }
    
    LoggerService.info('ConfigService initialized successfully');
  }

  /**
   * Get application configuration
   */
  public static getConfig(): AppConfig {
    if (!this.config) {
      // Synchronous fallback for backward compatibility
      this.config = this.loadConfigSync();
    }
    return this.config;
  }

  /**
   * Reload configuration
   */
  public static async reloadConfig(): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = await this.loadConfig();
    this.validateConfig();
    configEmitter.emit('config:reloaded', { old: oldConfig, new: this.config });
    LoggerService.info('Configuration reloaded successfully');
  }

  /**
   * Get the event emitter for config change notifications
   */
  public static getEventEmitter(): ConfigEventEmitter {
    return configEmitter;
  }

  /**
   * Check if Vault is connected
   */
  public static isVaultConnected(): boolean {
    return this.vaultClient !== null && this.vaultToken !== null;
  }

  /**
   * Get exchange credentials
   */
  public static async getExchangeCredentials(exchange: string): Promise<ExchangeCredentials | null> {
    const secretPath = (VAULT_SECRET_PATHS as Record<string, string>)[exchange.toLowerCase()];
    if (!secretPath) {
      LoggerService.warn(`Unknown exchange: ${exchange}`);
      return null;
    }
    
    const secret = await this.getVaultSecret(secretPath);
    if (!secret) {
      return this.getExchangeCredentialsFromEnv(exchange);
    }
    
    return {
      apiKey: secret.api_key || secret.apiKey || '',
      apiSecret: secret.api_secret || secret.apiSecret || '',
      passphrase: secret.passphrase,
      username: secret.username,
      subaccount: secret.subaccount,
    };
  }

  /**
   * Get all exchange credentials
   */
  public static async getAllExchangeCredentials(): Promise<Record<string, ExchangeCredentials>> {
    const exchanges = ['binance', 'bybit', 'kucoin', 'kraken', 'okx', 'valr', 'bitstamp'];
    const credentials: Record<string, ExchangeCredentials> = {};
    
    for (const exchange of exchanges) {
      const creds = await this.getExchangeCredentials(exchange);
      if (creds && creds.apiKey) {
        credentials[exchange] = creds;
      }
    }
    
    return credentials;
  }

  /**
   * Get blockchain provider configuration
   */
  public static async getBlockchainProvider(provider: string): Promise<BlockchainProviderConfig | null> {
    const secretPath = (VAULT_SECRET_PATHS as Record<string, string>)[provider.toLowerCase()];
    if (!secretPath) {
      LoggerService.warn(`Unknown blockchain provider: ${provider}`);
      return null;
    }
    
    const secret = await this.getVaultSecret(secretPath);
    if (!secret) {
      return this.getBlockchainProviderFromEnv(provider);
    }
    
    return {
      apiKey: secret.api_key || secret.apiKey || '',
      endpoint: secret.endpoint,
      projectId: secret.project_id || secret.projectId,
    };
  }

  /**
   * Get wallet configuration
   */
  public static async getWalletConfig(network: 'testnet' | 'mainnet'): Promise<WalletConfig | null> {
    const secretPath = network === 'testnet' 
      ? VAULT_SECRET_PATHS.testnetWallet 
      : VAULT_SECRET_PATHS.mainnetWallet;
    
    const secret = await this.getVaultSecret(secretPath);
    if (!secret) {
      return this.getWalletConfigFromEnv(network);
    }
    
    return {
      address: secret.address || '',
      privateKey: secret.private_key || secret.privateKey || '',
      network: secret.network || network,
      chainId: parseInt(secret.chain_id || secret.chainId || (network === 'testnet' ? '97' : '56')),
    };
  }

  /**
   * Get banking credentials
   */
  public static async getBankingCredentials(provider: string): Promise<BankingCredentials | null> {
    const providerMap: Record<string, string> = {
      'nedbank-deposit': VAULT_SECRET_PATHS.nedbankDeposit,
      'nedbank-payshap': VAULT_SECRET_PATHS.nedbankPayshap,
      'stripe': VAULT_SECRET_PATHS.stripe,
    };
    
    const secretPath = providerMap[provider.toLowerCase()];
    if (!secretPath) {
      LoggerService.warn(`Unknown banking provider: ${provider}`);
      return null;
    }
    
    const secret = await this.getVaultSecret(secretPath);
    if (!secret) {
      return null;
    }
    
    return {
      apiKey: secret.api_key || secret.apiKey || secret.secret_key || '',
      apiSecret: secret.api_secret || secret.apiSecret || '',
      merchantId: secret.merchant_id || secret.merchantId,
      environment: (secret.environment || 'sandbox') as 'sandbox' | 'production',
      webhookSecret: secret.webhook_secret || secret.webhookSecret,
    };
  }

  /**
   * Get compliance credentials
   */
  public static async getComplianceCredentials(provider: string): Promise<ComplianceCredentials | null> {
    const providerMap: Record<string, string> = {
      'ofac': VAULT_SECRET_PATHS.ofac,
      'secure-citizen': VAULT_SECRET_PATHS.secureCitizen,
    };
    
    const secretPath = providerMap[provider.toLowerCase()];
    if (!secretPath) {
      LoggerService.warn(`Unknown compliance provider: ${provider}`);
      return null;
    }
    
    const secret = await this.getVaultSecret(secretPath);
    if (!secret) {
      return null;
    }
    
    return {
      apiKey: secret.api_key || secret.apiKey || '',
      apiSecret: secret.api_secret || secret.apiSecret,
      endpoint: secret.endpoint || '',
    };
  }

  /**
   * Shutdown the configuration service
   */
  public static shutdown(): void {
    this.stopWatching();
    if (this.tokenRenewalTimer) {
      clearInterval(this.tokenRenewalTimer);
      this.tokenRenewalTimer = null;
    }
    this.secretCache.clear();
    LoggerService.info('ConfigService shutdown complete');
  }

  // ============================================
  // Vault Integration
  // ============================================

  /**
   * Initialize HashiCorp Vault connection
   */
  private static async initializeVault(): Promise<void> {
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
        mountPath: process.env.VAULT_MOUNT_PATH || 'kv',
        tokenTTL: parseInt(process.env.VAULT_TOKEN_TTL || '3600'),
        renewThreshold: parseFloat(process.env.VAULT_RENEW_THRESHOLD || '0.2'),
      };

      // Authenticate with Vault
      let token: string | undefined = this.vaultConfig.token;

      if (!token && this.vaultConfig.roleId && this.vaultConfig.secretId) {
        const appRoleToken = await this.authenticateWithAppRole();
        token = appRoleToken ?? undefined;
      }

      if (!token) {
        LoggerService.warn('No Vault authentication method available, skipping Vault integration');
        return;
      }

      // Create Vault client
      this.vaultClient = axios.create({
        baseURL: this.vaultConfig.url,
        headers: {
          'X-Vault-Token': token,
          ...(this.vaultConfig.namespace && { 'X-Vault-Namespace': this.vaultConfig.namespace }),
        },
        timeout: 10000,
      });

      // Test connection
      const healthResponse = await this.vaultClient.get('/v1/sys/health');
      if (healthResponse.status !== 200) {
        throw new Error('Vault health check failed');
      }

      LoggerService.info('✅ Vault connection established successfully');

      // Start token renewal timer
      this.startTokenRenewal();

    } catch (error: any) {
      LoggerService.error('Failed to initialize Vault:', { error: error.message });
      this.vaultClient = null;
      this.vaultToken = null;
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
          secret_id: this.vaultConfig.secretId,
        },
        {
          headers: this.vaultConfig.namespace
            ? { 'X-Vault-Namespace': this.vaultConfig.namespace }
            : {},
          timeout: 10000,
        }
      );

      const auth = response.data?.auth;
      if (!auth?.client_token) {
        throw new Error('No client token in AppRole response');
      }

      // Store token info
      this.vaultToken = {
        token: auth.client_token,
        expiresAt: new Date(Date.now() + (auth.lease_duration * 1000)),
        renewable: auth.renewable,
      };

      LoggerService.info('Vault AppRole authentication successful', {
        ttl: auth.lease_duration,
        renewable: auth.renewable,
      });

      return auth.client_token;
    } catch (error: any) {
      LoggerService.error('Vault AppRole authentication failed:', { error: error.message });
      return null;
    }
  }

  /**
   * Start automatic token renewal
   */
  private static startTokenRenewal(): void {
    if (this.tokenRenewalTimer) {
      clearInterval(this.tokenRenewalTimer);
    }

    // Check every minute
    this.tokenRenewalTimer = setInterval(async () => {
      await this.checkAndRenewToken();
    }, 60000);
  }

  /**
   * Check and renew Vault token if needed
   */
  private static async checkAndRenewToken(): Promise<void> {
    if (!this.vaultToken || !this.vaultClient) return;

    const now = new Date();
    const timeRemaining = this.vaultToken.expiresAt.getTime() - now.getTime();
    const totalTTL = this.vaultConfig?.tokenTTL || 3600;
    const threshold = totalTTL * 1000 * this.TOKEN_RENEWAL_THRESHOLD;

    if (timeRemaining < threshold && this.vaultToken.renewable) {
      try {
        const response = await this.vaultClient.post('/v1/auth/token/renew-self');
        const auth = response.data?.auth;
        
        if (auth) {
          this.vaultToken.expiresAt = new Date(Date.now() + (auth.lease_duration * 1000));
          
          // Update client headers with new token if provided
          if (auth.client_token) {
            this.vaultToken.token = auth.client_token;
            this.vaultClient.defaults.headers['X-Vault-Token'] = auth.client_token;
          }
          
          LoggerService.debug('Vault token renewed successfully');
        }
      } catch (error: any) {
        LoggerService.error('Failed to renew Vault token:', { error: error.message });
        
        // Try to re-authenticate
        if (this.vaultConfig?.roleId && this.vaultConfig?.secretId) {
          const newToken = await this.authenticateWithAppRole();
          if (newToken && this.vaultClient) {
            this.vaultClient.defaults.headers['X-Vault-Token'] = newToken;
          }
        }
      }
    }
  }

  /**
   * Get a secret from Vault with caching
   */
  private static async getVaultSecret(secretPath: string): Promise<Record<string, any> | null> {
    // Check cache first
    const cached = this.secretCache.get(secretPath);
    if (cached && cached.expiresAt > new Date()) {
      return JSON.parse(cached.value);
    }

    if (!this.vaultClient || !this.vaultConfig) {
      return null;
    }

    try {
      const response = await this.vaultClient.get(
        `/v1/${this.vaultConfig.mountPath}/data/${secretPath}`
      );

      const secretData = response.data?.data?.data;
      if (secretData) {
        // Cache the secret
        this.secretCache.set(secretPath, {
          value: JSON.stringify(secretData),
          expiresAt: new Date(Date.now() + this.CACHE_TTL_MS),
        });
        return secretData;
      }

      return null;
    } catch (error: any) {
      if (error.response?.status !== 404) {
        LoggerService.warn(`Failed to load Vault secret: ${secretPath}`, { error: error.message });
      }
      return null;
    }
  }

  /**
   * Write a secret to Vault
   */
  public static async writeVaultSecret(secretPath: string, data: Record<string, any>): Promise<boolean> {
    if (!this.vaultClient || !this.vaultConfig) {
      LoggerService.warn('Vault not configured, cannot write secret');
      return false;
    }

    try {
      await this.vaultClient.post(
        `/v1/${this.vaultConfig.mountPath}/data/${secretPath}`,
        { data }
      );

      // Update cache
      this.secretCache.set(secretPath, {
        value: JSON.stringify(data),
        expiresAt: new Date(Date.now() + this.CACHE_TTL_MS),
      });

      LoggerService.info(`Secret written to Vault: ${secretPath}`);
      return true;
    } catch (error: any) {
      LoggerService.error(`Failed to write Vault secret: ${secretPath}`, { error: error.message });
      return false;
    }
  }

  /**
   * Invalidate cached secret
   */
  public static invalidateSecretCache(secretPath?: string): void {
    if (secretPath) {
      this.secretCache.delete(secretPath);
    } else {
      this.secretCache.clear();
    }
  }

  // ============================================
  // Configuration Loading
  // ============================================

  /**
   * Load configuration asynchronously (with Vault)
   */
  private static async loadConfig(): Promise<AppConfig> {
    const dnsOrigins = this.loadDnsOriginsFromSecrets();
    
    // Load secrets from Vault or fallback
    const dbSecret = await this.getVaultSecret(VAULT_SECRET_PATHS.database);
    const redisSecret = await this.getVaultSecret(VAULT_SECRET_PATHS.redis);
    const jwtSecret = await this.getVaultSecret(VAULT_SECRET_PATHS.jwt);
    const encryptionSecret = await this.getVaultSecret(VAULT_SECRET_PATHS.encryption);
    const smtpSecret = await this.getVaultSecret(VAULT_SECRET_PATHS.smtp);
    const kafkaSecret = await this.getVaultSecret(VAULT_SECRET_PATHS.kafka);
    const keycloakSecret = await this.getVaultSecret(VAULT_SECRET_PATHS.keycloak);
    const stripeSecret = await this.getVaultSecret(VAULT_SECRET_PATHS.stripe);
    const twilioSecret = await this.getVaultSecret(VAULT_SECRET_PATHS.twilio);
    const sendgridSecret = await this.getVaultSecret(VAULT_SECRET_PATHS.sendgrid);
    
    return {
      port: parseInt(process.env.PORT || '3002', 10),
      env: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',

      cors: {
        origin: Array.from(new Set([
          ...(process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001']),
          ...dnsOrigins
        ])),
        credentials: (process.env.CORS_CREDENTIALS || 'true').toLowerCase() === 'true'
      },

      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
      },

      database: this.getDatabaseConfig(dbSecret),
      redis: this.getRedisConfig(redisSecret),
      jwt: this.getJWTConfig(jwtSecret),

      encryption: {
        algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
        key: encryptionSecret?.key || process.env.ENCRYPTION_KEY || ''
      },

      smtp: {
        host: smtpSecret?.host || process.env.SMTP_HOST || '',
        port: parseInt(smtpSecret?.port || process.env.SMTP_PORT || '587', 10),
        secure: (smtpSecret?.secure || process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
        auth: {
          user: smtpSecret?.user || process.env.SMTP_USER || '',
          pass: smtpSecret?.password || process.env.SMTP_PASSWORD || ''
        },
        from: smtpSecret?.from || process.env.SMTP_FROM || process.env.SMTP_USER || ''
      },

      external: {
        stripe: {
          secretKey: stripeSecret?.secret_key || process.env.STRIPE_SECRET_KEY || '',
          webhookSecret: stripeSecret?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || ''
        },
        twilio: {
          accountSid: twilioSecret?.account_sid || process.env.TWILIO_ACCOUNT_SID || '',
          authToken: twilioSecret?.auth_token || process.env.TWILIO_AUTH_TOKEN || '',
          phoneNumber: twilioSecret?.phone_number || process.env.TWILIO_PHONE_NUMBER || ''
        },
        sendgrid: {
          apiKey: sendgridSecret?.api_key || process.env.SENDGRID_API_KEY || '',
          fromEmail: sendgridSecret?.from_email || process.env.SENDGRID_FROM_EMAIL || 'noreply@thaliumx.com'
        }
      },

      kafka: {
        brokers: (kafkaSecret?.brokers || process.env.KAFKA_BROKERS)?.split(',') || ['localhost:9092'],
        ssl: (kafkaSecret?.ssl || process.env.KAFKA_SSL || 'false').toLowerCase() === 'true',
        sasl: (kafkaSecret?.sasl_username || process.env.KAFKA_SASL_USERNAME) ? {
          mechanism: kafkaSecret?.sasl_mechanism || process.env.KAFKA_SASL_MECHANISM || 'plain',
          username: kafkaSecret?.sasl_username || process.env.KAFKA_SASL_USERNAME || '',
          password: kafkaSecret?.sasl_password || process.env.KAFKA_SASL_PASSWORD || ''
        } : undefined
      },

      keycloak: {
        baseUrl: keycloakSecret?.url || process.env.KEYCLOAK_URL || 'http://localhost:8080',
        realm: keycloakSecret?.realm || process.env.KEYCLOAK_REALM || 'master',
        clientId: keycloakSecret?.client_id || process.env.KEYCLOAK_CLIENT_ID || 'admin-cli',
        clientSecret: keycloakSecret?.client_secret || process.env.KEYCLOAK_CLIENT_SECRET || '',
        adminUsername: keycloakSecret?.admin_username || process.env.KEYCLOAK_ADMIN_USERNAME || 'admin',
        adminPassword: keycloakSecret?.admin_password || process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
        timeout: parseInt(keycloakSecret?.timeout || process.env.KEYCLOAK_TIMEOUT || '30000'),
        retryAttempts: parseInt(keycloakSecret?.retry_attempts || process.env.KEYCLOAK_RETRY_ATTEMPTS || '3')
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
   * Load configuration synchronously (fallback without Vault)
   */
  private static loadConfigSync(): AppConfig {
    const dnsOrigins = this.loadDnsOriginsFromSecrets();
    
    return {
      port: parseInt(process.env.PORT || '3002', 10),
      env: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',

      cors: {
        origin: Array.from(new Set([
          ...(process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001']),
          ...dnsOrigins
        ])),
        credentials: (process.env.CORS_CREDENTIALS || 'true').toLowerCase() === 'true'
      },

      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
      },

      database: this.getDatabaseConfig(null),
      redis: this.getRedisConfig(null),
      jwt: this.getJWTConfig(null),

      encryption: {
        algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
        key: process.env.ENCRYPTION_KEY || this.readSecretFile('encryption-key') || ''
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

  // ============================================
  // Configuration Helpers
  // ============================================

  private static getDatabaseConfig(vaultSecret: Record<string, any> | null): DatabaseConfig {
    return {
      host: vaultSecret?.host || process.env.DB_HOST || 'localhost',
      port: parseInt(vaultSecret?.port || process.env.DB_PORT || '5432', 10),
      database: vaultSecret?.database || process.env.DB_NAME || 'thaliumx',
      username: vaultSecret?.username || process.env.DB_USER || 'postgres',
      password: vaultSecret?.password || process.env.DB_PASSWORD || '',
      ssl: (vaultSecret?.ssl || process.env.DB_SSL || 'false').toLowerCase() === 'true',
      pool: {
        min: parseInt(vaultSecret?.pool_min || process.env.DB_POOL_MIN || '2', 10),
        max: parseInt(vaultSecret?.pool_max || process.env.DB_POOL_MAX || '10', 10),
        idle: parseInt(vaultSecret?.pool_idle || process.env.DB_POOL_IDLE || '10000', 10)
      }
    };
  }

  private static getRedisConfig(vaultSecret: Record<string, any> | null): RedisConfig {
    return {
      host: vaultSecret?.host || process.env.REDIS_HOST || 'localhost',
      port: parseInt(vaultSecret?.port || process.env.REDIS_PORT || '6379', 10),
      password: vaultSecret?.password || process.env.REDIS_PASSWORD || '',
      db: parseInt(vaultSecret?.db || process.env.REDIS_DB || '0', 10),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10)
    };
  }

  private static getJWTConfig(vaultSecret: Record<string, any> | null): JWTConfig {
    return {
      secret: vaultSecret?.secret || process.env.JWT_SECRET || this.readSecretFile('jwt-secret') || '',
      expiresIn: vaultSecret?.expires_in || process.env.JWT_EXPIRES_IN || '15m',
      refreshExpiresIn: vaultSecret?.refresh_expires_in || process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: vaultSecret?.issuer || process.env.JWT_ISSUER || 'thaliumx',
      audience: vaultSecret?.audience || process.env.JWT_AUDIENCE || 'thaliumx-users'
    };
  }

  // ============================================
  // Fallback Methods
  // ============================================

  private static getExchangeCredentialsFromEnv(exchange: string): ExchangeCredentials | null {
    const prefix = exchange.toUpperCase();
    const apiKey = process.env[`${prefix}_API_KEY`];
    const apiSecret = process.env[`${prefix}_API_SECRET`];
    
    if (!apiKey || !apiSecret) {
      return null;
    }
    
    return {
      apiKey,
      apiSecret,
      passphrase: process.env[`${prefix}_PASSPHRASE`],
      username: process.env[`${prefix}_USERNAME`],
    };
  }

  private static getBlockchainProviderFromEnv(provider: string): BlockchainProviderConfig | null {
    const prefix = provider.toUpperCase();
    const apiKey = process.env[`${prefix}_API_KEY`];
    
    if (!apiKey) {
      return null;
    }
    
    return {
      apiKey,
      endpoint: process.env[`${prefix}_ENDPOINT`],
      projectId: process.env[`${prefix}_PROJECT_ID`],
    };
  }

  private static getWalletConfigFromEnv(network: 'testnet' | 'mainnet'): WalletConfig | null {
    const prefix = network === 'testnet' ? 'TESTNET' : 'MAINNET';
    const privateKey = process.env[`${prefix}_WALLET_PRIVATE_KEY`];
    
    if (!privateKey) {
      return null;
    }
    
    return {
      address: process.env[`${prefix}_WALLET_ADDRESS`] || '',
      privateKey,
      network,
      chainId: parseInt(process.env[`${prefix}_CHAIN_ID`] || (network === 'testnet' ? '97' : '56')),
    };
  }

  private static readSecretFile(filename: string): string {
    try {
      const filePath = path.join(process.cwd(), '.secrets', filename);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8').trim();
      }
    } catch (error) {
      LoggerService.warn(`Failed to read secret file: ${filename}`);
    }
    return '';
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

  // ============================================
  // File Watching (Development)
  // ============================================

  private static startWatching(): void {
    if (this.isWatching) return;
    this.isWatching = true;

    // Watch .env file
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      try {
        fs.watchFile(envPath, { interval: 1000 }, (curr, prev) => {
          if (curr.mtime !== prev.mtime) {
            LoggerService.info('.env file changed, reloading configuration...');
            dotenv.config({ override: true });
            this.reloadConfig();
          }
        });
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

  private static stopWatching(): void {
    this.watchers.forEach((watcher, watchPath) => {
      try {
        if (typeof watcher.close === 'function') {
          watcher.close();
        } else {
          fs.unwatchFile(watchPath);
        }
      } catch (error) {
        LoggerService.warn(`Failed to stop watching ${watchPath}`, error);
      }
    });
    this.watchers.clear();
    this.isWatching = false;
    LoggerService.info('Stopped watching configuration files');
  }

  // ============================================
  // Validation
  // ============================================

  public static validateConfig(): void {
    const config = this.getConfig();
    const errors: string[] = [];

    // JWT validation
    if (!config.jwt.secret || config.jwt.secret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long');
    }

    // Encryption key validation
    if (!config.encryption.key || config.encryption.key.length < 32) {
      errors.push('Encryption key must be at least 32 characters long');
    }

    // Database validation
    if (!config.database.host) {
      errors.push('Database host is required');
    }

    // Production-specific validations
    if (config.env === 'production') {
      if (!config.database.ssl) {
        errors.push('Database SSL must be enabled in production');
      }
      
      if (config.keycloak.adminPassword === 'admin') {
        errors.push('Default Keycloak admin password must be changed in production');
      }
      
      if (!this.isVaultConnected()) {
        LoggerService.warn('Vault is not connected in production - secrets may not be properly managed');
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
      if (config.env === 'production') {
        throw new Error(errorMessage);
      } else {
        LoggerService.warn(errorMessage);
      }
    } else {
      LoggerService.info('Configuration validation passed');
    }
  }
}

// Export singleton methods for backward compatibility
export const getConfig = () => ConfigService.getConfig();
export const validateConfig = () => ConfigService.validateConfig();
export const initializeConfig = () => ConfigService.initialize();