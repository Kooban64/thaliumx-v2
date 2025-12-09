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
export interface AppConfiguration {
    server: {
        port: number;
        host: string;
        environment: 'development' | 'staging' | 'production';
        trustProxy: boolean;
    };
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
    redis: {
        host: string;
        port: number;
        password?: string;
        db: number;
        keyPrefix: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
        refreshExpiresIn: string;
        issuer: string;
    };
    cors: {
        origin: string[];
        credentials: boolean;
        methods: string[];
        allowedHeaders: string[];
    };
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
    monitoring: {
        enabled: boolean;
        metricsToken: string;
        metricsIpAllowlist: string[];
    };
    features: {
        marginTrading: boolean;
        kyc: boolean;
        compliance: boolean;
        multiTenant: boolean;
    };
}
export declare class ConfigManager {
    private static instance;
    private config;
    private configPath;
    private constructor();
    static getInstance(): ConfigManager;
    getConfig(): AppConfiguration;
    updateConfig(updates: Partial<AppConfiguration>): void;
    get<T>(path: string): T;
    set(path: string, value: any): void;
    private loadConfiguration;
    private mergeWithEnvironment;
    private createDefaultConfiguration;
    private saveConfiguration;
    private validateConfiguration;
    getEnvironmentInfo(): any;
    reloadConfiguration(): void;
}
export declare const configManager: ConfigManager;
//# sourceMappingURL=config-manager.d.ts.map