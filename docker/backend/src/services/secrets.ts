/**
 * Secrets Service (HashiCorp Vault)
 * 
 * Integration with HashiCorp Vault for secure secret storage and retrieval.
 * 
 * Features:
 * - Retrieve secrets from HashiCorp Vault
 * - Support for KV v2 secrets engine
 * - Token-based and AppRole authentication
 * - Automatic token renewal
 * - Secret caching with TTL
 * 
 * Usage:
 * - Primary secret storage for all environments
 * - Falls back to environment variables if Vault unavailable
 * - Used by ConfigService for secret loading
 * 
 * Security:
 * - Secrets never logged
 * - Encrypted in transit (TLS)
 * - Encrypted at rest by Vault
 * - Token-based access control
 * - Audit logging via Vault
 * 
 * Configuration:
 * - VAULT_ADDR: Vault server URL (default: http://thaliumx-vault:8200)
 * - VAULT_TOKEN: Direct token authentication
 * - VAULT_ROLE_ID: AppRole role ID (alternative auth)
 * - VAULT_SECRET_ID: AppRole secret ID (alternative auth)
 * - VAULT_NAMESPACE: Vault namespace (enterprise feature)
 * - VAULT_MOUNT_PATH: Secret engine mount path (default: secret)
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { LoggerService } from './logger';

interface VaultConfig {
  url: string;
  token?: string;
  roleId?: string;
  secretId?: string;
  namespace?: string;
  mountPath: string;
  cacheTtlMs: number;
}

interface CachedSecret {
  value: string;
  expiresAt: number;
}

interface VaultHealthResponse {
  initialized: boolean;
  sealed: boolean;
  standby: boolean;
  performance_standby: boolean;
  replication_performance_mode: string;
  replication_dr_mode: string;
  server_time_utc: number;
  version: string;
  cluster_name: string;
  cluster_id: string;
}

interface VaultSecretResponse {
  request_id: string;
  lease_id: string;
  renewable: boolean;
  lease_duration: number;
  data: {
    data: Record<string, string>;
    metadata: {
      created_time: string;
      custom_metadata: Record<string, string> | null;
      deletion_time: string;
      destroyed: boolean;
      version: number;
    };
  };
  wrap_info: null;
  warnings: null;
  auth: null;
}

interface VaultAppRoleResponse {
  request_id: string;
  lease_id: string;
  renewable: boolean;
  lease_duration: number;
  data: null;
  wrap_info: null;
  warnings: null;
  auth: {
    client_token: string;
    accessor: string;
    policies: string[];
    token_policies: string[];
    metadata: Record<string, string>;
    lease_duration: number;
    renewable: boolean;
    entity_id: string;
    token_type: string;
    orphan: boolean;
  };
}

export class SecretsService {
  private static config: VaultConfig | null = null;
  private static client: AxiosInstance | null = null;
  private static secretCache: Map<string, CachedSecret> = new Map();
  private static isInitialized: boolean = false;
  private static tokenRenewalTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize the Vault connection
   * 
   * Supports multiple authentication methods:
   * - Token-based authentication (VAULT_TOKEN)
   * - AppRole authentication (VAULT_ROLE_ID + VAULT_SECRET_ID)
   */
  public static async initialize(): Promise<void> {
    const vaultAddr = process.env.VAULT_ADDR || process.env.VAULT_URL || 'http://thaliumx-vault:8200';

    this.config = {
      url: vaultAddr,
      token: process.env.VAULT_TOKEN,
      roleId: process.env.VAULT_ROLE_ID,
      secretId: process.env.VAULT_SECRET_ID,
      namespace: process.env.VAULT_NAMESPACE,
      mountPath: process.env.VAULT_MOUNT_PATH || 'secret',
      cacheTtlMs: parseInt(process.env.VAULT_CACHE_TTL_MS || '300000', 10) // 5 minutes default
    };

    try {
      // Authenticate with Vault
      let token: string | undefined = this.config.token;

      if (!token && this.config.roleId && this.config.secretId) {
        // AppRole authentication
        const appRoleToken = await this.authenticateWithAppRole();
        token = appRoleToken || undefined;
      }

      if (!token) {
        LoggerService.warn('No Vault authentication method available, falling back to environment variables');
        return;
      }

      // Create authenticated client
      this.client = axios.create({
        baseURL: this.config.url,
        headers: {
          'X-Vault-Token': token,
          'Content-Type': 'application/json',
          ...(this.config.namespace && { 'X-Vault-Namespace': this.config.namespace })
        },
        timeout: 10000
      });

      // Test connection
      const healthResponse = await this.client.get<VaultHealthResponse>('/v1/sys/health');
      
      if (healthResponse.data.sealed) {
        throw new Error('Vault is sealed');
      }

      this.isInitialized = true;
      LoggerService.info('✅ Vault connection established successfully', {
        version: healthResponse.data.version,
        cluster: healthResponse.data.cluster_name
      });

      // Start token renewal if using AppRole
      if (this.config.roleId && this.config.secretId) {
        this.startTokenRenewal();
      }

    } catch (error: any) {
      LoggerService.error('Failed to initialize Vault:', { 
        error: error.message,
        url: this.config.url
      });
      // Don't throw - fall back to environment variables
      this.isInitialized = false;
    }
  }

  /**
   * Authenticate with Vault using AppRole
   */
  private static async authenticateWithAppRole(): Promise<string | null> {
    if (!this.config) return null;

    try {
      const response = await axios.post<VaultAppRoleResponse>(
        `${this.config.url}/v1/auth/approle/login`,
        {
          role_id: this.config.roleId,
          secret_id: this.config.secretId
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.namespace && { 'X-Vault-Namespace': this.config.namespace })
          },
          timeout: 10000
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
   * Start automatic token renewal for AppRole authentication
   */
  private static startTokenRenewal(): void {
    // Renew token every 30 minutes (Vault default token TTL is 1 hour)
    const renewalInterval = 30 * 60 * 1000;

    this.tokenRenewalTimer = setInterval(async () => {
      try {
        if (this.client) {
          await this.client.post('/v1/auth/token/renew-self');
          LoggerService.debug('Vault token renewed successfully');
        }
      } catch (error: any) {
        LoggerService.warn('Failed to renew Vault token, re-authenticating...', { error: error.message });
        // Re-authenticate
        const newToken = await this.authenticateWithAppRole();
        if (newToken && this.client) {
          this.client.defaults.headers['X-Vault-Token'] = newToken;
        }
      }
    }, renewalInterval);
  }

  /**
   * Stop token renewal timer
   */
  public static stopTokenRenewal(): void {
    if (this.tokenRenewalTimer) {
      clearInterval(this.tokenRenewalTimer);
      this.tokenRenewalTimer = null;
    }
  }

  /**
   * Check if Vault is connected and available
   */
  public static isConnected(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Get a secret from Vault
   * 
   * @param secretPath - Path to the secret (e.g., 'thaliumx/database')
   * @param key - Optional specific key within the secret
   * @returns The secret value or empty string if not found
   */
  public static async getSecret(secretPath: string, key?: string): Promise<string> {
    // Check cache first
    const cacheKey = key ? `${secretPath}/${key}` : secretPath;
    const cached = this.secretCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // If Vault not available, fall back to environment variable
    if (!this.isConnected() || !this.client || !this.config) {
      const envKey = key || secretPath.split('/').pop() || '';
      const envValue = process.env[envKey.toUpperCase().replace(/-/g, '_')];
      return envValue || '';
    }

    try {
      const response = await this.client.get<VaultSecretResponse>(
        `/v1/${this.config.mountPath}/data/${secretPath}`
      );

      const secretData = response.data?.data?.data;
      if (!secretData) {
        return '';
      }

      // Cache all keys from this secret
      for (const [k, v] of Object.entries(secretData)) {
        this.secretCache.set(`${secretPath}/${k}`, {
          value: String(v),
          expiresAt: Date.now() + this.config.cacheTtlMs
        });
      }

      // Return specific key or first value
      if (key && secretData[key]) {
        return secretData[key];
      }

      // Return all data as JSON if no specific key requested
      return key ? '' : JSON.stringify(secretData);

    } catch (error: any) {
      if ((error as AxiosError).response?.status === 404) {
        LoggerService.debug(`Secret not found in Vault: ${secretPath}`);
      } else {
        LoggerService.warn(`Failed to get secret from Vault: ${secretPath}`, { error: error.message });
      }
      return '';
    }
  }

  /**
   * Get multiple secrets from a path
   * 
   * @param secretPath - Path to the secret (e.g., 'thaliumx/database')
   * @returns Object containing all key-value pairs
   */
  public static async getSecrets(secretPath: string): Promise<Record<string, string>> {
    if (!this.isConnected() || !this.client || !this.config) {
      return {};
    }

    try {
      const response = await this.client.get<VaultSecretResponse>(
        `/v1/${this.config.mountPath}/data/${secretPath}`
      );

      const secretData = response.data?.data?.data;
      if (!secretData) {
        return {};
      }

      // Cache all keys
      for (const [k, v] of Object.entries(secretData)) {
        this.secretCache.set(`${secretPath}/${k}`, {
          value: String(v),
          expiresAt: Date.now() + this.config.cacheTtlMs
        });
      }

      return secretData;

    } catch (error: any) {
      if ((error as AxiosError).response?.status !== 404) {
        LoggerService.warn(`Failed to get secrets from Vault: ${secretPath}`, { error: error.message });
      }
      return {};
    }
  }

  /**
   * Write a secret to Vault
   * 
   * @param secretPath - Path to store the secret
   * @param data - Key-value pairs to store
   * @returns True if successful
   */
  public static async writeSecret(secretPath: string, data: Record<string, string>): Promise<boolean> {
    if (!this.isConnected() || !this.client || !this.config) {
      LoggerService.warn('Vault not connected, cannot write secret');
      return false;
    }

    try {
      await this.client.post(
        `/v1/${this.config.mountPath}/data/${secretPath}`,
        { data }
      );

      // Update cache
      for (const [k, v] of Object.entries(data)) {
        this.secretCache.set(`${secretPath}/${k}`, {
          value: v,
          expiresAt: Date.now() + this.config.cacheTtlMs
        });
      }

      LoggerService.info(`Secret written to Vault: ${secretPath}`);
      return true;

    } catch (error: any) {
      LoggerService.error(`Failed to write secret to Vault: ${secretPath}`, { error: error.message });
      return false;
    }
  }

  /**
   * Delete a secret from Vault
   * 
   * @param secretPath - Path to the secret to delete
   * @returns True if successful
   */
  public static async deleteSecret(secretPath: string): Promise<boolean> {
    if (!this.isConnected() || !this.client || !this.config) {
      LoggerService.warn('Vault not connected, cannot delete secret');
      return false;
    }

    try {
      await this.client.delete(
        `/v1/${this.config.mountPath}/data/${secretPath}`
      );

      // Clear from cache
      for (const key of this.secretCache.keys()) {
        if (key.startsWith(secretPath)) {
          this.secretCache.delete(key);
        }
      }

      LoggerService.info(`Secret deleted from Vault: ${secretPath}`);
      return true;

    } catch (error: any) {
      LoggerService.error(`Failed to delete secret from Vault: ${secretPath}`, { error: error.message });
      return false;
    }
  }

  /**
   * List secrets at a path
   * 
   * @param path - Path to list secrets from
   * @returns Array of secret names
   */
  public static async listSecrets(path: string): Promise<string[]> {
    if (!this.isConnected() || !this.client || !this.config) {
      return [];
    }

    try {
      const response = await this.client.request({
        method: 'LIST',
        url: `/v1/${this.config.mountPath}/metadata/${path}`
      });

      return response.data?.data?.keys || [];

    } catch (error: any) {
      if ((error as AxiosError).response?.status !== 404) {
        LoggerService.warn(`Failed to list secrets from Vault: ${path}`, { error: error.message });
      }
      return [];
    }
  }

  /**
   * Clear the secret cache
   */
  public static clearCache(): void {
    this.secretCache.clear();
    LoggerService.debug('Vault secret cache cleared');
  }

  /**
   * Get cache statistics
   */
  public static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.secretCache.size,
      keys: Array.from(this.secretCache.keys())
    };
  }

  /**
   * Health check for Vault connection
   */
  public static async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }> {
    if (!this.client || !this.config) {
      return {
        healthy: false,
        details: { error: 'Vault not configured' }
      };
    }

    try {
      const response = await this.client.get<VaultHealthResponse>('/v1/sys/health');
      
      return {
        healthy: !response.data.sealed,
        details: {
          initialized: response.data.initialized,
          sealed: response.data.sealed,
          version: response.data.version,
          cluster: response.data.cluster_name
        }
      };
    } catch (error: any) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }

  /**
   * Graceful shutdown
   */
  public static async shutdown(): Promise<void> {
    this.stopTokenRenewal();
    this.clearCache();
    this.client = null;
    this.isInitialized = false;
    LoggerService.info('Vault service shut down');
  }
}