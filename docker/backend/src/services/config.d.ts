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
import { AppConfig } from '../types';
import { EventEmitter } from 'events';
declare class ConfigEventEmitter extends EventEmitter {
}
export declare class ConfigService {
    private static config;
    private static watchers;
    private static isWatching;
    private static vaultClient;
    private static vaultConfig;
    private static vaultSecrets;
    /**
     * Get application configuration
     *
     * Loads configuration on first call, then returns cached config.
     * In development mode, starts watching config files for changes.
     *
     * @returns {AppConfig} Complete application configuration
     */
    static getConfig(): AppConfig;
    /**
     * Reload configuration from environment variables and files
     */
    static reloadConfig(): void;
    /**
     * Get the event emitter instance for listening to config changes
     */
    static getEventEmitter(): ConfigEventEmitter;
    /**
     * Start watching configuration files for changes (development only)
     */
    private static startWatching;
    /**
     * Stop watching configuration files
     */
    static stopWatching(): void;
    private static loadConfig;
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
    static initializeVault(): Promise<void>;
    /**
     * Authenticate with Vault using AppRole
     */
    private static authenticateWithAppRole;
    /**
     * Load secrets from Vault
     */
    private static loadVaultSecrets;
    /**
     * Get a secret value with priority: Vault > Environment > .secrets file
     */
    static getSecret(key: string, vaultPath?: string): string;
    /**
     * Write a secret to Vault
     */
    static writeVaultSecret(secretPath: string, data: Record<string, string>): Promise<boolean>;
    /**
     * Check if Vault is available and connected
     */
    static isVaultConnected(): boolean;
    private static loadDnsOriginsFromSecrets;
    private static getDatabaseConfig;
    private static getRedisConfig;
    private static getJWTConfig;
    static validateConfig(): void;
    static getExchangeCredentials(): Record<string, {
        apiKey: string;
        apiSecret: string;
        passphrase?: string;
        username?: string;
    }>;
}
export {};
//# sourceMappingURL=config.d.ts.map