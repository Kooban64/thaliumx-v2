"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configManager = exports.ConfigManager = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
// Load environment variables
dotenv_1.default.config();
class ConfigManager {
    static instance;
    config;
    configPath;
    constructor() {
        this.configPath = path.join(process.cwd(), 'config', 'app.config.json');
        this.config = this.loadConfiguration();
        this.validateConfiguration();
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.saveConfiguration();
        this.validateConfiguration();
        logger_1.LoggerService.info('Configuration updated successfully');
    }
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.config);
    }
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key])
                obj[key] = {};
            return obj[key];
        }, this.config);
        target[lastKey] = value;
        this.saveConfiguration();
        this.validateConfiguration();
    }
    loadConfiguration() {
        // Try to load from file first
        if (fs.existsSync(this.configPath)) {
            try {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const fileConfig = JSON.parse(configData);
                logger_1.LoggerService.info('Configuration loaded from file');
                return this.mergeWithEnvironment(fileConfig);
            }
            catch (error) {
                logger_1.LoggerService.warn('Failed to load configuration from file, using defaults:', error);
            }
        }
        // Fallback to environment variables
        return this.createDefaultConfiguration();
    }
    mergeWithEnvironment(fileConfig) {
        const defaultConfig = this.createDefaultConfiguration();
        // Deep merge with environment overrides
        return {
            ...defaultConfig,
            ...fileConfig,
            server: {
                ...defaultConfig.server,
                ...fileConfig.server,
                port: parseInt(process.env.PORT || '3002'),
                environment: process.env.NODE_ENV || 'development',
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
    createDefaultConfiguration() {
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
    saveConfiguration() {
        try {
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            logger_1.LoggerService.info('Configuration saved to file');
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to save configuration:', error);
        }
    }
    validateConfiguration() {
        const errors = [];
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
            logger_1.LoggerService.error(errorMessage);
            throw new Error(errorMessage);
        }
        logger_1.LoggerService.info('Configuration validation passed');
    }
    getEnvironmentInfo() {
        return {
            nodeVersion: process.version,
            environment: this.config.server.environment,
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
        };
    }
    reloadConfiguration() {
        logger_1.LoggerService.info('Reloading configuration...');
        this.config = this.loadConfiguration();
        this.validateConfiguration();
        logger_1.LoggerService.info('Configuration reloaded successfully');
    }
}
exports.ConfigManager = ConfigManager;
// Export singleton instance
exports.configManager = ConfigManager.getInstance();
//# sourceMappingURL=config-manager.js.map